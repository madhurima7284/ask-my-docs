/**
 * Checks whether retrieved sources meet the confidence threshold to ground an answer safely.
 */
export function checkRetrievalGroundedness(
  retrievedSources,
  threshold = 0.35,
  isBroadQuery = false
) {
  if (retrievedSources.length === 0) {
    return {
      isGrounded: false,
      maxScore: 0,
      averageScore: 0,
      refusalReason: 'No relevant document chunks found in vector database.',
    };
  }

  const scores = retrievedSources.map((s) =>
    Math.max(s.similarityScore, s.hybridScore ?? 0, s.rerankScore ?? 0)
  );

  const maxScore = Math.max(...scores);
  const sum = scores.reduce((acc, curr) => acc + curr, 0);
  const averageScore = sum / scores.length;

  const effectiveThreshold = isBroadQuery ? 0.01 : threshold;

  if (maxScore < effectiveThreshold) {
    return {
      isGrounded: false,
      maxScore,
      averageScore,
      refusalReason: `Top chunk similarity (${maxScore.toFixed(3)}) is below the required groundedness threshold (${effectiveThreshold}).`,
    };
  }

  return {
    isGrounded: true,
    maxScore,
    averageScore,
  };
}

export const GROUNDEDNESS_REFUSAL_MESSAGE =
  "I couldn't find enough information in the uploaded documents to answer this reliably. Please check if the relevant document has been uploaded and indexed.";
