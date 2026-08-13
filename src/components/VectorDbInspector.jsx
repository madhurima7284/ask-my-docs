import React, { useState, useEffect } from 'react';
import {
  Database,
  Code2,
  Search,
  Layers,
  Copy,
  Check,
} from 'lucide-react';

export const VectorDbInspector = ({
  documentsCount,
  totalChunksCount,
}) => {
  const [ddlSchema, setDdlSchema] = useState('');
  const [activeTab, setActiveTab] = useState('query');
  const [copied, setCopied] = useState(false);

  // Raw vector search query tester state
  const [testQuery, setTestQuery] = useState('How does vector search and chunking work?');
  const [isSearching, setIsSearching] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [sampleChunks, setSampleChunks] = useState([]);

  useEffect(() => {
    fetch('/api/schema/ddl')
      .then((res) => res.json())
      .then((data) => setDdlSchema(data.ddl))
      .catch((err) => console.error('Failed to load DDL schema:', err));

    fetch('/api/documents')
      .then((res) => res.json())
      .then((data) => {
        if (data.documents && data.documents.length > 0) {
          fetch(`/api/documents/${data.documents[0].id}`)
            .then((res) => res.json())
            .then((dData) => {
              if (dData.chunks) setSampleChunks(dData.chunks.slice(0, 10));
            });
        }
      });
  }, []);

  const handleRunVectorQuery = async () => {
    if (!testQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: testQuery }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.type === 'metadata' && parsed.retrievedSources) {
                setTestResults(parsed.retrievedSources);
              }
            } catch (e) {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (err) {
      console.error('Vector test search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopyDdl = () => {
    navigator.clipboard.writeText(ddlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* Top Banner Stats */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded-md border border-slate-200">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
              <span>pgvector Database Inspector</span>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] px-2 py-0.5 rounded font-mono">
                vector(768)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Inspect database schema, chunk embeddings, and test raw cosine similarity matching.
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <p className="text-[10px] text-slate-500 uppercase">Documents</p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">{documentsCount}</p>
          </div>

          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <p className="text-[10px] text-slate-500 uppercase">Total Chunks</p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">{totalChunksCount}</p>
          </div>

          <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
            <p className="text-[10px] text-slate-500 uppercase">Metric</p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">Cosine</p>
          </div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('query')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'query'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Vector Query Test</span>
            </button>

            <button
              onClick={() => setActiveTab('schema')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'schema'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>SQL Schema</span>
            </button>

            <button
              onClick={() => setActiveTab('chunks')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeTab === 'chunks'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Chunk Records</span>
            </button>
          </div>

          {activeTab === 'schema' && (
            <button
              onClick={handleCopyDdl}
              className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1 border border-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied' : 'Copy DDL'}</span>
            </button>
          )}
        </div>

        {/* Tab 1: Vector Query Tester */}
        {activeTab === 'query' && (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Test Similarity Lookup Query
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="Type a phrase to search vector space..."
                  className="flex-1 bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                />

                <button
                  onClick={handleRunVectorQuery}
                  disabled={isSearching}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isSearching ? 'Searching...' : 'Run Query'}</span>
                </button>
              </div>
            </div>

            {testResults.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Matched Chunks</span>
                  <span className="text-slate-500 font-mono">
                    {testResults.length} Results
                  </span>
                </h3>

                <div className="space-y-2.5">
                  {testResults.map((res, idx) => (
                    <div
                      key={res.chunk.id || idx}
                      className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="bg-slate-900 text-white px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold">
                            #{res.rank}
                          </span>
                          <span className="font-medium text-slate-900">
                            {res.chunk.metadata.document_name} (Page {res.chunk.page})
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 font-mono text-[11px] text-slate-600">
                          <span>
                            Similarity: {(res.similarityScore * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-800 leading-relaxed font-mono bg-white p-2.5 rounded border border-slate-200">
                        {res.chunk.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: SQL DDL Schema */}
        {activeTab === 'schema' && (
          <div className="p-4">
            <pre className="bg-slate-50 p-4 rounded border border-slate-200 text-xs text-slate-800 font-mono overflow-x-auto leading-relaxed">
              {ddlSchema}
            </pre>
          </div>
        )}

        {/* Tab 3: Sample Chunks Preview */}
        {activeTab === 'chunks' && (
          <div className="p-4">
            {sampleChunks.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No chunks available. Upload a document in Documents tab to preview.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sampleChunks.map((c) => (
                  <div
                    key={c.id}
                    className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 border-b border-slate-200 pb-1">
                      <span className="text-slate-700 font-medium">{c.metadata.document_name}</span>
                      <span>Page {c.page}</span>
                    </div>

                    <p className="text-slate-800 font-mono text-[11px] pt-1">
                      {c.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
