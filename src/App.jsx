import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.jsx';
import { ChatInterface } from './components/ChatInterface.jsx';
import { DocumentLibrary } from './components/DocumentLibrary.jsx';
import { VectorDbInspector } from './components/VectorDbInspector.jsx';
import { RagEvaluation } from './components/RagEvaluation.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { DockerModal } from './components/DockerModal.jsx';
import { SourceInspector } from './components/SourceInspector.jsx';

export function App() {
  const [activeTab, setActiveTab] = useState('chat');

  // Data State
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [selectedDocIdForChat, setSelectedDocIdForChat] = useState(null);

  // Settings & Modals State
  const [ragSettings, setRagSettings] = useState({
    chunkSize: 1000,
    chunkOverlap: 200,
    topK: 5,
    similarityThreshold: 0.35,
    enableHybridSearch: true,
    hybridAlpha: 0.6,
    enableReranking: true,
    rerankTopK: 10,
    groundednessThreshold: 0.35,
    temperature: 0.2,
    embeddingModel: 'gemini-embedding-2-preview',
    llmModel: 'gemini-3.6-flash',
  });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDockerModal, setShowDockerModal] = useState(false);
  const [inspectedSource, setInspectedSource] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [recentUpload, setRecentUpload] = useState(null);

  // Fetch initial documents & conversations & settings
  useEffect(() => {
    fetchDocuments();
    fetchConversations();
    fetchSettings();

    // Poll documents status every 2s if any document is processing
    const interval = setInterval(() => {
      fetchDocuments();
    }, 2000);

    return () => clearInterval(interval);
  }, [recentUpload?.id]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);

        // Update recentUpload status if tracking a doc
        setRecentUpload((prev) => {
          if (!prev) return null;
          const matched = data.documents.find(
            (d) => (prev.id && d.id === prev.id) || d.name === prev.name
          );
          if (matched) {
            return {
              ...prev,
              id: matched.id,
              status: matched.status,
            };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
        if (data.conversations.length > 0 && !activeConversation) {
          setActiveConversation(data.conversations[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setRagSettings(data.settings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  // Upload handler
  const handleDocumentUpload = async (file) => {
    setIsUploadingPdf(true);
    setRecentUpload({
      name: file.name,
      status: 'PROCESSING',
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setRecentUpload({
          name: file.name,
          status: 'FAILED',
          error: err.error || 'Upload failed',
        });
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      const docRecord = data.document;

      setRecentUpload({
        id: docRecord.id,
        name: docRecord.name,
        status: docRecord.status || 'PROCESSING',
      });

      await fetchDocuments();
    } catch (err) {
      console.error('Upload failed:', err);
      setRecentUpload({
        name: file.name,
        status: 'FAILED',
        error: err.message,
      });
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Delete document
  const handleDocumentDelete = async (id) => {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (selectedDocIdForChat === id) {
      setSelectedDocIdForChat(null);
    }
    await fetchDocuments();
  };

  // Re-index document
  const handleDocumentReindex = async (id, chunkSize, chunkOverlap) => {
    const res = await fetch(`/api/documents/${id}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkSize, chunkOverlap }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Re-index failed');
    }

    await fetchDocuments();
  };

  // Save RAG settings
  const handleSaveSettings = async (newSettings) => {
    setRagSettings(newSettings);
    setShowSettingsModal(false);

    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
  };

  // Conversation handlers
  const handleSelectConversation = async (id) => {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    if (data.conversation) {
      setActiveConversation(data.conversation);
    }
  };

  const handleNewConversation = () => {
    setActiveConversation(null);
  };

  const handleDeleteConversation = async (id) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (activeConversation?.id === id) {
      setActiveConversation(null);
    }
    await fetchConversations();
  };

  // Send message streaming chat Q&A handler
  const handleSendMessage = async (question) => {
    setIsGenerating(true);

    const currentConvId = activeConversation?.id || `conv_${Date.now()}`;

    // Optimistically update UI with user message
    const userMsg = {
      id: `u_${Date.now()}`,
      conversationId: currentConvId,
      sender: 'user',
      text: question,
      createdAt: new Date().toISOString(),
    };

    const tempConv = activeConversation
      ? { ...activeConversation, messages: [...activeConversation.messages, userMsg] }
      : {
          id: currentConvId,
          title: question.slice(0, 40) + '...',
          messages: [userMsg],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    setActiveConversation(tempConv);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversationId: currentConvId,
          filterDocumentId: selectedDocIdForChat,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let assistantText = '';
      let retrievedSources = [];
      let isRefusal = false;
      let groundednessScore = 0;

      // Add placeholder assistant message
      const assistantPlaceholder = {
        id: `a_${Date.now()}`,
        conversationId: currentConvId,
        sender: 'assistant',
        text: '',
        sources: [],
        createdAt: new Date().toISOString(),
      };

      let updatedMessages = [...tempConv.messages, assistantPlaceholder];
      setActiveConversation({ ...tempConv, messages: updatedMessages });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value);
        const lines = textChunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));

              if (parsed.type === 'metadata') {
                retrievedSources = parsed.retrievedSources || [];
                if (parsed.groundedness) {
                  isRefusal = !parsed.groundedness.isGrounded;
                  groundednessScore = parsed.groundedness.maxScore;
                }
              } else if (parsed.type === 'token') {
                assistantText += parsed.text;
                // Live streaming update
                updatedMessages = updatedMessages.map((m) =>
                  m.id === assistantPlaceholder.id
                    ? {
                        ...m,
                        text: assistantText,
                        sources: retrievedSources,
                        isRefusal,
                        groundednessScore,
                      }
                    : m
                );
                setActiveConversation({ ...tempConv, messages: updatedMessages });
              } else if (parsed.type === 'done' && parsed.message) {
                // Final official message record
                updatedMessages = updatedMessages.map((m) =>
                  m.id === assistantPlaceholder.id ? parsed.message : m
                );
                setActiveConversation({ ...tempConv, messages: updatedMessages });
              }
            } catch (e) {
              // Ignore partial chunk decode errors
            }
          }
        }
      }

      await fetchConversations();
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        documentCount={documents.length}
        openSettings={() => setShowSettingsModal(true)}
        openDockerModal={() => setShowDockerModal(true)}
        onUploadPdf={handleDocumentUpload}
        isUploadingPdf={isUploadingPdf}
      />

      {/* Tab Views */}
      <main className="flex-1">
        {activeTab === 'chat' && (
          <ChatInterface
            conversations={conversations}
            activeConversation={activeConversation}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
            onInspectSource={(source) => setInspectedSource(source)}
            selectedDocIdForChat={selectedDocIdForChat}
            onClearDocFilter={() => setSelectedDocIdForChat(null)}
            documents={documents}
            onUploadPdf={handleDocumentUpload}
            isUploadingPdf={isUploadingPdf}
            recentUpload={recentUpload}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentLibrary
            documents={documents}
            onUpload={handleDocumentUpload}
            onDelete={handleDocumentDelete}
            onReindex={handleDocumentReindex}
            onSelectDocumentForChat={(docId) => {
              setSelectedDocIdForChat(docId);
              if (docId) setActiveTab('chat');
            }}
            selectedDocIdForChat={selectedDocIdForChat}
          />
        )}

        {activeTab === 'vector' && (
          <VectorDbInspector
            documentsCount={documents.length}
            totalChunksCount={totalChunks}
          />
        )}

        {activeTab === 'eval' && <RagEvaluation />}
      </main>

      {/* Drawers & Modals */}
      {showSettingsModal && (
        <SettingsModal
          settings={ragSettings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showDockerModal && (
        <DockerModal onClose={() => setShowDockerModal(false)} />
      )}

      {inspectedSource && (
        <SourceInspector
          source={inspectedSource}
          onClose={() => setInspectedSource(null)}
        />
      )}
    </div>
  );
}

export default App;
