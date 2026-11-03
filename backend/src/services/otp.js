import crypto from 'node:crypto';
import { db } from '../db.js';
import { hmac, safeEqual } from './tokens.js';
import { sendEmail, sendSms } from './messaging.js';
import { HttpError } from '../middleware/errors.js';

const TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 30 * 1000;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

const hashCode = (channel, target, code) => hmac(`${channel}:${target}:${code}`);

export async function issueOtp(channel, target, purpose) {
  const hourAgo = new Date(Date.now() - 3600_000);
  const recent = await db('otps')
    .where({ channel, target })
    .andWhere('created_at', '>', hourAgo)
    .orderBy('created_at', 'desc');
  if (recent.length >= MAX_PER_HOUR) throw new HttpError(429, 'Too many OTP requests. Try again later.');
  const lastSame = recent.find((o) => o.purpose === purpose);
  if (lastSame && Date.now() - new Date(lastSame.created_at).getTime() < COOLDOWN_MS) {
    throw new HttpError(429, 'Please wait 30 seconds before requesting another OTP.');
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await db('otps').insert({
    channel,
    target,
    purpose,
    code_hash: hashCode(channel, target, code),
    expires_at: new Date(Date.now() + TTL_MS),
  });
  const text = `${code} is your Nalam verification code. It expires in 10 minutes. Do not share it with anyone.`;
  if (channel === 'phone') await sendSms(target, text, { otp: code });
  else await sendEmail(target, 'Your Nalam verification code', text);
}

export async function consumeOtp(channel, target, purpose, code) {
  const otp = await db('otps')
    .where({ channel, target, purpose })
    .whereNull('consumed_at')
    .andWhere('expires_at', '>', new Date())
    .orderBy('created_at', 'desc')
    .first();
  if (!otp) throw new HttpError(400, 'OTP expired or not found. Please request a new one.');
  if (otp.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong attempts. Request a new OTP.');
  if (!safeEqual(otp.code_hash, hashCode(channel, target, String(code)))) {
    await db('otps').where({ id: otp.id }).increment('attempts', 1);
    throw new HttpError(400, 'Incorrect OTP.');
  }
  const updated = await db('otps').where({ id: otp.id }).whereNull('consumed_at').update({ consumed_at: new Date() });
  if (!updated) throw new HttpError(400, 'OTP already used.');
}
