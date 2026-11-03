import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { db } from './db.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import { getSettings, FEATURES } from './services/settings.js';
import { devOutbox } from './services/messaging.js';
import { PUBLIC_DIR, UPLOAD_DIR } from './paths.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import trackingRoutes from './routes/tracking.js';
import contentRoutes from './routes/content.js';
import adminRoutes from './routes/admin/index.js';
import { hostedCheckoutComplete, hostedCheckoutPage, razorpayWebhook, subscriptionRouter } from './routes/subscription.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin) || origin === config.webAppUrl || !config.isProd),
    }),
  );
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  // Webhook needs the raw body for signature verification - register before express.json()
  app.post('/api/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }), razorpayWebhook);
  app.use(express.json({ limit: '1mb' }));

  app.use('/static', express.static(PUBLIC_DIR, { maxAge: '7d' }));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

  app.get('/api/health', async (req, res) => {
    await db.raw('select 1');
    res.json({ ok: true });
  });

  /** Public app configuration used by the web and Android clients before login. */
  app.get('/api/config', async (req, res) => {
    const s = await getSettings();
    const plans = await db('plans').where({ active: true }).orderBy('sort_order');
    res.json({
      appName: 'Nalam',
      trialDays: s.trial_days,
      authMethods: s.auth_methods,
      announcement: s.announcement,
      maintenance: s.maintenance_mode,
      supportEmail: s.support_email,
      features: FEATURES,
      freeFeatures: s.free_features,
      plans,
      payments: { mode: config.payments.mode, keyId: config.payments.mode === 'mock' ? null : config.payments.razorpayKeyId },
      googleClientIds: config.googleClientIds,
    });
  });

  if (!config.isProd) {
    // Development helper: read OTPs that would have been sent by SMS/email.
    app.get('/api/dev/outbox', (req, res) => res.json(devOutbox.slice().reverse()));
  }

  app.get('/pay/:id', hostedCheckoutPage);
  app.post('/pay/:id/complete', hostedCheckoutComplete);

  app.use('/api/auth', authRoutes);
  app.use('/api/subscription', subscriptionRouter);
  app.use('/api/me', requireAuth, meRoutes);
  app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
  const userApi = Router();
  userApi.use(requireAuth);
  userApi.use(trackingRoutes); // /api/foods, /api/food-logs, /api/water, /api/weight ...
  userApi.use(contentRoutes); // /api/workouts, /api/recipes, /api/articles, /api/coach ...
  app.use('/api', userApi);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
