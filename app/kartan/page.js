'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { timeUntil, formatCountdown } from '../../lib/countdown';
import { usePubliceradePaket } from '../../hooks/useKartanPaket';
import { PaketSpel } from '../../components/kartan/PaketSpel';

function stockholmNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
}
function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function LaunchCountdownScreen({ launchAt }) {
  const [remaining, setRemaining] = useState(() => timeUntil(launchAt));

  useEffect(() => {
    const timer = setInterval(() => setRemaining(timeUntil(launchAt)), 1000);
    return () => clearInterval(timer);
  }, [launchAt]);

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">
          &larr; Alla spel
        </a>
      </div>
      <div className="upgrade-card">
        <span className="upgrade-badge">Lanseras snart</span>
        <div className="upgrade-title">Kartan öppnar om</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 36, color: 'var(--amber-glow)', margin: '10px 0 18px' }}>
          {remaining ? formatCountdown(remaining) : '00:00'}
        </div>
        <p className="subhead">
          Du är redan medlem — så fort klockan slår noll öppnas Kartan automatiskt, ingen ny åtgärd behövs från dig.
        </p>
      </div>
    </div>
  );
}

export default function KartanPage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [aktivtPaketId, setAktivtPaketId] = useState(null);

  const { paket, loading: paketLoading } = usePubliceradePaket();

  useEffect(() => {
    async function checkAccess() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }
      const uid = sessionData.session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('paid_until, is_admin')
        .eq('id', uid)
        .single();

      const today = ymd(stockholmNow());
      const hasPaidAccess = !!profile?.is_admin || (!!profile?.paid_until && profile.paid_until >= today);

      if (!hasPaidAccess) {
        setEligibility({ ok: false, reason: 'Kartan kräver ett betalt medlemskap.', needsPayment: true });
        return;
      }

      // Lanseringsnedräkning: samma mönster som Dagens utmaning.
      // Admin kommer alltid förbi.
      if (!profile?.is_admin) {
        const { data: settingsRow } = await supabase
          .from('app_settings')
          .select('kartan_launch_at')
          .eq('id', 1)
          .single();
        if (settingsRow?.kartan_launch_at && timeUntil(settingsRow.kartan_launch_at)) {
          setEligibility({ ok: false, reason: '', launchAt: settingsRow.kartan_launch_at });
          return;
        }
      }

      setEligibility({ ok: true });
    }

    checkAccess();
  }, [router]);

  if (!eligibility) {
    return (
      <div className="wrap">
        <p className="subhead">Laddar…</p>
      </div>
    );
  }

  if (eligibility.launchAt) {
    return <LaunchCountdownScreen launchAt={eligibility.launchAt} />;
  }

  if (!eligibility.ok) {
    return (
      <div className="wrap">
        <div className="topbar">
          <a className="btn btn-ghost" href="/">
            &larr; Alla spel
          </a>
        </div>
        <div className="upgrade-card">
          <span className="upgrade-badge">Medlemskap krävs</span>
          <div className="upgrade-title">{eligibility.reason}</div>
          <a className="btn btn-primary" href="/prenumerera" style={{ display: 'inline-block', width: 'auto', marginTop: 10 }}>
            Bli medlem
          </a>
        </div>
      </div>
    );
  }

  const aktivtPaket = paket.find((p) => p.id === aktivtPaketId);
  const aktivtPaketViewBounds =
    aktivtPaket?.vy_lat_min != null
      ? {
          latMin: aktivtPaket.vy_lat_min,
          latMax: aktivtPaket.vy_lat_max,
          lonMin: aktivtPaket.vy_lon_min,
          lonMax: aktivtPaket.vy_lon_max,
        }
      : null;

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">
          &larr; Alla spel
        </a>
      </div>

      <p className="eyebrow">KAN DU ALLA</p>
      <h1 className="brand">Kartan</h1>

      {aktivtPaket ? (
        <div style={{ marginTop: 20 }}>
          <PaketSpel
            paketId={aktivtPaket.id}
            paketNamn={aktivtPaket.namn}
            viewBounds={aktivtPaketViewBounds}
            spelareId={userId}
            onKlar={() => setAktivtPaketId(null)}
          />
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          {paketLoading && <p className="subhead">Laddar paket…</p>}

          {!paketLoading && paket.length === 0 && (
            <p className="subhead">Inga paket är publicerade just nu — kom tillbaka snart!</p>
          )}

          <div className="list-grid">
            {paket.map((p) => (
              <button
                key={p.id}
                onClick={() => setAktivtPaketId(p.id)}
                className="plaque"
                style={{ textAlign: 'left', width: '100%', border: '1px solid var(--line)' }}
              >
                <span className="tag">PAKET</span>
                {p.namn}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
