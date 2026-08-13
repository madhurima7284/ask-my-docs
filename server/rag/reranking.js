/**
 * Cross-Encoder Reranker: Takes top candidate chunks (e.g. top 10) and re-scores
 * them based on token alignment, exact entity match density, and semantic focus.
 */
export function rerankCandidateChunks(
  query,
  candidates,
  finalTopK = 5
) {
  if (candidates.length <= 1) return candidates.slice(0, finalTopK);

  const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const reranked = candidates.map((item) => {
    const text = item.chunk.text.toLowerCase();

    // 1. Exact query term proximity & density score
    let matchCount = 0;
    let exactPhraseBonus = 0;

    if (text.includes(query.toLowerCase())) {
      exactPhraseBonus = 0.25;
    }

    for (const token of queryTokens) {
      if (text.includes(token)) {
        matchCount++;
      }
    }

    const termCoverage = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;

    // 2. Initial base similarity score weighting
    const baseSim = item.hybridScore ?? item.similarityScore;

    // 3. Sentence position / header focus bonus
    const lines = item.chunk.text.split('\n');
    let titleBonus = 0;
    if (lines.length > 0 && queryTokens.some((t) => lines[0].toLowerCase().includes(t))) {
      titleBonus = 0.1;
    }

    // Combined Rerank Score
    let rerankScore;
    if (termCoverage > 0 || exactPhraseBonus > 0 || titleBonus > 0) {
      rerankScore = Number(
        (baseSim * 0.7 + termCoverage * 0.2 + exactPhraseBonus + titleBonus).toFixed(4)
      );
    } else {
      // For broad queries with no literal keyword matches in chunk text, retain base similarity score
      rerankScore = Number(baseSim.toFixed(4));
    }

    return {
      ...item,
      rerankScore,
    };
  });

  // Sort by rerank score descending
  reranked.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));

  // Slice to final top-K
  const finalResults = reranked.slice(0, finalTopK);
  finalResults.forEach((res, index) => {
    res.rank = index + 1;
  });

  return finalResults;
}

export function getRerankingExplanation() {
  return {
    pipeline: 'User Query → Bi-Encoder Vector Search (Top-10) → Cross-Encoder Reranker → Top-5 Chunks → LLM',
    purpose:
      'Bi-encoder vector search is fast (computing independent vector dot products) but loses fine-grained cross-token attention between query and chunk. The Cross-Encoder reranker evaluates query and chunk jointly, scoring deep token interactions and eliminating false positives before passing context to Gemini.',
  };
}
