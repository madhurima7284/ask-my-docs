/**
 * Calculates BM25 score for a document chunk relative to query terms.
 * BM25 formula:
 * score(D, Q) = ∑ IDF(q_i) * [ f(q_i, D) * (k1 + 1) ] / [ f(q_i, D) + k1 * (1 - b + b * (|D| / avgdl)) ]
 */
export function calculateBM25Score(
  query,
  chunkText,
  allChunks,
  k1 = 1.5,
  b = 0.75
) {
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (queryTerms.length === 0) return 0;

  const chunkWords = chunkText.toLowerCase().split(/\s+/).filter(Boolean);
  const docLen = chunkWords.length;
  if (docLen === 0) return 0;

  // Compute average document length across corpus
  let totalWords = 0;
  for (const c of allChunks) {
    totalWords += c.text.split(/\s+/).filter(Boolean).length;
  }
  const avgdl = allChunks.length > 0 ? totalWords / allChunks.length : 100;

  let totalBm25 = 0;
  const N = Math.max(1, allChunks.length);

  for (const term of queryTerms) {
    // Term Frequency in chunk
    let tf = 0;
    for (const w of chunkWords) {
      if (w.includes(term) || term.includes(w)) {
        tf += 1;
      }
    }

    if (tf === 0) continue;

    // Document Frequency across corpus
    let df = 0;
    for (const c of allChunks) {
      if (c.text.toLowerCase().includes(term)) {
        df += 1;
      }
    }

    // Inverse Document Frequency (IDF)
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1.0);

    // BM25 term score calculation
    const termScore =
      idf *
      ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgdl))));

    totalBm25 += termScore;
  }

  return totalBm25;
}

/**
 * Executes Hybrid Search combining Vector Cosine Retrieval and Keyword BM25 Search
 * via Reciprocal Rank Fusion (RRF) and Alpha Weighting.
 */
export function performHybridSearch(
  vectorResults,
  query,
  allChunks,
  alpha = 0.5, // 0.0 = BM25 only, 1.0 = Vector only
  kRrf = 60
) {
  if (vectorResults.length === 0) return [];

  // Compute BM25 scores for all vector candidate chunks
  const bm25Scored = vectorResults.map((vRes) => {
    const rawBm25 = calculateBM25Score(query, vRes.chunk.text, allChunks);
    return {
      vRes,
      rawBm25,
    };
  });

  // Sort by BM25 to compute BM25 rank
  const bm25Sorted = [...bm25Scored].sort((a, b) => b.rawBm25 - a.rawBm25);
  const bm25RankMap = new Map();
  let maxBm25 = 0;

  bm25Sorted.forEach((item, index) => {
    bm25RankMap.set(item.vRes.chunk.id, index + 1);
    if (item.rawBm25 > maxBm25) maxBm25 = item.rawBm25;
  });

  // Combine scores using alpha weighting & RRF
  const hybridResults = bm25Scored.map((item) => {
    const chunkId = item.vRes.chunk.id;
    const vecRank = item.vRes.rank;
    const bm25Rank = bm25RankMap.get(chunkId) || vectorResults.length;

    let alphaScore;
    let normalizedBm25 = 0;

    if (maxBm25 > 0 && item.rawBm25 > 0) {
      normalizedBm25 = Math.min(1.0, item.rawBm25 / maxBm25);
      alphaScore = alpha * item.vRes.similarityScore + (1 - alpha) * normalizedBm25;
    } else {
      alphaScore = item.vRes.similarityScore;
    }

    // Reciprocal Rank Fusion (RRF)
    const rrfScore = 1 / (kRrf + vecRank) + 1 / (kRrf + bm25Rank);

    const finalHybridScore = maxBm25 > 0
      ? Number((alphaScore * 0.7 + rrfScore * 30 * 0.3).toFixed(4))
      : Number(item.vRes.similarityScore.toFixed(4));

    return {
      ...item.vRes,
      bm25Score: Number(normalizedBm25.toFixed(4)),
      hybridScore: finalHybridScore,
    };
  });

  // Sort by hybrid combined score
  hybridResults.sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0));

  // Re-assign final rank
  hybridResults.forEach((res, idx) => {
    res.rank = idx + 1;
  });

  return hybridResults;
}

export function getHybridSearchExplanation() {
  return {
    concept:
      'Hybrid Search merges dense semantic vector retrieval (capturing context and synonyms) with sparse lexical search (BM25/TF-IDF capturing exact keyword matches, serial numbers, product IDs, and rare proper nouns).',
    whyHybrid:
      'Pure vector search can fail on exact keyword queries (e.g. searching for error code "ERR_9021" or exact ISBN numbers) because dense embeddings map numbers into similar abstract spaces. BM25 guarantees keyword matches, while vector search handles semantic intent.',
    rrfFormula:
      'RRF(d) = 1 / (60 + rank_vector(d)) + 1 / (60 + rank_bm25(d))',
  };
}
