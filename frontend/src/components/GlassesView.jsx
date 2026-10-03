import { useEffect, useMemo, useRef } from 'react';
import lens from '../lens.json';

const pct = (v) => `${(v * 100).toFixed(2)}%`;
const place = (r) => ({ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) });

/**
 * The AISPEC.png frame. Its lenses are real see-through holes:
 *   layer 1  camera feed + grid   (clipped to the lens shapes)
 *   layer 2  HUD text             (clipped to the lens shapes)
 *   layer 3  the glasses PNG on top
 */
export default function GlassesView({
  videoRef, cameraOn, mode, role, heard, interim, label, answer, busy, scanning, level, listening, error, speaking,
}) {
  const [left, right] = lens.lenses;
  const clipD = useMemo(
    () => lens.lenses.map((l) => 'M' + l.poly.map(([x, y]) => `${x} ${y}`).join(' L') + ' Z').join(' '),
    [],
  );
  const ansRef = useRef(null);
  useEffect(() => {
    const el = ansRef.current;
    if (el) el.scrollTop = busy ? el.scrollHeight : 0; // follow the stream, then rewind to the top
  }, [answer, label, busy]);

  const n = answer.length;
  const ansSize = n < 60 ? 2.2 : n < 110 ? 1.9 : n < 170 ? 1.6 : n < 240 ? 1.4 : 1.25;
  const bars = 9;
  const lit = Math.round(level * bars);
  const heardText = interim || heard;

  return (
    <div className="rigWrap">
      <div className="rig" style={{ aspectRatio: lens.aspect }}>
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <clipPath id="lensClip" clipPathUnits="objectBoundingBox">
              <path d={clipD} />
            </clipPath>
          </defs>
        </svg>

        <div className="seeThrough" style={{ clipPath: 'url(#lensClip)' }}>
          <video ref={videoRef} playsInline muted className={cameraOn ? 'on' : ''} />
          <div className="gridfx" />
          <div className="tintfx" />
          {!cameraOn && <div className="camOff">CAMERA OFF</div>}
        </div>

        <div className="hud" style={{ clipPath: 'url(#lensClip)' }}>
          {cameraOn && (
            <>
              <div className={`reticle ${scanning ? 'scan' : ''}`} style={place({ x: left.rect.x - 0.01, y: 0.1, w: right.rect.x + right.rect.w - left.rect.x + 0.02, h: 0.72 })}>
                <i /><i /><i /><i />
                {scanning && <b className="scanline" />}
              </div>
            </>
          )}

          <div className="pane" style={place(left.rect)}>
            <div className="tags">
              <span className="tag">{mode === 'advisor' ? 'OPEN HOUSE' : mode === 'lab' ? 'LAB VISION' : 'GENERAL'}</span>
              <span className={`tag ${role === 'visitor' ? 'pink' : ''}`}>{role === 'visitor' ? 'VISITOR' : 'YOU'}</span>
            </div>
            <div className="lbl">HEARD</div>
            <div className={`heard ${interim ? 'live' : ''}`}>
              {heardText || (listening ? 'Listening...' : 'Mic off. Tap MIC or type below.')}
            </div>
            <div className="meter" aria-hidden="true">
              {Array.from({ length: bars }, (_, i) => (
                <u key={i} className={listening && i < lit ? 'lit' : ''} style={{ height: `${30 + i * 8}%` }} />
              ))}
              {speaking && <em>SPEAKING</em>}
            </div>
          </div>

          <div className="pane ans" style={place(right.rect)}>
            <div className="tags">
              <span className="tag cyan">AI</span>
              {label && <span className="tag label">{label}</span>}
              {busy && <span className="dots"><i /><i /><i /></span>}
            </div>
            <div className="answer" ref={ansRef} style={{ fontSize: `${ansSize}cqw` }}>
              {error ? <span className="err">{error}</span> : answer || (busy ? '' : 'Ready. Ask me anything.')}
            </div>
          </div>
        </div>

        <img className="frame" src="/aispec.png" alt="AI smart glasses frame" draggable="false" />
      </div>
    </div>
  );
}
