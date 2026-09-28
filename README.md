# 📄 Ask My Docs

> An AI-powered document question-answering system that lets users upload PDFs and ask questions using Retrieval-Augmented Generation (RAG).

### [Live Demo](https://madhurima7284.github.io/ask-my-docs/) · [GitHub Repository](https://github.com/madhurima7284/ask-my-docs)

## Overview

**Ask My Docs** is a RAG-based AI application that allows users to upload PDF documents and interact with them through natural-language questions.

The system retrieves relevant information from uploaded documents and uses **Google Gemini** to generate context-grounded answers. It also provides **page-level citations** and includes a claim-verification layer to help identify unsupported answers.

## ✨ Features

* 📄 Upload and process PDF documents
* 💬 Ask natural-language questions about documents
* 🔍 Semantic document retrieval
* 🧠 Retrieval-Augmented Generation (RAG)
* 🤖 Google Gemini-powered responses
* 📌 Page-level citations
* 🛡️ Claim verification against retrieved context
* ⚡ FAISS-based vector search
* 📚 Grounded answers based on uploaded documents

## 🏗️ Architecture

```text
              PDF Document
                   │
                   ▼
             Text Extraction
                   │
                   ▼
                Chunking
                   │
                   ▼
               Embeddings
                   │
                   ▼
            FAISS Vector Store
                   │
                   │
User Question ────┘
       │
       ▼
Semantic Retrieval
       │
       ▼
Relevant Chunks
       │
       ▼
    Gemini LLM
       │
       ▼
Generated Answer
       │
       ▼
Claim Verification
       │
       ▼
Answer + Page Citations
```

## 🧠 RAG Pipeline

### 1. Document Ingestion

PDF documents are uploaded and processed to extract their text content.

### 2. Chunking

The extracted content is divided into smaller chunks to make retrieval more effective.

### 3. Embedding Generation

Document chunks are converted into vector representations using embedding models.

### 4. Vector Storage & Retrieval

The embeddings are stored in **FAISS**, enabling semantic similarity search for relevant document chunks.

### 5. LLM Generation

Retrieved context is passed to **Google Gemini**, which generates an answer based on the available document evidence.

### 6. Claim Verification

The generated response is compared against retrieved content to identify unsupported claims.

### 7. Citations

Relevant document pages are provided alongside answers, making the response easier to verify.

## 🛠️ Tech Stack

| Technology    | Purpose                  |
| ------------- | ------------------------ |
| React         | Frontend                 |
| Vite          | Frontend tooling         |
| FastAPI       | Backend/API              |
| Python        | RAG pipeline             |
| Google Gemini | Large Language Model     |
| FAISS         | Vector similarity search |
| Embeddings    | Semantic retrieval       |
| JavaScript    | Frontend development     |

## 📊 Retrieval Evaluation

The retrieval component was evaluated using a **50-question benchmark** across multiple embedding models.

Evaluation metrics included:

* Precision@K
* Recall@K

The evaluation was used to compare the effectiveness of different embedding models for retrieving relevant document chunks.

## 📂 Project Structure

```text
ask-my-docs/
│
├── src/
├── server/
├── server.js
├── package.json
├── .env.example
└── README.md
```

## ⚙️ Environment Variables

Create a `.env` file and add the required API configuration.

```env
GEMINI_API_KEY=your_gemini_api_key
```

Refer to `.env.example` for the required configuration.

## 🚀 Run Locally

### Clone the repository

```bash
git clone https://github.com/madhurima7284/ask-my-docs.git
cd ask-my-docs
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env` file and add your Gemini API key.

### Start the application

```bash
npm run dev
```

Open the local URL displayed in the terminal.

## 🎯 Key Learning Outcomes

* Retrieval-Augmented Generation
* Vector embeddings
* Semantic search
* FAISS vector databases
* LLM-based question answering
* Prompt and context engineering
* Retrieval evaluation
* Claim verification
* Hallucination reduction
* Full-stack AI application development

## 🔮 Future Improvements

* Support for additional document formats
* Conversation memory
* Hybrid keyword + semantic retrieval
* Reranking models
* Streaming responses
* Authentication and user-specific document history
* Expanded retrieval evaluation

## 👩‍💻 Author

**Mainampati Madhurima**

B.Tech Computer Science Engineering

[GitHub](https://github.com/madhurima7284) · [LinkedIn](https://www.linkedin.com/in/mainampati-madhurima-376409340/)

