import { useCallback, useEffect, useRef, useState } from 'react';

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [on, setOn] = useState(false);
  const [facing, setFacing] = useState('environment');
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOn(false);
  }, []);

  const start = useCallback(
    async (face = facing) => {
      setError('');
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
        setOn(true);
      } catch (e) {
        setError(e.name === 'NotAllowedError' ? 'Camera permission denied' : 'Camera not available');
        setOn(false);
      }
    },
    [facing],
  );

  const toggle = useCallback(() => (on ? stop() : start()), [on, start, stop]);
  const flip = useCallback(() => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    if (on) start(next);
  }, [facing, on, start]);

  /** Grab the current frame as a small JPEG data URL (keeps uploads fast). */
  const capture = useCallback((max = 800) => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  }, []);

  useEffect(() => stop, [stop]);
  return { videoRef, on, error, toggle, flip, capture, facing };
}
