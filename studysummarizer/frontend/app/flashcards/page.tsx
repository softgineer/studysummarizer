'use client';
// frontend/app/flashcards/page.tsx
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ChevronLeft, ChevronRight, RotateCcw, Loader2, Sparkles, Check, X, Minus } from 'lucide-react';
import { flashcardsApi, type Flashcard } from '../../lib/api';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Basic',
  2: 'Intermediate',
  3: 'Advanced',
};

const QUALITY_OPTIONS = [
  { label: 'Forgot', icon: X, quality: 1, color: 'text-red-600 border-red-200 hover:bg-red-50' },
  { label: 'Hard', icon: Minus, quality: 3, color: 'text-amber-600 border-amber-200 hover:bg-amber-50' },
  { label: 'Easy', icon: Check, quality: 5, color: 'text-green-600 border-green-200 hover:bg-green-50' },
];

export default function FlashcardsPage() {
  const { getToken } = useAuth();
  const params = useSearchParams();
  const documentId = params.get('doc') || '';

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(20);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set<string>());

  async function generateCards() {
    setGenerating(true);
    try {
      const token = await getToken();
      if (!token) return;
      const { flashcards } = await flashcardsApi.generate(documentId, count, token);
      setCards(flashcards);
      setCurrentIndex(0);
      setFlipped(false);
      setReviewed(new Set());
    } catch (err) {
      alert('Failed to generate flashcards. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleReview(quality: number) {
    const card = cards[currentIndex];
    setReviewed(prev => new Set(Array.from(prev).concat(card.id)));

    try {
      const token = await getToken();
      if (token) await flashcardsApi.review(card.id, quality, token);
    } catch {
      // Non-critical — spaced repetition update can fail silently
    }

    // Move to next
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(i => i + 1);
      setFlipped(false);
    }
  }

  const card = cards[currentIndex];
  const progress = cards.length > 0 ? Math.round(((currentIndex) / cards.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Flashcards</h1>
        <p className="text-gray-500 text-sm mb-8">Flip cards to reveal answers. Track your progress with spaced repetition.</p>

        {/* Setup */}
        {cards.length === 0 && (
          <div className="card p-8 text-center">
            <Sparkles className="w-10 h-10 text-brand-400 mx-auto mb-4" />
            <h2 className="font-semibold text-gray-900 mb-2">Generate flashcards</h2>
            <p className="text-sm text-gray-500 mb-6">AI will create question-answer pairs from your document.</p>

            <div className="flex items-center justify-center gap-3 mb-6">
              <label className="text-sm text-gray-600">Number of cards:</label>
              <select
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="input w-24"
              >
                {[10, 20, 30, 50].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <button onClick={generateCards} disabled={generating || !documentId} className="btn-primary">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate {count} flashcards</>
              )}
            </button>
          </div>
        )}

        {/* Card deck */}
        {cards.length > 0 && card && (
          <>
            {/* Progress */}
            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
              <span>{currentIndex + 1} of {cards.length}</span>
              <span>{reviewed.size} reviewed · {cards.length - currentIndex - 1} remaining</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
              <div
                className="bg-brand-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Card */}
            <div
              onClick={() => setFlipped(f => !f)}
              className={`
                card p-10 min-h-[240px] flex flex-col items-center justify-center text-center
                cursor-pointer transition-all duration-200 mb-4 select-none
                ${flipped ? 'bg-brand-50 border-brand-200' : 'hover:bg-gray-50'}
              `}
            >
              {!flipped ? (
                <>
                  <div className="badge badge-purple mb-4 text-xs">Question</div>
                  <p className="text-lg font-medium text-gray-900 leading-relaxed">{card.question}</p>
                  <p className="text-xs text-gray-400 mt-6">Tap to reveal answer</p>
                </>
              ) : (
                <>
                  <div className="badge bg-green-50 text-green-700 mb-4 text-xs">Answer</div>
                  <p className="text-base text-gray-700 leading-relaxed">{card.answer}</p>
                  {card.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap justify-center mt-4">
                      {card.tags.map(tag => (
                        <span key={tag} className="badge badge-purple">{tag}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Review buttons (only when flipped) */}
            {flipped && (
              <div className="flex gap-3 mb-6 animate-fade-in">
                {QUALITY_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => handleReview(opt.quality)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${opt.color}`}
                  >
                    <opt.icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setCurrentIndex(i => Math.max(0, i - 1)); setFlipped(false); }}
                disabled={currentIndex === 0}
                className="btn-secondary"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>

              <button
                onClick={generateCards}
                disabled={generating}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Regenerate
              </button>

              <button
                onClick={() => { setCurrentIndex(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}
                disabled={currentIndex === cards.length - 1}
                className="btn-secondary"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Completed state */}
            {currentIndex === cards.length - 1 && reviewed.has(card.id) && (
              <div className="mt-8 card p-6 text-center bg-green-50 border-green-200 animate-fade-in">
                <p className="font-semibold text-green-800 mb-1">All cards reviewed!</p>
                <p className="text-sm text-green-600 mb-4">Great job. Come back tomorrow for your next review session.</p>
                <button onClick={generateCards} className="btn-primary">
                  Generate new cards
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
