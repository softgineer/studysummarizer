'use client';
// frontend/app/summarize/page.tsx
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Zap, BookOpen, Notebook, PenLine, Loader2, Download, RefreshCw } from 'lucide-react';
import { summariesApi, exportApi, type SummaryMode } from '../../lib/api';

const MODES: { id: SummaryMode; label: string; icon: typeof Zap; desc: string }[] = [
  { id: 'quick', label: 'Quick Summary', icon: Zap, desc: '7–10 key bullet points' },
  { id: 'detailed', label: 'Detailed Summary', icon: BookOpen, desc: 'Chapter-by-chapter' },
  { id: 'study_notes', label: 'Study Notes', icon: Notebook, desc: 'Definitions & formulas' },
  { id: 'exam_prep', label: 'Exam Prep', icon: PenLine, desc: 'Questions & answers' },
];

const EXPORT_FORMATS = ['pdf', 'docx', 'md', 'txt'] as const;

export default function SummarizePage() {
  const { getToken } = useAuth();
  const params = useSearchParams();
  const documentId = params.get('doc') || '';

  const [selectedMode, setSelectedMode] = useState<SummaryMode>('quick');
  const [loading, setLoading] = useState(false);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  async function generate() {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    setContent(null);
    setSummaryId(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      const { summary } = await summariesApi.generate(documentId, selectedMode, token);
      setContent(summary.content);
      setSummaryId(summary.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: string) {
    if (!summaryId) return;
    setExporting(format);
    try {
      const token = await getToken();
      if (!token) return;
      await exportApi.export(summaryId, format, token);
    } catch (err) {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  }

  // Convert markdown to HTML (simple)
  function renderMarkdown(md: string): string {
    const lines = md.split('\n');
    let html = '';
    for (const line of lines) {
      if (line.startsWith('### ')) html += `<h3>${line.slice(4)}</h3>`;
      else if (line.startsWith('## ')) html += `<h2>${line.slice(3)}</h2>`;
      else if (line.startsWith('# ')) html += `<h1>${line.slice(2)}</h1>`;
      else if (line.startsWith('- ')) html += `<li>${line.slice(2)}</li>`;
      else if (line.trim() === '') html += '';
      else html += `<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')}</p>`;
    }
    return html;
  }

  if (!documentId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No document selected.</p>
          <a href="/upload" className="btn-primary">Upload a PDF</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Summary</h1>
        <p className="text-gray-500 mb-8 text-sm">Choose a mode, then generate your study material.</p>

        {/* Mode selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={`card p-4 text-left transition-all ${
                selectedMode === mode.id
                  ? 'border-brand-400 border-2 bg-brand-50'
                  : 'hover:border-brand-200'
              }`}
            >
              <mode.icon className={`w-5 h-5 mb-2 ${selectedMode === mode.id ? 'text-brand-600' : 'text-gray-400'}`} />
              <div className={`font-medium text-sm mb-0.5 ${selectedMode === mode.id ? 'text-brand-900' : 'text-gray-900'}`}>
                {mode.label}
              </div>
              <div className="text-xs text-gray-500">{mode.desc}</div>
            </button>
          ))}
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={loading}
          className="btn-primary mb-8 w-full md:w-auto justify-center py-3 px-8"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> {content ? 'Regenerate' : 'Generate summary'}</>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="card p-4 border-red-200 bg-red-50 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Loading placeholder */}
        {loading && (
          <div className="card p-8">
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
              <div className="h-4 bg-gray-200 rounded w-4/5" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </div>
          </div>
        )}

        {/* Output */}
        {content && !loading && (
          <div className="card p-8 animate-fade-in">
            <div
              className="prose-summary"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />

            {/* Export bar */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">Export as:</span>
              {EXPORT_FORMATS.map(fmt => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  disabled={exporting === fmt}
                  className="btn-secondary text-xs py-1.5 px-3 uppercase tracking-wide"
                >
                  {exporting === fmt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
