import express from 'express';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { extractDocumentText } from './server/rag/extraction.js';
import { chunkDocumentPages, getChunkingRationale } from './server/rag/chunking.js';
import {
  generateBatchEmbeddings,
  generateEmbedding,
  getEmbeddingExplanation,
} from './server/rag/embeddings.js';
import {
  PGVECTOR_SCHEMA_DDL,
  vectorStore,
} from './server/rag/pgvector_store.js';
import { performHybridSearch, getHybridSearchExplanation } from './server/rag/hybrid_search.js';
import { rerankCandidateChunks, getRerankingExplanation } from './server/rag/reranking.js';
import { checkRetrievalGroundedness, GROUNDEDNESS_REFUSAL_MESSAGE } from './server/rag/groundedness.js';
import { generateGroundedAnswerStream } from './server/rag/generation.js';
import { runRagEvaluationSuite } from './server/rag/evaluation.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max file size
});

// Default RAG Pipeline Settings State
let currentSettings = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.35,
  enableHybridSearch: true,
  hybridAlpha: 0.6,
  enableReranking: true,
  rerankTopK: 10,
  groundednessThreshold: 0.35,
  temperature: 0.2,
  embeddingModel: 'gemini-embedding-2-preview',
  llmModel: 'gemini-3.6-flash',
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // RAG Settings
  app.get('/api/settings', (req, res) => {
    res.json({
      settings: currentSettings,
      rationale: getChunkingRationale(),
      embeddingExplanation: getEmbeddingExplanation(),
      hybridExplanation: getHybridSearchExplanation(),
      rerankingExplanation: getRerankingExplanation(),
    });
  });

  app.post('/api/settings', (req, res) => {
    currentSettings = { ...currentSettings, ...req.body };
    res.json({ status: 'success', settings: currentSettings });
  });

  // Vector Schema DDL
  app.get('/api/schema/ddl', (req, res) => {
    res.json({ ddl: PGVECTOR_SCHEMA_DDL });
  });

  // 1. Upload Document (POST /api/documents/upload)
  app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const originalName = req.file.originalname;
      const fileExt = path.extname(originalName).toLowerCase();
      let fileType = 'txt';

      if (fileExt === '.pdf') fileType = 'pdf';
      else if (fileExt === '.docx') fileType = 'docx';
      else if (fileExt === '.txt' || fileExt === '.md') fileType = 'txt';
      else {
        res.status(400).json({ error: 'Unsupported file type. Please upload PDF, DOCX, or TXT.' });
        return;
      }

      const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Initial record
      const docRecord = {
        id: docId,
        name: originalName,
        originalName,
        fileType,
        fileSize: req.file.size,
        pageCount: 0,
        chunkCount: 0,
        status: 'PROCESSING',
        chunkSize: currentSettings.chunkSize,
        chunkOverlap: currentSettings.chunkOverlap,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: [],
      };

      vectorStore.saveDocument(docRecord);

      // Process document synchronously (await indexing) so client receives completed status
      try {
        await processDocumentAsync(docRecord, req.file.buffer);
        res.status(200).json({
          message: 'Document uploaded and indexed successfully',
          document: docRecord,
        });
      } catch (procErr) {
        console.error(`Error processing document ${docId}:`, procErr);
        docRecord.status = 'FAILED';
        docRecord.errorMessage = procErr.message || 'Processing failed';
        vectorStore.saveDocument(docRecord);
        res.status(500).json({
          error: `Indexing failed: ${procErr.message || 'Processing failed'}`,
          document: docRecord,
        });
      }
    } catch (err) {
      console.error('Upload endpoint error:', err);
      res.status(500).json({ error: err.message || 'Upload failed' });
    }
  });

  // 2. Get All Documents (GET /api/documents)
  app.get('/api/documents', (req, res) => {
    const docs = vectorStore.getAllDocuments();
    res.json({ documents: docs });
  });

  // 3. Get Single Document (GET /api/documents/:id)
  app.get('/api/documents/:id', (req, res) => {
    const doc = vectorStore.getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    const chunks = vectorStore.getDocumentChunks(req.params.id);
    res.json({ document: doc, chunks });
  });

  // 4. Delete Document (DELETE /api/documents/:id)
  app.delete('/api/documents/:id', (req, res) => {
    const success = vectorStore.deleteDocument(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ success: true, message: 'Document deleted' });
  });

  // 5. Re-index Document with custom chunking parameters (POST /api/documents/:id/index)
  app.post('/api/documents/:id/index', async (req, res) => {
    const doc = vectorStore.getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const { chunkSize = currentSettings.chunkSize, chunkOverlap = currentSettings.chunkOverlap } = req.body;

    try {
      doc.status = 'INDEXING';
      doc.chunkSize = chunkSize;
      doc.chunkOverlap = chunkOverlap;
      vectorStore.saveDocument(doc);

      // Clear existing chunks for this document
      vectorStore.deleteDocumentChunks(doc.id);

      // Re-chunk pages
      const newChunks = chunkDocumentPages(
        doc.pages,
        doc.id,
        doc.name,
        doc.fileType,
        { chunkSize, chunkOverlap }
      );

      // Re-embed chunks
      const texts = newChunks.map((c) => c.text);
      const { embeddings, mode } = await generateBatchEmbeddings(texts);

      for (let i = 0; i < newChunks.length; i++) {
        newChunks[i].embedding = embeddings[i];
      }

      vectorStore.setActiveEmbeddingMode(mode);
      vectorStore.saveChunks(newChunks);

      doc.chunkCount = newChunks.length;
      doc.status = 'READY';
      doc.updatedAt = new Date().toISOString();
      vectorStore.saveDocument(doc);

      res.json({
        message: 'Document re-indexed successfully',
        document: doc,
        chunkCount: newChunks.length,
      });
    } catch (err) {
      console.error('Re-index error:', err);
      doc.status = 'FAILED';
      doc.errorMessage = err.message || 'Re-indexing failed';
      vectorStore.saveDocument(doc);
      res.status(500).json({ error: err.message || 'Re-indexing failed' });
    }
  });

  // --- DEBUG ENDPOINTS ---

  // GET /api/debug/rag
  app.get('/api/debug/rag', (req, res) => {
    const docs = vectorStore.getAllDocuments();
    const chunks = vectorStore.getAllChunks();
    const indexedChunks = chunks.filter(
      (c) => Array.isArray(c.embedding) && c.embedding.length > 0
    );
    const dimension = vectorStore.getEmbeddingDimension();

    res.json({
      documents: docs.length,
      chunks: chunks.length,
      faiss_exists: indexedChunks.length > 0,
      faiss_vectors: indexedChunks.length,
      metadata_entries: chunks.filter((c) => !!c.metadata).length,
      embedding_dimension: dimension,
    });
  });

  // POST /api/debug/retrieve
  app.post('/api/debug/retrieve', async (req, res) => {
    const { question, filterDocumentId } = req.body;
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Question string is required' });
      return;
    }

    try {
      const activeModeRaw = vectorStore.getActiveEmbeddingMode();
      const preferredMode = activeModeRaw === 'fallback-768' ? 'fallback-768' : 'gemini-embedding-2-preview';
      const { embedding: queryEmbedding } = await generateEmbedding(question, preferredMode);

      const docDim = vectorStore.getEmbeddingDimension();
      const queryDim = queryEmbedding.length;
      const indexDim = vectorStore.getEmbeddingDimension();

      console.log(`
[DEBUG RETRIEVE]
question: ${question}
document embedding dimension: ${docDim}
question embedding dimension: ${queryDim}
FAISS index dimension: ${indexDim}
`);

      let candidates = vectorStore.queryVectorDistance(
        queryEmbedding,
        currentSettings.rerankTopK,
        filterDocumentId
      );

      const allChunks = vectorStore.getAllChunks();
      if (currentSettings.enableHybridSearch && candidates.length > 0) {
        candidates = performHybridSearch(
          candidates,
          question,
          allChunks,
          currentSettings.hybridAlpha
        );
      }

      if (currentSettings.enableReranking && candidates.length > 0) {
        candidates = rerankCandidateChunks(question, candidates, currentSettings.topK);
      } else {
        candidates = candidates.slice(0, currentSettings.topK);
      }

      const results = candidates.map((c) => ({
        document: c.chunk.metadata.document_name || c.chunk.document_id,
        page: c.chunk.metadata.page || c.chunk.page,
        score: Number((c.rerankScore ?? c.hybridScore ?? c.similarityScore).toFixed(4)),
        text_preview: c.chunk.text.slice(0, 150) + (c.chunk.text.length > 150 ? '...' : ''),
      }));

      res.json({
        question,
        results,
      });
    } catch (err) {
      console.error('Debug retrieve endpoint error:', err);
      res.status(500).json({ error: err.message || 'Retrieval failed' });
    }
  });

  function isBroadQuery(question) {
    const q = question.toLowerCase().trim();
    const broadPhrases = [
      'analyze', 'summary', 'summarize', 'overview', 'about',
      'resume', 'cv', 'document', 'file', 'candidate', 'skills',
      'experience', 'background', 'profile', 'what is this',
      'tell me about', 'describe', 'content', 'details', 'who is',
      'key points', 'main points', 'highlights', 'work history'
    ];
    return broadPhrases.some((phrase) => q.includes(phrase)) || q.length <= 20;
  }

  // 6. Streaming Chat Q&A Endpoint (POST /api/chat) via SSE
  app.post('/api/chat', async (req, res) => {
    const { question, conversationId, filterDocumentId } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    // Set Server-Sent Events (SSE) headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const convId = conversationId || `conv_${Date.now()}`;
    const startTime = Date.now();

    try {
      const isBroad = isBroadQuery(question);

      // 1. Question Embedding
      const activeModeRaw = vectorStore.getActiveEmbeddingMode();
      const preferredMode = activeModeRaw === 'fallback-768' ? 'fallback-768' : 'gemini-embedding-2-preview';
      const { embedding: queryEmbedding } = await generateEmbedding(question, preferredMode);
      const embedLatency = Date.now() - startTime;

      const docDim = vectorStore.getEmbeddingDimension();
      const queryDim = queryEmbedding.length;
      const indexDim = vectorStore.getEmbeddingDimension();

      console.log(`
document embedding dimension: ${docDim}
question embedding dimension: ${queryDim}
FAISS index dimension: ${indexDim}
`);

      // 2. Vector Retrieval
      const retrieveStart = Date.now();
      let candidates = vectorStore.queryVectorDistance(
        queryEmbedding,
        currentSettings.rerankTopK,
        filterDocumentId
      );

      // 3. Optional Hybrid Search
      const allChunks = vectorStore.getAllChunks();
      if (currentSettings.enableHybridSearch && candidates.length > 0) {
        candidates = performHybridSearch(
          candidates,
          question,
          allChunks,
          currentSettings.hybridAlpha
        );
      }

      // 4. Optional Reranking
      if (currentSettings.enableReranking && candidates.length > 0) {
        candidates = rerankCandidateChunks(question, candidates, currentSettings.topK);
      } else {
        candidates = candidates.slice(0, currentSettings.topK);
      }

      const retrievalLatency = Date.now() - retrieveStart;

      const similarityScores = candidates.map((c) =>
        Number((c.rerankScore ?? c.hybridScore ?? c.similarityScore).toFixed(4))
      );
      const docNames = Array.from(new Set(candidates.map((c) => c.chunk.metadata.document_name)));
      const pageNums = Array.from(new Set(candidates.map((c) => c.chunk.metadata.page)));

      console.log(`
[QUESTION]
question: ${question}
top_k: ${currentSettings.topK}
retrieved chunks: ${candidates.length}
similarity scores: ${JSON.stringify(similarityScores)}
retrieved document names: ${JSON.stringify(docNames)}
retrieved page numbers: ${JSON.stringify(pageNums)}
`);

      // 5. Groundedness / Hallucination Check
      const groundedCheck = checkRetrievalGroundedness(
        candidates,
        currentSettings.groundednessThreshold,
        isBroad
      );

      // Send initial SSE event with metadata and retrieved sources
      res.write(
        `data: ${JSON.stringify({
          type: 'metadata',
          conversationId: convId,
          retrievedSources: candidates,
          groundedness: groundedCheck,
          latencies: { embedMs: embedLatency, retrievalMs: retrievalLatency },
        })}\n\n`
      );

      // 6. Get conversation history
      const existingConv = vectorStore.getConversation(convId);
      const history = existingConv ? existingConv.messages : [];

      // 7. Grounded LLM Generation Stream
      const genStart = Date.now();
      const userMessage = {
        id: `msg_u_${Date.now()}`,
        conversationId: convId,
        sender: 'user',
        text: question,
        createdAt: new Date().toISOString(),
      };
      vectorStore.addMessageToConversation(convId, userMessage);

      const genResult = await generateGroundedAnswerStream({
        question,
        retrievedSources: candidates,
        conversationHistory: history,
        isRefusal: !groundedCheck.isGrounded,
        onChunk: (chunkText) => {
          res.write(`data: ${JSON.stringify({ type: 'token', text: chunkText })}\n\n`);
        },
      });

      const genLatency = Date.now() - genStart;

      const assistantMessage = {
        id: `msg_a_${Date.now()}`,
        conversationId: convId,
        sender: 'assistant',
        text: genResult.fullText,
        sources: candidates,
        citations: genResult.citations,
        isRefusal: !groundedCheck.isGrounded,
        groundednessScore: groundedCheck.maxScore,
        retrievalLatencyMs: retrievalLatency,
        generationLatencyMs: genLatency,
        createdAt: new Date().toISOString(),
      };

      vectorStore.addMessageToConversation(convId, assistantMessage);

      // Send final SSE completion event
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          message: assistantMessage,
        })}\n\n`
      );
      res.end();
    } catch (err) {
      console.error('Chat endpoint error:', err);
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: err.message || 'Error executing chat response',
        })}\n\n`
      );
      res.end();
    }
  });

  // 7. Get All Conversations (GET /api/conversations)
  app.get('/api/conversations', (req, res) => {
    const convs = vectorStore.getAllConversations();
    res.json({ conversations: convs });
  });

  // 8. Get Single Conversation (GET /api/conversations/:id)
  app.get('/api/conversations/:id', (req, res) => {
    const conv = vectorStore.getConversation(req.params.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ conversation: conv });
  });

  // 9. Delete Conversation (DELETE /api/conversations/:id)
  app.delete('/api/conversations/:id', (req, res) => {
    const success = vectorStore.deleteConversation(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ success: true, message: 'Conversation deleted' });
  });

  // 10. Evaluation Endpoints
  app.get('/api/eval/benchmarks', (req, res) => {
    const benchmarks = vectorStore.getEvalBenchmarks();
    res.json({ benchmarks });
  });

  app.post('/api/eval/run', async (req, res) => {
    try {
      const report = await runRagEvaluationSuite(currentSettings);
      res.json({ report });
    } catch (err) {
      console.error('Eval run error:', err);
      res.status(500).json({ error: err.message || 'Evaluation run failed' });
    }
  });

  app.get('/api/eval/runs', (req, res) => {
    const runs = vectorStore.getEvalRunReports();
    res.json({ runs });
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ask My Docs server running on http://0.0.0.0:${PORT}`);
  });
}

/**
 * Async pipeline worker to process document upload
 */
async function processDocumentAsync(doc, buffer) {
  // Step 1: Extract Text & Pages
  doc.status = 'PROCESSING';
  vectorStore.saveDocument(doc);

  const extracted = await extractDocumentText(buffer, doc.fileType, doc.originalName);
  doc.pages = extracted.pages;
  doc.pageCount = extracted.pageCount;

  // Step 2: Chunk Document
  doc.status = 'INDEXING';
  vectorStore.saveDocument(doc);

  const chunks = chunkDocumentPages(
    extracted.pages,
    doc.id,
    doc.name,
    doc.fileType,
    {
      chunkSize: doc.chunkSize,
      chunkOverlap: doc.chunkOverlap,
    }
  );

  // Step 3: Generate Embeddings
  const texts = chunks.map((c) => c.text);
  const { embeddings, mode } = await generateBatchEmbeddings(texts);

  for (let i = 0; i < chunks.length; i++) {
    chunks[i].embedding = embeddings[i];
  }

  // Step 4: Index into Vector Database
  vectorStore.setActiveEmbeddingMode(mode);
  vectorStore.saveChunks(chunks);

  doc.chunkCount = chunks.length;
  doc.status = 'READY';
  doc.updatedAt = new Date().toISOString();
  vectorStore.saveDocument(doc);

  const totalCharsExtracted = extracted.pages.reduce((sum, p) => sum + p.characterCount, 0);
  const totalVectorsInStore = vectorStore.getAllChunks().length;

  console.log(`
[UPLOAD]
filename: ${doc.name}
pages: ${doc.pageCount}
characters extracted: ${totalCharsExtracted}
chunks created: ${chunks.length}
embeddings created: ${embeddings.length}
vectors in FAISS: ${totalVectorsInStore}
`);
}

startServer();
