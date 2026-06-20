// backend/src/routes/chat.ts
import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../db/client';
import { chatWithDocument } from '../services/ai.service';

export const chatRoutes = Router();

const MessageSchema = z.object({
  documentId: z.string(),
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
});

// POST /api/chat/message
chatRoutes.post('/message', async (req: AuthRequest, res, next) => {
  try {
    const { documentId, sessionId, message } = MessageSchema.parse(req.body);

    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: req.userId, status: 'READY' },
      select: { id: true, name: true },
    });
    if (!document) return next(new AppError('Document not found or not ready', 404));

    // Get or create chat session
    let session;
    if (sessionId) {
      session = await prisma.chatSession.findFirst({
        where: { id: sessionId, userId: req.userId },
      });
    }

    if (!session) {
      session = await prisma.chatSession.create({
        data: { userId: req.userId!, documentId, title: message.slice(0, 60) },
      });
    }

    // Load chat history (last 10 messages for context)
    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { role: true, content: true },
    });

    // Save user message
    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'USER', content: message, sourceChunks: [] },
    });

    // Get AI response via RAG
    const { answer, sourceChunkIds } = await chatWithDocument(
      message,
      documentId,
      document.name,
      history.map(m => ({ role: m.role.toLowerCase() as 'user' | 'assistant', content: m.content }))
    );

    // Save assistant response
    const assistantMessage = await prisma.chatMessage.create({
      data: { sessionId: session.id, role: 'ASSISTANT', content: answer, sourceChunks: sourceChunkIds },
    });

    res.json({
      sessionId: session.id,
      message: assistantMessage,
      answer,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.message, 400));
    next(err);
  }
});

// GET /api/chat/:documentId/sessions
chatRoutes.get('/:documentId/sessions', async (req: AuthRequest, res, next) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { documentId: req.params.documentId, userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/chat/:sessionId/history
chatRoutes.get('/session/:sessionId/history', async (req: AuthRequest, res, next) => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.sessionId, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) return next(new AppError('Session not found', 404));
    res.json({ session });
  } catch (err) {
    next(err);
  }
});
