import { useEffect, useRef } from 'react';

export const browserSTTSupported =
  typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Live speech-to-text with the browser engine (Chrome / Edge / Safari).
 * Shows interim words instantly; emits one utterance after ~1.1 s of silence.
 */
export function useBrowserSTT({ enabled, paused, lang = 'en-SG', onInterim, onUtterance }) {
  const pausedRef = useRef(paused);
  const cbs = useRef({ onInterim, onUtterance });
  pausedRef.current = paused;
  cbs.current = { onInterim, onUtterance };

  useEffect(() => {
    if (!enabled || !browserSTTSupported) return undefined;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    let stopped = false;
    let pending = '';
    let timer;

    const flush = () => {
      const text = pending.trim();
      pending = '';
      if (text && !pausedRef.current) cbs.current.onUtterance(text);
    };

    rec.onresult = (e) => {
      if (pausedRef.current) {
        // the app is speaking: drop anything heard (it is our own voice)
        pending = '';
        clearTimeout(timer);
        cbs.current.onInterim('');
        return;
      }
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) pending += ' ' + r[0].transcript;
        else interim += r[0].transcript;
      }
      cbs.current.onInterim((pending + ' ' + interim).trim());
      clearTimeout(timer);
      timer = setTimeout(flush, 1100);
    };
    rec.onend = () => {
      if (!stopped) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') stopped = true;
    };
    try {
      rec.start();
    } catch {
      /* ignore */
    }
    return () => {
      stopped = true;
      clearTimeout(timer);
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, lang]);
}
