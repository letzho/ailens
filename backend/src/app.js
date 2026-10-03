import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, features } from './config.js';
import chat from './routes/chat.js';
import transcribe from './routes/transcribe.js';
import advisor from './routes/advisor.js';
import tts from './routes/tts.js';
import { ttsProvider } from './services/tts.js';
import auth, { requireAuth, isAuthed } from './routes/auth.js';
import { getHistory } from './services/supabase.js';

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || !config.corsOrigins.length || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed'));
    },
    exposedHeaders: ['X-Sources'],
  }),
);
app.use(express.json({ limit: '4mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => {
  const authed = isAuthed(req);
  res.json({
    ok: true,
    ...(authed && {
      features: { ...features(), tts: ttsProvider() },
      models: { chat: config.openai.chatModel, vision: config.openai.visionModel, transcribe: config.openai.transcribeModel },
    }),
  });
});
app.use('/api/auth', auth);
app.get('/api/history', requireAuth, async (req, res, next) => {
  try {
    res.json(await getHistory(String(req.query.sessionId || ''), 30));
  } catch (e) {
    next(e);
  }
});
app.use('/api/chat', requireAuth, chat);
app.use('/api/transcribe', requireAuth, transcribe);
app.use('/api/tts', requireAuth, tts);
app.use('/api/advisor', advisor); // protected by x-admin-key instead of the PIN

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

export default app;
