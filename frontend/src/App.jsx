import { useCallback, useEffect, useRef, useState } from 'react';
import GlassesView from './components/GlassesView.jsx';
import Dock from './components/Dock.jsx';
import ModeTabs, { QUICK } from './components/ModeTabs.jsx';
import Log from './components/Log.jsx';
import { useCamera } from './hooks/useCamera.js';
import { useMic } from './hooks/useMic.js';
import { useBrowserSTT, browserSTTSupported } from './hooks/useBrowserSTT.js';
import { useWhisperVad } from './hooks/useWhisperVad.js';
import { useSpeak } from './hooks/useSpeak.js';
import Login from './components/Login.jsx';
import Logo from './components/Logo.jsx';
import { getHealth, getHistory, getMe, logout, parseLensText, streamChat } from './lib/api.js';

const VISUAL = /\b(this|that|these|those|see|look|looking|show|showing|read|identify|holding|here|resistor|component)\b/i;

function sessionId() {
  try {
    let id = localStorage.getItem('lens-session');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('lens-session', id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}
const SESSION = sessionId();

function Lens({ onLock, canLock }) {
  const [mode, setMode] = useState('advisor');
  const [role, setRole] = useState('visitor');
  const [engine, setEngine] = useState(browserSTTSupported ? 'browser' : 'whisper');
  const [micOn, setMicOn] = useState(false);
  const [auto, setAuto] = useState(false);
  const [health, setHealth] = useState(null);

  const [heard, setHeard] = useState('');
  const [interim, setInterim] = useState('');
  const [label, setLabel] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState([]);

  const cam = useCamera();
  const mic = useMic(micOn);
  const tts = useSpeak();
  const abortRef = useRef(null);
  const busyRef = useRef(false);
  const logRef = useRef([]);
  logRef.current = log;

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ offline: true }));
    getHistory(SESSION)
      .then((rows) => setLog(rows.reverse().map((r) => ({ id: 'h' + r.id, role: r.role, q: r.question, a: r.answer, label: r.label }))))
      .catch((e) => e.status === 401 && onLock());
  }, [onLock]);

  const ask = useCallback(
    async ({ text, who = 'me', forceImage = false, forceMode }) => {
      const useMode = forceMode || mode;
      if (forceMode && forceMode !== mode) setMode(forceMode);
      let image = null;
      if (cam.on && useMode !== 'advisor') {
        if (forceImage || useMode === 'lab' || VISUAL.test(text) || !text) image = cam.capture();
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      tts.cancel();
      setBusy(true);
      busyRef.current = true;
      setScanning(!!image);
      setError('');
      setAnswer('');
      setLabel('');
      setHeard(text || '(scan)');

      try {
        const history = logRef.current.slice(-3).map((m) => ({ q: m.q, a: m.a }));
        const out = await streamChat(
          { mode: useMode, role: who, text, image, history, sessionId: SESSION },
          {
            signal: ctrl.signal,
            onChunk: (raw) => {
              const p = parseLensText(raw);
              setLabel(p.label);
              setAnswer(p.answer);
            },
          },
        );
        const p = parseLensText(out.text);
        setLog((l) => [...l, { id: crypto.randomUUID(), role: who, q: text || 'Scan', a: p.answer, label: p.label, sources: out.sources }].slice(-40));
        tts.speak(p.answer);
      } catch (e) {
        if (e.status === 401) onLock();
        else if (e.name !== 'AbortError') setError(e.message || 'Something went wrong');
      } finally {
        if (abortRef.current === ctrl) {
          setBusy(false);
          busyRef.current = false;
          setScanning(false);
        }
      }
    },
    [mode, cam, tts, onLock],
  );

  const onUtterance = useCallback(
    (text) => {
      if (text.trim().length < 3) return;
      if (tts.speakingRef.current) return; // never interrupt our own speech
      setInterim('');
      ask({ text, who: role });
    },
    [ask, role, tts.speakingRef],
  );

  const askRef = useRef(ask);
  askRef.current = ask;

  const paused = tts.speaking;
  useBrowserSTT({ enabled: micOn && engine === 'browser', paused, onInterim: setInterim, onUtterance });
  useWhisperVad({
    stream: mic.stream,
    enabled: micOn && engine === 'whisper',
    paused,
    onInterim: setInterim,
    onUtterance,
    onError: setError,
  });

  // optional: keep describing what the camera sees
  useEffect(() => {
    if (!auto || !cam.on) return undefined;
    const t = setInterval(() => {
      if (!busyRef.current) askRef.current({ text: 'What am I looking at now? Be brief.', who: 'me', forceImage: true, forceMode: mode === 'advisor' ? 'lab' : mode });
    }, 8000);
    return () => clearInterval(t);
  }, [auto, cam.on, mode]);

  useEffect(() => {
    if (!cam.on) setAuto(false);
  }, [cam.on]);

  useEffect(() => {
    tts.setProvider(health?.features?.tts || 'browser');
  }, [health]); // eslint-disable-line react-hooks/exhaustive-deps

  const offline = health?.offline;
  const f = health?.features || {};

  return (
    <div className="app">
      <div className="bg" aria-hidden="true"><i /><i /><i /></div>

      <header className="top">
        <div className="brand">
          <Logo />
          <h1>AI<span>LENS</span></h1>
        </div>
        <div className="status">
          {canLock && <button type="button" className="pill lockbtn" onClick={onLock}>LOCK</button>}
          <span className={`pill ${offline ? 'bad' : 'ok'}`}>{offline ? 'API OFFLINE' : 'API ONLINE'}</span>
          {!offline && health && (
            <>
              <span className={`pill ${f.openai ? 'ok' : 'bad'}`}>OPENAI</span>
              <span className={`pill ${f.pinecone ? 'ok' : 'dim'}`}>RAG</span>
              <span className={`pill ${f.tavily ? 'ok' : 'dim'}`}>TAVILY</span>
              <span className={`pill ${f.supabase ? 'ok' : 'dim'}`}>DB</span>
              {f.tts && f.tts !== 'browser' && <span className="pill ok">{f.tts === 'elevenlabs' ? '11LABS' : 'AI VOICE'}</span>}
            </>
          )}
        </div>
      </header>

      <main>
        <GlassesView
          videoRef={cam.videoRef}
          cameraOn={cam.on}
          mode={mode}
          role={role}
          heard={heard}
          interim={interim}
          label={label}
          answer={answer}
          busy={busy}
          scanning={scanning}
          level={mic.level}
          listening={micOn}
          error={error}
          speaking={tts.speaking}
        />

        <ModeTabs mode={mode} setMode={setMode} />

        <div className="answerCard" aria-live="polite">
          {label && <span className="chip">{label}</span>}
          <p>{error || answer || (busy ? 'Thinking...' : 'Lens answer will appear here too.')}</p>
        </div>

        <Dock
          listening={micOn}
          onMic={() => setMicOn((v) => !v)}
          cameraOn={cam.on}
          onCam={cam.toggle}
          onFlip={cam.flip}
          onScan={() => ask({ text: 'What am I looking at? Explain the main object.', who: 'me', forceImage: true, forceMode: mode === 'advisor' ? 'lab' : mode })}
          speakOn={tts.enabled}
          onSpeak={() => tts.setEnabled(!tts.enabled)}
          speakSupported={tts.supported}
          role={role}
          setRole={setRole}
          engine={engine}
          setEngine={setEngine}
          sttBrowser={browserSTTSupported}
          auto={auto}
          setAuto={setAuto}
          busy={busy}
          onSend={(t) => ask({ text: t, who: 'me' })}
          camError={cam.error}
          micError={mic.error}
        />

        <div className="quick">
          {QUICK[mode].map((q) => (
            <button key={q} type="button" onClick={() => ask({ text: q, who: role })} disabled={busy}>{q}</button>
          ))}
        </div>

        <Log items={log} onClear={() => setLog([])} />
      </main>

      <footer>AI Lens &middot; NYP School of Engineering &middot; answers may contain errors, confirm key facts on nyp.edu.sg</footer>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState({ checking: true, required: false, authed: false, misconfigured: false });

  useEffect(() => {
    getMe()
      .then((m) => setAuth({ checking: false, ...m }))
      .catch(() => setAuth({ checking: false, required: false, authed: true, misconfigured: false }));
  }, []);

  const lock = useCallback(async () => {
    await logout();
    setAuth((a) => ({ ...a, authed: false, required: true }));
  }, []);

  if (auth.checking) return <div className="app" />;
  if (auth.required && !auth.authed) {
    return <Login misconfigured={auth.misconfigured} onSuccess={() => setAuth((a) => ({ ...a, authed: true }))} />;
  }
  return <Lens onLock={lock} canLock={auth.required} />;
}
