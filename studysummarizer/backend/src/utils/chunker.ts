// backend/src/utils/chunker.ts
//
// Splits long documents into overlapping chunks suitable for embedding.
// Uses a token-aware strategy with sentence boundary detection.

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  pageNumber?: number;
  heading?: string;
}

const CHUNK_SIZE_TOKENS = 800;    // target tokens per chunk
const CHUNK_OVERLAP_TOKENS = 150; // overlap between consecutive chunks
const AVG_CHARS_PER_TOKEN = 4;   // rough estimate for token counting

// ── Main chunker ──────────────────────────────────────────────────────────────

export function chunkText(
  text: string,
  options: {
    chunkSize?: number;
    overlap?: number;
    preserveHeadings?: boolean;
  } = {}
): TextChunk[] {
  const {
    chunkSize = CHUNK_SIZE_TOKENS,
    overlap = CHUNK_OVERLAP_TOKENS,
    preserveHeadings = true,
  } = options;

  const chunkSizeChars = chunkSize * AVG_CHARS_PER_TOKEN;
  const overlapChars = overlap * AVG_CHARS_PER_TOKEN;

  // Split into sentences first (respect sentence boundaries)
  const sentences = splitIntoSentences(text);

  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  let currentChunk = '';
  let currentHeading: string | null = null;
  let i = 0;

  while (i < sentences.length) {
    const sentence = sentences[i];

    // Detect headings
    if (preserveHeadings && isHeading(sentence)) {
      // If we have accumulated content, save the chunk
      if (currentChunk.trim().length > 100) {
        chunks.push(makeChunk(currentChunk.trim(), chunkIndex++, currentHeading));
        // Start overlap: keep last N chars
        currentChunk = getOverlap(currentChunk, overlapChars);
      }
      currentHeading = sentence.trim();
      currentChunk += sentence + '\n';
      i++;
      continue;
    }

    // Check if adding this sentence would exceed chunk size
    if (currentChunk.length + sentence.length > chunkSizeChars && currentChunk.length > 100) {
      chunks.push(makeChunk(currentChunk.trim(), chunkIndex++, currentHeading));
      // Start new chunk with overlap
      currentChunk = getOverlap(currentChunk, overlapChars) + sentence + ' ';
    } else {
      currentChunk += sentence + ' ';
    }

    i++;
  }

  // Last chunk
  if (currentChunk.trim().length > 50) {
    chunks.push(makeChunk(currentChunk.trim(), chunkIndex, currentHeading));
  }

  return chunks;
}

// ── Sentence splitter ─────────────────────────────────────────────────────────

function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space+capital
  // Keep delimiters attached to previous token
  const raw = text
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return raw;
}

// ── Heading detection ─────────────────────────────────────────────────────────

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length > 120) return false;

  return (
    /^(Chapter|Section|Part|Unit)\s+\d+/i.test(trimmed) ||
    /^\d+\.\d*\s+[A-Z]/.test(trimmed) ||
    /^[A-Z][A-Z\s]{4,}$/.test(trimmed) ||
    /^#{1,3}\s+/.test(trimmed)
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOverlap(text: string, overlapChars: number): string {
  if (text.length <= overlapChars) return text;
  const overlap = text.slice(-overlapChars);
  // Start at word boundary
  const spaceIdx = overlap.indexOf(' ');
  return spaceIdx > -1 ? overlap.slice(spaceIdx + 1) : overlap;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}

function makeChunk(
  content: string,
  chunkIndex: number,
  heading: string | null
): TextChunk {
  return {
    content,
    chunkIndex,
    tokenCount: estimateTokens(content),
    heading: heading ?? undefined,
  };
}
