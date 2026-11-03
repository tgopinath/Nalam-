# Nalam 🌿 — health & fitness app (Android + Web + Admin)

Nalam is a Healthify-style wellness app: calorie & macro tracking with Indian foods, guided workouts with
images, water / weight / steps / sleep / mood trackers, recipes, articles, coach chat, weekly insights, and
paid subscriptions after a 7-day free trial. Admins control everything from a web admin panel.

```
backend/   Node.js + Express + PostgreSQL REST API (auth, tracking, content, payments, admin)
web/       React (Vite) web app — user app at /  and admin panel at /admin
mobile/    Android app — Expo / React Native (Expo Router)
```

## Features

**Users**
- Sign up / log in with **mobile OTP**, **email** (password or email OTP, forgot-password) or **Google**
- Onboarding → personalised calorie, protein/carb/fat and water targets (Mifflin-St Jeor), BMI
- Dashboard: calories left (eaten vs burned), macros, water glasses, steps, sleep, mood, weight trend, logging streak
- Food diary by meal with 65+ South & North Indian foods (Tamil names), servings, custom foods
- Workouts with images for every exercise, filters, a guided player (timers, sets, rest, instructions), calorie burn logging
- Progress: weight history, weekly insights (calories / water / steps / sleep charts + tips)
- Healthy recipes, health articles, chat with a coach, in-app notifications
- Profile: goals, targets, link phone, change password, log out everywhere, delete account

**Subscription**
- Every feature free for the first **7 days** (configurable)
- After the trial: **Monthly (₹199)** and **Annual (₹1,499)** plans via **Razorpay** (UPI, cards, net banking, wallets)
- Coupons (e.g. `WELCOME20`), billing history, renewals stack on top of remaining days
- Server-verified payments (signature check + Razorpay webhook), so access can't be faked from the client

**Admin panel (`/admin`)**
- Overview: users, premium/trial/expired counts, conversion, revenue, 14-day sign-up & revenue charts
- Users: search & filter, view details/payments, grant free premium days, edit trial/premium dates, block (signs them out), make admin, delete, message a user
- Payments: list by status, mark refunded · Plans & Coupons: full CRUD (prices, durations, highlights)
- Content: workouts (+ exercise list editor), exercises, foods, recipes, articles — with image/GIF upload
- Coach inbox, broadcast notifications
- App settings: trial length, **which features stay free after the trial**, enable/disable each login method, announcement banner, support email, coach auto-reply, maintenance mode

## Quick start (local)

Requirements: Node 20+, PostgreSQL 14+.

```bash
# 1. API
cd backend
cp .env.example .env            # edit DATABASE_URL, JWT_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD
npm install
npm run migrate && npm run seed # creates tables, plans, admin user, foods, workouts, recipes, articles
npm run dev                     # http://localhost:4000

# 2. Web app + admin
cd ../web && npm install && npm run dev      # http://localhost:5173  (admin: /admin)

# 3. Android app
cd ../mobile && npm install && npx expo start   # press "a" for the Android emulator
```

In development `SMS_PROVIDER=console` and no SMTP means OTPs are printed in the API console (also at
`GET /api/dev/outbox`), and `PAYMENTS_MODE=mock` lets you complete a test payment without money. Both are
rejected when `NODE_ENV=production`.

Default admin (change it!): the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (`admin@nalam.app` / `ChangeMe@123` in the example).

Tests: `cd backend && npm test` (uses a `nalam_test` database; set `TEST_DATABASE_URL` to override).

## Going live — what you need to set up

| What | Where | Env vars |
|---|---|---|
| PostgreSQL database | any managed Postgres | `DATABASE_URL` |
| SMS OTP (India) | [MSG91](https://msg91.com) OTP template containing `##OTP##` (DLT registered), or Twilio | `SMS_PROVIDER`, `MSG91_*` / `TWILIO_*` |
| Email OTP / reset | any SMTP (SES, Zoho, Gmail Workspace…) | `SMTP_*`, `MAIL_FROM` |
| Google login | Google Cloud Console → OAuth client IDs: **Web** (for web) and **Android** (package `app.nalam.android` + SHA-1 of your signing key) | API: `GOOGLE_CLIENT_IDS=web-id,android-id`; mobile `app.json → extra.googleAndroidClientId / googleWebClientId` |
| Payments | Razorpay dashboard → API keys + Webhook to `https://<api>/api/webhooks/razorpay` (events `payment.captured`, `payment.failed`, `refund.processed`) | `PAYMENTS_MODE=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| URLs | | `API_PUBLIC_URL`, `WEB_APP_URL`, `CORS_ORIGINS`, `JWT_SECRET` (32+ chars) |

Deploying: run `backend` as a Node service (`npm start` runs migrations on boot) behind HTTPS; mount `UPLOAD_DIR`
on persistent storage for admin-uploaded images. Build the web app with `VITE_API_URL=https://<api> npm run build`
and host `web/dist` on any static host (configure SPA fallback to `index.html`).

### Building the Android app

```bash
cd mobile
# set your API URL in eas.json (EXPO_PUBLIC_API_URL) for the preview/production profiles
npx eas-cli@latest login
npm run build:apk     # installable APK for testing
npm run build:aab     # Play Store bundle
```

Payments in the app open Nalam's secure hosted Razorpay checkout in a browser tab and return through the
`nalam://` deep link; the server verifies the payment before unlocking Premium.

> **Play Store policy:** Google Play requires Google Play Billing for in-app digital subscriptions (India also
> allows *user choice billing* with an alternative provider such as Razorpay alongside Play Billing). Before
> publishing on Play, either enrol in user-choice billing or add Play Billing for Android — the backend's
> `payments` table and `markOrderPaid()` are provider-agnostic so another provider can be plugged in.

## API overview

`/api/auth/*` (otp/request, otp/verify, register, login, google, password/forgot|reset, phone/link, logout-all) ·
`/api/me` (profile, dashboard, insights, notifications) · `/api/foods`, `/api/food-logs`, `/api/water`,
`/api/weight|steps|sleep|mood` · `/api/workouts`, `/api/recipes`, `/api/articles`, `/api/coach/messages` ·
`/api/subscription/*` (plans, coupon, checkout, verify, history) · `/api/admin/*` · `/api/config` (public).
Locked features return **HTTP 402** with `code: SUBSCRIPTION_REQUIRED`; clients show the paywall.

## Images

Seeded exercises, workouts, recipes and articles use illustrated images generated by
`backend/scripts/generate-exercise-images.js` (`npm run images`). Replace any of them with real photos or GIFs
from the admin panel (Workouts / Exercises / Recipes / Articles → Edit → upload).
