import React, { useState } from 'react';
import { FileCode2, X, Copy, Check, Server, ShieldCheck, Cpu } from 'lucide-react';

export const DockerModal = ({ onClose }) => {
  const [copied, setCopied] = useState(false);

  const dockerfileContent = `# Production Multi-Stage Dockerfile for Ask My Docs
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build Vite frontend and Bundle Server with esbuild
RUN npm run build

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(dockerfileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCode2 className="w-4 h-4 text-slate-700" />
            <h3 className="font-semibold text-xs text-slate-900">
              Dockerfile Specification
            </h3>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Production Dockerfile Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-800 text-xs flex items-center space-x-1.5">
                <Server className="w-3.5 h-3.5 text-slate-600" />
                <span>Multi-Stage Dockerfile</span>
              </h4>

              <button
                onClick={handleCopy}
                className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1 border border-slate-200 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <pre className="bg-slate-50 p-3.5 rounded border border-slate-200 font-mono text-[11px] text-slate-800 leading-relaxed overflow-x-auto">
              {dockerfileContent}
            </pre>
          </div>

          {/* Key Pipeline Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
              <h5 className="font-semibold text-slate-800 text-xs flex items-center space-x-1">
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                <span>Vector Embeddings</span>
              </h5>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Stores 768-dimensional chunk vectors using standard distance matching for accurate chunk retrieval.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1">
              <h5 className="font-semibold text-slate-800 text-xs flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                <span>Refusal Guardrails</span>
              </h5>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                If candidate chunk scores fall below configured thresholds, response is refused automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
