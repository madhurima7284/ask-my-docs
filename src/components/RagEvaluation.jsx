import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  FileCheck,
} from 'lucide-react';

export const RagEvaluation = () => {
  const [reports, setReports] = useState([]);
  const [latestReport, setLatestReport] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    fetch('/api/eval/runs')
      .then((res) => res.json())
      .then((data) => {
        if (data.runs && data.runs.length > 0) {
          setReports(data.runs);
          setLatestReport(data.runs[0]);
        }
      })
      .catch((err) => console.error('Failed to load eval runs:', err));
  }, []);

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/eval/run', { method: 'POST' });
      const data = await res.json();
      if (data.report) {
        setLatestReport(data.report);
        setReports((prev) => [data.report, ...prev]);
      }
    } catch (err) {
      console.error('Eval run failed:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded-md border border-slate-200">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
              <span>Retrieval & Accuracy Benchmarks</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Run benchmark test cases to measure precision, recall, answer faithfulness, and response latency.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunEvaluation}
          disabled={isRunning}
          className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2 rounded-md text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isRunning ? 'Running Benchmarks...' : 'Run Benchmark Evaluation'}</span>
        </button>
      </div>

      {/* Main Metric Cards */}
      {latestReport ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Precision
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {(latestReport.averagePrecision * 100).toFixed(0)}%
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Relevant chunks ratio</p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Recall
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {(latestReport.averageRecall * 100).toFixed(0)}%
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Context captured</p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Faithfulness
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {(latestReport.averageFaithfulness * 100).toFixed(0)}%
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Source groundedness</p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Context Relevance
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {(latestReport.averageContextRelevance * 100).toFixed(0)}%
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Density score</p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm col-span-2 md:col-span-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Overall Score
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              {(latestReport.overallScore * 100).toFixed(0)} / 100
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Passed: {latestReport.passCount}/{latestReport.totalTests}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-500 space-y-2 shadow-sm">
          <BarChart2 className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-semibold text-slate-800">No evaluation runs recorded yet.</p>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto">
            Click "Run Benchmark Evaluation" to test answer accuracy against reference queries.
          </p>
        </div>
      )}

      {/* Benchmark Test Details Table */}
      {latestReport && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-semibold text-xs text-slate-800 flex items-center space-x-1.5">
              <FileCheck className="w-4 h-4 text-slate-600" />
              <span>Benchmark Results ({latestReport.itemResults.length} Tests)</span>
            </h3>

            <span className="text-[11px] text-slate-500 font-mono">
              Tested at {new Date(latestReport.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {latestReport.itemResults.map((item, idx) => (
              <div key={idx} className="p-4 space-y-2.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-2.5">
                    <div className="mt-0.5">
                      {item.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-xs text-slate-900">{item.question}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Expected: <span className="text-slate-700">{item.expectedAnswer}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-[11px] font-mono">
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                      Precision: {(item.metrics.retrievalPrecision * 100).toFixed(0)}%
                    </span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                      Faithfulness: {(item.metrics.answerFaithfulness * 100).toFixed(0)}%
                    </span>
                    <span className="text-slate-400">{item.latencyMs}ms</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
                    Generated Answer:
                  </p>
                  <p className="text-slate-800 leading-relaxed">{item.generatedAnswer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
