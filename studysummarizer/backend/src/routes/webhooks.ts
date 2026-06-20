import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const webhookRoutes = Router();

webhookRoutes.post('/clerk', async (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    const { type, data } = event;

    if (type === 'user.created' || type === 'user.updated') {
      const email = data.email_addresses?.[0]?.email_address;
      await prisma.user.upsert({
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
      await prisma.user.deleteMany({ where: { clerkId: data.id } });
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});