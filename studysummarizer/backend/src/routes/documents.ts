// backend/src/routes/documents.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../db/client';
import { extractPdfText } from '../services/pdf.service';
import { chunkText } from '../utils/chunker';
import { indexDocumentChunks, deleteDocumentVectors } from '../services/rag.service';
import { uploadToS3, deleteFromS3 } from '../services/storage.service';

export const documentRoutes = Router();

// Multer config — temp local storage before S3 upload
const upload = multer({
  dest: '/tmp/studysummarizer/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.txt', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported. Allowed: ${allowed.join(', ')}`));
    }
  },
});

// ── POST /api/documents/upload ────────────────────────────────────────────────

documentRoutes.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
  const file = req.file;
  if (!file) return next(new AppError('No file uploaded', 400));

  let documentId: string | null = null;

  try {
    // 1. Create DB record immediately (status: PROCESSING)
    const document = await prisma.document.create({
      data: {
        userId: req.userId!,
        name: file.originalname,
        s3Key: '',       // filled in after S3 upload
        s3Url: '',
        mimeType: file.mimetype,
        sizeBytes: file.size,
        status: 'PROCESSING',
      },
    });
    documentId = document.id;

    // Return the document ID immediately so client can poll
    res.status(202).json({
      documentId: document.id,
      message: 'Upload received. Processing...',
    });

    // Process asynchronously (don't await — response already sent)
    processDocument(
      document.id,
      req.userId!,
      file.path,
      file.originalname,
      file.mimetype
    ).catch(err => {
      console.error(`Processing failed for document ${document.id}:`, err);
    });
  } catch (err) {
    // Clean up temp file on error
    if (file?.path) fs.unlink(file.path, () => {});
    next(err);
  }
});

async function processDocument(
  documentId: string,
  userId: string,
  tempPath: string,
  originalName: string,
  mimeType: string
) {
  try {
    // 2. Upload to S3
    const { s3Key, s3Url } = await uploadToS3(tempPath, originalName, userId, mimeType);

    // 3. Extract text
    const { text, pageCount, wordCount, hasOcr } = await extractPdfText(tempPath);

    // 4. Chunk text
    const chunks = chunkText(text);

    // 5. Index in Pinecone
    const vectorIds = await indexDocumentChunks(documentId, userId, chunks);

    // 6. Store chunks in DB
    await prisma.documentChunk.createMany({
      data: chunks.map((chunk, i) => ({
        documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        heading: chunk.heading || null,
        vectorId: vectorIds[i] || null,
      })),
    });

    // 7. Update document as READY
    await prisma.document.update({
      where: { id: documentId },
      data: {
        s3Key,
        s3Url,
        pageCount,
        wordCount,
        extractedText: text,
        hasOcr,
        pineconeNamespace: `doc_${documentId}`,
        status: 'READY',
      },
    });

    console.log(`Document ${documentId} processed: ${chunks.length} chunks, ${pageCount} pages`);
  } catch (err) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      },
    });
    throw err;
  } finally {
    // Clean up temp file
    fs.unlink(tempPath, () => {});
  }
}

// ── GET /api/documents ────────────────────────────────────────────────────────

documentRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const documents = await prisma.document.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        name: true,
        status: true,
        pageCount: true,
        wordCount: true,
        sizeBytes: true,
        hasOcr: true,
        createdAt: true,
        _count: { select: { summaries: true, flashcards: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ documents });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents/:id ────────────────────────────────────────────────────

documentRoutes.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        summaries: { orderBy: { createdAt: 'desc' }, take: 5 },
        _count: { select: { flashcards: true, chatSessions: true } },
      },
    });

    if (!document) return next(new AppError('Document not found', 404));

    // Don't return full extracted text in list view
    const { extractedText: _text, ...safeDocument } = document;
    res.json({ document: safeDocument });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/documents/:id/status ─────────────────────────────────────────────

documentRoutes.get('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true, status: true, errorMessage: true, pageCount: true, wordCount: true },
    });

    if (!document) return next(new AppError('Document not found', 404));
    res.json(document);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/documents/:id ─────────────────────────────────────────────────

documentRoutes.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!document) return next(new AppError('Document not found', 404));

    // Delete from S3 and Pinecone in parallel
    await Promise.allSettled([
      document.s3Key ? deleteFromS3(document.s3Key) : Promise.resolve(),
      deleteDocumentVectors(document.id),
    ]);

    // Cascade delete in DB (summaries, flashcards, chunks, chat sessions)
    await prisma.document.delete({ where: { id: document.id } });

    res.json({ message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
});
