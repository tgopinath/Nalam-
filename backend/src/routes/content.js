import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireFeature } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { caloriesBurned } from '../services/nutrition.js';

const router = Router();
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- Workouts (browsable by everyone, locked ones need premium) ---------- */
router.get('/workouts', async (req, res) => {
  const { category, difficulty, q } = req.query;
  const rows = await db('workouts')
    .where({ published: true })
    .modify((qb) => {
      if (category) qb.andWhere({ category: String(category) });
      if (difficulty) qb.andWhere({ difficulty: String(difficulty) });
      if (q) qb.andWhereILike('title', `%${String(q).slice(0, 80)}%`);
    })
    .select('workouts.*', db.raw('(select count(*)::int from workout_exercises we where we.workout_id = workouts.id) as exercise_count'))
    .orderBy('created_at', 'desc');
  const unlocked = req.access.features.includes('workouts');
  res.json(rows.map((w) => ({ ...w, locked: w.is_premium && !unlocked })));
});

router.get('/workouts/:id', async (req, res) => {
  const w = await db('workouts').where({ id: Number(req.params.id) || 0, published: true }).first();
  if (!w) throw new HttpError(404, 'Workout not found');
  if (w.is_premium && !req.access.features.includes('workouts')) {
    throw new HttpError(402, 'This workout needs a Nalam Premium subscription.', { code: 'SUBSCRIPTION_REQUIRED', feature: 'workouts' });
  }
  const exercises = await db('workout_exercises as we')
    .join('exercises as e', 'e.id', 'we.exercise_id')
    .where('we.workout_id', w.id)
    .orderBy('we.position')
    .select('we.id', 'we.sets', 'we.reps', 'we.duration_sec', 'we.rest_sec', 'we.position', 'e.id as exercise_id', 'e.name', 'e.image_url', 'e.instructions', 'e.muscle_group', 'e.equipment', 'e.met');
  res.json({ ...w, exercises });
});

router.post('/workouts/:id/complete', async (req, res) => {
  const body = z.object({ duration_min: z.coerce.number().int().min(1).max(600).optional(), date: z.iso.date().optional() }).parse(req.body || {});
  const w = await db('workouts').where({ id: Number(req.params.id) || 0 }).first();
  if (!w) throw new HttpError(404, 'Workout not found');
  if (w.is_premium && !req.access.features.includes('workouts')) throw new HttpError(402, 'Premium required', { code: 'SUBSCRIPTION_REQUIRED' });
  const minutes = body.duration_min ?? w.duration_min;
  const avgMet = await db('workout_exercises as we').join('exercises as e', 'e.id', 'we.exercise_id').where('we.workout_id', w.id).avg({ met: 'e.met' }).first();
  const kcal = caloriesBurned(Number(avgMet?.met) || 5, req.user.weight_kg, minutes);
  const [row] = await db('workout_logs')
    .insert({ user_id: req.user.id, workout_id: w.id, title: w.title, date: body.date || today(), duration_min: minutes, calories_burned: kcal })
    .returning('*');
  res.status(201).json(row);
});

/* Log any activity manually (walk, cycling, sport...) */
router.post('/activity', requireFeature('steps'), async (req, res) => {
  const body = z
    .object({ title: z.string().trim().min(1).max(140), duration_min: z.coerce.number().int().min(1).max(600), met: z.coerce.number().min(1).max(20).default(4), date: z.iso.date().optional() })
    .parse(req.body);
  const [row] = await db('workout_logs')
    .insert({ user_id: req.user.id, title: body.title, date: body.date || today(), duration_min: body.duration_min, calories_burned: caloriesBurned(body.met, req.user.weight_kg, body.duration_min) })
    .returning('*');
  res.status(201).json(row);
});

router.get('/workout-history', async (req, res) => {
  res.json(await db('workout_logs').where({ user_id: req.user.id }).orderBy('created_at', 'desc').limit(100));
});

router.get('/exercises', async (req, res) => {
  res.json(await db('exercises').orderBy('name'));
});

/* ---------- Recipes ---------- */
router.get('/recipes', requireFeature('recipes'), async (req, res) => {
  const { diet, meal, q } = req.query;
  const rows = await db('recipes')
    .where({ published: true })
    .modify((qb) => {
      if (diet) qb.andWhere({ diet_type: String(diet) });
      if (meal) qb.andWhere({ meal_type: String(meal) });
      if (q) qb.andWhereILike('title', `%${String(q).slice(0, 80)}%`);
    })
    .orderBy('title');
  res.json(rows);
});

router.get('/recipes/:id', requireFeature('recipes'), async (req, res) => {
  const r = await db('recipes').where({ id: Number(req.params.id) || 0, published: true }).first();
  if (!r) throw new HttpError(404, 'Recipe not found');
  res.json(r);
});

/* ---------- Articles ---------- */
router.get('/articles', requireFeature('articles'), async (req, res) => {
  res.json(await db('articles').where({ published: true }).orderBy('created_at', 'desc').select('id', 'title', 'image_url', 'category', 'summary', 'created_at'));
});

router.get('/articles/:id', requireFeature('articles'), async (req, res) => {
  const a = await db('articles').where({ id: Number(req.params.id) || 0, published: true }).first();
  if (!a) throw new HttpError(404, 'Article not found');
  res.json(a);
});

/* ---------- Coach chat ---------- */
router.get('/coach/messages', requireFeature('coach'), async (req, res) => {
  const rows = await db('coach_messages').where({ user_id: req.user.id }).orderBy('created_at').limit(500);
  await db('coach_messages').where({ user_id: req.user.id, sender: 'coach' }).whereNull('read_at').update({ read_at: new Date() });
  res.json(rows);
});

router.post('/coach/messages', requireFeature('coach'), async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
  const isFirst = !(await db('coach_messages').where({ user_id: req.user.id }).first());
  const [msg] = await db('coach_messages').insert({ user_id: req.user.id, sender: 'user', body }).returning('*');
  if (isFirst && req.settings.coach_auto_reply) {
    await db('coach_messages').insert({ user_id: req.user.id, sender: 'coach', body: req.settings.coach_auto_reply });
  }
  res.status(201).json(msg);
});

export default router;
