'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function KartanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [launchAt, setLaunchAt] = useState(null);
  const [checking, setChecking] = useState(true);
  const [aktivtPaketId, setAktivtPaketId] = useState(null);

  // Länk direkt in i ett specifikt paket (t.ex. "dagens Kartan-utmaning"
  // från hub-sidan): /kartan?paket=<id> väljer det paketet automatiskt,
  // så länge det faktiskt är publicerat och listat.
  useEffect(() => {
    const paketFranUrl = searchParams.get('paket');
    if (paketFranUrl) setAktivtPaketId(paketFranUrl);
  }, [searchParams]);

  const { paket, loading: paketLoading } = usePubliceradePaket();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

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
        .select('username, paid_until, is_admin')
        .eq('id', uid)
        .single();

      setUsername(profile?.username || '');
      setIsAdmin(!!profile?.is_admin);

      const today = ymd(stockholmNow());
      const paidAccess = !!profile?.is_admin || (!!profile?.paid_until && profile.paid_until >= today);
      setHasPaidAccess(paidAccess);

      // Lanseringsnedräkning: gäller HELA Kartan, oavsett om enskilda
      // paket är gratis eller ej — inget ska synas före lansering.
      // Admin kommer alltid förbi.
      if (!profile?.is_admin) {
        const { data: settingsRow } = await supabase
          .from('app_settings')
          .select('kartan_launch_at')
          .eq('id', 1)
          .single();
        if (settingsRow?.kartan_launch_at && timeUntil(settingsRow.kartan_launch_at)) {
          setLaunchAt(settingsRow.kartan_launch_at);
        }
      }

      setChecking(false);
    }

    checkAccess();
  }, [router]);

  if (checking) {
    return (
      <div className="wrap">
        <p className="subhead">Laddar…</p>
      </div>
    );
  }

  if (launchAt) {
    return <LaunchCountdownScreen launchAt={launchAt} />;
  }

  const aktivtPaket = paket.find((p) => p.id === aktivtPaketId);
  const aktivtPaketLast = aktivtPaket && (!aktivtPaket.kraver_medlemskap || hasPaidAccess);
  const aktivtPaketViewBounds =
    aktivtPaket?.vy_lat_min != null
      ? {
          latMin: aktivtPaket.vy_lat_min,
          latMax: aktivtPaket.vy_lat_max,
          lonMin: aktivtPaket.vy_lon_min,
          lonMax: aktivtPaket.vy_lon_max,
        }
      : null;

  const frittPaket = paket.filter((p) => !p.kraver_medlemskap);
  const medlemsPaket = paket.filter((p) => p.kraver_medlemskap);

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="user">Inloggad som <b style={{ color: 'var(--amber-glow)' }}>{username}</b></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-ghost" href="/">Alla spel</a>
          <a className="btn btn-ghost" href="/profil">Min profil</a>
          <a className="btn btn-ghost" href="/kartan">Kartan</a>
          <a className="btn btn-ghost" href="/topplistor">Topplistor</a>
          {isAdmin && <a className="btn btn-ghost" href="/admin">Admin</a>}
          <button className="btn btn-ghost" onClick={handleLogout}>Logga ut</button>
        </div>
      </div>

      <p className="eyebrow" style={{ marginTop: 20 }}>KAN DU ALLA</p>
      <h1 className="brand">Kartan</h1>

      {aktivtPaket && aktivtPaketLast ? (
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

          {frittPaket.length > 0 && (
            <>
              <p className="subhead" style={{ marginBottom: 10 }}>Testa gratis</p>
              <div className="list-grid" style={{ marginBottom: 28 }}>
                {frittPaket.map((p) => (
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
            </>
          )}

          {medlemsPaket.length > 0 && (
            <>
              <p className="subhead" style={{ marginBottom: 10 }}>
                Medlemspaket {!hasPaidAccess && '— kräver betalt medlemskap'}
              </p>
              <div className="list-grid">
                {medlemsPaket.map((p) =>
                  hasPaidAccess ? (
                    <button
                      key={p.id}
                      onClick={() => setAktivtPaketId(p.id)}
                      className="plaque"
                      style={{ textAlign: 'left', width: '100%', border: '1px solid var(--line)' }}
                    >
                      <span className="tag">PAKET</span>
                      {p.namn}
                    </button>
                  ) : (
                    <div
                      key={p.id}
                      className="plaque"
                      style={{
                        textAlign: 'left',
                        width: '100%',
                        border: '1px solid var(--line)',
                        opacity: 0.55,
                        cursor: 'not-allowed',
                        position: 'relative',
                      }}
                    >
                      <span className="tag">🔒 MEDLEM</span>
                      {p.namn}
                    </div>
                  )
                )}
              </div>
              {!hasPaidAccess && (
                <a
                  className="btn btn-primary"
                  href="/prenumerera"
                  style={{ display: 'inline-block', width: 'auto', marginTop: 16 }}
                >
                  Bli medlem för att låsa upp allt
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function KartanPage() {
  return (
    <Suspense fallback={<div className="wrap"><p className="subhead">Laddar…</p></div>}>
      <KartanPageContent />
    </Suspense>
  );
}
