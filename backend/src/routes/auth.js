import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const COOKIE = 'lens_session';
const IS_PROD = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const runtimeSecret = crypto.randomBytes(32).toString('hex'); // dev fallback, resets on restart

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const secret = () => config.auth.secret || runtimeSecret;
const b64 = (s) => Buffer.from(s).toString('base64url');

/** Locally no PIN = open (handy for dev). In production a missing PIN/secret blocks everything. */
export const authRequired = () => IS_PROD || !!config.auth.pin;
const misconfigured = () => IS_PROD && (!config.auth.pin || !config.auth.secret);

function sign(exp) {
  const payload = b64(String(exp));
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return false;
  const want = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return false;
  const exp = Number(Buffer.from(payload, 'base64url').toString());
  return Number.isFinite(exp) && exp > Date.now();
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

export function isAuthed(req) {
  if (!authRequired()) return true;
  if (misconfigured()) return false;
  return verify(readCookie(req, COOKIE));
}

export function requireAuth(req, res, next) {
  if (misconfigured()) {
    return res.status(503).json({ error: 'Server not configured: set APP_PIN and AUTH_SECRET.' });
  }
  if (isAuthed(req)) return next();
  return res.status(401).json({ error: 'PIN required' });
}

const setCookie = (req, res, value, maxAgeSec) => {
  const secure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`,
  );
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8, // wrong guesses per IP per 15 min
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

const router = Router();

router.get('/me', (req, res) => {
  res.json({ required: authRequired(), authed: isAuthed(req), misconfigured: misconfigured() });
});

router.post('/login', loginLimiter, async (req, res) => {
  if (misconfigured()) return res.status(503).json({ error: 'Server not configured: set APP_PIN and AUTH_SECRET.' });
  if (!authRequired()) return res.json({ ok: true });
  const pin = String(req.body?.pin ?? '');
  if (!pin || !safeEqual(pin, config.auth.pin)) {
    await new Promise((r) => setTimeout(r, 500)); // slow down guessing
    return res.status(401).json({ error: 'Wrong PIN' });
  }
  const ttl = Math.max(1, config.auth.ttlHours) * 3600;
  setCookie(req, res, sign(Date.now() + ttl * 1000), ttl);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  setCookie(req, res, '', 0);
  res.json({ ok: true });
});

export default router;
