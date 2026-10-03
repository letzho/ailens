import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTts } from '../lib/api.js';

/** Prefer natural-sounding browser voices (Edge/Chrome "Natural"/"Online"), Singapore English first. */
function pickBrowserVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const score = (v) => {
    let s = 0;
    if (/natural|online/i.test(v.name)) s += 10;
    if (/google/i.test(v.name)) s += 4;
    if (/en[-_]SG/i.test(v.lang)) s += 6;
    else if (/en[-_](GB|AU)/i.test(v.lang)) s += 3;
    else if (/^en/i.test(v.lang)) s += 2;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0] || null;
}

/**
 * Reads answers aloud. Uses the server voice (ElevenLabs / OpenAI) when the backend has one,
 * and falls back to the best browser voice.
 */
export function useSpeak() {
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [provider, setProvider] = useState('browser');
  const enabledRef = useRef(false);
  const providerRef = useRef('browser');
  const audioRef = useRef(null);
  const urlRef = useRef('');
  const abortRef = useRef(null);
  const runRef = useRef(0);
  const speakingRef = useRef(false);
  const tailRef = useRef(null);
  enabledRef.current = enabled;
  providerRef.current = provider;

  // true from the moment we start fetching the voice until ~0.9 s after it stops (room echo tail)
  const setBusySpeaking = useCallback((on, hold = 0) => {
    clearTimeout(tailRef.current);
    if (on || !hold) {
      speakingRef.current = on;
      setSpeaking(on);
    } else {
      tailRef.current = setTimeout(() => {
        speakingRef.current = false;
        setSpeaking(false);
      }, hold);
    }
  }, []);

  const cancel = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = '';
    }
    window.speechSynthesis?.cancel();
    setBusySpeaking(false);
  }, [setBusySpeaking]);

  const speakBrowser = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    const v = pickBrowserVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.rate = 1;
    const run = runRef.current;
    u.onstart = () => run === runRef.current && setBusySpeaking(true);
    u.onend = () => run === runRef.current && setBusySpeaking(false, 900);
    u.onerror = () => run === runRef.current && setBusySpeaking(false);
    setBusySpeaking(true);
    window.speechSynthesis.speak(u);
  }, [setBusySpeaking]);

  const speak = useCallback(
    async (text) => {
      if (!enabledRef.current || !text) return;
      cancel();
      const run = runRef.current;
      if (providerRef.current === 'browser') return speakBrowser(text);
      setBusySpeaking(true); // mic stays paused while the voice is being fetched
      try {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const blob = await fetchTts(text, ctrl.signal);
        if (run !== runRef.current) return; // cancelled or a newer answer started
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setBusySpeaking(true);
        audio.onended = audio.onerror = () => {
          setBusySpeaking(false, 900);
          URL.revokeObjectURL(url);
        };
        await audio.play();
      } catch (e) {
        if (e.name === 'AbortError' || run !== runRef.current) return;
        speakBrowser(text); // server voice failed: never leave the user in silence
      }
    },
    [cancel, speakBrowser, setBusySpeaking],
  );

  useEffect(() => {
    window.speechSynthesis?.getVoices?.(); // warm up the voice list
  }, []);

  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  return { enabled, setEnabled, speaking, speakingRef, speak, cancel, provider, setProvider, supported: true };
}
