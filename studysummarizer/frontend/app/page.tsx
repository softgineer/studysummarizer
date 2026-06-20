// frontend/app/page.tsx
import Link from 'next/link';
import { BookOpen, Zap, MessageSquare, Download, Star, ChevronRight } from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant summaries',
    desc: 'Quick bullets, chapter breakdowns, study notes, and exam prep — all from one upload.',
  },
  {
    icon: Star,
    title: 'Smart flashcards',
    desc: 'Auto-generated Q&A pairs with spaced repetition scheduling.',
  },
  {
    icon: MessageSquare,
    title: 'Chat with your PDF',
    desc: 'Ask questions, get explanations, and generate practice questions in real time.',
  },
  {
    icon: Download,
    title: 'Export anywhere',
    desc: 'Download summaries as PDF, Word, Markdown, or plain text.',
  },
];

const MODES = [
  { label: 'Quick Summary', desc: '7–10 key bullet points' },
  { label: 'Detailed Summary', desc: 'Chapter-by-chapter breakdown' },
  { label: 'Study Notes', desc: 'Definitions, formulas, concepts' },
  { label: 'Exam Prep', desc: 'Questions & model answers' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">StudySummarizer</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn-primary">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 text-brand-600 text-sm font-medium mb-8">
          <Zap className="w-3.5 h-3.5" />
          Powered by Claude AI
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Study smarter,<br />
          <span className="text-brand-600">not longer</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Upload any PDF — textbook, lecture notes, research paper — and get instant AI summaries,
          flashcards, and exam prep in seconds.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/upload" className="btn-primary text-base px-6 py-3">
            Upload your first PDF
            <ChevronRight className="w-4 h-4" />
          </Link>
          <Link href="/sign-in" className="btn-secondary text-base px-6 py-3">
            Sign in
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">Free · No credit card required</p>
      </section>

      {/* Summary modes */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
            Four ways to study your document
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MODES.map(mode => (
              <div key={mode.label} className="card p-5 text-center">
                <div className="font-semibold text-gray-900 mb-1.5">{mode.label}</div>
                <div className="text-sm text-gray-500">{mode.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-8">
          {FEATURES.map(feature => (
            <div key={feature.title} className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to ace your exams?
          </h2>
          <p className="text-brand-100 mb-8">
            Join students using StudySummarizer to study more efficiently.
          </p>
          <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-600 font-semibold rounded-lg hover:bg-brand-50 transition-colors">
            Start for free
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <BookOpen className="w-4 h-4" />
            StudySummarizer · Built with Claude AI
          </div>
          <div className="text-sm text-gray-400">
            © {new Date().getFullYear()} StudySummarizer. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
