import 'dotenv/config';

const env = process.env;
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

const isTest = env.NODE_ENV === 'test';
const isProd = env.NODE_ENV === 'production';

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  isTest,
  port: Number(env.PORT || 4000),
  apiPublicUrl: (env.API_PUBLIC_URL || `http://localhost:${env.PORT || 4000}`).replace(/\/$/, ''),
  webAppUrl: (env.WEB_APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: list(env.CORS_ORIGINS),
  databaseUrl: isTest
    ? env.TEST_DATABASE_URL || 'postgres://nalam:nalam@localhost:5432/nalam_test'
    : env.DATABASE_URL || 'postgres://nalam:nalam@localhost:5432/nalam',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
  admin: { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, phone: env.ADMIN_PHONE },
  googleClientIds: list(env.GOOGLE_CLIENT_IDS),
  sms: {
    provider: isTest ? 'console' : env.SMS_PROVIDER || 'console',
    defaultCountryCode: env.DEFAULT_COUNTRY_CODE || '+91',
    msg91: { authKey: env.MSG91_AUTH_KEY, templateId: env.MSG91_TEMPLATE_ID },
    twilio: { sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM },
  },
  smtp: {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM || 'Nalam <no-reply@nalam.app>',
  },
  payments: {
    mode: isTest ? 'mock' : env.PAYMENTS_MODE || 'mock',
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  },
};

if (isProd) {
  const problems = [];
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (config.payments.mode === 'mock') problems.push('PAYMENTS_MODE=mock is not allowed in production');
  if (config.sms.provider === 'console') problems.push('SMS_PROVIDER=console is not allowed in production');
  if (problems.length) {
    throw new Error(`Invalid production configuration:\n - ${problems.join('\n - ')}`);
  }
}
