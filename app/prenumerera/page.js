'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabaseClient';
import { timeUntil, formatCountdown } from '../../lib/countdown';
import {
  buildSwishLink, SWISH_NUMBER, PLAN_PRICES,
  COMPANY_PRICE_PER_SEAT, COMPANY_MIN_SEATS, CHILD_PACKAGE_PRICE
} from '../../lib/swish';

const TABS = { ...PLAN_PRICES, company: { label: 'Företag' }, child: { label: 'Barnpaket' } };
const QR_SIZE = 260;

export default function PrenumereraPage() {
  const [plan, setPlan] = useState('yearly');
  const [seats, setSeats] = useState(COMPANY_MIN_SEATS);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);
  const [launchAt, setLaunchAt] = useState(null);
  const [launchRemaining, setLaunchRemaining] = useState(null);
  const canvasRef = useRef(null);
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    if (!launchAt) return;
    const timer = setInterval(() => setLaunchRemaining(timeUntil(launchAt)), 1000);
    return () => clearInterval(timer);
  }, [launchAt]);

  // ---- Barnkonto-skapande ----
  const [childUsername, setChildUsername] = useState('');
  const [childPassword, setChildPassword] = useState('');
  const [childPasswordConfirm, setChildPasswordConfirm] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
  const [childAccountCreated, setChildAccountCreated] = useState(false);
  const [childCreateError, setChildCreateError] = useState('');
  const [creatingChild, setCreatingChild] = useState(false);

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
      const { data: settingsRow } = await supabase.from('app_settings').select('launch_at').eq('id', 1).single();
      if (settingsRow?.launch_at) {
        const remain = timeUntil(settingsRow.launch_at);
        if (remain) {
          setLaunchAt(settingsRow.launch_at);
          setLaunchRemaining(remain);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  // Kollar ledigt användarnamn medan föräldern skriver, med kort fördröjning
  useEffect(() => {
    if (childUsername.length < 3) { setUsernameStatus(null); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(childUsername)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    const timeout = setTimeout(async () => {
      const { data } = await supabase.rpc('is_username_available', { p_username: childUsername });
      setUsernameStatus(data ? 'available' : 'taken');
    }, 500);
    return () => clearTimeout(timeout);
  }, [childUsername]);

  async function handleCreateChildAccount() {
    setChildCreateError('');
    if (usernameStatus !== 'available') { setChildCreateError('Välj ett ledigt användarnamn först.'); return; }
    if (childPassword.length < 6) { setChildCreateError('Lösenordet måste vara minst 6 tecken.'); return; }
    if (childPassword !== childPasswordConfirm) { setChildCreateError('Lösenorden matchar inte.'); return; }

    setCreatingChild(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch('/api/create-child-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ childUsername, childPassword })
    });
    const result = await res.json();
    setCreatingChild(false);

    if (!res.ok) {
      setChildCreateError(result.error || 'Något gick fel.');
      return;
    }
    setChildAccountCreated(true);
  }

  const isCompany = plan === 'company';
  const isChild = plan === 'child';
  const amount = isCompany ? seats * COMPANY_PRICE_PER_SEAT : (isChild ? CHILD_PACKAGE_PRICE : PLAN_PRICES[plan].amount);
  // Swish avvisar länken ("felaktig länk") om meddelandet innehåller
  // understreck (bekräftat genom test) - byter ut alla tecken som inte
  // är bokstäver/siffror/bindestreck mot bindestreck för säkerhets skull.
  // Påverkar bara Swish-meddelandet, inte det riktiga användarnamnet.
  const safeUsername = username ? username.replace(/[^a-zA-Z0-9-]/g, '-') : null;
  const safeChildLabel = childUsername ? childUsername.replace(/[^a-zA-Z0-9-]/g, '-') : '';
  const message = safeUsername
    ? (isCompany ? `KDA-${safeUsername}-F${seats}`
      : isChild ? `KDA-${safeUsername}-BARN-${safeChildLabel}`
      : `KDA-${safeUsername}`)
    : null;
  const swishLink = message
    ? buildSwishLink({ payeeNumber: SWISH_NUMBER, amount, message, editableFields: [] })
    : null;

  // Barnpaket-fliken ska bara visa QR:n när kontot faktiskt skapats
  const readyForPayment = !isChild || childAccountCreated;

  // Ritar QR-koden direkt på en <canvas> med biblioteket "qrcode" - ingen
  // extern bildtjänst inblandad, så det finns inget mellanled som kan
  // skala om eller på annat sätt förändra bilden efter att den skapats.
  useEffect(() => {
    if (!swishLink || !canvasRef.current || !readyForPayment) return;
    setQrError('');
    QRCode.toCanvas(canvasRef.current, swishLink, {
      width: QR_SIZE,
      margin: 4,
      errorCorrectionLevel: 'M'
    }, (err) => {
      if (err) setQrError('Kunde inte rita QR-koden: ' + err.message);
    });
  }, [swishLink, readyForPayment]);

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

      {launchAt && (
        <div className="panel" style={{ marginBottom: 24, border: '2px solid var(--amber)', textAlign: 'center' }}>
          <span className="upgrade-badge">Snart här</span>
          <div className="upgrade-title" style={{ marginTop: 6 }}>Innehållet låses upp om</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, color: 'var(--amber-glow)', margin: '10px 0' }}>
            {launchRemaining ? formatCountdown(launchRemaining) : '00:00'}
          </div>
          <p className="subhead" style={{ margin: 0 }}>
            Du kan bli medlem redan nu — Dagens utmaning, Topplistor och medlemsspelen öppnas automatiskt
            för dig så fort klockan slår noll.
          </p>
        </div>
      )}

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
        {isChild && <span className="upgrade-badge">Växande bibliotek — 50 nya spel/år</span>}

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

        {isChild && !childAccountCreated && (
          <div style={{ marginBottom: 16, textAlign: 'left' }}>
            <label className="subhead" style={{ display: 'block', marginBottom: 6 }}>Barnets användarnamn</label>
            <input
              className="field"
              placeholder="t.ex. LitenAnna"
              value={childUsername}
              onChange={e => setChildUsername(e.target.value)}
              style={{ marginBottom: 4 }}
            />
            <p className="subhead" style={{ fontSize: 11.5, marginBottom: 12, minHeight: 16 }}>
              {usernameStatus === 'checking' && 'Kollar…'}
              {usernameStatus === 'available' && <span style={{ color: '#7fc98f' }}>✓ Ledigt</span>}
              {usernameStatus === 'taken' && <span style={{ color: 'var(--miss)' }}>Upptaget, välj ett annat</span>}
              {usernameStatus === 'invalid' && <span style={{ color: 'var(--miss)' }}>3-20 tecken, bara bokstäver/siffror/_</span>}
            </p>

            <label className="subhead" style={{ display: 'block', marginBottom: 6 }}>Lösenord åt barnet</label>
            <input
              className="field"
              type="password"
              placeholder="Minst 6 tecken"
              value={childPassword}
              onChange={e => setChildPassword(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            <label className="subhead" style={{ display: 'block', marginBottom: 6 }}>Bekräfta lösenord</label>
            <input
              className="field"
              type="password"
              placeholder="Samma igen"
              value={childPasswordConfirm}
              onChange={e => setChildPasswordConfirm(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            {childCreateError && <div className="error-msg" style={{ marginBottom: 10 }}>{childCreateError}</div>}

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleCreateChildAccount}
              disabled={creatingChild || usernameStatus !== 'available'}
            >
              {creatingChild ? 'Skapar konto…' : 'Skapa barnkonto'}
            </button>
            <p className="subhead" style={{ fontSize: 11, marginTop: 8 }}>
              Skriv upp uppgifterna någonstans — de finns även sparade under din egen profil om ni glömmer bort dem.
            </p>
          </div>
        )}

        {isChild && childAccountCreated && (
          <p className="subhead" style={{ marginBottom: 16 }}>
            ✓ Kontot <b style={{ color: 'var(--amber-glow)' }}>{childUsername}</b> är skapat. Betala nedan för att aktivera det.
          </p>
        )}

        <div className="upgrade-price" style={{ fontSize: 44, marginBottom: 4 }}>
          {amount} kr{(isCompany || isChild) && <span style={{ fontSize: 15 }}> / år</span>}
        </div>
        <p className="subhead" style={{ marginBottom: 20 }}>
          {plan === 'monthly' ? 'Gäller i cirka en månad från betalning.' :
           plan === 'yearly' ? 'Gäller i ett helt år från betalning.' :
           plan === 'family' ? '4 fristående konton i ett helt år. Du blir ägare av familjeplanen och får en kod att dela.' :
           isChild ? '50 utvalda spel anpassade för barn — 99 kr/år. Biblioteket växer med 50 nya spel varje år ni förnyar, och ni behåller alla tidigare års spel så länge prenumerationen är aktiv.' :
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
        ) : !readyForPayment ? null : (
          <>
            <div style={{
              background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: 12, borderRadius: 8, marginBottom: 16, minWidth: QR_SIZE, minHeight: QR_SIZE, maxWidth: '100%'
            }}>
              <canvas ref={canvasRef} width={QR_SIZE} height={QR_SIZE} />
              {qrError && <p style={{ color: '#b00', fontSize: 13 }}>{qrError}</p>}
            </div>
            <p className="subhead" style={{ marginBottom: 4 }}>
              Skanna med Swish-appen. Belopp och meddelande (<b style={{ color: 'var(--amber-glow)' }}>{message}</b>) är redan ifyllda.
            </p>
            <p className="subhead" style={{ fontSize: 12, marginBottom: 18 }}>
              På mobilen? <a href={swishLink}>Tryck här istället för att skanna</a>.
            </p>
            <p className="subhead" style={{ fontSize: 12.5, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              När betalningen har registrerats aktiveras kontot manuellt inom kort — det här är
              i uppstartsläge inget som sker automatiskt än.
            </p>
            <p className="subhead" style={{ fontSize: 11, marginTop: 10 }}>
              Genom att betala godkänner du våra <a href="/villkor" target="_blank" rel="noreferrer">villkor</a> och
              vår <a href="/integritetspolicy" target="_blank" rel="noreferrer">integritetspolicy</a>,
              inklusive att tjänsten aktiveras direkt och att ångerrätten därmed upphör i samband
              med aktivering.
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
