import { db } from '../db.js';

/** Every feature key the app knows about. Admin decides which stay free after the trial. */
export const FEATURES = {
  dashboard: 'Dashboard & daily summary',
  food_log: 'Food & calorie tracking',
  water: 'Water tracker',
  weight: 'Weight tracker',
  steps: 'Steps & activity',
  sleep: 'Sleep & mood tracking',
  workouts: 'Workouts with images',
  recipes: 'Healthy recipes',
  articles: 'Health articles',
  coach: 'Chat with a coach',
  insights: 'Weekly insights & reports',
};

export const DEFAULT_SETTINGS = {
  trial_days: 7,
  free_features: ['dashboard', 'water', 'weight'],
  auth_methods: { phone: true, email: true, google: true },
  maintenance_mode: false,
  announcement: '',
  support_email: 'support@nalam.app',
  coach_auto_reply: 'Thanks for reaching out! A Nalam coach will reply within 24 hours.',
};

let cache = null;
let cacheAt = 0;

export async function getSettings() {
  if (cache && Date.now() - cacheAt < 10_000) return cache;
  const rows = await db('settings').select('key', 'value');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  cache = out;
  cacheAt = Date.now();
  return out;
}

export async function updateSettings(patch) {
  const entries = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    await db('settings')
      .insert({ key, value: JSON.stringify(value), updated_at: db.fn.now() })
      .onConflict('key')
      .merge();
  }
  cache = null;
  return getSettings();
}

export function clearSettingsCache() {
  cache = null;
}
