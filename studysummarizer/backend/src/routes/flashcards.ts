// backend/src/routes/flashcards.ts
import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../db/client';
import { generateFlashcards } from '../services/ai.service';

export const flashcardRoutes = Router();

const GenerateSchema = z.object({
  documentId: z.string(),
  count: z.number().int().min(5).max(50).default(20),
});

// POST /api/flashcards/generate
flashcardRoutes.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { documentId, count } = GenerateSchema.parse(req.body);

    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: req.userId, status: 'READY' },
      select: { id: true, name: true, extractedText: true },
    });

    if (!document?.extractedText) return next(new AppError('Document not found or not ready', 404));

    const cards = await generateFlashcards(document.extractedText, document.name, count);

    if (!cards.length) return next(new AppError('Could not generate flashcards', 422));

    // Delete existing flashcards for this document before saving new ones
    await prisma.flashcard.deleteMany({ where: { documentId, userId: req.userId } });

    const created = await prisma.flashcard.createMany({
      data: cards.map(card => ({
        userId: req.userId!,
        documentId,
        question: card.question,
        answer: card.answer,
        tags: card.tags,
        difficulty: card.difficulty,
      })),
    });

    const flashcards = await prisma.flashcard.findMany({
      where: { documentId, userId: req.userId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ flashcards, count: created.count });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.message, 400));
    next(err);
  }
});

// GET /api/flashcards/:documentId
flashcardRoutes.get('/:documentId', async (req: AuthRequest, res, next) => {
  try {
    const flashcards = await prisma.flashcard.findMany({
      where: { documentId: req.params.documentId, userId: req.userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ flashcards });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/flashcards/:id/review — spaced repetition update
flashcardRoutes.patch('/:id/review', async (req: AuthRequest, res, next) => {
  try {
    const { quality } = z.object({ quality: z.number().min(0).max(5) }).parse(req.body);
    const card = await prisma.flashcard.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!card) return next(new AppError('Flashcard not found', 404));

    // SM-2 algorithm
    const ef = Math.max(1.3, card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    const interval = quality < 3 ? 1 : Math.round(card.interval === 1 ? 1 : card.interval * ef);
    const nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

    const updated = await prisma.flashcard.update({
      where: { id: card.id },
      data: { easeFactor: ef, interval, nextReview },
    });

    res.json({ flashcard: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.message, 400));
    next(err);
  }
});
