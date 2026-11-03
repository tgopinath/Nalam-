import { FEATURES } from './settings.js';

/**
 * Works out what a user can do right now.
 *  - admins: everything
 *  - active trial (first N days after sign-up) or paid premium: everything
 *  - otherwise: only the features the admin marked as free
 */
export function entitlement(user, settings, now = new Date()) {
  const trialEnds = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const premiumUntil = user.premium_until ? new Date(user.premium_until) : null;
  const isAdmin = user.role === 'admin';
  const premiumActive = !!premiumUntil && premiumUntil > now;
  const trialActive = !premiumActive && !!trialEnds && trialEnds > now;
  const full = isAdmin || premiumActive || trialActive;
  const features = full ? Object.keys(FEATURES) : settings.free_features.filter((f) => f in FEATURES);
  const status = isAdmin ? 'admin' : premiumActive ? 'premium' : trialActive ? 'trial' : 'expired';
  const endsAt = premiumActive ? premiumUntil : trialActive ? trialEnds : null;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 86_400_000)) : 0;
  return { status, full, features, trialEndsAt: trialEnds, premiumUntil, daysLeft };
}
