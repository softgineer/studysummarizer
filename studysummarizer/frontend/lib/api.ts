// frontend/lib/api.ts
// Typed API client for the StudySummarizer backend.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Token provider ────────────────────────────────────────────────────────────
// In Next.js + Clerk, call getToken() from useAuth() on the client side.
// This module expects a token injected per-call.

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ── Documents ─────────────────────────────────────────────────────────────────

export const documentsApi = {
  upload: async (file: File, token: string): Promise<{ documentId: string }> => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/documents/upload', { method: 'POST', body: form, token });
  },

  list: (token: string) =>
    request<{ documents: Document[] }>('/api/documents', { token }),

  get: (id: string, token: string) =>
    request<{ document: Document }>(`/api/documents/${id}`, { token }),

  getStatus: (id: string, token: string) =>
    request<{ id: string; status: string; pageCount?: number; wordCount?: number }>(
      `/api/documents/${id}/status`, { token }
    ),

  delete: (id: string, token: string) =>
    request(`/api/documents/${id}`, { method: 'DELETE', token }),
};

// ── Summaries ─────────────────────────────────────────────────────────────────

export type SummaryMode = 'quick' | 'detailed' | 'study_notes' | 'exam_prep';

export const summariesApi = {
  generate: (documentId: string, mode: SummaryMode, token: string) =>
    request<{ summary: Summary }>('/api/summaries/generate', {
      method: 'POST',
      body: JSON.stringify({ documentId, mode }),
      token,
    }),

  list: (documentId: string, token: string) =>
    request<{ summaries: Summary[] }>(`/api/summaries/${documentId}`, { token }),

  history: (token: string) =>
    request<{ summaries: Summary[] }>('/api/summaries', { token }),
};

// ── Chat ──────────────────────────────────────────────────────────────────────

export const chatApi = {
  sendMessage: (
    documentId: string,
    message: string,
    token: string,
    sessionId?: string
  ) =>
    request<{ sessionId: string; answer: string }>('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ documentId, message, sessionId }),
      token,
    }),

  getSessions: (documentId: string, token: string) =>
    request<{ sessions: ChatSession[] }>(`/api/chat/${documentId}/sessions`, { token }),

  getHistory: (sessionId: string, token: string) =>
    request<{ session: ChatSession & { messages: ChatMessage[] } }>(
      `/api/chat/session/${sessionId}/history`, { token }
    ),
};

// ── Flashcards ────────────────────────────────────────────────────────────────

export const flashcardsApi = {
  generate: (documentId: string, count: number, token: string) =>
    request<{ flashcards: Flashcard[]; count: number }>('/api/flashcards/generate', {
      method: 'POST',
      body: JSON.stringify({ documentId, count }),
      token,
    }),

  list: (documentId: string, token: string) =>
    request<{ flashcards: Flashcard[] }>(`/api/flashcards/${documentId}`, { token }),

  review: (flashcardId: string, quality: number, token: string) =>
    request<{ flashcard: Flashcard }>(`/api/flashcards/${flashcardId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ quality }),
      token,
    }),
};

// ── Export ────────────────────────────────────────────────────────────────────

export const exportApi = {
  export: async (summaryId: string, format: string, token: string) => {
    const res = await fetch(`${API_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ summaryId, format }),
    });

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const contentDisposition = res.headers.get('Content-Disposition') || '';
    const filename = contentDisposition.match(/filename="(.+)"/)?.[1] || `summary.${format}`;

    // Trigger browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  name: string;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  pageCount: number | null;
  wordCount: number | null;
  sizeBytes: number;
  hasOcr: boolean;
  createdAt: string;
  _count?: { summaries: number; flashcards: number };
}

export interface Summary {
  id: string;
  documentId: string;
  mode: string;
  content: string;
  createdAt: string;
  document?: { name: string };
}

export interface Flashcard {
  id: string;
  documentId: string;
  question: string;
  answer: string;
  tags: string[];
  difficulty: 1 | 2 | 3;
  nextReview: string | null;
}

export interface ChatSession {
  id: string;
  documentId: string;
  title: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}
