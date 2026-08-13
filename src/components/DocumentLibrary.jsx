import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Search,
  ChevronRight,
  X,
} from 'lucide-react';

export const DocumentLibrary = ({
  documents,
  onUpload,
  onDelete,
  onReindex,
  onSelectDocumentForChat,
  selectedDocIdForChat,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docChunks, setDocChunks] = useState([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Custom chunking params for re-indexing
  const [customChunkSize, setCustomChunkSize] = useState(1000);
  const [customChunkOverlap, setCustomChunkOverlap] = useState(200);
  const [isReindexing, setIsReindexing] = useState(false);

  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const inspectDocument = async (doc) => {
    setSelectedDoc(doc);
    setCustomChunkSize(doc.chunkSize || 1000);
    setCustomChunkOverlap(doc.chunkOverlap || 200);
    setIsLoadingChunks(true);

    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      const data = await res.json();
      if (data.chunks) {
        setDocChunks(data.chunks);
      }
    } catch (err) {
      console.error('Failed to fetch doc chunks:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const handleReindexSubmit = async () => {
    if (!selectedDoc) return;
    setIsReindexing(true);
    try {
      await onReindex(selectedDoc.id, customChunkSize, customChunkOverlap);
      await inspectDocument(selectedDoc);
    } catch (err) {
      console.error('Reindex error:', err);
    } finally {
      setIsReindexing(false);
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Ready</span>
          </span>
        );
      case 'PROCESSING':
      case 'INDEXING':
        return (
          <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
            <span>Indexing</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* Upload Zone & Stats Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upload Box */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`lg:col-span-2 border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-slate-800 bg-slate-100'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-2 bg-white text-slate-700 border border-slate-200 rounded-md shadow-sm">
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-800">
                {isUploading ? 'Processing File...' : 'Click or drop PDF, DOCX, or TXT files here'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Files are parsed and prepared for context lookup. Maximum 25MB.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between space-y-3 shadow-sm">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Library Overview
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <p className="text-[11px] text-slate-500">Documents</p>
                <p className="text-lg font-semibold text-slate-900 mt-0.5">{documents.length}</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <p className="text-[11px] text-slate-500">Total Chunks</p>
                <p className="text-lg font-semibold text-slate-900 mt-0.5">
                  {documents.reduce((acc, curr) => acc + (curr.chunkCount || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Main Document Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="font-semibold text-xs text-slate-800">Uploaded Documents</h2>

          {selectedDocIdForChat && (
            <div className="flex items-center space-x-1.5 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded text-xs text-blue-700">
              <span>Filter active for: {documents.find((d) => d.id === selectedDocIdForChat)?.name}</span>
              <button
                onClick={() => onSelectDocumentForChat('')}
                className="text-blue-500 hover:text-blue-800 font-bold ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {filteredDocs.length === 0 ? (
          <div className="p-10 text-center text-slate-500 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-medium text-slate-700">No documents in library.</p>
            <p className="text-[11px] text-slate-400">
              Upload a document above to get started with Q&A.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-4">Document Name</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Pages</th>
                  <th className="py-2.5 px-3">Chunks</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                {filteredDocs.map((doc) => {
                  const isSelectedForChat = selectedDocIdForChat === doc.id;
                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isSelectedForChat ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <span className="font-medium text-slate-900 truncate max-w-sm">{doc.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">{renderStatusBadge(doc.status)}</td>

                      <td className="py-3 px-3 font-mono text-slate-600">
                        {doc.pageCount || '—'}
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-600">
                        {doc.chunkCount || '—'}
                      </td>

                      <td className="py-3 px-3 text-slate-500 font-mono">
                        {(doc.fileSize / 1024).toFixed(1)} KB
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => inspectDocument(doc)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-200 text-[11px] font-medium flex items-center space-x-1"
                          >
                            <span>Chunks</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() =>
                              onSelectDocumentForChat(isSelectedForChat ? '' : doc.id)
                            }
                            className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                              isSelectedForChat
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isSelectedForChat ? 'Active Filter' : 'Filter Q&A'}
                          </button>

                          <button
                            onClick={() => onDelete(doc.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded"
                            title="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Chunk Inspector Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <div>
                  <h3 className="font-semibold text-xs text-slate-900">{selectedDoc.name}</h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedDoc.pageCount} Pages • {selectedDoc.chunkCount} Chunks
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Re-indexing controls */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-slate-800 flex items-center space-x-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                    <span>Re-chunk Settings</span>
                  </h4>

                  <button
                    onClick={handleReindexSubmit}
                    disabled={isReindexing}
                    className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1"
                  >
                    {isReindexing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>{isReindexing ? 'Re-indexing...' : 'Re-index'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1 text-[11px]">
                      Chunk Size (chars): <span className="text-slate-900 font-mono font-medium">{customChunkSize}</span>
                    </label>
                    <input
                      type="range"
                      min={200}
                      max={2500}
                      step={50}
                      value={customChunkSize}
                      onChange={(e) => setCustomChunkSize(Number(e.target.value))}
                      className="w-full accent-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 text-[11px]">
                      Overlap (chars): <span className="text-slate-900 font-mono font-medium">{customChunkOverlap}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={500}
                      step={10}
                      value={customChunkOverlap}
                      onChange={(e) => setCustomChunkOverlap(Number(e.target.value))}
                      className="w-full accent-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Chunk list */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center space-x-2">
                  <span>Document Chunks ({docChunks.length})</span>
                </h4>

                {isLoadingChunks ? (
                  <div className="py-8 text-center text-slate-500 flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    <span>Loading chunks...</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {docChunks.map((chunk) => (
                      <div
                        key={chunk.id}
                        className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-200 pb-1">
                          <span className="font-mono text-slate-700 font-medium">
                            Chunk #{chunk.chunk_index}
                          </span>
                          <span className="bg-white px-1.5 py-0.2 rounded border border-slate-200 font-mono">
                            Page {chunk.page}
                          </span>
                        </div>

                        <p className="text-slate-800 leading-relaxed whitespace-pre-wrap text-[11px]">
                          {chunk.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
