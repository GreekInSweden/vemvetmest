'use client';

export default function PrenumereraPage() {
  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ textAlign: 'center', marginBottom: 30 }}>
        <div className="eyebrow">Ranglistan Medlemskap</div>
        <h1 className="brand">Tävla på riktigt</h1>
        <p className="subhead" style={{ maxWidth: 480, margin: '0 auto' }}>
          Ett år av dagliga utmaningar, egna ligor och topplistor att skryta med.
        </p>
      </header>

      <div className="upgrade-card" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
        <span className="upgrade-badge">Obegränsad tillgång</span>
        <div className="upgrade-price" style={{ fontSize: 44, marginBottom: 4 }}>
          29 kr<span style={{ fontSize: 15 }}> / månad</span>
        </div>
        <p className="subhead" style={{ marginBottom: 20 }}>Avsluta när du vill. Inga bindningstider.</p>

        <ul className="upgrade-perks" style={{ marginBottom: 22 }}>
          <li>✓ <b>Dagens utmaning</b> varje måndag, onsdag och fredag — 156 om året</li>
          <li>✓ Ämnet dolt fram till du klickar in, rättvist för alla</li>
          <li>✓ <b>5 liv om året</b> för att ta igen missade pass på helgen</li>
          <li>✓ Skapa eller gå med i <b>privata ligor</b> med kollegor och vänner</li>
          <li>✓ <b>Topplistor</b> — totalt, per liga och per omgång</li>
          <li>✓ Ständigt växande bank av övningsspel</li>
        </ul>

        <button className="btn btn-primary" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
          Betalning öppnar snart
        </button>
        <p className="subhead" style={{ fontSize: 12, marginTop: 10, marginBottom: 0, textAlign: 'center' }}>
          Vi kopplar in betalningen inom kort. Under tiden är övningsspelen och Dagens utmaning öppna för alla.
        </p>
      </div>

      <p className="subhead" style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        Har du frågor eller vill vara med bland de första? Hör av dig till oss.
      </p>
    </div>
  );
}
