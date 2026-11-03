import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireFeature } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
const today = () => new Date().toISOString().slice(0, 10);
const dateQ = (req) => z.iso.date().optional().parse(req.query.date) || today();
const dateField = z.iso.date().optional();

/* ---------- Foods ---------- */
router.get('/foods', requireFeature('food_log'), async (req, res) => {
  const q = z.string().max(80).optional().parse(req.query.q)?.trim();
  const rows = await db('foods')
    .where((w) => w.whereNull('created_by').orWhere({ created_by: req.user.id }))
    .modify((qb) => {
      if (q) qb.andWhere((w) => w.whereILike('name', `%${q}%`).orWhereILike('local_name', `%${q}%`).orWhereILike('category', `%${q}%`));
    })
    .orderByRaw('verified desc, name asc')
    .limit(50);
  res.json(rows);
});

const foodSchema = z.object({
  name: z.string().trim().min(1).max(160),
  serving_desc: z.string().trim().max(80).default('1 serving'),
  serving_g: z.coerce.number().positive().optional(),
  calories: z.coerce.number().min(0).max(5000),
  protein_g: z.coerce.number().min(0).default(0),
  carbs_g: z.coerce.number().min(0).default(0),
  fat_g: z.coerce.number().min(0).default(0),
  fiber_g: z.coerce.number().min(0).default(0),
  is_veg: z.boolean().default(true),
});

router.post('/foods', requireFeature('food_log'), async (req, res) => {
  const body = foodSchema.parse(req.body);
  const [food] = await db('foods').insert({ ...body, created_by: req.user.id, category: 'My foods' }).returning('*');
  res.status(201).json(food);
});

/* ---------- Food log ---------- */
const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'];

router.get('/food-logs', requireFeature('food_log'), async (req, res) => {
  const date = dateQ(req);
  const rows = await db('food_logs').where({ user_id: req.user.id, date }).orderBy('created_at');
  const meals = Object.fromEntries(MEALS.map((m) => [m, rows.filter((r) => r.meal === m)]));
  const total = rows.reduce(
    (t, r) => ({ calories: t.calories + r.calories, protein: t.protein + r.protein_g, carbs: t.carbs + r.carbs_g, fat: t.fat + r.fat_g }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  res.json({ date, meals, total });
});

router.post('/food-logs', requireFeature('food_log'), async (req, res) => {
  const body = z
    .object({ food_id: z.coerce.number().int(), meal: z.enum(MEALS), servings: z.coerce.number().positive().max(20).default(1), date: dateField })
    .parse(req.body);
  const food = await db('foods').where({ id: body.food_id }).andWhere((w) => w.whereNull('created_by').orWhere({ created_by: req.user.id })).first();
  if (!food) throw new HttpError(404, 'Food not found');
  const s = body.servings;
  const r1 = (n) => Math.round(n * s * 10) / 10;
  const [row] = await db('food_logs')
    .insert({
      user_id: req.user.id,
      food_id: food.id,
      food_name: food.name,
      date: body.date || today(),
      meal: body.meal,
      servings: s,
      calories: r1(food.calories),
      protein_g: r1(food.protein_g),
      carbs_g: r1(food.carbs_g),
      fat_g: r1(food.fat_g),
    })
    .returning('*');
  res.status(201).json(row);
});

router.delete('/food-logs/:id', requireFeature('food_log'), async (req, res) => {
  const n = await db('food_logs').where({ id: req.params.id, user_id: req.user.id }).del();
  if (!n) throw new HttpError(404, 'Not found');
  res.json({ ok: true });
});

/* ---------- Water ---------- */
router.get('/water', requireFeature('water'), async (req, res) => {
  const date = dateQ(req);
  const rows = await db('water_logs').where({ user_id: req.user.id, date }).orderBy('created_at');
  res.json({ date, total_ml: rows.reduce((s, r) => s + r.amount_ml, 0), target_ml: req.user.water_target_ml, entries: rows });
});

router.post('/water', requireFeature('water'), async (req, res) => {
  const body = z.object({ amount_ml: z.coerce.number().int().min(-2000).max(2000).refine((v) => v !== 0), date: dateField }).parse(req.body);
  const date = body.date || today();
  const current = await db('water_logs').where({ user_id: req.user.id, date }).sum({ ml: 'amount_ml' }).first();
  const amount = Math.max(body.amount_ml, -Number(current?.ml || 0)); // never below zero for the day
  if (amount !== 0) await db('water_logs').insert({ user_id: req.user.id, date, amount_ml: amount });
  const total = await db('water_logs').where({ user_id: req.user.id, date }).sum({ ml: 'amount_ml' }).first();
  res.status(201).json({ date, total_ml: Number(total?.ml || 0) });
});

/* ---------- Daily single-value logs: weight, steps, sleep, mood ---------- */
function dailyLog(path, table, feature, schema, after) {
  router.get(`/${path}`, requireFeature(feature), async (req, res) => {
    const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days ?? 30);
    const rows = await db(table)
      .where({ user_id: req.user.id })
      .andWhere('date', '>', db.raw('current_date - ?::int', [days]))
      .orderBy('date');
    res.json(rows);
  });
  router.put(`/${path}`, requireFeature(feature), async (req, res) => {
    const body = schema.extend({ date: dateField }).parse(req.body);
    const date = body.date || today();
    const [row] = await db(table)
      .insert({ ...body, user_id: req.user.id, date })
      .onConflict(['user_id', 'date'])
      .merge()
      .returning('*');
    if (after) await after(req, row);
    res.json(row);
  });
}

dailyLog('weight', 'weight_logs', 'weight', z.object({ weight_kg: z.coerce.number().min(25).max(300) }), async (req, row) => {
  // keep the profile weight in sync with the most recent entry
  const latest = await db('weight_logs').where({ user_id: req.user.id }).orderBy('date', 'desc').first();
  if (latest?.id === row.id) await db('users').where({ id: req.user.id }).update({ weight_kg: row.weight_kg });
});
dailyLog('steps', 'step_logs', 'steps', z.object({ steps: z.coerce.number().int().min(0).max(100000) }));
dailyLog('sleep', 'sleep_logs', 'sleep', z.object({ hours: z.coerce.number().min(0).max(24), quality: z.coerce.number().int().min(1).max(5).optional() }));
dailyLog('mood', 'mood_logs', 'sleep', z.object({ mood: z.coerce.number().int().min(1).max(5), note: z.string().max(280).optional() }));

export default router;
