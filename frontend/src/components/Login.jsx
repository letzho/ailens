import { useState } from 'react';
import { login } from '../lib/api.js';
import Logo from './Logo.jsx';

export default function Login({ onSuccess, misconfigured }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    setErr('');
    try {
      await login(pin);
      onSuccess();
    } catch (ex) {
      setErr(ex.message || 'Login failed');
      setPin('');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app lock">
      <div className="bg" aria-hidden="true"><i /><i /><i /></div>
      <form className={`lockCard ${shake ? 'shake' : ''}`} onSubmit={submit}>
        <div className="brand">
          <Logo />
          <h1>AI<span>LENS</span></h1>
        </div>
        <p className="lockTitle">Enter your PIN to wake the lens</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          aria-label="PIN"
          maxLength={32}
        />
        {misconfigured && <div className="warn">Server is missing APP_PIN / AUTH_SECRET.</div>}
        {err && <div className="warn" role="alert">{err}</div>}
        <button type="submit" className="unlock" disabled={busy || !pin}>{busy ? 'CHECKING...' : 'UNLOCK'}</button>
      </form>
    </div>
  );
}
