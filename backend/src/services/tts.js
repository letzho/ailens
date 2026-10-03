import { Readable } from 'node:stream';
import { config } from '../config.js';
import { getOpenAI } from './openai.js';

/** Which engine will speak: 'elevenlabs' | 'openai' | 'browser' (= no server voice, browser reads it). */
export function ttsProvider() {
  const { provider, elevenKey } = config.tts;
  const hasOpenAI = !!config.openai.apiKey;
  if (provider === 'browser') return 'browser';
  if (provider === 'elevenlabs') return elevenKey ? 'elevenlabs' : hasOpenAI ? 'openai' : 'browser';
  if (provider === 'openai') return hasOpenAI ? 'openai' : 'browser';
  return elevenKey ? 'elevenlabs' : hasOpenAI ? 'openai' : 'browser'; // auto
}

/** Returns { type, body } where body is a Node Readable or a Buffer. Throws before any bytes are sent. */
export async function synthesize(text) {
  const provider = ttsProvider();

  if (provider === 'elevenlabs') {
    const { elevenKey, elevenVoice, elevenModel, elevenBase } = config.tts;
    const r = await fetch(`${elevenBase}/v1/text-to-speech/${elevenVoice}/stream?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: elevenModel,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 200);
      const e = new Error(`ElevenLabs ${r.status}: ${detail}`);
      e.status = r.status === 401 ? 502 : r.status;
      throw e;
    }
    return { type: 'audio/mpeg', body: Readable.fromWeb(r.body) };
  }

  if (provider === 'openai') {
    const { openaiModel, openaiVoice, openaiStyle } = config.tts;
    const params = { model: openaiModel, voice: openaiVoice, input: text, response_format: 'mp3' };
    if (openaiModel.includes('gpt-4o') && openaiStyle) params.instructions = openaiStyle;
    const r = await getOpenAI().audio.speech.create(params);
    return { type: 'audio/mpeg', body: Buffer.from(await r.arrayBuffer()) };
  }

  const e = new Error('No server voice configured');
  e.status = 501;
  throw e;
}
