import { Router } from 'express';
import { config } from '../config.js';
import { embed } from '../services/openai.js';
import { extractPages, crawlSite } from '../services/tavily.js';
import { upsertChunks } from '../services/pinecone.js';
import { chunkText, cleanText, seedText } from '../services/rag.js';
import { createHash } from 'node:crypto';

const router = Router();

export async function runIngest({ crawl = false } = {}) {
  const pages = [{ url: config.tavily.segUrl + '  (bundled snapshot)', text: seedText(), seed: true }];
  const failed = [];
  if (config.tavily.apiKey) {
    const urls = [...new Set([config.tavily.segUrl, ...config.tavily.extraUrls])];
    const r = await extractPages(urls);
    pages.push(...r.pages);
    failed.push(...r.failed);
    if (crawl) {
      try {
        pages.push(...(await crawlSite(config.tavily.segUrl)));
      } catch (e) {
        failed.push({ url: 'crawl ' + config.tavily.segUrl, error: e.message });
      }
    }
  } else {
    failed.push({ url: 'ALL', error: 'TAVILY_API_KEY missing - only the bundled snapshot was used' });
  }

  const records = [];
  const seenIds = new Set();
  const report = [];
  for (const p of pages) {
    const clean = cleanText(p.text);
    let n = 0;
    for (const [i, text] of chunkText(clean).entries()) {
      const id = createHash('sha1').update(text).digest('hex').slice(0, 24); // same text = same id
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      records.push({ id, text, url: p.url.replace(/ {2}\(bundled snapshot\)$/, '') });
      n++;
    }
    report.push({ url: p.url, rawChars: String(p.text).length, cleanChars: clean.length, chunks: n });
  }
  if (!records.length) throw new Error('nothing to ingest');

  const vectors = [];
  for (let i = 0; i < records.length; i += 64) {
    const batch = records.slice(i, i + 64);
    const embs = await embed(batch.map((r) => r.text));
    batch.forEach((r, k) =>
      vectors.push({ id: r.id, values: embs[k], metadata: { text: r.text, url: r.url } }),
    );
  }
  await upsertChunks(vectors);
  return { pages: pages.length, chunks: vectors.length, report, failed };
}

/** POST /api/advisor/ingest  (header x-admin-key) body: { crawl?: boolean } */
router.post('/ingest', async (req, res, next) => {
  try {
    if (!config.adminKey || req.get('x-admin-key') !== config.adminKey) {
      return res.status(401).json({ error: 'unauthorised' });
    }
    res.json(await runIngest({ crawl: !!req.body?.crawl }));
  } catch (e) {
    next(e);
  }
});

export default router;
