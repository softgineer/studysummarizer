// backend/src/routes/export.ts
import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../db/client';
import { exportSummary } from '../services/export.service';

export const exportRoutes = Router();

const ExportSchema = z.object({
  summaryId: z.string(),
  format: z.enum(['pdf', 'docx', 'md', 'txt']),
});

// POST /api/export
exportRoutes.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { summaryId, format } = ExportSchema.parse(req.body);

    const summary = await prisma.summary.findFirst({
      where: { id: summaryId, userId: req.userId },
      include: { document: { select: { name: true } } },
    });

    if (!summary) return next(new AppError('Summary not found', 404));

    const result = await exportSummary(
      summary.content,
      summary.document.name,
      format,
      summary.mode.toLowerCase()
    );

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.send(result.buffer);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(err.message, 400));
    next(err);
  }
});


// backend/src/routes/webhooks.ts — Clerk user sync
import { Router as WRouter } from 'express';
import { prisma as _prisma } from '../db/client';

export const webhookRoutes = WRouter();

// POST /api/webhooks/clerk
webhookRoutes.post('/clerk', async (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    const { type, data } = event;

    if (type === 'user.created' || type === 'user.updated') {
      const email = data.email_addresses?.[0]?.email_address;
      await _prisma.user.upsert({
        where: { clerkId: data.id },
        create: {
          clerkId: data.id,
          email: email || '',
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || null,
        },
        update: {
          email: email || '',
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || null,
        },
      });
    }

    if (type === 'user.deleted') {
      await _prisma.user.deleteMany({ where: { clerkId: data.id } });
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});
