'use client';

import { useState } from 'react';

export default function PrenumereraPage() {
  const [plan, setPlan] = useState('yearly');

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ textAlign: 'center', marginBottom: 30 }}>
        <div className="eyebrow">Ranglistan Medlemskap</div>
        <h1 className="brand">Tävla på riktigt</h1>
        <p className="subhead" style={{ maxWidth: 480, margin: '0 auto' }}>
          Dagliga utmaningar, egna ligor och topplistor att skryta med.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, maxWidth: 480, margin: '0 auto 20px', justifyContent: 'center' }}>
        <button
          className="plaque"
          style={{ flex: 1, textAlign: 'center', borderColor: plan === 'monthly' ? 'var(--amber)' : undefined, color: plan === 'monthly' ? 'var(--text)' : undefined }}
          onClick={() => setPlan('monthly')}
        >
          Månadsvis
        </button>
        <button
          className="plaque"
          style={{ flex: 1, textAlign: 'center', borderColor: plan === 'yearly' ? 'var(--amber)' : undefined, color: plan === 'yearly' ? 'var(--text)' : undefined }}
          onClick={() => setPlan('yearly')}
        >
          Helår
        </button>
      </div>

      <div className="upgrade-card" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
        {plan === 'yearly' && <span className="upgrade-badge">Bäst värde</span>}
        {plan === 'monthly' ? (
          <div className="upgrade-price" style={{ fontSize: 44, marginBottom: 4 }}>
            29 kr<span style={{ fontSize: 15 }}> / månad</span>
          </div>
        ) : (
          <div className="upgrade-price" style={{ fontSize: 44, marginBottom: 4 }}>
            299 kr<span style={{ fontSize: 15 }}> / år</span>
          </div>
        )}
        <p className="subhead" style={{ marginBottom: 20 }}>
          {plan === 'monthly' ? 'Avsluta när du vill. Inga bindningstider.' : 'Betala en gång, spela hela året.'}
        </p>

        <ul className="upgrade-perks" style={{ marginBottom: 22 }}>
          <li>✓ <b>Dagens utmaning</b> varje måndag och onsdag</li>
          <li>✓ Ämnet dolt fram till du klickar in, rättvist för alla</li>
          <li>✓ <b>5 liv om året</b> — fredagar är sista chansen att ta igen missade pass</li>
          <li>✓ Lördagar avslöjas veckans resultat i topplistan</li>
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
