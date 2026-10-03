import { useState } from 'react';

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3',
  cam: 'M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  speaker: 'M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12',
  flip: 'M4 7h13l-3-3M20 17H7l3 3',
  send: 'M4 12 20 4l-4 16-4-6z',
  auto: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
};

function Btn({ on, onClick, icon, children, kind = '', disabled, title }) {
  return (
    <button type="button" className={`btn ${on ? 'on' : ''} ${kind}`} onClick={onClick} disabled={disabled} title={title}>
      <Icon d={ICONS[icon]} />
      <span>{children}</span>
    </button>
  );
}

export default function Dock({
  listening, onMic, cameraOn, onCam, onFlip, onScan, speakOn, onSpeak, speakSupported,
  role, setRole, engine, setEngine, sttBrowser, auto, setAuto, busy, onSend, camError, micError,
}) {
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <div className="dock">
      <div className="row">
        <Btn on={listening} onClick={onMic} icon="mic" kind="primary">{listening ? 'LISTENING' : 'MIC'}</Btn>
        <Btn on={cameraOn} onClick={onCam} icon="cam">{cameraOn ? 'CAMERA ON' : 'CAMERA OFF'}</Btn>
        <Btn onClick={onScan} icon="scan" disabled={!cameraOn || busy} title="Identify what the camera sees">SCAN</Btn>
        <Btn on={auto} onClick={() => setAuto(!auto)} icon="auto" disabled={!cameraOn} title="Re-scan every 8 seconds">AUTO</Btn>
        <Btn on={speakOn} onClick={onSpeak} icon="speaker" disabled={!speakSupported} title="Read answers aloud">VOICE</Btn>
        <Btn onClick={onFlip} icon="flip" disabled={!cameraOn} title="Switch camera">FLIP</Btn>
      </div>

      <div className="row opts">
        <div className="seg" role="group" aria-label="Who is speaking">
          <button type="button" className={role === 'visitor' ? 'active pink' : ''} onClick={() => setRole('visitor')}>Visitor speaks</button>
          <button type="button" className={role === 'me' ? 'active' : ''} onClick={() => setRole('me')}>I speak</button>
        </div>
        <div className="seg" role="group" aria-label="Speech engine">
          <button type="button" className={engine === 'browser' ? 'active' : ''} disabled={!sttBrowser} onClick={() => setEngine('browser')}>Live captions</button>
          <button type="button" className={engine === 'whisper' ? 'active' : ''} onClick={() => setEngine('whisper')}>Whisper AI</button>
        </div>
      </div>

      {(camError || micError) && <div className="warn">{camError || micError}</div>}

      <form className="typebar" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type a question for the lens..." aria-label="Type a question" />
        <button type="submit" className="send" disabled={busy || !text.trim()} aria-label="Send"><Icon d={ICONS.send} /></button>
      </form>
    </div>
  );
}
