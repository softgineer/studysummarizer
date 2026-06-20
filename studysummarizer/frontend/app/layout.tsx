// frontend/app/layout.tsx
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StudySummarizer — AI Study Assistant',
  description: 'Upload PDFs and get AI-powered summaries, flashcards, and study notes instantly.',
  keywords: ['study', 'AI', 'PDF', 'summary', 'flashcards', 'exam prep'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className={`${inter.className} h-full bg-gray-50 text-gray-900 antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
