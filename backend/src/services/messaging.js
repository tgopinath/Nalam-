import nodemailer from 'nodemailer';
import { config } from '../config.js';

/** Outbox used in development/tests so OTPs can be read without a real SMS/email provider. */
export const devOutbox = [];

function record(kind, to, text) {
  devOutbox.push({ kind, to, text, at: new Date() });
  if (devOutbox.length > 50) devOutbox.shift();
  if (!config.isTest) console.log(`[${kind} -> ${to}] ${text}`);
}

export async function sendSms(phone, text, { otp } = {}) {
  const { provider, msg91, twilio } = config.sms;
  if (provider === 'console') return record('sms', phone, text);

  if (provider === 'msg91') {
    // MSG91 OTP API (template must contain ##OTP##)
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', msg91.templateId);
    url.searchParams.set('mobile', phone.replace('+', ''));
    url.searchParams.set('otp', otp);
    const res = await fetch(url, { method: 'POST', headers: { authkey: msg91.authKey } });
    if (!res.ok) throw new Error(`MSG91 error ${res.status}`);
    return;
  }

  if (provider === 'twilio') {
    const body = new URLSearchParams({ To: phone, From: twilio.from, Body: text });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${twilio.sid}:${twilio.token}`).toString('base64') },
      body,
    });
    if (!res.ok) throw new Error(`Twilio error ${res.status}`);
    return;
  }
  throw new Error(`Unknown SMS provider ${provider}`);
}

let transporter;
export async function sendEmail(to, subject, text) {
  const { host, port, user, pass, from } = config.smtp;
  if (!host || config.isTest) return record('email', to, `${subject}: ${text}`);
  transporter ??= nodemailer.createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined });
  await transporter.sendMail({ from, to, subject, text });
}
