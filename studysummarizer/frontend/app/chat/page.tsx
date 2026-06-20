'use client';
// frontend/app/chat/page.tsx
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Send, Bot, User, Loader2, BookOpen, Sparkles } from 'lucide-react';
import { chatApi } from '../../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  'Explain the main argument',
  'What are the key formulas?',
  'Summarize Chapter 1',
  'Generate 5 practice questions',
  'List all definitions',
  'What should I focus on for an exam?',
];

export default function ChatPage() {
  const { getToken } = useAuth();
  const params = useSearchParams();
  const documentId = params.get('doc') || '';

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m ready to help you study. Ask me anything about your document — I can explain concepts, summarize sections, or generate practice questions.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text?: string) {
    const query = (text || input).trim();
    if (!query || loading || !documentId) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');

      const { answer, sessionId: sid } = await chatApi.sendMessage(documentId, query, token, sessionId);
      if (sid && !sessionId) setSessionId(sid);

      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: err instanceof Error ? `Error: ${err.message}` : 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!documentId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No document selected.</p>
          <a href="/upload" className="btn-primary">Upload a PDF</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">Chat with your PDF</p>
          <p className="text-xs text-gray-400">RAG-powered answers from your document</p>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex gap-2 overflow-x-auto">
        {QUICK_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => send(prompt)}
            disabled={loading}
            className="flex-shrink-0 px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-600 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full">
        <div className="space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 items-start animate-slide-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                ${msg.role === 'user' ? 'bg-brand-600' : 'bg-gray-100'}
              `}>
                {msg.role === 'user'
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className="w-4 h-4 text-gray-500" />}
              </div>

              {/* Bubble */}
              <div className={`
                max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}
              `}>
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
                ))}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3 items-start animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-gray-500" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask anything about your document…"
            disabled={loading}
            className="input flex-1"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="btn-primary px-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Answers are grounded in your document using RAG
        </p>
      </div>
    </div>
  );
}
