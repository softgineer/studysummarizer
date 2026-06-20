// backend/src/routes/summaries.ts
import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../db/client';
import { generateSummary, generateLongDocumentSummary } from '../services/ai.service';
import { chunkText } from '../utils/chunker';

export const summaryRoutes = Router();

const GenerateSchema = z.object({
  documentId: z.string(),
  mode: z.enum(['quick', 'detailed', 'study_notes', 'exam_prep']),
});

// POST /api/summaries/generate
summaryRoutes.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { documentId, mode } = GenerateSchema.parse(req.body);

    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: req.userId, status: 'READY' },
      select: { id: true, name: true, extractedText: true, wordCount: true },
    });

    if (!document) return next(new AppError('Document not found or not ready', 404));
    if (!document.extractedText) return next(new AppError('Document text not available', 422));

    const LONG_DOC_WORDS = 50_000;
    let content: string;

    if ((document.wordCount || 0) > LONG_DOC_WORDS) {
      // Long document: chunk + map-reduce
      const chunks = chunkText(document.extractedText, { chunkSize: 2000 });
      const chunkTexts = chunks.map(c => c.content);
      content = await generateLongDocumentSummary(chunkTexts, mode, document.name);
    } else {
      content = await generateSummary(document.extractedText, mode, document.name);
    }

    const summary = await prisma.summary.create({
      data: {
        userId: req.userId!,
        documentId,
        mode: mode.toUpperCase() as any,
        content,
      },
    });

    res.json({ summary });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.message, 400));
    next(err);
  }
});

// GET /api/summaries/:documentId
summaryRoutes.get('/:documentId', async (req: AuthRequest, res, next) => {
  try {
    const summaries = await prisma.summary.findMany({
      where: { documentId: req.params.documentId, userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ summaries });
  } catch (err) {
    next(err);
  }
});

// GET /api/summaries/history
summaryRoutes.get('/', async (req: AuthRequest, res, next) => {
  try {
    const summaries = await prisma.summary.findMany({
      where: { userId: req.userId },
      include: { document: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ summaries });
  } catch (err) {
    next(err);
  }
});
