import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, v: user.token_version, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function hmac(value) {
  return crypto.createHmac('sha256', config.jwtSecret).update(value).digest('hex');
}

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
