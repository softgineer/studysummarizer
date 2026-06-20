// backend/src/services/pdf.service.ts
//
// Extracts text from PDFs.
// Strategy:
//   1. Try pdf-parse (fast, works for text-based PDFs)
//   2. If result is too sparse (<100 chars/page), fall back to Tesseract OCR
//
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

export interface ExtractedDocument {
  text: string;
  pageCount: number;
  wordCount: number;
  hasOcr: boolean;
  title?: string;
}

export interface PageSection {
  heading: string | null;
  content: string;
  pageNumber: number;
}

// ── Main extraction ───────────────────────────────────────────────────────────

export async function extractPdfText(
  filePath: string
): Promise<ExtractedDocument> {
  const buffer = fs.readFileSync(filePath);
  let text = '';
  let pageCount = 0;
  let hasOcr = false;

  try {
    const result = await pdfParse(buffer, {
      // Custom page renderer to preserve structure
      pagerender: renderPage,
    });

    text = result.text;
    pageCount = result.numpages;

    // Check if text extraction was adequate
    const avgCharsPerPage = text.length / Math.max(pageCount, 1);

    if (avgCharsPerPage < 100) {
      // PDF is likely scanned — attempt OCR
      console.log(`Sparse text (${avgCharsPerPage.toFixed(0)} chars/page), attempting OCR...`);
      const ocrResult = await extractWithOcr(filePath, pageCount);
      if (ocrResult.length > text.length) {
        text = ocrResult;
        hasOcr = true;
      }
    }
  } catch (err) {
    console.error('pdf-parse failed, falling back to OCR:', err);
    const ocrResult = await extractWithOcr(filePath, 0);
    text = ocrResult;
    hasOcr = true;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    text: cleanText(text),
    pageCount,
    wordCount,
    hasOcr,
  };
}

// ── OCR fallback ──────────────────────────────────────────────────────────────
// Uses Tesseract.js. For production consider calling python/pytesseract
// via child_process for better accuracy and speed.

async function extractWithOcr(filePath: string, _estimatedPages: number): Promise<string> {
  try {
    // Dynamic import — only load if needed
    const Tesseract = await import('tesseract.js');
    const { data } = await Tesseract.recognize(filePath, 'eng', {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rOCR progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    console.log('\nOCR complete');
    return data.text;
  } catch (err) {
    console.error('OCR failed:', err);
    return '';
  }
}

// ── Custom page renderer ──────────────────────────────────────────────────────
// Adds page break markers so we can track page numbers

function renderPage(pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) {
  return pageData.getTextContent().then(
    (textContent: { items: Array<{ str: string; transform: number[] }> }) => {
      let lastY: number | null = null;
      let text = '';

      for (const item of textContent.items) {
        const y = item.transform[5]; // vertical position
        if (lastY !== null && Math.abs(y - lastY) > 5) {
          text += '\n';
        }
        text += item.str + ' ';
        lastY = y;
      }

      return text + '\n\n[PAGE_BREAK]\n\n';
    }
  );
}

// ── Section detection ─────────────────────────────────────────────────────────
// Heuristically detect headings and split into sections

export function detectSections(text: string): PageSection[] {
  const pages = text.split('[PAGE_BREAK]');
  const sections: PageSection[] = [];

  // Heading patterns
  const headingPatterns = [
    /^(Chapter\s+\d+[\.:]\s*.+)$/im,
    /^(\d+\.\s+[A-Z].+)$/m,
    /^([A-Z][A-Z\s]{4,})$/m,       // ALL CAPS lines
    /^(#{1,3}\s+.+)$/m,             // Markdown-style
  ];

  pages.forEach((page, pageIndex) => {
    const lines = page.split('\n').map(l => l.trim()).filter(Boolean);
    let currentHeading: string | null = null;
    let buffer = '';

    for (const line of lines) {
      const isHeading = headingPatterns.some(p => p.test(line)) && line.length < 100;

      if (isHeading) {
        if (buffer.trim()) {
          sections.push({
            heading: currentHeading,
            content: buffer.trim(),
            pageNumber: pageIndex + 1,
          });
          buffer = '';
        }
        currentHeading = line;
      } else {
        buffer += line + ' ';
      }
    }

    if (buffer.trim()) {
      sections.push({
        heading: currentHeading,
        content: buffer.trim(),
        pageNumber: pageIndex + 1,
      });
    }
  });

  return sections;
}

// ── Text cleaning ─────────────────────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')          // collapse excess blank lines
    .replace(/[ \t]{2,}/g, ' ')          // collapse inline spaces
    .replace(/[^\S\n]+$/gm, '')          // trailing whitespace
    .replace(/\u0000/g, '')              // null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
    .trim();
}
