const engines = [
  'Object',
  'Relationship',
  'Event',
  'Workflow',
  'Search',
  'Permission',
  'Mission',
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">FYRE INTELLIGENCE // ORBIT KERNEL</p>
        <h1>Truther Media Command Center</h1>
        <p className="summary">
          Mission-driven research, evidence, production, broadcast, publishing, and institutional memory.
        </p>
        <div className="status">SYSTEM FOUNDATION: ONLINE</div>
      </section>

      <section className="panel">
        <h2>ORBIT Engines</h2>
        <div className="engineGrid">
          {engines.map((engine) => (
            <article key={engine}>{engine} Engine</article>
          ))}
        </div>
      </section>
    </main>
  );
}
