import fs from 'fs';
import path from 'path';
import { calculateCosineSimilarity } from './embeddings.js';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'pgvector_db.json');

/**
 * PostgreSQL + pgvector Schema DDL Definition string for system visibility.
 */
export const PGVECTOR_SCHEMA_DDL = `-- PostgreSQL + pgvector Extension Setup
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INT NOT NULL,
  page_count INT DEFAULT 0,
  chunk_count INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'PROCESSING',
  chunk_size INT DEFAULT 1000,
  chunk_overlap INT DEFAULT 200,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Document Pages Table
CREATE TABLE IF NOT EXISTS document_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  text TEXT NOT NULL,
  word_count INT NOT NULL,
  character_count INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Document Chunks Table with pgvector vector(768) Column
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  page_number INT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding vector(768), -- pgvector dense vector column
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Vector Index for Fast Cosine Distance Retrieval
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Full-text Search Index for Hybrid BM25 / Keyword Search
CREATE INDEX IF NOT EXISTS document_chunks_content_fts_idx 
ON document_chunks 
USING gin (to_tsvector('english', content));

-- 5. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  sources JSONB,
  is_refusal BOOLEAN DEFAULT FALSE,
  groundedness_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Citations Table
CREATE TABLE IF NOT EXISTS citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  chunk_index INT NOT NULL,
  snippet TEXT NOT NULL,
  similarity_score FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export class VectorStore {
  constructor() {
    this.state = {
      documents: {},
      chunks: {},
      conversations: {},
      evalBenchmarks: {},
      evalRuns: {},
    };
    this.initStorage();
    this.seedDefaultBenchmarks();
  }

  initStorage() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.state = JSON.parse(raw);
      } catch (err) {
        console.warn('Could not parse database file, resetting state:', err);
      }
    } else {
      this.saveState();
    }
  }

  saveState() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save vector database state:', err);
    }
  }

  // --- Document Operations ---
  saveDocument(doc) {
    this.state.documents[doc.id] = doc;
    this.saveState();
  }

  getDocument(id) {
    return this.state.documents[id];
  }

  getAllDocuments() {
    return Object.values(this.state.documents).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  deleteDocument(id) {
    if (!this.state.documents[id]) return false;
    delete this.state.documents[id];

    // Delete associated chunks
    for (const chunkId of Object.keys(this.state.chunks)) {
      if (this.state.chunks[chunkId].document_id === id) {
        delete this.state.chunks[chunkId];
      }
    }
    this.saveState();
    return true;
  }

  // --- Chunk Operations ---
  saveChunks(chunks) {
    for (const chunk of chunks) {
      this.state.chunks[chunk.id] = chunk;
    }
    this.saveState();
  }

  getDocumentChunks(documentId) {
    return Object.values(this.state.chunks)
      .filter((c) => c.document_id === documentId)
      .sort((a, b) => a.chunk_index - b.chunk_index);
  }

  deleteDocumentChunks(documentId) {
    for (const chunkId of Object.keys(this.state.chunks)) {
      if (this.state.chunks[chunkId].document_id === documentId) {
        delete this.state.chunks[chunkId];
      }
    }
    this.saveState();
  }

  getAllChunks() {
    return Object.values(this.state.chunks);
  }

  /**
   * Performs vector similarity search over stored chunks using Cosine Distance (<=> operator in pgvector).
   * SELECT content, page_number, 1 - (embedding <=> $query_vector) AS similarity_score
   * FROM document_chunks
   * ORDER BY embedding <=> $query_vector
   * LIMIT $top_k;
   */
  queryVectorDistance(queryEmbedding, topK = 5, documentIdFilter) {
    const candidateChunks = Object.values(this.state.chunks).filter((chunk) => {
      if (documentIdFilter && chunk.document_id !== documentIdFilter) {
        return false;
      }
      return chunk.embedding && chunk.embedding.length > 0;
    });

    const scoredResults = candidateChunks.map((chunk) => {
      const sim = calculateCosineSimilarity(queryEmbedding, chunk.embedding);
      const cosDistance = 1.0 - sim;
      return {
        chunk,
        similarityScore: sim,
        cosineDistance: cosDistance,
        rank: 0,
      };
    });

    // Sort by highest similarity score (smallest cosine distance)
    scoredResults.sort((a, b) => b.similarityScore - a.similarityScore);

    // Take topK
    const topResults = scoredResults.slice(0, topK);
    topResults.forEach((res, index) => {
      res.rank = index + 1;
    });

    return topResults;
  }

  getActiveEmbeddingMode() {
    return this.state.embeddingMode;
  }

  setActiveEmbeddingMode(mode) {
    this.state.embeddingMode = mode;
    this.saveState();
  }

  getEmbeddingDimension() {
    const chunk = Object.values(this.state.chunks).find(
      (c) => Array.isArray(c.embedding) && c.embedding.length > 0
    );
    return chunk?.embedding?.length || 768;
  }

  // --- Conversation & Message Operations ---
  saveConversation(conv) {
    this.state.conversations[conv.id] = conv;
    this.saveState();
  }

  getConversation(id) {
    return this.state.conversations[id];
  }

  getAllConversations() {
    return Object.values(this.state.conversations).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  deleteConversation(id) {
    if (!this.state.conversations[id]) return false;
    delete this.state.conversations[id];
    this.saveState();
    return true;
  }

  addMessageToConversation(conversationId, message) {
    let conv = this.state.conversations[conversationId];
    if (!conv) {
      conv = {
        id: conversationId,
        title: message.text.slice(0, 40) + '...',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    conv.messages.push(message);
    conv.updatedAt = new Date().toISOString();
    this.state.conversations[conversationId] = conv;
    this.saveState();
    return conv;
  }

  // --- Evaluation Benchmarks & Runs ---
  getEvalBenchmarks() {
    return Object.values(this.state.evalBenchmarks);
  }

  saveEvalBenchmark(item) {
    this.state.evalBenchmarks[item.id] = item;
    this.saveState();
  }

  saveEvalRunReport(report) {
    this.state.evalRuns[report.id] = report;
    this.saveState();
  }

  getEvalRunReports() {
    return Object.values(this.state.evalRuns).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  seedDefaultBenchmarks() {
    if (Object.keys(this.state.evalBenchmarks).length > 0) return;

    const defaults = [
      {
        id: 'bm_01',
        question: 'What is the core architecture mechanism of Retrieval-Augmented Generation?',
        expectedAnswer: 'RAG combines vector embedding retrieval over indexed document chunks with an LLM generation phase to ground answers in verified external knowledge.',
        expectedDocumentName: 'rag_architecture.pdf',
        expectedPage: 1,
        category: 'synthesis',
      },
      {
        id: 'bm_02',
        question: 'How does chunk overlap prevent context fragmentation?',
        expectedAnswer: 'Chunk overlap preserves semantic context and entity relationships that cross chunk boundary boundaries so facts are not cut in half.',
        expectedDocumentName: 'chunking_guide.docx',
        expectedPage: 2,
        category: 'factual',
      },
      {
        id: 'bm_03',
        question: 'What is the capital of Mars?',
        expectedAnswer: 'I couldn\'t find enough information in the uploaded documents to answer this reliably.',
        expectedDocumentName: 'none',
        expectedPage: 0,
        category: 'out_of_domain',
      },
      {
        id: 'bm_04',
        question: 'Why does hybrid search combine BM25 and vector embeddings?',
        expectedAnswer: 'Hybrid search combines keyword precision (BM25 for exact terms, acronyms, IDs) with dense vector semantic understanding using Reciprocal Rank Fusion.',
        expectedDocumentName: 'hybrid_search.pdf',
        expectedPage: 3,
        category: 'synthesis',
      },
    ];

    for (const item of defaults) {
      this.state.evalBenchmarks[item.id] = item;
    }
    this.saveState();
  }
}

export const vectorStore = new VectorStore();
