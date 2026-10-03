import { Router } from 'express';
import { synthesize } from '../services/tts.js';

const router = Router();

/** POST /api/tts  { text } -> audio/mpeg */
router.post('/', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').replace(/\s+/g, ' ').trim().slice(0, 700);
    if (!text) return res.status(400).json({ error: 'text required' });
    const { type, body } = await synthesize(text);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-store');
    if (Buffer.isBuffer(body)) return res.end(body);
    body.on('error', () => res.end());
    body.pipe(res);
  } catch (e) {
    next(e);
  }
});

export default router;
