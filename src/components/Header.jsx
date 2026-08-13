import React from 'react';
import {
  MessageSquare,
  FileText,
  Database,
  BarChart2,
  Sliders,
  FileCode,
} from 'lucide-react';
import { UploadPdfButton } from './UploadPdfButton.jsx';

export const Header = ({
  activeTab,
  setActiveTab,
  documentCount,
  openSettings,
  openDockerModal,
  onUploadPdf,
  isUploadingPdf = false,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Simple Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-slate-900 text-white p-1.5 rounded-md">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-semibold text-sm tracking-tight text-slate-900">
                  Ask My Docs
                </h1>
                <span className="text-[11px] text-slate-500 font-mono">
                  v2.0
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Q&A Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'documents'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Documents</span>
              {documentCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  activeTab === 'documents' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                }`}>
                  {documentCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('vector')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'vector'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">pgvector DB</span>
            </button>

            <button
              onClick={() => setActiveTab('eval')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'eval'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Eval Benchmarks</span>
            </button>
          </nav>

          {/* Actions & Upload PDF */}
          <div className="flex items-center space-x-2">
            {onUploadPdf && (
              <UploadPdfButton
                onUpload={onUploadPdf}
                isUploading={isUploadingPdf}
                size="sm"
                variant="primary"
              />
            )}

            <button
              onClick={openSettings}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 transition-colors"
              title="Pipeline Configuration"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">Settings</span>
            </button>

            <button
              onClick={openDockerModal}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 transition-colors"
              title="View Dockerfile & Docs"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden lg:inline">Dockerfile</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
