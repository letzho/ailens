import { useEffect, useRef, useState } from 'react';

/** Opens the microphone and exposes a 0..1 level (for the lens meter) + the raw stream. */
export function useMic(enabled) {
  const [level, setLevel] = useState(0);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const levelRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      return undefined;
    }
    let raf;
    let ctx;
    let s;
    let cancelled = false;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        setStream(s);
        setError('');
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.fftSize);
        let last = 0;
        const tick = (t) => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 5);
          if (t - last > 70) {
            last = t;
            setLevel(levelRef.current);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Microphone not available');
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      s?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      setStream(null);
      setLevel(0);
    };
  }, [enabled]);

  return { level, levelRef, stream, error };
}
