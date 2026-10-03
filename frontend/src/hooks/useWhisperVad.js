import { useEffect, useRef } from 'react';
import { transcribeBlob } from '../lib/api.js';

/**
 * Server-side speech-to-text (OpenAI) with voice-activity detection.
 * Works in every browser. Records an utterance when you speak, sends it when you pause.
 */
export function useWhisperVad({ stream, enabled, paused, onInterim, onUtterance, onError }) {
  const pausedRef = useRef(paused);
  const cbs = useRef({ onInterim, onUtterance, onError });
  pausedRef.current = paused;
  cbs.current = { onInterim, onUtterance, onError };

  useEffect(() => {
    if (!enabled || !stream || typeof MediaRecorder === 'undefined') return undefined;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);

    let raf;
    let rec = null;
    let chunks = [];
    let speechStart = 0;
    let lastVoice = 0;
    let noise = 0.01;

    const rms = () => {
      an.getByteTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        s += v * v;
      }
      return Math.sqrt(s / buf.length);
    };

    const startRec = () => {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m));
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        const dur = performance.now() - speechStart;
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        rec = null;
        if (dur < 500 || blob.size < 2000) return cbs.current.onInterim('');
        try {
          cbs.current.onInterim('transcribing...');
          const text = await transcribeBlob(blob);
          cbs.current.onInterim(text);
          if (text) cbs.current.onUtterance(text);
        } catch (e) {
          cbs.current.onError?.(e.message);
        }
      };
      rec.start();
      speechStart = performance.now();
    };

    const tick = () => {
      const now = performance.now();
      const v = rms();
      const threshold = Math.max(0.025, noise * 3);
      if (!pausedRef.current && v > threshold) {
        lastVoice = now;
        if (!rec) {
          startRec();
          cbs.current.onInterim('listening...');
        }
      } else if (!rec) {
        noise = noise * 0.98 + v * 0.02; // learn the room noise floor
      }
      if (rec && now - lastVoice > 1000) rec.stop();
      if (rec && now - speechStart > 25000) rec.stop();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (rec) {
        rec.onstop = null;
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      ctx.close().catch(() => {});
    };
  }, [stream, enabled]);
}
