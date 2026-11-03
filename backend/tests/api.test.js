import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { db } from '../src/db.js';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';
import { devOutbox } from '../src/services/messaging.js';
import { clearSettingsCache } from '../src/services/settings.js';

const app = createApp();
let adminToken;

const lastOtp = (to) => {
  const m = [...devOutbox].reverse().find((x) => x.to === to);
  return m?.text.match(/\d{6}/)[0];
};
const auth = (t) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  await db.migrate.rollback(undefined, true);
  config.admin.email = 'admin@test.dev';
  config.admin.password = 'Admin@12345';
  await seed({ log: () => {} });
  clearSettingsCache();
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.dev', password: 'Admin@12345' });
  adminToken = res.body.token;
});
after(() => db.destroy());

async function phoneSignup(phone, name = 'Test') {
  await request(app).post('/api/auth/otp/request').send({ channel: 'phone', target: phone }).expect(200);
  const normalized = phone.startsWith('+') ? phone : `+91${phone}`;
  const res = await request(app).post('/api/auth/otp/verify').send({ channel: 'phone', target: phone, code: lastOtp(normalized), name });
  return res;
}

test('public config exposes plans and trial days', async () => {
  const res = await request(app).get('/api/config').expect(200);
  assert.equal(res.body.trialDays, 7);
  assert.equal(res.body.plans.length, 2);
});

test('phone OTP signup gives a 7-day full-access trial', async () => {
  const res = await phoneSignup('9876543210', 'Priya');
  assert.equal(res.status, 201);
  assert.equal(res.body.user.phone, '+919876543210');
  assert.equal(res.body.access.status, 'trial');
  assert.equal(res.body.access.daysLeft, 7);
  assert.ok(res.body.access.features.includes('workouts'));
  // second login with same phone logs into same account
  await new Promise((r) => setTimeout(r, 0));
  await db('otps').update({ created_at: new Date(Date.now() - 60_000) }); // skip cooldown
  const again = await phoneSignup('+919876543210');
  assert.equal(again.status, 200);
  assert.equal(again.body.user.id, res.body.user.id);
});

test('wrong OTP is rejected and limited', async () => {
  await request(app).post('/api/auth/otp/request').send({ channel: 'email', target: 'otp@x.dev' }).expect(200);
  const bad = await request(app).post('/api/auth/otp/verify').send({ channel: 'email', target: 'otp@x.dev', code: '000000' });
  assert.equal(bad.status, lastOtp('otp@x.dev') === '000000' ? 201 : 400);
  const cooldown = await request(app).post('/api/auth/otp/request').send({ channel: 'email', target: 'otp@x.dev' });
  assert.equal(cooldown.status, 429);
});

test('email register, login, onboarding computes targets', async () => {
  const reg = await request(app).post('/api/auth/register').send({ name: 'Arun', email: 'Arun@Example.com', password: 'secret123' }).expect(201);
  assert.equal(reg.body.user.email, 'arun@example.com');
  await request(app).post('/api/auth/login').send({ email: 'arun@example.com', password: 'wrong' }).expect(401);
  const login = await request(app).post('/api/auth/login').send({ email: 'arun@example.com', password: 'secret123' }).expect(200);
  const t = login.body.token;
  const prof = await request(app).patch('/api/me/profile').set(auth(t))
    .send({ gender: 'male', dob: '1992-05-10', height_cm: 175, weight_kg: 80, target_weight_kg: 72, activity_level: 'light', goal: 'lose', diet_pref: 'veg' })
    .expect(200);
  assert.equal(prof.body.user.onboarded, true);
  assert.ok(prof.body.user.calorie_target > 1500 && prof.body.user.calorie_target < 2500);
  assert.equal(prof.body.user.bmi.value, 26.1);

  // tracking works during trial
  const foods = await request(app).get('/api/foods?q=idli').set(auth(t)).expect(200);
  assert.ok(foods.body.length >= 1);
  await request(app).post('/api/food-logs').set(auth(t)).send({ food_id: foods.body[0].id, meal: 'breakfast', servings: 3 }).expect(201);
  await request(app).post('/api/water').set(auth(t)).send({ amount_ml: 500 }).expect(201);
  const dash = await request(app).get('/api/me/dashboard').set(auth(t)).expect(200);
  assert.equal(dash.body.food.calories, 174);
  assert.equal(dash.body.water_ml, 500);
  assert.equal(dash.body.streak, 1);
});

test('password reset via email OTP', async () => {
  await request(app).post('/api/auth/password/forgot').send({ email: 'arun@example.com' }).expect(200);
  const code = lastOtp('arun@example.com');
  await request(app).post('/api/auth/password/reset').send({ email: 'arun@example.com', code, password: 'newpass123' }).expect(200);
  await request(app).post('/api/auth/login').send({ email: 'arun@example.com', password: 'newpass123' }).expect(200);
});

test('after the trial premium features are locked, free ones still work, and paying unlocks', async () => {
  const signup = await phoneSignup('9000000001', 'Kavi');
  const t = signup.body.token;
  const uid = signup.body.user.id;
  await db('users').where({ id: uid }).update({ trial_ends_at: new Date(Date.now() - 1000) });

  const me = await request(app).get('/api/me').set(auth(t)).expect(200);
  assert.equal(me.body.access.status, 'expired');
  const locked = await request(app).get('/api/foods').set(auth(t)).expect(402);
  assert.equal(locked.body.code, 'SUBSCRIPTION_REQUIRED');
  await request(app).post('/api/water').set(auth(t)).send({ amount_ml: 250 }).expect(201); // free feature

  const workouts = await request(app).get('/api/workouts').set(auth(t)).expect(200);
  const premium = workouts.body.find((w) => w.is_premium);
  const free = workouts.body.find((w) => !w.is_premium);
  assert.equal(premium.locked, true);
  assert.equal(free.locked, false);
  await request(app).get(`/api/workouts/${premium.id}`).set(auth(t)).expect(402);
  const freeDetail = await request(app).get(`/api/workouts/${free.id}`).set(auth(t)).expect(200);
  assert.ok(freeDetail.body.exercises[0].image_url.endsWith('.png'));

  // buy the monthly plan with a coupon (mock gateway)
  const plans = await request(app).get('/api/subscription/plans').expect(200);
  const monthly = plans.body.find((p) => p.code === 'monthly');
  const coupon = await request(app).post('/api/subscription/coupon').set(auth(t)).send({ planId: monthly.id, code: 'welcome20' }).expect(200);
  assert.equal(coupon.body.amount, Math.round(monthly.price_paise * 0.8));
  const co = await request(app).post('/api/subscription/checkout').set(auth(t)).send({ planId: monthly.id, coupon: 'WELCOME20' }).expect(200);
  assert.equal(co.body.amount, coupon.body.amount);
  await request(app).post('/api/subscription/verify').set(auth(t))
    .send({ razorpay_order_id: co.body.orderId, razorpay_payment_id: 'pay_x', razorpay_signature: 'nope' }).expect(400);

  const co2 = await request(app).post('/api/subscription/checkout').set(auth(t)).send({ planId: monthly.id }).expect(200);
  const ok = await request(app).post('/api/subscription/verify').set(auth(t))
    .send({ razorpay_order_id: co2.body.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'mock_signature' }).expect(200);
  assert.equal(ok.body.access.status, 'premium');
  assert.ok(ok.body.access.daysLeft >= 29);
  // verifying twice does not extend twice
  const twice = await request(app).post('/api/subscription/verify').set(auth(t))
    .send({ razorpay_order_id: co2.body.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'mock_signature' }).expect(200);
  assert.equal(twice.body.user.premium_until, ok.body.user.premium_until);
  await request(app).get('/api/foods').set(auth(t)).expect(200);
  await request(app).get(`/api/workouts/${premium.id}`).set(auth(t)).expect(200);

  const hist = await request(app).get('/api/subscription/history').set(auth(t)).expect(200);
  assert.equal(hist.body.filter((p) => p.status === 'paid').length, 1);
});

test('hosted checkout page (used by the Android app) is signed', async () => {
  const s = await phoneSignup('9000000002');
  const t = s.body.token;
  const plan = (await request(app).get('/api/subscription/plans')).body[1];
  const co = await request(app).post('/api/subscription/checkout').set(auth(t)).send({ planId: plan.id }).expect(200);
  const url = new URL(co.body.hostedUrl);
  await request(app).get(`${url.pathname}?sig=bad`).expect(404);
  const page = await request(app).get(url.pathname + url.search).expect(200);
  assert.match(page.text, /Pay securely/);
  await request(app).post(`${url.pathname}/complete${url.search}`)
    .send({ razorpay_order_id: co.body.orderId, razorpay_payment_id: 'pay_h', razorpay_signature: 'mock_signature' }).expect(200);
  const me = await request(app).get('/api/me').set(auth(t)).expect(200);
  assert.equal(me.body.access.status, 'premium');
  assert.ok(me.body.access.daysLeft >= 365);
});

test('razorpay webhook requires a valid signature', async () => {
  config.payments.razorpayWebhookSecret = 'whsec';
  const s = await phoneSignup('9000000003');
  const plan = (await request(app).get('/api/subscription/plans')).body[0];
  const co = await request(app).post('/api/subscription/checkout').set(auth(s.body.token)).send({ planId: plan.id }).expect(200);
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_wh', order_id: co.body.orderId } } } });
  await request(app).post('/api/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', 'bad').send(body).expect(400);
  const sig = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
  await request(app).post('/api/webhooks/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sig).send(body).expect(200);
  const p = await db('payments').where({ provider_order_id: co.body.orderId }).first();
  assert.equal(p.status, 'paid');
});

test('admin controls: settings, users, grant, block, content', async () => {
  const user = await phoneSignup('9000000004', 'Meena');
  const t = user.body.token;
  const uid = user.body.user.id;

  await request(app).get('/api/admin/stats').set(auth(t)).expect(403);
  const stats = await request(app).get('/api/admin/stats').set(auth(adminToken)).expect(200);
  assert.ok(stats.body.users >= 5);

  // admin makes food logging free after trial + changes trial length
  await request(app).put('/api/admin/settings').set(auth(adminToken)).send({ trial_days: 14, free_features: ['dashboard', 'water', 'weight', 'food_log'] }).expect(200);
  clearSettingsCache();
  await db('users').where({ id: uid }).update({ trial_ends_at: new Date(Date.now() - 1000) });
  await request(app).get('/api/foods').set(auth(t)).expect(200);
  await request(app).get('/api/recipes').set(auth(t)).expect(402);

  // grant 30 days
  await request(app).post(`/api/admin/users/${uid}/grant`).set(auth(adminToken)).send({ days: 30 }).expect(200);
  await request(app).get('/api/recipes').set(auth(t)).expect(200);

  // block -> logged out
  await request(app).patch(`/api/admin/users/${uid}`).set(auth(adminToken)).send({ status: 'blocked' }).expect(200);
  await request(app).get('/api/me').set(auth(t)).expect(401);

  // content CRUD
  const w = await request(app).post('/api/admin/workouts').set(auth(adminToken))
    .send({ title: 'Test Flow', slug: 'test-flow', category: 'yoga', duration_min: 10, calories_est: 50 }).expect(201);
  const ex = await request(app).get('/api/admin/exercises').set(auth(adminToken)).expect(200);
  const list = await request(app).put(`/api/admin/workouts/${w.body.id}/exercises`).set(auth(adminToken))
    .send([{ exercise_id: ex.body[0].id, sets: 2, duration_sec: 30 }]).expect(200);
  assert.equal(list.body.length, 1);
  await request(app).post('/api/admin/plans').set(auth(adminToken))
    .send({ code: 'quarterly', name: 'Quarterly', interval: 'custom', duration_days: 90, price_paise: 49900 }).expect(201);
  const cfg = await request(app).get('/api/config').expect(200);
  assert.equal(cfg.body.plans.length, 3);

  // image upload
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const up = await request(app).post('/api/admin/upload').set(auth(adminToken)).attach('image', png, 'x.png').expect(201);
  await request(app).get(up.body.url).expect(200);
  await request(app).post('/api/admin/upload').set(auth(adminToken)).attach('image', Buffer.from('hi'), 'x.txt').expect(400);
});

test('admin can disable a login method', async () => {
  await request(app).put('/api/admin/settings').set(auth(adminToken)).send({ auth_methods: { phone: false, email: true, google: true } }).expect(200);
  clearSettingsCache();
  await request(app).post('/api/auth/otp/request').send({ channel: 'phone', target: '9111111111' }).expect(403);
  await request(app).put('/api/admin/settings').set(auth(adminToken)).send({ auth_methods: { phone: true, email: true, google: true } }).expect(200);
  clearSettingsCache();
});

test('coach chat round trip', async () => {
  const u = await phoneSignup('9000000005', 'Selvi');
  const t = u.body.token;
  await request(app).post('/api/coach/messages').set(auth(t)).send({ body: 'What should I eat before a workout?' }).expect(201);
  const threads = await request(app).get('/api/admin/coach/threads').set(auth(adminToken)).expect(200);
  const th = threads.body.find((x) => x.user_id === u.body.user.id);
  assert.ok(th);
  await request(app).post(`/api/admin/coach/threads/${th.user_id}`).set(auth(adminToken)).send({ body: 'A banana 30 minutes before.' }).expect(201);
  const msgs = await request(app).get('/api/coach/messages').set(auth(t)).expect(200);
  assert.equal(msgs.body.at(-1).body, 'A banana 30 minutes before.');
  const notes = await request(app).get('/api/me/notifications').set(auth(t)).expect(200);
  assert.ok(notes.body.some((n) => n.title.includes('coach')));
});
