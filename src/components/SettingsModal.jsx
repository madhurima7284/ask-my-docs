import React from 'react';
import { Sliders, X, Check } from 'lucide-react';

export const SettingsModal = ({
  settings,
  onSave,
  onClose,
}) => {
  const [localSettings, setLocalSettings] = React.useState(settings);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(localSettings);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-slate-700" />
            <h3 className="font-semibold text-xs text-slate-900">RAG Settings</h3>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Chunking Settings */}
          <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-3">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
              1. Document Chunking
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 mb-1">
                  Target Chunk Size: <span className="text-slate-900 font-mono font-medium">{localSettings.chunkSize} chars</span>
                </label>
                <input
                  type="range"
                  min={200}
                  max={2500}
                  step={50}
                  value={localSettings.chunkSize}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, chunkSize: Number(e.target.value) })
                  }
                  className="w-full accent-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">
                  Chunk Overlap: <span className="text-slate-900 font-mono font-medium">{localSettings.chunkOverlap} chars</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={10}
                  value={localSettings.chunkOverlap}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, chunkOverlap: Number(e.target.value) })
                  }
                  className="w-full accent-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Hybrid Search & Vector Retrieval */}
          <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                2. Hybrid Search (Dense + BM25)
              </h4>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.enableHybridSearch}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enableHybridSearch: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-slate-900"></div>
              </label>
            </div>

            {localSettings.enableHybridSearch && (
              <div>
                <label className="block text-slate-600 mb-1">
                  Alpha Weighting: <span className="text-slate-900 font-mono font-medium">{localSettings.hybridAlpha}</span>
                </label>
                <p className="text-[10px] text-slate-500 mb-1.5">
                  0.0 = BM25 Only • 1.0 = Vector Only
                </p>
                <input
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={localSettings.hybridAlpha}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, hybridAlpha: Number(e.target.value) })
                  }
                  className="w-full accent-slate-800"
                />
              </div>
            )}
          </div>

          {/* Reranking Stage */}
          <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                3. Reranking
              </h4>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.enableReranking}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enableReranking: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-slate-900"></div>
              </label>
            </div>

            {localSettings.enableReranking && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 mb-1">
                    Candidate Pool: <span className="text-slate-900 font-mono font-medium">{localSettings.rerankTopK}</span>
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={25}
                    step={1}
                    value={localSettings.rerankTopK}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, rerankTopK: Number(e.target.value) })
                    }
                    className="w-full accent-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">
                    Top Chunks Sent to Model: <span className="text-slate-900 font-mono font-medium">{localSettings.topK}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={localSettings.topK}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, topK: Number(e.target.value) })
                    }
                    className="w-full accent-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Refusal Threshold */}
          <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-2">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
              4. Refusal Threshold
            </h4>

            <div>
              <label className="block text-slate-600 mb-1">
                Min Similarity Score: <span className="text-slate-900 font-mono font-medium">{localSettings.groundednessThreshold}</span>
              </label>
              <p className="text-[10px] text-slate-500 mb-1.5">
                Questions below this threshold will be refused to prevent ungrounded responses.
              </p>
              <input
                type="range"
                min={0.15}
                max={0.80}
                step={0.05}
                value={localSettings.groundednessThreshold}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, groundednessThreshold: Number(e.target.value) })
                }
                className="w-full accent-slate-800"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-slate-600 hover:text-slate-900 font-medium text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded font-medium text-xs flex items-center space-x-1 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
