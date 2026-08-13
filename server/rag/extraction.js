import * as pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';

const pdfParse = pdfParseModule.default || pdfParseModule;

/**
 * Extracts text and metadata page-by-page from raw file buffers (PDF, DOCX, TXT).
 */
export async function extractDocumentText(buffer, fileType, originalName) {
  if (fileType === 'pdf') {
    return parsePdfDocument(buffer);
  } else if (fileType === 'docx') {
    return parseDocxDocument(buffer);
  } else {
    return parseTxtDocument(buffer);
  }
}

async function parsePdfDocument(buffer) {
  const pages = [];

  // Attempt 1: Modern pdf-parse v2 PDFParse class
  try {
    const PDFParseClass =
      pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse;
    if (PDFParseClass) {
      const parser = new PDFParseClass({ data: buffer });
      const textResult = await parser.getText();
      if (textResult && Array.isArray(textResult.pages) && textResult.pages.length > 0) {
        textResult.pages.forEach((p, idx) => {
          const rawText = p.text || '';
          const cleaned = cleanText(rawText);
          if (cleaned.length > 0) {
            const words = cleaned.split(/\s+/).filter(Boolean);
            pages.push({
              pageNumber: p.num || idx + 1,
              text: cleaned,
              wordCount: words.length,
              characterCount: cleaned.length,
            });
          }
        });
      } else if (textResult?.text) {
        const cleaned = cleanText(textResult.text);
        if (cleaned.length > 0) {
          pages.push({
            pageNumber: 1,
            text: cleaned,
            wordCount: cleaned.split(/\s+/).filter(Boolean).length,
            characterCount: cleaned.length,
          });
        }
      }
    }
  } catch (e1) {
    console.warn('pdf-parse v2 PDFParse class failed, trying v1 function:', e1);
  }

  // Attempt 2: Legacy pdf-parse default function fallback
  if (pages.length === 0) {
    try {
      const legacyFn =
        typeof pdfParseModule === 'function'
          ? pdfParseModule
          : pdfParseModule.default;
      if (typeof legacyFn === 'function') {
        const parsed = await legacyFn(buffer);
        if (parsed?.text) {
          const rawPages = parsed.text.split('\f');
          rawPages.forEach((raw, index) => {
            const cleaned = cleanText(raw);
            if (cleaned.length > 0) {
              const words = cleaned.split(/\s+/).filter(Boolean);
              pages.push({
                pageNumber: index + 1,
                text: cleaned,
                wordCount: words.length,
                characterCount: cleaned.length,
              });
            }
          });
        }
      }
    } catch (e2) {
      console.warn('pdf-parse v1 function failed:', e2);
    }
  }

  const fullText = pages.map((p) => p.text).join('\n\n');
  const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0);

  return {
    pages,
    fullText,
    pageCount: pages.length,
    wordCount: totalWords,
  };
}

async function parseDocxDocument(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value || '';
  const cleaned = cleanText(rawText);

  // Divide into virtual pages (~500 words per page) for DOCX since DOCX lacks fixed page layout
  const paragraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const pages = [];

  let currentPageText = '';
  let currentPageWords = 0;
  let pageNum = 1;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).filter(Boolean).length;
    if (currentPageWords + paraWords > 450 && currentPageText.length > 0) {
      pages.push({
        pageNumber: pageNum++,
        text: currentPageText.trim(),
        wordCount: currentPageWords,
        characterCount: currentPageText.length,
      });
      currentPageText = para;
      currentPageWords = paraWords;
    } else {
      currentPageText += (currentPageText ? '\n\n' : '') + para;
      currentPageWords += paraWords;
    }
  }

  if (currentPageText.trim().length > 0) {
    pages.push({
      pageNumber: pageNum,
      text: currentPageText.trim(),
      wordCount: currentPageWords,
      characterCount: currentPageText.length,
    });
  }

  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      text: cleaned,
      wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      characterCount: cleaned.length,
    });
  }

  const fullText = pages.map((p) => p.text).join('\n\n');
  const totalWords = pages.reduce((sum, p) => sum + p.wordCount, 0);

  return {
    pages,
    fullText,
    pageCount: pages.length,
    wordCount: totalWords,
  };
}

async function parseTxtDocument(buffer) {
  const rawText = buffer.toString('utf-8');
  const cleaned = cleanText(rawText);

  // Split into virtual pages every 2500 characters
  const pages = [];
  const pageSize = 2500;
  let pageNum = 1;

  for (let i = 0; i < cleaned.length; i += pageSize) {
    const pageChunk = cleaned.slice(i, i + pageSize);
    pages.push({
      pageNumber: pageNum++,
      text: pageChunk,
      wordCount: pageChunk.split(/\s+/).filter(Boolean).length,
      characterCount: pageChunk.length,
    });
  }

  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      text: cleaned,
      wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      characterCount: cleaned.length,
    });
  }

  return {
    pages,
    fullText: cleaned,
    pageCount: pages.length,
    wordCount: cleaned.split(/\s+/).filter(Boolean).length,
  };
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
