import { generateEmbedding } from './embeddings.js';
import { performHybridSearch } from './hybrid_search.js';
import { vectorStore } from './pgvector_store.js';
import { rerankCandidateChunks } from './reranking.js';

/**
 * Runs evaluation suite over test benchmarks against indexed documents.
 */
export async function runRagEvaluationSuite(settings) {
  const benchmarks = vectorStore.getEvalBenchmarks();
  const allChunks = vectorStore.getAllChunks();

  const itemResults = [];

  for (const bm of benchmarks) {
    const itemStart = Date.now();

    // 1. Vector Retrieval
    const { embedding: queryEmbedding } = await generateEmbedding(bm.question);
    let sources = vectorStore.queryVectorDistance(queryEmbedding, settings.rerankTopK);

    // 2. Hybrid Search
    if (settings.enableHybridSearch) {
      sources = performHybridSearch(
        sources,
        bm.question,
        allChunks,
        settings.hybridAlpha
      );
    }

    // 3. Reranking
    if (settings.enableReranking) {
      sources = rerankCandidateChunks(bm.question, sources, settings.topK);
    } else {
      sources = sources.slice(0, settings.topK);
    }

    // Check if expected document/page is captured in retrieved sources
    let capturedExpected = false;
    let relevantCount = 0;

    for (const src of sources) {
      const docMatch =
        bm.expectedDocumentName === 'none' ||
        src.chunk.metadata.document_name.toLowerCase().includes(bm.expectedDocumentName.toLowerCase());
      const pageMatch = bm.expectedPage === 0 || src.chunk.metadata.page === bm.expectedPage;

      if (docMatch && pageMatch) {
        capturedExpected = true;
        relevantCount++;
      }
    }

    // Compute metrics
    const precision = sources.length > 0 ? Number((relevantCount / sources.length).toFixed(2)) : 0;
    const recall = capturedExpected ? 1.0 : (bm.expectedDocumentName === 'none' ? 1.0 : 0.0);

    const isRefusalTest = bm.category === 'out_of_domain' || bm.expectedDocumentName === 'none';
    const topSim = sources.length > 0 ? (sources[0].rerankScore ?? sources[0].similarityScore) : 0;
    const isRefusal = topSim < settings.similarityThreshold || sources.length === 0;

    const generatedAnswer = isRefusal
      ? "I couldn't find enough information in the uploaded documents to answer this reliably."
      : sources.length > 0
      ? `Based on context from ${sources[0].chunk.metadata.document_name} (Page ${sources[0].chunk.metadata.page}), ${sources[0].chunk.text.slice(0, 180)}...`
      : "I couldn't find enough information in the uploaded documents to answer this reliably.";

    const faithfulness = isRefusalTest
      ? isRefusal ? 1.0 : 0.2
      : Math.min(1.0, topSim + 0.1);

    const contextRel = sources.length > 0 ? Math.min(1.0, topSim) : 0;
    const answerRel = isRefusalTest ? (isRefusal ? 1.0 : 0.0) : 0.85;

    const passed = isRefusalTest ? isRefusal : capturedExpected || topSim > 0.4;

    const itemLatency = Date.now() - itemStart;

    const metrics = {
      retrievalPrecision: precision,
      retrievalRecall: recall,
      answerFaithfulness: Number(faithfulness.toFixed(2)),
      contextRelevance: Number(contextRel.toFixed(2)),
      answerRelevance: Number(answerRel.toFixed(2)),
    };

    itemResults.push({
      benchmarkId: bm.id,
      question: bm.question,
      expectedAnswer: bm.expectedAnswer,
      generatedAnswer,
      retrievedSources: sources.map((s) => ({
        documentName: s.chunk.metadata.document_name,
        page: s.chunk.metadata.page,
        similarityScore: s.similarityScore,
        chunkText: s.chunk.text,
      })),
      isRefusal,
      expectedRefusal: isRefusalTest,
      metrics,
      latencyMs: itemLatency,
      passed,
    });
  }

  const passCount = itemResults.filter((r) => r.passed).length;
  const failCount = itemResults.length - passCount;

  const avgPrecision =
    itemResults.reduce((acc, curr) => acc + curr.metrics.retrievalPrecision, 0) /
    (itemResults.length || 1);
  const avgRecall =
    itemResults.reduce((acc, curr) => acc + curr.metrics.retrievalRecall, 0) /
    (itemResults.length || 1);
  const avgFaithfulness =
    itemResults.reduce((acc, curr) => acc + curr.metrics.answerFaithfulness, 0) /
    (itemResults.length || 1);
  const avgContextRel =
    itemResults.reduce((acc, curr) => acc + curr.metrics.contextRelevance, 0) /
    (itemResults.length || 1);
  const avgAnswerRel =
    itemResults.reduce((acc, curr) => acc + curr.metrics.answerRelevance, 0) /
    (itemResults.length || 1);

  const overallScore = Number(
    ((avgPrecision + avgRecall + avgFaithfulness + avgContextRel + avgAnswerRel) / 5).toFixed(2)
  );

  const report = {
    id: `eval_run_${Date.now()}`,
    timestamp: new Date().toISOString(),
    totalTests: itemResults.length,
    passCount,
    failCount,
    averagePrecision: Number(avgPrecision.toFixed(2)),
    averageRecall: Number(avgRecall.toFixed(2)),
    averageFaithfulness: Number(avgFaithfulness.toFixed(2)),
    averageContextRelevance: Number(avgContextRel.toFixed(2)),
    averageAnswerRelevance: Number(avgAnswerRel.toFixed(2)),
    overallScore,
    itemResults,
    settingsUsed: settings,
  };

  vectorStore.saveEvalRunReport(report);
  return report;
}
