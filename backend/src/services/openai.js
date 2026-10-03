import OpenAI from 'openai';
import { config } from '../config.js';

let client;
export function getOpenAI() {
  if (!config.openai.apiKey) {
    const e = new Error('OPENAI_API_KEY is missing in backend/.env');
    e.status = 500;
    throw e;
  }
  client ??= new OpenAI({ apiKey: config.openai.apiKey });
  return client;
}

export async function embed(texts) {
  const res = await getOpenAI().embeddings.create({
    model: config.openai.embedModel,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
