import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireFeature } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { computeTargets } from '../services/nutrition.js';
import { publicUser, sessionPayload } from '../services/users.js';
import { FEATURES } from '../services/settings.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await sessionPayload(req.user));
});

const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    gender: z.enum(['male', 'female', 'other']),
    dob: z.iso.date(),
    height_cm: z.coerce.number().min(90).max(250),
    weight_kg: z.coerce.number().min(25).max(300),
    target_weight_kg: z.coerce.number().min(25).max(300),
    activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    goal: z.enum(['lose', 'maintain', 'gain']),
    diet_pref: z.enum(['veg', 'non_veg', 'eggetarian', 'vegan']),
    step_target: z.coerce.number().int().min(1000).max(50000),
    water_target_ml: z.coerce.number().int().min(500).max(6000),
    calorie_target: z.coerce.number().int().min(1000).max(6000),
  })
  .partial();

router.patch('/profile', async (req, res) => {
  const patch = profileSchema.parse(req.body);
  const merged = { ...req.user, ...patch };
  const targets = computeTargets(merged);
  const update = { ...patch, updated_at: new Date() };
  const bodyChanged = ['gender', 'dob', 'height_cm', 'weight_kg', 'activity_level', 'goal'].some((k) => k in patch);
  if (targets && bodyChanged) {
    // recompute targets from body stats unless the user explicitly set their own in this request
    update.calorie_target = patch.calorie_target ?? targets.calorie_target;
    update.protein_g = targets.protein_g;
    update.carbs_g = targets.carbs_g;
    update.fat_g = targets.fat_g;
    if (!patch.water_target_ml) update.water_target_ml = targets.water_target_ml;
  }
  if (merged.height_cm && merged.weight_kg && merged.goal && merged.dob) update.onboarded = true;
  const [user] = await db('users').where({ id: req.user.id }).update(update).returning('*');
  if ('weight_kg' in patch) {
    const today = new Date().toISOString().slice(0, 10);
    await db('weight_logs').insert({ user_id: user.id, date: today, weight_kg: patch.weight_kg }).onConflict(['user_id', 'date']).merge();
  }
  res.json({ user: publicUser(user), targets });
});

router.post('/password', async (req, res) => {
  const body = z.object({ current: z.string().optional(), password: z.string().min(8).max(100) }).parse(req.body);
  if (req.user.password_hash && !(await bcrypt.compare(body.current || '', req.user.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  await db('users').where({ id: req.user.id }).update({ password_hash: await bcrypt.hash(body.password, 10) });
  res.json({ ok: true });
});

router.delete('/', async (req, res) => {
  await db('users').where({ id: req.user.id }).del();
  res.json({ ok: true });
});

/* ---------- Dashboard ---------- */
const dateParam = z.iso.date().optional();
const todayStr = () => new Date().toISOString().slice(0, 10);

router.get('/dashboard', requireFeature('dashboard'), async (req, res) => {
  const date = dateParam.parse(req.query.date) || todayStr();
  const uid = req.user.id;
  const can = (f) => req.access.features.includes(f);
  const [food, water, steps, sleep, mood, workouts, weights, streak] = await Promise.all([
    db('food_logs').where({ user_id: uid, date })
      .select(db.raw('coalesce(sum(calories),0)::float as calories, coalesce(sum(protein_g),0)::float as protein, coalesce(sum(carbs_g),0)::float as carbs, coalesce(sum(fat_g),0)::float as fat'))
      .first(),
    db('water_logs').where({ user_id: uid, date }).sum({ ml: 'amount_ml' }).first(),
    db('step_logs').where({ user_id: uid, date }).first(),
    db('sleep_logs').where({ user_id: uid, date }).first(),
    db('mood_logs').where({ user_id: uid, date }).first(),
    db('workout_logs').where({ user_id: uid, date }).select('title', 'duration_min', 'calories_burned'),
    db('weight_logs').where({ user_id: uid }).orderBy('date', 'desc').limit(30).select('date', 'weight_kg'),
    loggingStreak(uid),
  ]);
  const burned = workouts.reduce((s, w) => s + w.calories_burned, 0);
  res.json({
    date,
    targets: {
      calories: req.user.calorie_target,
      protein: req.user.protein_g,
      carbs: req.user.carbs_g,
      fat: req.user.fat_g,
      water_ml: req.user.water_target_ml,
      steps: req.user.step_target,
    },
    food: can('food_log') ? food : null,
    burned,
    water_ml: Number(water?.ml || 0),
    steps: can('steps') ? steps?.steps ?? 0 : null,
    sleep: can('sleep') ? sleep ?? null : null,
    mood: can('sleep') ? mood ?? null : null,
    workouts: can('workouts') ? workouts : null,
    weights: weights.reverse(),
    streak,
    locked: Object.keys(FEATURES).filter((f) => !can(f)),
  });
});

async function loggingStreak(uid) {
  const rows = await db.raw(
    `select distinct date from (
       select date from food_logs where user_id = ? union
       select date from water_logs where user_id = ? union
       select date from workout_logs where user_id = ?
     ) d where date > current_date - 400 order by date desc`,
    [uid, uid, uid],
  );
  const dates = new Set(rows.rows.map((r) => r.date));
  let streak = 0;
  const d = new Date();
  if (!dates.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1); // today not logged yet is fine
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

/* ---------- Weekly insights ---------- */
router.get('/insights', requireFeature('insights'), async (req, res) => {
  const uid = req.user.id;
  const q = (table, expr) =>
    db(table).where({ user_id: uid }).andWhere('date', '>', db.raw('current_date - 7')).groupBy('date').select('date', db.raw(`${expr} as value`)).orderBy('date');
  const [calories, water, steps, sleep, workouts, weight] = await Promise.all([
    q('food_logs', 'sum(calories)::float'),
    q('water_logs', 'sum(amount_ml)::int'),
    q('step_logs', 'max(steps)'),
    q('sleep_logs', 'max(hours)::float'),
    q('workout_logs', 'sum(duration_min)::int'),
    db('weight_logs').where({ user_id: uid }).orderBy('date', 'desc').limit(60).select('date', 'weight_kg'),
  ]);
  const avg = (rows) => (rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.value), 0) / rows.length) : 0);
  const tips = [];
  if (avg(water) < (req.user.water_target_ml || 2500) * 0.8) tips.push('You are drinking less water than your goal. Keep a bottle at your desk.');
  if (avg(steps) < (req.user.step_target || 8000) * 0.8) tips.push('Add a 15-minute walk after lunch to close your step gap.');
  if (req.user.calorie_target && avg(calories) > req.user.calorie_target * 1.1) tips.push('Calories are above target most days — watch evening snacks.');
  if (workouts.length < 3) tips.push('Aim for at least 3 workouts a week.');
  if (!tips.length) tips.push('Great consistency this week — keep it up! 💪');
  res.json({
    days: 7,
    series: { calories, water, steps, sleep, workouts },
    averages: { calories: avg(calories), water_ml: avg(water), steps: avg(steps), sleep_hours: avg(sleep), workout_days: workouts.length },
    weight: weight.reverse(),
    tips,
  });
});

/* ---------- Notifications ---------- */
router.get('/notifications', async (req, res) => {
  const rows = await db('notifications')
    .where((q) => q.where({ user_id: req.user.id }).orWhereNull('user_id'))
    .andWhere('created_at', '>=', req.user.created_at)
    .orderBy('created_at', 'desc')
    .limit(50);
  res.json(rows);
});

export default router;
