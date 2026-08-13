import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  User,
  FileText,
  Loader2,
  Plus,
  Trash2,
  ChevronRight,
  AlertTriangle,
  Clock,
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { UploadPdfButton } from './UploadPdfButton.jsx';

export const ChatInterface = ({
  conversations = [],
  activeConversation = null,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onSendMessage,
  isGenerating = false,
  onInspectSource,
  selectedDocIdForChat = null,
  onClearDocFilter,
  documents = [],
  onUploadPdf,
  isUploadingPdf = false,
  recentUpload = null,
}) => {
  const [inputQuestion, setInputQuestion] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, isGenerating]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isGenerating) return;
    const q = inputQuestion;
    setInputQuestion('');
    await onSendMessage(q);
  };

  const sampleQuestions = [
    'What are the main findings in this document?',
    'Summarize the key sections and conclusions.',
    'What key concepts or definitions are mentioned?',
    'List any requirements or specific steps outlined.',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 h-[calc(100vh-4.5rem)] flex gap-5">
      {/* Sidebar: Conversation History */}
      <div className="w-64 bg-slate-50 border border-slate-200 rounded-lg flex flex-col overflow-hidden hidden md:flex">
        <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <h2 className="font-semibold text-xs text-slate-600 uppercase tracking-wider">
            History
          </h2>

          <button
            onClick={onNewConversation}
            className="bg-slate-900 hover:bg-slate-800 text-white p-1 rounded-md text-xs font-medium flex items-center transition-colors"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2 overflow-y-auto flex-1 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">
              No saved chats. Ask a question to start.
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`group p-2.5 rounded-md cursor-pointer text-xs transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-white border border-slate-300 text-slate-900 font-medium shadow-sm'
                      : 'hover:bg-slate-100 text-slate-600 border border-transparent'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="truncate">{conv.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(conv.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-sm">
        {/* Chat Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <MessageSquare className="w-4 h-4 text-slate-700" />
            <div>
              <h2 className="font-semibold text-xs text-slate-900">
                Document Q&A
              </h2>
              <p className="text-[11px] text-slate-500">
                Answers are matched against text chunks from uploaded files
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {selectedDocIdForChat && (
              <div className="flex items-center space-x-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded text-xs text-blue-700">
                <span>Filtered by document</span>
                <button
                  onClick={onClearDocFilter}
                  className="text-blue-500 hover:text-blue-800 font-bold ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <UploadPdfButton
              onUpload={onUploadPdf}
              isUploading={isUploadingPdf}
              size="sm"
              variant="primary"
            />
          </div>
        </div>

        {/* Active / Processing Document Banner */}
        {(recentUpload || documents.length > 0) && (
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 overflow-hidden">
              <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="font-medium text-slate-700 text-[11px] truncate">
                {recentUpload ? recentUpload.name : `${documents.length} document${documents.length > 1 ? 's' : ''} available`}
              </span>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              {recentUpload ? (
                recentUpload.status === 'READY' ? (
                  <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Ready</span>
                  </span>
                ) : recentUpload.status === 'FAILED' ? (
                  <span className="inline-flex items-center space-x-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    <span>Failed</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    <span>Processing...</span>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Ready</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 p-5 overflow-y-auto space-y-5">
          {documents.length === 0 && !recentUpload ? (
            <div className="max-w-md mx-auto py-16 text-center space-y-4">
              <div className="bg-slate-100 text-slate-500 p-3 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6 text-slate-600" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  No documents uploaded yet.
                </h3>
                <p className="text-xs text-slate-500">
                  Upload a PDF to start asking questions.
                </p>
              </div>

              <div className="pt-2">
                <UploadPdfButton
                  onUpload={onUploadPdf}
                  isUploading={isUploadingPdf}
                  size="md"
                  variant="primary"
                />
              </div>
            </div>
          ) : !activeConversation || activeConversation.messages.length === 0 ? (
            <div className="max-w-lg mx-auto py-12 text-center space-y-5">
              <div className="bg-slate-100 text-slate-600 p-3 rounded-full w-12 h-12 mx-auto flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Ask a question about your documents
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Type your question below. Answers will cite exact pages from your uploaded PDFs.
                </p>
              </div>

              {/* Sample Prompts */}
              <div className="space-y-2 text-left pt-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-center">
                  Suggested Questions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sampleQuestions.map((sq, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInputQuestion(sq)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 rounded-md text-xs text-slate-700 text-left transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate pr-2">{sq}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            activeConversation.messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 font-semibold text-xs ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                  </div>

                  <div
                    className={`max-w-2xl space-y-2.5 ${
                      isUser ? 'items-end text-right' : 'items-start text-left'
                    }`}
                  >
                    {/* Message Content */}
                    <div
                      className={`p-3.5 rounded-md text-xs leading-relaxed ${
                        isUser
                          ? 'bg-slate-900 text-white'
                          : msg.isRefusal
                          ? 'bg-amber-50 border border-amber-200 text-amber-900'
                          : 'bg-slate-50 border border-slate-200 text-slate-800'
                      }`}
                    >
                      {msg.isRefusal && (
                        <div className="flex items-center space-x-1.5 text-amber-800 font-medium mb-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Not enough context found in documents</span>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>

                    {/* Citations Block */}
                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-200 pb-1.5">
                          <span className="font-medium flex items-center space-x-1 text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>Sources ({msg.sources.length})</span>
                          </span>

                          {msg.retrievalLatencyMs !== undefined && (
                            <span className="flex items-center space-x-1 text-[10px] text-slate-400 font-mono">
                              <Clock className="w-3 h-3" />
                              <span>{msg.retrievalLatencyMs}ms</span>
                            </span>
                          )}
                        </div>

                        {/* Citation Badges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                          {msg.sources.map((src, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => onInspectSource(src)}
                              className="bg-white hover:bg-slate-100 p-2.5 rounded border border-slate-200 text-left transition-colors flex flex-col justify-between space-y-1 cursor-pointer"
                            >
                              <div className="flex items-center justify-between text-[11px] font-medium text-slate-800">
                                <span className="truncate max-w-[140px]">
                                  {src.chunk.metadata.document_name}
                                </span>
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-mono">
                                  Page {src.chunk.page}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 line-clamp-2">
                                "{src.chunk.text}"
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isGenerating && (
            <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-100 border border-slate-200 p-2.5 rounded-md max-w-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              <span>Searching documents...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type your question..."
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              disabled={isGenerating}
              className="flex-1 bg-white border border-slate-300 rounded-md px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
            />

            <button
              type="submit"
              disabled={!inputQuestion.trim() || isGenerating}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-4 py-2 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
