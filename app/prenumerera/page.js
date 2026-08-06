'use client';

import { useState } from 'react';

const PLANS = {
  monthly: {
    label: 'Månadsvis',
    price: '29 kr',
    unit: ' / månad',
    badge: null,
    note: 'Avsluta när du vill. Inga bindningstider.',
  },
  yearly: {
    label: 'Helår',
    price: '299 kr',
    unit: ' / år',
    badge: 'Bäst värde för en',
    note: 'Betala en gång, spela hela året.',
  },
  family: {
    label: 'Familj',
    price: '897 kr',
    unit: ' / år',
    badge: '4 konton — en på oss',
    note: '897 kr är exakt vad 3 helårskonton kostar. Det fjärde följer med.',
  },
};

export default function PrenumereraPage() {
  const [plan, setPlan] = useState('yearly');
  const p = PLANS[plan];

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ textAlign: 'center', marginBottom: 30 }}>
        <div className="eyebrow">Kan Du Alla Medlemskap</div>
        <h1 className="brand">Tävla på riktigt</h1>
        <p className="subhead" style={{ maxWidth: 480, margin: '0 auto' }}>
          Dagliga utmaningar, egna ligor och topplistor att skryta med.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, maxWidth: 480, margin: '0 auto 20px', justifyContent: 'center' }}>
        {Object.entries(PLANS).map(([key, val]) => (
          <button
            key={key}
            className="plaque"
            style={{
              flex: 1, textAlign: 'center',
              borderColor: plan === key ? 'var(--amber)' : undefined,
              color: plan === key ? 'var(--text)' : undefined
            }}
            onClick={() => setPlan(key)}
          >
            {val.label}
          </button>
        ))}
      </div>

      <div className="upgrade-card" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
        {p.badge && <span className="upgrade-badge">{p.badge}</span>}
        <div className="upgrade-price" style={{ fontSize: 44, marginBottom: 4 }}>
          {p.price}<span style={{ fontSize: 15 }}>{p.unit}</span>
        </div>
        <p className="subhead" style={{ marginBottom: 20 }}>{p.note}</p>

        {plan === 'family' ? (
          <>
            <ul className="upgrade-perks" style={{ marginBottom: 18 }}>
              <li>✓ <b>4 fristående konton</b>, allt du betalar för är detta enda köp</li>
              <li>✓ Samma <b>29 perks</b> som helårsplanen, för alla fyra</li>
              <li>✓ Perfekt för en familj eller en fast vängrupp som redan spelar ihop</li>
            </ul>
            <div className="panel" style={{ background: 'var(--bg-2)', marginBottom: 22, padding: '14px 16px' }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, textTransform: 'uppercase', color: 'var(--amber-glow)', marginBottom: 6 }}>
                Så funkar det
              </div>
              <p className="subhead" style={{ margin: 0, fontSize: 13 }}>
                Du betalar en gång och blir ägare av familjeplanen. Precis som med en privat liga
                får du en <b>6-teckens kod</b> att skicka till de tre andra — de skriver in koden
                under sin profil och är igång direkt. Ingen av dem behöver betala något.
              </p>
            </div>
          </>
        ) : (
          <ul className="upgrade-perks" style={{ marginBottom: 22 }}>
            <li>✓ <b>Dagens utmaning</b> varje måndag och onsdag</li>
            <li>✓ Ämnet dolt fram till du klickar in, rättvist för alla</li>
            <li>✓ <b>5 liv om året</b> — fredagar är sista chansen att ta igen missade pass</li>
            <li>✓ Lördagar avslöjas veckans resultat i topplistan</li>
            <li>✓ Skapa eller gå med i <b>privata ligor</b> med kollegor och vänner</li>
            <li>✓ <b>Topplistor</b> — totalt, per liga och per omgång</li>
            <li>✓ Ständigt växande bank av övningsspel</li>
          </ul>
        )}

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
