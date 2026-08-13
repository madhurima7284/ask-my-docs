import { GoogleGenAI } from '@google/genai';
import { GROUNDEDNESS_REFUSAL_MESSAGE } from './groundedness.js';

let aiInstance = null;

function getGeminiClient() {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

/**
 * Streams grounded answer generation from Gemini 3.6 Flash using retrieved context.
 */
export async function generateGroundedAnswerStream(params) {
  const { question, retrievedSources, conversationHistory = [], isRefusal = false, onChunk } = params;

  // If marked as ungrounded refusal, stream the standard refusal message immediately
  if (isRefusal || retrievedSources.length === 0) {
    onChunk(GROUNDEDNESS_REFUSAL_MESSAGE);
    return {
      fullText: GROUNDEDNESS_REFUSAL_MESSAGE,
      citations: [],
    };
  }

  // Format context block with strict document and page identifiers
  const contextFormatted = retrievedSources
    .map((src, idx) => {
      return `--- CONTEXT CHUNK [${idx + 1}] ---
Document: ${src.chunk.metadata.document_name}
Page Number: ${src.chunk.metadata.page}
Chunk Index: ${src.chunk.chunk_index}
Content:
${src.chunk.text}
`;
    })
    .join('\n\n');

  // Prepare citations metadata objects
  const citations = retrievedSources.map((src, idx) => ({
    id: `cit_${Date.now()}_${idx}`,
    documentId: src.chunk.document_id,
    documentName: src.chunk.metadata.document_name,
    pageNumber: src.chunk.metadata.page,
    chunkIndex: src.chunk.chunk_index,
    snippet: src.chunk.text,
    similarityScore: src.similarityScore,
  }));

  // Build conversation history string (last 6 messages max)
  const historySnippet = conversationHistory
    .slice(-6)
    .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
    .join('\n');

  const systemInstruction = `You are "Ask My Docs", a precision Document Question Answering AI.
YOUR PRIMARY DIRECTIVE IS STRICT GROUNDEDNESS.

RULES:
1. Answer the user's question USING ONLY the provided Context Chunks.
2. Every factual statement or claim MUST include inline citations referring to the source document and page number in exact format: [Source: <document_name>, Page <page_number>]. Example: "Self-attention enables token modeling [Source: transformer.pdf, Page 7]."
3. If the provided Context Chunks DO NOT contain sufficient information to directly answer the question, YOU MUST explicitly refuse by stating: "${GROUNDEDNESS_REFUSAL_MESSAGE}"
4. Do NOT invent facts, extrapolate beyond what is stated, or use outside knowledge.
5. Keep your tone professional, authoritative, and direct.`;

  const prompt = `CONVERSATION HISTORY:
${historySnippet || 'None'}

RETRIEVED DOCUMENT CONTEXT:
${contextFormatted}

USER QUESTION:
${question}

GROUNDED ANSWER WITH INLINE CITATIONS:`;

  const ai = getGeminiClient();

  if (!ai) {
    // Fallback streaming simulation if API key is not yet set
    const fallbackAns = generateFallbackGroundedAnswer(question, retrievedSources);
    for (const charChunk of chunkStringByLength(fallbackAns, 12)) {
      onChunk(charChunk);
      await new Promise((r) => setTimeout(r, 20));
    }
    return {
      fullText: fallbackAns,
      citations,
    };
  }

  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for factual precision
      },
    });

    let fullText = '';
    for await (const chunk of stream) {
      const text = chunk.text || '';
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }

    if (!fullText.trim()) {
      fullText = GROUNDEDNESS_REFUSAL_MESSAGE;
      onChunk(fullText);
    }

    return {
      fullText,
      citations,
    };
  } catch (err) {
    console.error('Gemini generateContentStream error:', err);
    const errorFallback = `Error connecting to Gemini LLM service: ${err.message || 'Unknown error'}. Falling back to retrieved chunk excerpts:\n\n` +
      retrievedSources.map(s => `• [Source: ${s.chunk.metadata.document_name}, Page ${s.chunk.metadata.page}]: ${s.chunk.text.slice(0, 180)}...`).join('\n\n');

    onChunk(errorFallback);
    return {
      fullText: errorFallback,
      citations,
    };
  }
}

function generateFallbackGroundedAnswer(question, sources) {
  if (sources.length === 0) return GROUNDEDNESS_REFUSAL_MESSAGE;

  const top = sources[0];
  return `Based on the provided document context, ${top.chunk.text.slice(0, 250)}... [Source: ${top.chunk.metadata.document_name}, Page ${top.chunk.metadata.page}]`;
}

function chunkStringByLength(str, length) {
  const result = [];
  for (let i = 0; i < str.length; i += length) {
    result.push(str.slice(i, i + length));
  }
  return result;
}
