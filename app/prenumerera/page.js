'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  buildSwishLink, swishQrImageUrl, SWISH_NUMBER, PLAN_PRICES,
  COMPANY_PRICE_PER_SEAT, COMPANY_MIN_SEATS
} from '../../lib/swish';

const TABS = { ...PLAN_PRICES, company: { label: 'Företag' } };

export default function PrenumereraPage() {
  const [plan, setPlan] = useState('yearly');
  const [seats, setSeats] = useState(COMPANY_MIN_SEATS);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', sessionData.session.user.id)
          .single();
        setUsername(profile?.username || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  const isCompany = plan === 'company';
  const amount = isCompany ? seats * COMPANY_PRICE_PER_SEAT : PLAN_PRICES[plan].amount;
  const message = username
    ? (isCompany ? `KDA-${username}-F${seats}` : `KDA-${username}`)
    : null;
  // Både belopp och meddelande låsta (editableFields tom) - ingen ska
  // kunna ändra vare sig summan eller vem betalningen tillhör.
  const swishLink = message
    ? buildSwishLink({ payeeNumber: SWISH_NUMBER, amount, message, editableFields: [] })
    : null;

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

      <div style={{ display: 'flex', gap: 8, maxWidth: 560, margin: '0 auto 20px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {Object.entries(TABS).map(([key, val]) => (
          <button
            key={key}
            className="plaque"
            style={{
              flex: '1 1 100px', textAlign: 'center',
              borderColor: plan === key ? 'var(--amber)' : undefined,
              color: plan === key ? 'var(--text)' : undefined
            }}
            onClick={() => setPlan(key)}
          >
            {val.label}
          </button>
        ))}
      </div>

      <div className="upgrade-card" style={{ maxWidth: 480, margin: '0 auto 24px', textAlign: 'center' }}>
        {plan === 'family' && <span className="upgrade-badge">4 konton — en på oss</span>}
        {isCompany && <span className="upgrade-badge">Skalbart för team och företag</span>}

        {isCompany && (
          <div style={{ marginBottom: 16 }}>
            <label className="subhead" style={{ display: 'block', marginBottom: 8 }}>Antal konton</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <button
                className="btn btn-ghost" style={{ width: 40, padding: '8px 0' }}
                onClick={() => setSeats(s => Math.max(COMPANY_MIN_SEATS, s - 1))}
              >−</button>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, minWidth: 40 }}>{seats}</span>
              <button
                className="btn btn-ghost" style={{ width: 40, padding: '8px 0' }}
                onClick={() => setSeats(s => s + 1)}
              >+</button>
            </div>
            <p className="subhead" style={{ fontSize: 12, marginTop: 6 }}>
              {COMPANY_PRICE_PER_SEAT} kr per konto och år &middot; {seats} eller fler personer, samma liga
            </p>
          </div>
        )}

        <div className="upgrade-price" style={{ fontSize: 44, marginBottom: 4 }}>
          {amount} kr{isCompany && <span style={{ fontSize: 15 }}> / år</span>}
        </div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          {plan === 'monthly' ? 'Gäller i cirka en månad från betalning.' :
           plan === 'yearly' ? 'Gäller i ett helt år från betalning.' :
           plan === 'family' ? '4 fristående konton i ett helt år. Du blir ägare av familjeplanen och får en kod att dela.' :
           `${seats} fristående konton i ett helt år, samlade i en egen privat liga med gemensam topplista.`}
        </p>

        {loading ? (
          <p className="subhead">Laddar…</p>
        ) : !username ? (
          <>
            <p className="subhead" style={{ marginBottom: 14 }}>
              Du måste vara inloggad för att få din personliga betalningskod.
            </p>
            <a className="btn btn-primary" href="/login" style={{ width: 'auto', padding: '13px 26px' }}>
              Logga in
            </a>
          </>
        ) : (
          <>
            <div style={{
              background: '#fff', display: 'inline-block', padding: 16, borderRadius: 8, marginBottom: 16
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={swishQrImageUrl(swishLink)} alt="Swish QR-kod" width={240} height={240} />
            </div>
            <p className="subhead" style={{ marginBottom: 4 }}>
              Skanna med Swish-appen. Belopp och meddelande (<b style={{ color: 'var(--amber-glow)' }}>{message}</b>) är redan ifyllda.
            </p>
            <p className="subhead" style={{ fontSize: 12, marginBottom: 18 }}>
              På mobilen? <a href={swishLink}>Tryck här istället för att skanna</a>.
            </p>
            <p className="subhead" style={{ fontSize: 12.5, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              När betalningen har registrerats aktiveras ditt konto manuellt inom kort — det här är
              i uppstartsläge inget som sker automatiskt än.
            </p>
          </>
        )}
      </div>

      <p className="subhead" style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
        Har du frågor? Hör av dig till oss.
      </p>
    </div>
  );
}
