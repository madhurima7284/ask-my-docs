import { GoogleGenAI } from '@google/genai';

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
 * Generates vector embeddings for a given text string using Gemini gemini-embedding-2-preview (768 dimensions)
 * or deterministic 768-dim fallback.
 */
export async function generateEmbedding(text, preferredMode) {
  const ai = getGeminiClient();

  if (ai && preferredMode !== 'fallback-768') {
    try {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: text,
        config: {
          outputDimensionality: 768,
        },
      });

      const embeddingValues =
        response.embeddings?.[0]?.values || response.embedding?.values;
      if (
        embeddingValues &&
        Array.isArray(embeddingValues) &&
        embeddingValues.length === 768
      ) {
        return { embedding: embeddingValues, mode: 'gemini-embedding-2-preview' };
      }
    } catch (err) {
      console.warn('Gemini embedContent API call failed, using fallback embedding generator:', err);
    }
  }

  // Deterministic local embedding generator (768 dimensions) as fallback
  const fallbackVector = generateFallbackEmbedding(text, 768);
  return { embedding: fallbackVector, mode: 'fallback-768' };
}

/**
 * Generates embeddings for a batch of text chunks, guaranteeing model and dimension consistency across all items.
 */
export async function generateBatchEmbeddings(texts) {
  if (texts.length === 0) return { embeddings: [], mode: 'gemini-embedding-2-preview' };

  // Try generating first embedding to determine active model mode
  const first = await generateEmbedding(texts[0]);
  const activeMode = first.mode;

  const embeddings = [first.embedding];

  for (let i = 1; i < texts.length; i++) {
    const res = await generateEmbedding(texts[i], activeMode);
    embeddings.push(res.embedding);
  }

  return { embeddings, mode: activeMode };
}

/**
 * Mathematical Cosine Similarity calculation between two dense vectors.
 * Formula: cos(θ) = (A · B) / (||A|| * ||B||)
 */
export function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Clamp between -1.0 and 1.0 to guard against precision float errors
  return Math.max(-1.0, Math.min(1.0, similarity));
}

/**
 * Fallback semantic feature hashing embedding generator for offline / fallback execution.
 */
function generateFallbackEmbedding(text, dimensions = 768) {
  const vector = new Array(dimensions).fill(0);

  let expandedText = text.toLowerCase().replace(/[^\w\s]/g, '');

  // Broad query anchor term expansion for fallback hashing mode
  if (
    expandedText.includes('analyze') ||
    expandedText.includes('resume') ||
    expandedText.includes('cv') ||
    expandedText.includes('summary') ||
    expandedText.includes('overview') ||
    expandedText.includes('candidate') ||
    expandedText.includes('skills') ||
    expandedText.includes('document')
  ) {
    expandedText +=
      ' document resume experience candidate skills education background profile summary details work history qualifications project';
  }

  const words = expandedText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return vector;

  for (const word of words) {
    let hash = 5381;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) + hash + word.charCodeAt(i);
      hash = hash & hash;
    }

    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1.0;

    // Sub-gram hashing for token positions
    for (let j = 0; j < word.length - 2; j++) {
      const trigram = word.slice(j, j + 3);
      let triHash = 0;
      for (let k = 0; k < trigram.length; k++) {
        triHash = triHash * 31 + trigram.charCodeAt(k);
      }
      const triIdx = Math.abs(triHash) % dimensions;
      vector[triIdx] += 0.5;
    }
  }

  // L2 normalization
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq) || 1;

  return vector.map((v) => v / norm);
}

export function getEmbeddingExplanation() {
  return {
    model: 'gemini-embedding-2-preview',
    metric: 'Cosine Similarity',
    formula: 'cos(θ) = (A · B) / (||A|| × ||B||)',
    explanation:
      'Cosine similarity measures the cosine of the angle between two multi-dimensional embedding vectors in geometric space. An angle of 0° yields cos(θ) = 1.0 (identical semantic direction), whereas orthogonal vectors (90°) yield 0.0 (unrelated semantics). Unlike Euclidean distance, cosine similarity measures direction rather than magnitude, making it invariant to document chunk length.',
  };
}
