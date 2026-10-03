import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config.js';

let pc;
let index;

export const pineconeEnabled = () => !!config.pinecone.apiKey;

export async function getIndex({ create = false } = {}) {
  if (!pineconeEnabled()) return null;
  pc ??= new Pinecone({ apiKey: config.pinecone.apiKey });
  if (index) return index;
  if (create) {
    const { indexes = [] } = await pc.listIndexes();
    if (!indexes.some((i) => i.name === config.pinecone.index)) {
      await pc.createIndex({
        name: config.pinecone.index,
        dimension: 1536, // text-embedding-3-small
        metric: 'cosine',
        spec: { serverless: { cloud: config.pinecone.cloud, region: config.pinecone.region } },
        waitUntilReady: true,
      });
    }
  }
  index = pc.index(config.pinecone.index);
  return index;
}

/** Replace the whole namespace so a re-ingest never leaves stale or duplicate chunks. */
export async function upsertChunks(vectors) {
  const idx = await getIndex({ create: true });
  const ns = idx.namespace(config.pinecone.namespace);
  try {
    await ns.deleteAll();
  } catch {
    /* namespace does not exist yet - fine */
  }
  for (let i = 0; i < vectors.length; i += 100) {
    await ns.upsert(vectors.slice(i, i + 100));
  }
}

export async function queryChunks(vector, topK = 5) {
  const idx = await getIndex();
  if (!idx) return [];
  const res = await idx.namespace(config.pinecone.namespace).query({
    vector,
    topK,
    includeMetadata: true,
  });
  return (res.matches || []).filter((m) => (m.score ?? 0) > 0.2).map((m) => ({
    score: m.score,
    text: m.metadata?.text || '',
    url: m.metadata?.url || '',
  }));
}
