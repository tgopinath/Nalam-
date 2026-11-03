import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../../db.js';
import { HttpError } from '../../middleware/errors.js';
import { getSettings, updateSettings, FEATURES, DEFAULT_SETTINGS } from '../../services/settings.js';
import { entitlement } from '../../services/entitlement.js';
import { publicUser } from '../../services/users.js';
import { UPLOAD_DIR } from '../../paths.js';

const router = Router();
const id = (req) => {
  const n = Number(req.params.id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id');
  return n;
};
const uuidParam = (req) => z.uuid().parse(req.params.id);

/* ---------- Overview ---------- */
router.get('/stats', async (req, res) => {
  const now = new Date();
  const [users, newWeek, premium, trial, revenue, revenueMonth, byDay, openChats] = await Promise.all([
    db('users').count({ n: '*' }).first(),
    db('users').where('created_at', '>', db.raw("now() - interval '7 days'")).count({ n: '*' }).first(),
    db('users').where('premium_until', '>', now).count({ n: '*' }).first(),
    db('users').where('trial_ends_at', '>', now).andWhere((q) => q.whereNull('premium_until').orWhere('premium_until', '<=', now)).count({ n: '*' }).first(),
    db('payments').where({ status: 'paid' }).sum({ s: 'amount_paise' }).first(),
    db('payments').where({ status: 'paid' }).andWhere('created_at', '>', db.raw("date_trunc('month', now())")).sum({ s: 'amount_paise' }).first(),
    db.raw(`select to_char(d, 'YYYY-MM-DD') as date,
              (select count(*)::int from users u where u.created_at::date = d) as signups,
              (select coalesce(sum(amount_paise),0)::int from payments p where p.status='paid' and p.created_at::date = d) as revenue_paise
            from generate_series(current_date - 29, current_date, '1 day') d order by d`),
    db.raw(`select count(*)::int as n from (select distinct on (user_id) user_id, sender from coach_messages order by user_id, created_at desc) t where sender='user'`),
  ]);
  res.json({
    users: Number(users.n),
    new_this_week: Number(newWeek.n),
    premium: Number(premium.n),
    trial: Number(trial.n),
    expired: Number(users.n) - Number(premium.n) - Number(trial.n),
    revenue_paise: Number(revenue.s || 0),
    revenue_month_paise: Number(revenueMonth.s || 0),
    daily: byDay.rows,
    open_chats: openChats.rows[0].n,
  });
});

/* ---------- Settings ---------- */
router.get('/settings', async (req, res) => {
  res.json({ settings: await getSettings(), features: FEATURES, defaults: DEFAULT_SETTINGS });
});

router.put('/settings', async (req, res) => {
  const patch = z
    .object({
      trial_days: z.coerce.number().int().min(0).max(365),
      free_features: z.array(z.enum(Object.keys(FEATURES))),
      auth_methods: z.object({ phone: z.boolean(), email: z.boolean(), google: z.boolean() }),
      maintenance_mode: z.boolean(),
      announcement: z.string().max(500),
      support_email: z.string().max(200),
      coach_auto_reply: z.string().max(1000),
    })
    .partial()
    .parse(req.body);
  res.json({ settings: await updateSettings(patch) });
});

/* ---------- Users ---------- */
router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 100);
  const filter = String(req.query.filter || '');
  const page = Math.max(1, Number(req.query.page) || 1);
  const now = new Date();
  const base = db('users').modify((qb) => {
    if (q) qb.where((w) => w.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`).orWhereILike('phone', `%${q}%`));
    if (filter === 'premium') qb.andWhere('premium_until', '>', now);
    if (filter === 'trial') qb.andWhere('trial_ends_at', '>', now).andWhere((w) => w.whereNull('premium_until').orWhere('premium_until', '<=', now));
    if (filter === 'expired') qb.andWhere((w) => w.whereNull('trial_ends_at').orWhere('trial_ends_at', '<=', now)).andWhere((w) => w.whereNull('premium_until').orWhere('premium_until', '<=', now));
    if (filter === 'blocked') qb.andWhere({ status: 'blocked' });
    if (filter === 'admin') qb.andWhere({ role: 'admin' });
  });
  const [{ n }] = await base.clone().count({ n: '*' });
  const rows = await base.clone().orderBy('created_at', 'desc').limit(25).offset((page - 1) * 25);
  const settings = await getSettings();
  res.json({ total: Number(n), page, pageSize: 25, users: rows.map((u) => ({ ...publicUser(u), access: entitlement(u, settings) })) });
});

router.get('/users/:id', async (req, res) => {
  const user = await db('users').where({ id: uuidParam(req) }).first();
  if (!user) throw new HttpError(404, 'User not found');
  const [payments, activity] = await Promise.all([
    db('payments as p').leftJoin('plans as pl', 'pl.id', 'p.plan_id').where('p.user_id', user.id).orderBy('p.created_at', 'desc').select('p.*', 'pl.name as plan_name'),
    db.raw(
      `select (select count(*)::int from food_logs where user_id=?) as food_logs,
              (select count(*)::int from workout_logs where user_id=?) as workouts,
              (select count(*)::int from water_logs where user_id=?) as water_logs,
              (select count(*)::int from weight_logs where user_id=?) as weight_logs`,
      [user.id, user.id, user.id, user.id],
    ),
  ]);
  res.json({ user: publicUser(user), access: entitlement(user, await getSettings()), payments, activity: activity.rows[0] });
});

router.patch('/users/:id', async (req, res) => {
  const uid = uuidParam(req);
  const body = z
    .object({
      name: z.string().max(120),
      role: z.enum(['user', 'admin']),
      status: z.enum(['active', 'blocked']),
      trial_ends_at: z.iso.datetime({ offset: true }).nullable(),
      premium_until: z.iso.datetime({ offset: true }).nullable(),
    })
    .partial()
    .parse(req.body);
  if (uid === req.user.id && (body.role === 'user' || body.status === 'blocked')) throw new HttpError(400, "You can't demote or block yourself");
  const update = { ...body, updated_at: new Date() };
  if (body.status === 'blocked') update.token_version = db.raw('token_version + 1'); // sign them out everywhere
  const [user] = await db('users').where({ id: uid }).update(update).returning('*');
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user: publicUser(user) });
});

/** Give a user free premium days (complimentary / support gesture). Recorded as a manual payment of ₹0. */
router.post('/users/:id/grant', async (req, res) => {
  const uid = uuidParam(req);
  const { days, note } = z.object({ days: z.coerce.number().int().min(1).max(3650), note: z.string().max(200).optional() }).parse(req.body);
  const user = await db('users').where({ id: uid }).first();
  if (!user) throw new HttpError(404, 'User not found');
  const now = new Date();
  const start = user.premium_until && new Date(user.premium_until) > now ? new Date(user.premium_until) : now;
  const end = new Date(start.getTime() + days * 86_400_000);
  await db.transaction(async (trx) => {
    await trx('users').where({ id: uid }).update({ premium_until: end });
    await trx('payments').insert({ user_id: uid, provider: 'manual', amount_paise: 0, status: 'paid', duration_days: days, period_start: start, period_end: end, note: note || `Granted by admin ${req.user.email || req.user.phone}` });
    await trx('notifications').insert({ user_id: uid, title: 'You received Nalam Premium 🎁', body: `${days} days of Premium have been added to your account.` });
  });
  res.json({ premium_until: end });
});

router.delete('/users/:id', async (req, res) => {
  const uid = uuidParam(req);
  if (uid === req.user.id) throw new HttpError(400, "You can't delete yourself");
  await db('users').where({ id: uid }).del();
  res.json({ ok: true });
});

/* ---------- Payments ---------- */
router.get('/payments', async (req, res) => {
  const status = String(req.query.status || '');
  const page = Math.max(1, Number(req.query.page) || 1);
  const rows = await db('payments as p')
    .join('users as u', 'u.id', 'p.user_id')
    .leftJoin('plans as pl', 'pl.id', 'p.plan_id')
    .modify((qb) => { if (status) qb.where('p.status', status); })
    .orderBy('p.created_at', 'desc')
    .limit(50).offset((page - 1) * 50)
    .select('p.*', 'u.name as user_name', 'u.email as user_email', 'u.phone as user_phone', 'pl.name as plan_name');
  res.json(rows);
});

router.patch('/payments/:id', async (req, res) => {
  const pid = uuidParam(req);
  const { status, note } = z.object({ status: z.enum(['refunded', 'failed']), note: z.string().max(200).optional() }).parse(req.body);
  const [p] = await db('payments').where({ id: pid }).update({ status, note, updated_at: new Date() }).returning('*');
  if (!p) throw new HttpError(404, 'Payment not found');
  res.json(p);
});

/* ---------- Generic content CRUD ---------- */
const img = z.string().max(500).nullable().optional();
const schemas = {
  plans: z.object({
    code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_-]+$/i),
    name: z.string().trim().min(1).max(80),
    interval: z.enum(['month', 'year', 'custom']),
    duration_days: z.coerce.number().int().min(1).max(3650),
    price_paise: z.coerce.number().int().min(100),
    mrp_paise: z.coerce.number().int().min(0).nullable().optional(),
    currency: z.string().length(3).default('INR'),
    description: z.string().max(500).nullable().optional(),
    highlights: z.array(z.string().max(120)).default([]),
    active: z.boolean().default(true),
    sort_order: z.coerce.number().int().default(0),
  }),
  coupons: z.object({
    code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/i).transform((s) => s.toUpperCase()),
    percent_off: z.coerce.number().int().min(1).max(100).nullable().optional(),
    amount_off_paise: z.coerce.number().int().min(1).nullable().optional(),
    max_redemptions: z.coerce.number().int().min(1).nullable().optional(),
    expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
    active: z.boolean().default(true),
  }),
  foods: z.object({
    name: z.string().trim().min(1).max(160),
    local_name: z.string().max(160).nullable().optional(),
    category: z.string().max(60).nullable().optional(),
    serving_desc: z.string().max(80).default('1 serving'),
    serving_g: z.coerce.number().positive().nullable().optional(),
    calories: z.coerce.number().min(0),
    protein_g: z.coerce.number().min(0).default(0),
    carbs_g: z.coerce.number().min(0).default(0),
    fat_g: z.coerce.number().min(0).default(0),
    fiber_g: z.coerce.number().min(0).default(0),
    is_veg: z.boolean().default(true),
    image_url: img,
    verified: z.boolean().default(true),
  }),
  exercises: z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9-]+$/),
    category: z.enum(['strength', 'cardio', 'yoga', 'stretching', 'hiit']),
    muscle_group: z.string().max(60).nullable().optional(),
    equipment: z.string().max(60).default('none'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    image_url: img,
    instructions: z.string().max(5000).nullable().optional(),
    met: z.coerce.number().min(1).max(20).default(4),
  }),
  workouts: z.object({
    title: z.string().trim().min(1).max(140),
    slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/),
    description: z.string().max(5000).nullable().optional(),
    image_url: img,
    category: z.enum(['strength', 'cardio', 'yoga', 'stretching', 'hiit']),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    duration_min: z.coerce.number().int().min(1).max(300),
    calories_est: z.coerce.number().int().min(0).max(3000),
    is_premium: z.boolean().default(true),
    published: z.boolean().default(true),
  }),
  recipes: z.object({
    title: z.string().trim().min(1).max(160),
    image_url: img,
    description: z.string().max(2000).nullable().optional(),
    ingredients: z.array(z.string().max(200)).default([]),
    steps: z.array(z.string().max(1000)).default([]),
    calories: z.coerce.number().int().min(0),
    protein_g: z.coerce.number().min(0).default(0),
    carbs_g: z.coerce.number().min(0).default(0),
    fat_g: z.coerce.number().min(0).default(0),
    prep_min: z.coerce.number().int().min(0).default(15),
    diet_type: z.enum(['veg', 'non_veg', 'eggetarian', 'vegan']).default('veg'),
    meal_type: z.enum(['breakfast', 'lunch', 'snacks', 'dinner']).default('lunch'),
    published: z.boolean().default(true),
  }),
  articles: z.object({
    title: z.string().trim().min(1).max(200),
    image_url: img,
    category: z.string().max(40).default('wellness'),
    summary: z.string().max(500).nullable().optional(),
    body: z.string().min(1).max(50000),
    published: z.boolean().default(true),
  }),
};
const jsonCols = { plans: ['highlights'], recipes: ['ingredients', 'steps'] };
const pk = { coupons: 'code' };

function toRow(table, data) {
  const out = { ...data };
  for (const c of jsonCols[table] || []) if (c in out) out[c] = JSON.stringify(out[c]);
  return out;
}

for (const [table, schema] of Object.entries(schemas)) {
  const key = pk[table] || 'id';
  const keyOf = (req) => (key === 'id' ? id(req) : String(req.params.id).toUpperCase());

  router.get(`/${table}`, async (req, res) => {
    const q = String(req.query.q || '').slice(0, 80);
    const label = table === 'workouts' || table === 'recipes' || table === 'articles' ? 'title' : table === 'coupons' ? 'code' : 'name';
    const rows = await db(table)
      .modify((qb) => {
        if (q) qb.whereILike(label, `%${q}%`);
        if (table === 'foods') qb.whereNull('created_by');
      })
      .orderBy(table === 'plans' ? 'sort_order' : key === 'id' ? 'id' : 'created_at', table === 'plans' ? 'asc' : 'desc')
      .limit(500);
    res.json(rows);
  });
  router.post(`/${table}`, async (req, res) => {
    const [row] = await db(table).insert(toRow(table, schema.parse(req.body))).returning('*');
    res.status(201).json(row);
  });
  router.put(`/${table}/:id`, async (req, res) => {
    const data = schema.partial().parse(req.body);
    const [row] = await db(table).where({ [key]: keyOf(req) }).update({ ...toRow(table, data), updated_at: new Date() }).returning('*');
    if (!row) throw new HttpError(404, 'Not found');
    res.json(row);
  });
  router.delete(`/${table}/:id`, async (req, res) => {
    const n = await db(table).where({ [key]: keyOf(req) }).del();
    if (!n) throw new HttpError(404, 'Not found');
    res.json({ ok: true });
  });
}

/* Workout exercise list (replace whole list) */
router.get('/workouts/:id/exercises', async (req, res) => {
  res.json(await db('workout_exercises').where({ workout_id: id(req) }).orderBy('position'));
});
router.put('/workouts/:id/exercises', async (req, res) => {
  const wid = id(req);
  const items = z
    .array(z.object({
      exercise_id: z.coerce.number().int(),
      sets: z.coerce.number().int().min(1).max(20).default(1),
      reps: z.coerce.number().int().min(1).max(500).nullable().optional(),
      duration_sec: z.coerce.number().int().min(5).max(3600).nullable().optional(),
      rest_sec: z.coerce.number().int().min(0).max(600).default(20),
    }))
    .max(60)
    .parse(req.body);
  if (!(await db('workouts').where({ id: wid }).first())) throw new HttpError(404, 'Workout not found');
  await db.transaction(async (trx) => {
    await trx('workout_exercises').where({ workout_id: wid }).del();
    if (items.length) await trx('workout_exercises').insert(items.map((it, i) => ({ ...it, workout_id: wid, position: i })));
  });
  res.json(await db('workout_exercises').where({ workout_id: wid }).orderBy('position'));
});

/* ---------- Image upload ---------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype) && /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    cb(ok ? null : new HttpError(400, 'Only JPG, PNG, WEBP or GIF images up to 5MB'), ok);
  },
});
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'No image uploaded (field name: image)');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

/* ---------- Coach inbox ---------- */
router.get('/coach/threads', async (req, res) => {
  const rows = await db.raw(`
    select u.id as user_id, u.name, u.email, u.phone, last.body as last_body, last.sender as last_sender, last.created_at as last_at,
      (select count(*)::int from coach_messages m where m.user_id = u.id and m.sender='user'
         and m.created_at > coalesce((select max(created_at) from coach_messages c where c.user_id=u.id and c.sender='coach'), 'epoch')) as unanswered
    from (select distinct on (user_id) * from coach_messages order by user_id, created_at desc) last
    join users u on u.id = last.user_id
    order by last.created_at desc limit 200`);
  res.json(rows.rows);
});
router.get('/coach/threads/:id', async (req, res) => {
  const uid = uuidParam(req);
  const user = await db('users').where({ id: uid }).first();
  if (!user) throw new HttpError(404, 'User not found');
  const messages = await db('coach_messages').where({ user_id: uid }).orderBy('created_at');
  res.json({ user: publicUser(user), messages });
});
router.post('/coach/threads/:id', async (req, res) => {
  const uid = uuidParam(req);
  const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
  const [msg] = await db('coach_messages').insert({ user_id: uid, sender: 'coach', coach_id: req.user.id, body }).returning('*');
  await db('notifications').insert({ user_id: uid, title: 'New message from your coach', body: body.slice(0, 140) });
  res.status(201).json(msg);
});

/* ---------- Notifications ---------- */
router.get('/notifications', async (req, res) => {
  res.json(await db('notifications').whereNull('user_id').orderBy('created_at', 'desc').limit(100));
});
router.post('/notifications', async (req, res) => {
  const b = z.object({ title: z.string().trim().min(1).max(140), body: z.string().trim().min(1).max(2000), user_id: z.uuid().optional() }).parse(req.body);
  const [n] = await db('notifications').insert({ title: b.title, body: b.body, user_id: b.user_id ?? null }).returning('*');
  res.status(201).json(n);
});
router.delete('/notifications/:id', async (req, res) => {
  await db('notifications').where({ id: id(req) }).del();
  res.json({ ok: true });
});

export default router;
