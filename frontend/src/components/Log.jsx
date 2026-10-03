export default function Log({ items, onClear }) {
  return (
    <section className="log" aria-label="Conversation">
      <header>
        <h2>Session log</h2>
        {items.length > 0 && <button type="button" onClick={onClear}>Clear</button>}
      </header>
      {items.length === 0 && <p className="empty">Your questions and the lens answers appear here.</p>}
      {items.map((m) => (
        <article key={m.id} className="entry">
          <div className="q"><span className={`who ${m.role === 'visitor' ? 'pink' : ''}`}>{m.role === 'visitor' ? 'VISITOR' : 'YOU'}</span>{m.q}</div>
          <div className="a">
            {m.label && <span className="chip">{m.label}</span>}
            {m.a}
            {m.sources?.length > 0 && (
              <div className="src">Source: {m.sources.slice(0, 2).map((s) => (<a key={s} href={s} target="_blank" rel="noreferrer">{new URL(s).pathname.split('/').filter(Boolean).slice(-1)[0] || 'nyp.edu.sg'}</a>))}</div>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
