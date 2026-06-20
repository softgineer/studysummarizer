// backend/src/services/rag.service.ts
//
// Retrieval-Augmented Generation pipeline:
//   1. Embed chunks using OpenAI text-embedding-3-small
//   2. Store in Pinecone
//   3. On query: embed query → search Pinecone → return top-k chunks

import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { TextChunk } from '../utils/chunker';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const TOP_K = 5; // chunks to retrieve per query
const BATCH_SIZE = 100; // embed this many chunks at once

// Lazy-init clients
let openai: OpenAI | null = null;
let pinecone: Pinecone | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

function getPinecone(): Pinecone {
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return pinecone;
}

function getIndex() {
  return getPinecone().index(process.env.PINECONE_INDEX || 'studysummarizer');
}

// ── Embed & upsert ────────────────────────────────────────────────────────────

export async function indexDocumentChunks(
  documentId: string,
  userId: string,
  chunks: TextChunk[]
): Promise<string[]> {
  const index = getIndex();
  const namespace = `doc_${documentId}`;
  const vectorIds: string[] = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content);

    // Embed
    const embeddingResponse = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    // Build Pinecone records
    const records = batch.map((chunk, j) => {
      const vectorId = `${documentId}_chunk_${chunk.chunkIndex}`;
      vectorIds.push(vectorId);

      return {
        id: vectorId,
        values: embeddingResponse.data[j].embedding,
        metadata: {
          documentId,
          userId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content.slice(0, 1000), // Pinecone metadata limit
          heading: chunk.heading || '',
          tokenCount: chunk.tokenCount,
        },
      };
    });

    // Upsert to Pinecone
    await index.namespace(namespace).upsert(records);
    console.log(`Indexed chunks ${i + 1}–${Math.min(i + BATCH_SIZE, chunks.length)} of ${chunks.length}`);
  }

  return vectorIds;
}

// ── Query / retrieval ─────────────────────────────────────────────────────────

export interface RetrievedChunk {
  content: string;
  heading: string | null;
  chunkIndex: number;
  score: number;
  vectorId: string;
}

export async function retrieveRelevantChunks(
  query: string,
  documentId: string,
  topK: number = TOP_K
): Promise<RetrievedChunk[]> {
  const index = getIndex();
  const namespace = `doc_${documentId}`;

  // Embed the query
  const queryEmbedding = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: [query],
    dimensions: EMBEDDING_DIMENSIONS,
  });

  // Search Pinecone
  const results = await index.namespace(namespace).query({
    vector: queryEmbedding.data[0].embedding,
    topK,
    includeMetadata: true,
  });

  return (results.matches || []).map(match => ({
    content: (match.metadata?.content as string) || '',
    heading: (match.metadata?.heading as string) || null,
    chunkIndex: (match.metadata?.chunkIndex as number) || 0,
    score: match.score || 0,
    vectorId: match.id,
  }));
}

// ── Build context string for Claude ──────────────────────────────────────────

export function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';

  const parts = chunks
    .sort((a, b) => a.chunkIndex - b.chunkIndex) // restore reading order
    .map((chunk, i) => {
      const header = chunk.heading ? `[${chunk.heading}]\n` : '';
      return `<source index="${i + 1}">\n${header}${chunk.content}\n</source>`;
    });

  return parts.join('\n\n');
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function deleteDocumentVectors(documentId: string): Promise<void> {
  const index = getIndex();
  const namespace = `doc_${documentId}`;

  // Delete all vectors in namespace
  await index.namespace(namespace).deleteAll();
}
