import { Router } from 'express';
import { getOpenAI } from '../services/openai.js';
import { config } from '../config.js';
import { PROMPTS, roleNote } from '../services/prompts.js';
import { retrieveContext } from '../services/rag.js';
import { logInteraction } from '../services/supabase.js';

const router = Router();
const MODES = ['advisor', 'lab', 'general'];

/**
 * POST /api/chat
 * body: { mode, role, text, image?(data URL), history?: [{q,a}], sessionId }
 * Streams plain text back as it is generated so the lens updates instantly.
 */
router.post('/', async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { mode = 'general', role = 'me', text = '', image, history = [], sessionId = 'anon' } = req.body || {};
    if (!MODES.includes(mode)) return res.status(400).json({ error: 'bad mode' });
    if (!text.trim() && !image) return res.status(400).json({ error: 'text or image required' });

    const openai = getOpenAI();
    let system;
    let sources = [];
    if (mode === 'advisor') {
      const r = await retrieveContext(text);
      system = PROMPTS.advisor(r.context);
      sources = r.sources;
    } else {
      system = PROMPTS[mode]();
    }

    const messages = [{ role: 'system', content: system }];
    for (const h of history.slice(-4)) {
      if (h.q) messages.push({ role: 'user', content: String(h.q).slice(0, 400) });
      if (h.a) messages.push({ role: 'assistant', content: String(h.a).slice(0, 400) });
    }
    const userText = `${roleNote(role)}\n\n${text.trim() || 'Describe what you see and what I should know about it.'}`;
    const hasImage = !!image && mode !== 'advisor';
    messages.push({
      role: 'user',
      content: hasImage
        ? [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: image, detail: 'auto' } },
          ]
        : userText,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (sources.length) res.setHeader('X-Sources', encodeURIComponent(JSON.stringify(sources)));
    res.flushHeaders?.();

    const stream = await openai.chat.completions.create({
      model: hasImage ? config.openai.visionModel : config.openai.chatModel,
      messages,
      stream: true,
      max_completion_tokens: 260,
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        res.write(delta);
      }
    }
    res.end();

    const m = full.match(/^\s*\[([^\]]{1,60})\]\s*\n?([\s\S]*)$/);
    logInteraction({
      session_id: String(sessionId).slice(0, 64),
      mode,
      role,
      question: text.slice(0, 1000),
      answer: (m ? m[2] : full).trim().slice(0, 2000),
      label: m ? m[1] : null,
      had_image: hasImage,
      sources: sources.length ? sources : null,
      latency_ms: Date.now() - t0,
    });
  } catch (e) {
    if (res.headersSent) {
      res.write('\n[error] ' + (e.message || 'failed'));
      return res.end();
    }
    next(e);
  }
});

export default router;
