import { db } from '../db.js';
import { verifyToken } from '../services/tokens.js';
import { entitlement } from '../services/entitlement.js';
import { getSettings, FEATURES } from '../services/settings.js';
import { HttpError } from './errors.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in');
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Session expired. Please log in again.');
  }
  const user = await db('users').where({ id: payload.sub }).first();
  if (!user || user.token_version !== payload.v) throw new HttpError(401, 'Session expired. Please log in again.');
  if (user.status === 'blocked') throw new HttpError(403, 'Your account has been blocked. Contact support.');
  const settings = await getSettings();
  if (settings.maintenance_mode && user.role !== 'admin') {
    throw new HttpError(503, 'Nalam is under maintenance. Please check back soon.');
  }
  req.user = user;
  req.settings = settings;
  req.access = entitlement(user, settings);
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Admin only');
  next();
}

/** Blocks a feature once the trial has ended unless the user subscribed (or admin made it free). */
export function requireFeature(feature) {
  if (!(feature in FEATURES)) throw new Error(`Unknown feature ${feature}`);
  return (req, res, next) => {
    if (!req.access.features.includes(feature)) {
      throw new HttpError(402, `${FEATURES[feature]} needs a Nalam Premium subscription.`, {
        code: 'SUBSCRIPTION_REQUIRED',
        feature,
      });
    }
    next();
  };
}
