// backend/src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { documentRoutes } from './routes/documents';
import { summaryRoutes } from './routes/summaries';
import { chatRoutes } from './routes/chat';
import { flashcardRoutes } from './routes/flashcards';
import { exportRoutes } from './routes/export';
import { webhookRoutes } from './routes/webhooks';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 AI calls per hour per IP
  message: 'Too many AI requests. Try again later.',
});

app.use('/api/', limiter);
app.use('/api/summaries', aiLimiter);
app.use('/api/chat', aiLimiter);
app.use('/api/flashcards', aiLimiter);

// ── Body parsing ──────────────────────────────────────────────────────────────
// Webhooks need raw body
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/webhooks', webhookRoutes);         // no auth (Clerk webhooks)
app.use('/api/documents', requireAuth, documentRoutes);
app.use('/api/summaries', requireAuth, summaryRoutes);
app.use('/api/chat', requireAuth, chatRoutes);
app.use('/api/flashcards', requireAuth, flashcardRoutes);
app.use('/api/export', requireAuth, exportRoutes);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 StudySummarizer API running on http://localhost:${PORT}`);
});

export default app;
