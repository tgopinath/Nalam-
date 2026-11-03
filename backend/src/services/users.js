import { db } from '../db.js';
import { getSettings } from './settings.js';
import { entitlement } from './entitlement.js';
import { bmi } from './nutrition.js';
import { config } from '../config.js';

const PRIVATE = ['password_hash', 'token_version', 'google_id'];

export function publicUser(user) {
  const out = { ...user };
  for (const k of PRIVATE) delete out[k];
  out.has_password = !!user.password_hash;
  out.google_linked = !!user.google_id;
  out.bmi = bmi(user.height_cm, user.weight_kg);
  return out;
}

export async function sessionPayload(user, token) {
  const settings = await getSettings();
  return { token, user: publicUser(user), access: entitlement(user, settings) };
}

export async function createUser(fields) {
  const settings = await getSettings();
  const [user] = await db('users')
    .insert({ ...fields, trial_ends_at: new Date(Date.now() + settings.trial_days * 86_400_000) })
    .returning('*');
  await db('notifications').insert({
    user_id: user.id,
    title: 'Welcome to Nalam 🌿',
    body: `Enjoy every Premium feature free for ${settings.trial_days} days.`,
  });
  return user;
}

export function normalizePhone(raw) {
  let p = String(raw || '').replace(/[\s()-]/g, '');
  if (!p.startsWith('+')) {
    p = p.replace(/^0+/, '');
    p = (p.length === 10 ? config.sms.defaultCountryCode : '+') + p;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(p)) return null;
  return p;
}

export const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
