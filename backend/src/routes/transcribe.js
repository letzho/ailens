import { Router } from 'express';
import multer from 'multer';
import { toFile } from 'openai';
import { getOpenAI } from '../services/openai.js';
import { config } from '../config.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const router = Router();

/** POST /api/transcribe  (multipart: audio=<blob>, language?) -> { text } */
router.post('/', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file required' });
    const ext = (req.file.mimetype || '').includes('mp4') ? 'mp4' : (req.file.mimetype || '').includes('ogg') ? 'ogg' : 'webm';
    const file = await toFile(req.file.buffer, `speech.${ext}`, { type: req.file.mimetype });
    const out = await getOpenAI().audio.transcriptions.create({
      file,
      model: config.openai.transcribeModel,
      language: req.body?.language || 'en',
      prompt: 'NYP, School of Engineering, diploma, JAE, resistor, multimeter, breadboard, AI Robotics, Cloud Engineering.',
    });
    res.json({ text: (out.text || '').trim() });
  } catch (e) {
    next(e);
  }
});

export default router;
