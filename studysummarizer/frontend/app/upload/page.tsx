'use client';
// frontend/app/upload/page.tsx
import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2,
  BookOpen, ArrowRight, AlertCircle
} from 'lucide-react';
import { documentsApi } from '../../lib/api';

type Stage = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

interface UploadState {
  stage: Stage;
  progress: number;
  documentId: string | null;
  fileName: string | null;
  error: string | null;
  pageCount?: number;
  wordCount?: number;
}

export default function UploadPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<UploadState>({
    stage: 'idle', progress: 0, documentId: null,
    fileName: null, error: null,
  });

  const handleFile = useCallback(async (file: File) => {
    setState({ stage: 'uploading', progress: 10, documentId: null, fileName: file.name, error: null });

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setState(prev => ({ ...prev, progress: Math.min(prev.progress + 15, 85) }));
      }, 400);

      const { documentId } = await documentsApi.upload(file, token);
      clearInterval(progressInterval);

      setState(prev => ({ ...prev, stage: 'processing', progress: 90, documentId }));

      // Poll for processing status
      pollStatus(documentId, token);
    } catch (err) {
      setState(prev => ({
        ...prev, stage: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      }));
    }
  }, [getToken]);

  async function pollStatus(documentId: string, token: string) {
    const maxAttempts = 60; // 2 minutes
    let attempts = 0;

    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        setState(prev => ({ ...prev, stage: 'error', error: 'Processing timed out. Please try again.' }));
        return;
      }

      try {
        const status = await documentsApi.getStatus(documentId, token);

        if (status.status === 'READY') {
          setState(prev => ({
            ...prev, stage: 'ready', progress: 100,
            pageCount: status.pageCount ?? undefined,
            wordCount: status.wordCount ?? undefined,
          }));
        } else if (status.status === 'FAILED') {
          setState(prev => ({ ...prev, stage: 'error', error: 'Processing failed. Please try again.' }));
        } else {
          // Still processing — poll again
          setTimeout(poll, 2000);
        }
      } catch {
        setTimeout(poll, 3000);
      }
    };

    poll();
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => { if (files[0]) handleFile(files[0]); },
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxSize: 100 * 1024 * 1024,
    multiple: false,
    disabled: state.stage !== 'idle',
  });

  const reset = () => setState({
    stage: 'idle', progress: 0, documentId: null, fileName: null, error: null,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-gray-900 font-semibold">
          <BookOpen className="w-5 h-5 text-brand-600" />
          StudySummarizer
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 text-sm">Upload</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Upload your document</h1>
          <p className="text-gray-500">PDF, DOCX, or TXT · Up to 100 MB · 1,000+ pages supported</p>
        </div>

        {/* Drop zone */}
        {state.stage === 'idle' && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer
              transition-all duration-200
              ${isDragActive
                ? 'border-brand-400 bg-brand-50'
                : 'border-gray-300 bg-white hover:border-brand-400 hover:bg-gray-50'}
            `}
          >
            <input {...getInputProps()} />
            <Upload className={`w-10 h-10 mx-auto mb-4 ${isDragActive ? 'text-brand-600' : 'text-gray-400'}`} />
            <p className="text-lg font-medium text-gray-900 mb-2">
              {isDragActive ? 'Drop it here' : 'Drag & drop your PDF'}
            </p>
            <p className="text-sm text-gray-500 mb-6">or click to browse files</p>
            <button className="btn-primary">
              <Upload className="w-4 h-4" />
              Choose file
            </button>
          </div>
        )}

        {/* Upload / processing state */}
        {(state.stage === 'uploading' || state.stage === 'processing') && (
          <div className="card p-10 text-center">
            <Loader2 className="w-10 h-10 mx-auto mb-4 text-brand-600 animate-spin" />
            <p className="font-medium text-gray-900 mb-1">{state.fileName}</p>
            <p className="text-sm text-gray-500 mb-6">
              {state.stage === 'uploading' ? 'Uploading...' : 'Extracting text & indexing chunks...'}
            </p>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-brand-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{state.progress}%</p>
          </div>
        )}

        {/* Ready state */}
        {state.stage === 'ready' && state.documentId && (
          <div className="card p-10 text-center animate-fade-in">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Ready to study!</h2>
            <p className="text-sm text-gray-500 mb-2">{state.fileName}</p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-400 mb-8">
              {state.pageCount && <span>{state.pageCount} pages</span>}
              {state.wordCount && <span>{state.wordCount.toLocaleString()} words</span>}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Link
                href={`/summarize?doc=${state.documentId}`}
                className="btn-primary justify-center"
              >
                Generate summary
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/chat?doc=${state.documentId}`}
                className="btn-secondary justify-center"
              >
                Chat with PDF
              </Link>
            </div>

            <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">
              Upload another file
            </button>
          </div>
        )}

        {/* Error state */}
        {state.stage === 'error' && (
          <div className="card p-10 text-center animate-fade-in">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload failed</h2>
            <p className="text-sm text-red-600 mb-6">{state.error}</p>
            <button onClick={reset} className="btn-primary">
              Try again
            </button>
          </div>
        )}

        {/* Tips */}
        {state.stage === 'idle' && (
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: FileText, label: 'Textbooks' },
              { icon: FileText, label: 'Research papers' },
              { icon: FileText, label: 'Lecture notes' },
            ].map(item => (
              <div key={item.label} className="card p-4 text-center">
                <item.icon className="w-5 h-5 mx-auto mb-2 text-brand-400" />
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
