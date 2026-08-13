/**
 * Splits document pages into chunks using recursive separator rules (paragraphs, sentences, spaces),
 * preserving page numbers, chunk indices, and detailed metadata.
 */
export function chunkDocumentPages(
  pages,
  documentId,
  documentName,
  fileType,
  options
) {
  const { chunkSize, chunkOverlap } = options;
  const chunks = [];
  let globalChunkIndex = 0;

  // Process page by page to guarantee accurate page citations
  for (const page of pages) {
    if (!page.text || page.text.trim().length === 0) continue;

    const pageChunksText = recursiveSplitText(page.text, chunkSize, chunkOverlap);

    let charOffset = 0;
    for (let i = 0; i < pageChunksText.length; i++) {
      const chunkText = pageChunksText[i].trim();
      if (chunkText.length < 15) continue; // Skip tiny noise chunks

      const chunkId = `chk_${documentId}_p${page.pageNumber}_${i}_${Date.now()}`;
      const tokenEstimate = Math.ceil(chunkText.length / 4);

      const metadata = {
        document_id: documentId,
        document_name: documentName,
        file_type: fileType,
        page: page.pageNumber,
        chunk_index: globalChunkIndex,
        total_chunks: 0, // Updated later
        start_char: charOffset,
        end_char: charOffset + chunkText.length,
        token_estimate: tokenEstimate,
      };

      chunks.push({
        id: chunkId,
        document_id: documentId,
        chunk_index: globalChunkIndex++,
        text: chunkText,
        page: page.pageNumber,
        metadata,
        created_at: new Date().toISOString(),
      });

      charOffset += Math.max(1, chunkText.length - chunkOverlap);
    }
  }

  // Update total_chunks count in metadata for all chunks
  for (const chk of chunks) {
    chk.metadata.total_chunks = chunks.length;
  }

  return chunks;
}

/**
 * Recursive character splitter: splits text by paragraph (\n\n), then line (\n), sentence (. ), word ( ), then character.
 */
function recursiveSplitText(text, chunkSize, chunkOverlap) {
  const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];

  function split(textToSplit, depth) {
    if (textToSplit.length <= chunkSize) {
      return [textToSplit];
    }

    const sep = depth < separators.length ? separators[depth] : '';
    const parts = sep ? textToSplit.split(sep) : textToSplit.split('');

    const result = [];
    let currentChunk = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const nextSegment = currentChunk
        ? currentChunk + sep + part
        : part;

      if (nextSegment.length <= chunkSize) {
        currentChunk = nextSegment;
      } else {
        if (currentChunk.length > 0) {
          result.push(currentChunk);
        }

        // If a single part is larger than chunkSize, recursively split with finer separator
        if (part.length > chunkSize && depth < separators.length - 1) {
          const subChunks = split(part, depth + 1);
          result.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = part;
        }
      }
    }

    if (currentChunk.length > 0) {
      result.push(currentChunk);
    }

    // Apply overlap between adjacent chunks
    if (chunkOverlap > 0 && result.length > 1) {
      const overlapped = [];
      for (let i = 0; i < result.length; i++) {
        if (i === 0) {
          overlapped.push(result[i]);
        } else {
          const prevChunk = result[i - 1];
          const overlapPrefix = prevChunk.slice(Math.max(0, prevChunk.length - chunkOverlap));
          overlapped.push((overlapPrefix + ' ' + result[i]).trim());
        }
      }
      return overlapped;
    }

    return result;
  }

  return split(text, 0);
}

/**
 * Explanatory notes on why chunk size and overlap matter for RAG.
 */
export function getChunkingRationale() {
  return {
    chunkSizeInfo:
      'Chunk Size determines the granularity of information retrieved. Small chunks (~300-500 chars) yield precise matching but may miss surrounding context. Large chunks (~1500-2500 chars) preserve rich context but dilute embedding density and risk exceeding LLM context windows.',
    chunkOverlapInfo:
      'Chunk Overlap (~10-20% of chunk size) prevents loss of semantic context across chunk boundaries (e.g. sentences or entities split in half). Overlap ensures critical key facts spanning adjacent segments are fully captured in at least one vector chunk.',
  };
}
