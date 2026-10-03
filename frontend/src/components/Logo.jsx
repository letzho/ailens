import { useState } from 'react';

/** Shows /icon.svg (frontend/public/icon.svg). Falls back to the built-in glow logo if the file is missing. */
export default function Logo() {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img className="logoImg" src="/icon.svg" alt="" onError={() => setOk(false)} />
  ) : (
    <span className="logo" aria-hidden="true" />
  );
}
