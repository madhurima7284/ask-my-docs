import React from 'react';
import {
  FileText,
  BookOpen,
  X,
  Layers,
} from 'lucide-react';

export const SourceInspector = ({
  source,
  onClose,
}) => {
  if (!source) return null;

  const { chunk, similarityScore, cosineDistance, bm25Score, rerankScore } = source;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-white border-l border-slate-200 shadow-xl flex flex-col transition-all">
      {/* Drawer Header */}
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-slate-700" />
          <h3 className="font-semibold text-xs text-slate-900">Source Chunk Details</h3>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
        {/* Source Meta Card */}
        <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white text-slate-800 rounded border border-slate-200">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-xs">{chunk.metadata.document_name}</p>
              <p className="text-slate-500 font-mono text-[11px]">
                Page {chunk.page} • Chunk #{chunk.chunk_index}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
            <div className="bg-white p-2 rounded border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Similarity</p>
              <p className="text-xs font-semibold text-slate-900 font-mono mt-0.5">
                {(similarityScore * 100).toFixed(1)}%
              </p>
            </div>

            <div className="bg-white p-2 rounded border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Distance</p>
              <p className="text-xs font-semibold text-slate-900 font-mono mt-0.5">
                {cosineDistance.toFixed(4)}
              </p>
            </div>

            {bm25Score !== undefined && (
              <div className="bg-white p-2 rounded border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">BM25 Score</p>
                <p className="text-xs font-semibold text-slate-900 font-mono mt-0.5">
                  {bm25Score.toFixed(3)}
                </p>
              </div>
            )}

            {rerankScore !== undefined && (
              <div className="bg-white p-2 rounded border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Reranker Score</p>
                <p className="text-xs font-semibold text-slate-900 font-mono mt-0.5">
                  {rerankScore.toFixed(3)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chunk Text Content */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 text-xs flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Extracted Text</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              ~{chunk.metadata.token_estimate} tokens
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded border border-slate-200 font-mono text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
            {chunk.text}
          </div>
        </div>

        {/* Index Info */}
        <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1 text-[11px] font-mono text-slate-600">
          <p className="font-semibold text-slate-800 font-sans text-xs mb-1">Chunk Index Info</p>
          <p>• Document ID: {chunk.document_id}</p>
          <p>• Character range: {chunk.metadata.start_char} - {chunk.metadata.end_char}</p>
        </div>
      </div>
    </div>
  );
};
