// backend/src/services/ai.service.ts
//
// All interactions with Claude API.
// Uses chunked processing for large documents.

import Anthropic from '@anthropic-ai/sdk';
import { retrieveRelevantChunks, buildContext } from './rag.service';

const MODEL = 'claude-sonnet-4-6';
const MAX_CONTEXT_TOKENS = 180_000; // claude-sonnet-4-6 context window
const CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// ── Summary generation ────────────────────────────────────────────────────────

type SummaryMode = 'quick' | 'detailed' | 'study_notes' | 'exam_prep';

const SUMMARY_PROMPTS: Record<SummaryMode, string> = {
  quick: `Generate a concise quick summary of the document. Output exactly:
- A one-sentence overview
- 7-10 bullet points covering the most important ideas
- No sub-bullets, no headers

Format as clean Markdown.`,

  detailed: `Generate a detailed chapter-by-chapter summary. For each chapter or major section:
- State the section title as a ## heading
- Write 2-4 sentences explaining what it covers
- List 3-5 key points as bullets

If chapters aren't clear, group by theme. Format as clean Markdown.`,

  study_notes: `Create structured study notes. Include:

## Key Definitions
List all important terms and their definitions.

## Core Concepts
Explain the main ideas students must understand.

## Important Formulas / Frameworks
List any equations, models, or frameworks with brief explanations.

## Dates & People
Important dates, names, or case studies if present.

Format as clean Markdown with these exact sections.`,

  exam_prep: `Generate exam preparation material. Include:

## Short Answer Questions (5)
Questions with model answers (2-4 sentences each).

## Multiple Choice Questions (5)
Each with 4 options (A-D) and the correct answer marked.

## Essay Questions (2)
Open-ended questions with a brief answer outline.

## Key Facts to Memorize
10-15 bullet points of the most exam-likely facts.

Format as clean Markdown with these exact sections.`,
};

export async function generateSummary(
  documentText: string,
  mode: SummaryMode,
  documentName: string
): Promise<string> {
  const anthropic = getClient();

  // For long documents, process in chunks and merge
  const truncatedText = documentText.slice(0, MAX_CONTEXT_CHARS);
  const wasTruncated = documentText.length > MAX_CONTEXT_CHARS;

  const systemPrompt = `You are StudySummarizer, an expert academic AI. You create high-quality study materials from academic documents.

Document: "${documentName}"
${wasTruncated ? `Note: Document was ${Math.round(documentText.length / 1000)}k characters. Summarizing first ${Math.round(MAX_CONTEXT_CHARS / 1000)}k characters.` : ''}

Rules:
- Never copy verbatim text from the source
- Use clear, student-friendly language
- Be comprehensive but concise
- Preserve all technical terms and formulas exactly
- Focus on concepts that are likely to be examined`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Here is the document:\n\n${truncatedText}\n\n---\n\nTask: ${SUMMARY_PROMPTS[mode]}`,
      },
    ],
  });

  return extractText(response);
}

// ── Long document: chunk + map-reduce summarization ──────────────────────────

export async function generateLongDocumentSummary(
  chunks: string[],
  mode: SummaryMode,
  documentName: string
): Promise<string> {
  const anthropic = getClient();

  // Map: summarize each chunk
  const chunkSummaries = await Promise.all(
    chunks.map(async (chunk, i) => {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Summarize this section of "${documentName}" in 3-5 bullet points. Focus on key facts, definitions, and concepts:\n\n${chunk}`,
          },
        ],
      });
      console.log(`Summarized chunk ${i + 1}/${chunks.length}`);
      return extractText(response);
    })
  );

  // Reduce: combine chunk summaries into final summary
  const combined = chunkSummaries.join('\n\n---\n\n');
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are StudySummarizer. You synthesize section summaries into complete study material for "${documentName}".`,
    messages: [
      {
        role: 'user',
        content: `These are summaries of each section:\n\n${combined}\n\n---\n\nNow create a final ${mode} using these summaries:\n\n${SUMMARY_PROMPTS[mode]}`,
      },
    ],
  });

  return extractText(response);
}

// ── Flashcard generation ──────────────────────────────────────────────────────

export interface Flashcard {
  question: string;
  answer: string;
  tags: string[];
  difficulty: 1 | 2 | 3;
}

export async function generateFlashcards(
  documentText: string,
  documentName: string,
  count: number = 20
): Promise<Flashcard[]> {
  const anthropic = getClient();
  const truncatedText = documentText.slice(0, MAX_CONTEXT_CHARS);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are StudySummarizer. Generate flashcards from academic content.
Output ONLY valid JSON — no markdown, no preamble, no explanation.`,
    messages: [
      {
        role: 'user',
        content: `Document: "${documentName}"

Content:
${truncatedText}

Generate exactly ${count} flashcards. Return JSON array:
[
  {
    "question": "Clear, specific question",
    "answer": "Concise but complete answer",
    "tags": ["definition" | "formula" | "concept" | "fact" | "name" | "date"],
    "difficulty": 1 | 2 | 3
  }
]

Include a mix of: definitions, key concepts, formulas/equations, important facts, cause-effect relationships.
Difficulty: 1=basic recall, 2=understanding, 3=application.`,
      },
    ],
  });

  const raw = extractText(response);
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const cards = JSON.parse(cleaned);
    return Array.isArray(cards) ? cards : [];
  } catch {
    console.error('Failed to parse flashcards JSON:', raw.slice(0, 200));
    return [];
  }
}

// ── RAG Chat ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatWithDocument(
  query: string,
  documentId: string,
  documentName: string,
  history: ChatMessage[]
): Promise<{ answer: string; sourceChunkIds: string[] }> {
  const anthropic = getClient();

  // Retrieve relevant chunks from vector store
  const relevantChunks = await retrieveRelevantChunks(query, documentId, 5);
  const context = buildContext(relevantChunks);
  const sourceChunkIds = relevantChunks.map(c => c.vectorId);

  const systemPrompt = `You are StudySummarizer, an AI study assistant. You answer questions about the document "${documentName}" based ONLY on the provided context.

Rules:
- Answer only from the context provided. If the answer is not in the context, say so.
- Be clear, educational, and helpful.
- For formulas, write them clearly.
- If asked to generate questions or summaries, do so based on the context.
- Keep answers concise unless detail is requested.`;

  const messages: Anthropic.MessageParam[] = [
    // Inject context as a system-like message
    {
      role: 'user',
      content: `Here is the relevant content from the document:\n\n${context}\n\n---\n\nPlease answer my questions based on this content.`,
    },
    { role: 'assistant', content: 'Understood. I have the relevant sections from your document. What would you like to know?' },
    // Previous conversation
    ...history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    // Current query
    { role: 'user', content: query },
  ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  return {
    answer: extractText(response),
    sourceChunkIds,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter(block => block.type === 'text')
    .map(block => (block as Anthropic.TextBlock).text)
    .join('');
}
