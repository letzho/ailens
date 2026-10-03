import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embed } from './openai.js';
import { pineconeEnabled, queryChunks } from './pinecone.js';
import { searchNyp } from './tavily.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let seedCache;
function seedText() {
  seedCache ??= fs.readFileSync(path.resolve(__dirname, '../../data/seg-seed.md'), 'utf8');
  return seedCache;
}

/**
 * Retrieval order:
 *   1. Pinecone vector search (RAG over the ingested NYP pages)
 *   2. Tavily live search restricted to nyp.edu.sg
 *   3. Bundled seed snapshot (always available)
 */
export async function retrieveContext(question) {
  const sources = [];
  let parts = [];

  if (pineconeEnabled() && config.openai.apiKey) {
    try {
      const [vec] = await embed([question]);
      const hits = await queryChunks(vec, 5);
      parts = hits.map((h) => h.text);
      hits.forEach((h) => h.url && sources.push(h.url));
    } catch (e) {
      console.warn('[rag] pinecone failed:', e.message);
    }
  }

  if (!parts.length && config.tavily.apiKey) {
    try {
      const res = await searchNyp(question, 4);
      parts = res.map((r) => r.text);
      res.forEach((r) => r.url && sources.push(r.url));
    } catch (e) {
      console.warn('[rag] tavily failed:', e.message);
    }
  }

  if (!parts.length) {
    parts = [seedText()];
    sources.push(config.tavily.segUrl);
  }
  return { context: parts.join('\n---\n').slice(0, 9000), sources: [...new Set(sources)] };
}

/** Drop menu/link-only lines, images and repeated lines so chunks hold real content. */
export function cleanText(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text).split('\n')) {
    let line = raw.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
    if (!line) {
      out.push('');
      continue;
    }
    const linkChars = [...line.matchAll(/\[[^\]]*\]\([^)]*\)/g)].reduce((n, m) => n + m[0].length, 0);
    if (linkChars / line.length > 0.7 && line.length < 200) continue; // nav / menu line
    line = line.replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1'); // keep link text only
    if (line.length < 4) continue;
    if (line.length < 120 && seen.has(line)) continue; // repeated header/footer line
    seen.add(line);
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Split text into ~900 char chunks on paragraph boundaries. */
export function chunkText(text, size = 900, overlap = 120) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > size && cur) {
      chunks.push(cur);
      cur = cur.slice(-overlap) + '\n\n' + p;
    } else {
      cur = cur ? cur + '\n\n' + p : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export { seedText };
