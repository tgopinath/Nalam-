/**
 * Seeds plans, settings, the first admin and starter content. Safe to run repeatedly:
 * existing rows are left untouched (content is matched by slug/name/title).
 *   npm run seed
 */
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { config } from './config.js';
import { DEFAULT_SETTINGS } from './services/settings.js';
import { EXERCISES } from './seed-data/exercises.js';
import { WORKOUTS } from './seed-data/workouts.js';
import { FOODS } from './seed-data/foods.js';
import { RECIPES, ARTICLES } from './seed-data/content.js';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function seed({ withAdmin = true, log = console.log } = {}) {
  await db.migrate.latest();

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db('settings').insert({ key, value: JSON.stringify(value) }).onConflict('key').ignore();
  }

  const plans = [
    { code: 'monthly', name: 'Monthly', interval: 'month', duration_days: 30, price_paise: 19900, mrp_paise: 29900, sort_order: 1,
      description: 'Full access, billed every month', highlights: ['All workouts with images', 'Food & calorie tracker', 'Coach chat', 'Weekly insights'] },
    { code: 'annual', name: 'Annual', interval: 'year', duration_days: 365, price_paise: 149900, mrp_paise: 358800, sort_order: 2,
      description: 'Best value - pay for 7.5 months, get 12', highlights: ['Everything in Monthly', 'Just ₹125/month', 'Priority coach replies'] },
  ];
  for (const p of plans) {
    await db('plans').insert({ ...p, highlights: JSON.stringify(p.highlights) }).onConflict('code').ignore();
  }
  await db('coupons').insert({ code: 'WELCOME20', percent_off: 20, max_redemptions: 1000 }).onConflict('code').ignore();

  if (withAdmin && config.admin.email && config.admin.password) {
    const email = config.admin.email.toLowerCase();
    const existing = await db('users').where({ email }).first();
    if (!existing) {
      await db('users').insert({
        name: 'Nalam Admin',
        email,
        email_verified: true,
        phone: config.admin.phone || null,
        phone_verified: !!config.admin.phone,
        password_hash: await bcrypt.hash(config.admin.password, 10),
        role: 'admin',
      });
      log(`Created admin ${email}`);
    } else if (existing.role !== 'admin') {
      await db('users').where({ id: existing.id }).update({ role: 'admin' });
      log(`Promoted ${email} to admin`);
    }
  }

  for (const ex of EXERCISES) {
    const { pose, prop, ...row } = ex; // eslint-disable-line no-unused-vars
    await db('exercises').insert({ equipment: 'none', difficulty: 'beginner', ...row, image_url: `/static/images/exercises/${ex.slug}.png` }).onConflict('slug').ignore();
  }
  const exIds = Object.fromEntries((await db('exercises').select('id', 'slug')).map((e) => [e.slug, e.id]));

  for (const w of WORKOUTS) {
    const { exercises, ...row } = w;
    const [created] = await db('workouts').insert({ is_premium: true, ...row, image_url: `/static/images/workouts/${w.slug}.png` }).onConflict('slug').ignore().returning('id');
    if (created) {
      await db('workout_exercises').insert(
        exercises.map(([slug, sets, reps, duration_sec, rest_sec], i) => ({ workout_id: created.id, exercise_id: exIds[slug], position: i, sets, reps, duration_sec, rest_sec })),
      );
    }
  }

  if (!(await db('foods').whereNull('created_by').first())) {
    await db('foods').insert(
      FOODS.map(([name, local_name, category, serving_desc, serving_g, calories, protein_g, carbs_g, fat_g, fiber_g, is_veg]) => ({
        name, local_name, category, serving_desc, serving_g, calories, protein_g, carbs_g, fat_g, fiber_g, is_veg, verified: true,
      })),
    );
  }

  for (const r of RECIPES) {
    if (await db('recipes').where({ title: r.title }).first()) continue;
    await db('recipes').insert({ ...r, ingredients: JSON.stringify(r.ingredients), steps: JSON.stringify(r.steps), image_url: `/static/images/recipes/${slugify(r.title)}.png` });
  }
  for (const a of ARTICLES) {
    if (await db('articles').where({ title: a.title }).first()) continue;
    await db('articles').insert({ ...a, image_url: `/static/images/articles/${slugify(a.title)}.png` });
  }
  log('Seed complete');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await seed();
  } finally {
    await db.destroy();
  }
}
