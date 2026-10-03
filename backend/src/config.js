import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Always read backend/.env (works no matter where node is started from).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const env = process.env;
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(env.PORT || 8787),
  corsOrigins: list(env.CORS_ORIGINS),
  adminKey: env.ADMIN_KEY || '',
  auth: {
    pin: env.APP_PIN || '',
    secret: env.AUTH_SECRET || '',
    ttlHours: Number(env.AUTH_TTL_HOURS || 12),
  },
  openai: {
    apiKey: env.OPENAI_API_KEY,
    chatModel: env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    visionModel: env.OPENAI_VISION_MODEL || 'gpt-4o',
    embedModel: env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
    transcribeModel: env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
  },
  tts: {
    provider: (env.TTS_PROVIDER || 'auto').toLowerCase(),
    elevenKey: env.ELEVENLABS_API_KEY || '',
    elevenVoice: env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
    elevenModel: env.ELEVENLABS_MODEL || 'eleven_flash_v2_5',
    elevenBase: env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io',
    openaiModel: env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    openaiVoice: env.OPENAI_TTS_VOICE || 'coral',
    openaiStyle: env.OPENAI_TTS_STYLE || 'Warm, friendly and natural, like a helpful Singaporean student ambassador. Clear, not too fast.',
  },
  tavily: {
    apiKey: env.TAVILY_API_KEY,
    segUrl: env.SEG_URL || 'https://www.nyp.edu.sg/student/study/schools/engineering',
    extraUrls: list(env.EXTRA_URLS),
  },
  pinecone: {
    apiKey: env.PINECONE_API_KEY,
    index: env.PINECONE_INDEX || 'ai-lens-seg',
    namespace: env.PINECONE_NAMESPACE || 'open-house-2027',
    cloud: env.PINECONE_CLOUD || 'aws',
    region: env.PINECONE_REGION || 'us-east-1',
  },
  supabase: {
    url: env.SUPABASE_URL,
    key: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY,
  },
};

export const features = () => ({
  openai: !!config.openai.apiKey,
  tavily: !!config.tavily.apiKey,
  pinecone: !!config.pinecone.apiKey,
  supabase: !!(config.supabase.url && config.supabase.key),
});
