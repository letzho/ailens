const BASE = import.meta.env.VITE_API_BASE || '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function fail(res, fallback) {
  const j = await res.json().catch(() => ({}));
  throw new ApiError(j.error || fallback || `Request failed (${res.status})`, res.status);
}

export async function getMe() {
  const r = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' });
  if (!r.ok) throw new Error('offline');
  return r.json();
}

export async function login(pin) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!r.ok) await fail(r, 'Login failed');
  return r.json();
}

export async function logout() {
  await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
}

export async function getHealth() {
  const r = await fetch(`${BASE}/api/health`, { credentials: 'include' });
  if (!r.ok) throw new Error('offline');
  return r.json();
}

export async function getHistory(sessionId) {
  const r = await fetch(`${BASE}/api/history?sessionId=${encodeURIComponent(sessionId)}`, { credentials: 'include' });
  if (r.status === 401) throw new ApiError('PIN required', 401);
  if (!r.ok) return [];
  return r.json();
}

/** Streams the answer; calls onChunk(fullTextSoFar) as tokens arrive. */
export async function streamChat(payload, { onChunk, signal } = {}) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) await fail(res);
  let sources = [];
  try {
    sources = JSON.parse(decodeURIComponent(res.headers.get('X-Sources') || '[]'));
  } catch {
    /* ignore */
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
    onChunk?.(full);
  }
  if (/\n\[error\]/.test(full)) throw new Error(full.split('[error]').pop().trim());
  return { text: full, sources };
}

export async function transcribeBlob(blob) {
  const fd = new FormData();
  fd.append('audio', blob, 'speech.webm');
  const res = await fetch(`${BASE}/api/transcribe`, { method: 'POST', body: fd, credentials: 'include' });
  if (!res.ok) await fail(res, 'Transcription failed');
  return (await res.json()).text || '';
}

/** "[Label]\nAnswer" -> { label, answer }. Handles partial streams. */
export function parseLensText(raw) {
  const m = raw.match(/^\s*\[([^\]\n]{1,60})\]\s*\n?([\s\S]*)$/);
  if (m) return { label: m[1].trim(), answer: m[2].trim() };
  if (/^\s*\[[^\]]*$/.test(raw)) return { label: '', answer: '' }; // label still streaming
  return { label: '', answer: raw.trim() };
}

export async function fetchTts(text, signal) {
  const res = await fetch(`${BASE}/api/tts`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) await fail(res, 'Voice failed');
  return res.blob();
}
