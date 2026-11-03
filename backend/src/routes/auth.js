import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { issueOtp, consumeOtp } from '../services/otp.js';
import { signToken } from '../services/tokens.js';
import { createUser, normalizeEmail, normalizePhone, sessionPayload } from '../services/users.js';
import { getSettings } from '../services/settings.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isTest ? 10_000 : 50, standardHeaders: true });
router.use(limiter);

const googleClient = new OAuth2Client();

async function ensureMethod(method) {
  const s = await getSettings();
  if (!s.auth_methods?.[method]) throw new HttpError(403, `${method} login is currently disabled.`);
}

async function login(user, res, status = 200) {
  if (user.status === 'blocked') throw new HttpError(403, 'Your account has been blocked. Contact support.');
  const [fresh] = await db('users').where({ id: user.id }).update({ last_login_at: new Date() }).returning('*');
  res.status(status).json(await sessionPayload(fresh, signToken(fresh)));
}

const target = (channel, raw) => {
  const v = channel === 'phone' ? normalizePhone(raw) : normalizeEmail(raw);
  if (!v || (channel === 'email' && !z.email().safeParse(v).success)) {
    throw new HttpError(400, channel === 'phone' ? 'Enter a valid mobile number' : 'Enter a valid email');
  }
  return v;
};

/* ---------- OTP login (phone or email) ---------- */
router.post('/otp/request', async (req, res) => {
  const { channel, target: raw } = z
    .object({ channel: z.enum(['phone', 'email']), target: z.string().min(3) })
    .parse(req.body);
  await ensureMethod(channel);
  await issueOtp(channel, target(channel, raw), 'login');
  res.json({ ok: true, message: 'OTP sent' });
});

router.post('/otp/verify', async (req, res) => {
  const body = z
    .object({
      channel: z.enum(['phone', 'email']),
      target: z.string().min(3),
      code: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
      name: z.string().trim().max(120).optional(),
    })
    .parse(req.body);
  await ensureMethod(body.channel);
  const t = target(body.channel, body.target);
  await consumeOtp(body.channel, t, 'login', body.code);
  const field = body.channel === 'phone' ? 'phone' : 'email';
  let user = await db('users').where({ [field]: t }).first();
  if (user) {
    if (!user[`${field}_verified`]) [user] = await db('users').where({ id: user.id }).update({ [`${field}_verified`]: true }).returning('*');
    return login(user, res);
  }
  user = await createUser({ [field]: t, [`${field}_verified`]: true, name: body.name || null });
  return login(user, res, 201);
});

/* ---------- Email + password ---------- */
const password = z.string().min(8, 'Password must be at least 8 characters').max(100);

router.post('/register', async (req, res) => {
  await ensureMethod('email');
  const body = z
    .object({ name: z.string().trim().min(1).max(120), email: z.string(), password })
    .parse(req.body);
  const email = target('email', body.email);
  if (await db('users').where({ email }).first()) throw new HttpError(409, 'An account with this email already exists. Please log in.');
  const user = await createUser({ name: body.name, email, password_hash: await bcrypt.hash(body.password, 10) });
  await issueOtp('email', email, 'verify').catch(() => {});
  return login(user, res, 201);
});

router.post('/login', async (req, res) => {
  await ensureMethod('email');
  const body = z.object({ email: z.string(), password: z.string() }).parse(req.body);
  const user = await db('users').where({ email: normalizeEmail(body.email) }).first();
  if (!user?.password_hash || !(await bcrypt.compare(body.password, user.password_hash))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  return login(user, res);
});

router.post('/email/verify', requireAuth, async (req, res) => {
  const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body);
  if (!req.user.email) throw new HttpError(400, 'No email on this account');
  await consumeOtp('email', req.user.email, 'verify', code);
  await db('users').where({ id: req.user.id }).update({ email_verified: true });
  res.json({ ok: true });
});

router.post('/email/resend', requireAuth, async (req, res) => {
  if (!req.user.email) throw new HttpError(400, 'No email on this account');
  await issueOtp('email', req.user.email, 'verify');
  res.json({ ok: true });
});

router.post('/password/forgot', async (req, res) => {
  const { email: raw } = z.object({ email: z.string() }).parse(req.body);
  const email = target('email', raw);
  const user = await db('users').where({ email }).first();
  if (user) await issueOtp('email', email, 'reset');
  // Same answer either way so accounts can't be enumerated.
  res.json({ ok: true, message: 'If that email is registered, a reset code has been sent.' });
});

router.post('/password/reset', async (req, res) => {
  const body = z.object({ email: z.string(), code: z.string().regex(/^\d{6}$/), password }).parse(req.body);
  const email = target('email', body.email);
  await consumeOtp('email', email, 'reset', body.code);
  const [user] = await db('users')
    .where({ email })
    .update({
      password_hash: await bcrypt.hash(body.password, 10),
      email_verified: true,
      token_version: db.raw('token_version + 1'),
    })
    .returning('*');
  if (!user) throw new HttpError(404, 'Account not found');
  return login(user, res);
});

/* ---------- Google ---------- */
router.post('/google', async (req, res) => {
  await ensureMethod('google');
  const body = z
    .object({ idToken: z.string().optional(), accessToken: z.string().optional() })
    .refine((b) => b.idToken || b.accessToken, 'idToken or accessToken required')
    .parse(req.body);
  if (!config.googleClientIds.length) throw new HttpError(500, 'Google Sign-In is not configured on the server');

  let profile;
  if (body.idToken) {
    const ticket = await googleClient
      .verifyIdToken({ idToken: body.idToken, audience: config.googleClientIds })
      .catch(() => {
        throw new HttpError(401, 'Invalid Google token');
      });
    profile = ticket.getPayload();
  } else {
    // Access-token flow (used by some mobile flows): check the token was issued to our app.
    const info = await googleClient.getTokenInfo(body.accessToken).catch(() => {
      throw new HttpError(401, 'Invalid Google token');
    });
    if (!config.googleClientIds.includes(info.aud)) throw new HttpError(401, 'Google token not issued for Nalam');
    const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    });
    profile = await r.json();
  }
  if (!profile?.sub || !profile.email || !profile.email_verified) throw new HttpError(401, 'Google account email is not verified');
  const email = normalizeEmail(profile.email);

  let user = await db('users').where({ google_id: profile.sub }).first();
  if (!user) {
    user = await db('users').where({ email }).first();
    if (user) {
      [user] = await db('users')
        .where({ id: user.id })
        .update({ google_id: profile.sub, email_verified: true, avatar_url: user.avatar_url || profile.picture })
        .returning('*');
    } else {
      user = await createUser({
        google_id: profile.sub,
        email,
        email_verified: true,
        name: profile.name,
        avatar_url: profile.picture,
      });
      return login(user, res, 201);
    }
  }
  return login(user, res);
});

/* ---------- Session ---------- */
router.post('/logout-all', requireAuth, async (req, res) => {
  await db('users').where({ id: req.user.id }).increment('token_version', 1);
  res.json({ ok: true });
});

/* Link a phone number to an existing account (e.g. after Google login) */
router.post('/phone/link', requireAuth, async (req, res) => {
  const body = z.object({ phone: z.string(), code: z.string().regex(/^\d{6}$/).optional() }).parse(req.body);
  const phone = target('phone', body.phone);
  const owner = await db('users').where({ phone }).first();
  if (owner && owner.id !== req.user.id) throw new HttpError(409, 'This number is linked to another account');
  if (!body.code) {
    await issueOtp('phone', phone, 'verify');
    return res.json({ ok: true, message: 'OTP sent' });
  }
  await consumeOtp('phone', phone, 'verify', body.code);
  const [user] = await db('users').where({ id: req.user.id }).update({ phone, phone_verified: true }).returning('*');
  res.json(await sessionPayload(user));
});

export default router;
