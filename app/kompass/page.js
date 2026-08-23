'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { KompassRatt } from '../../components/kompass/KompassRatt';
import { VarldsKarta } from '../../components/kompass/VarldsKarta';
import styles from '../../components/kompass/kompass.module.css';

async function authedFetch(url, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Inte inloggad.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Något gick fel.');
  return data;
}

export default function KompassPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [lagen, setLagen] = useState([]);

  const [partiId, setPartiId] = useState(null);
  const [lage, setLage] = useState(null);
  const [aktuelltLand, setAktuelltLand] = useState(null);
  const [malLand, setMalLand] = useState(null);
  const [bredd, setBredd] = useState(90);
  const [vinkel, setVinkel] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [slutresultat, setSlutresultat] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [landerLookup, setLanderLookup] = useState(null);

  useEffect(() => {
    fetch('/data/kompass/lander.json')
      .then((r) => r.json())
      .then((data) => {
        const lookup = {};
        data.forEach((l) => {
          lookup[l.iso2] = l;
        });
        setLanderLookup(lookup);
      });
  }, []);

  function punktFor(land) {
    if (!land || !landerLookup) return null;
    const rad = landerLookup[land.iso2];
    if (!rad) return null;
    const anvandHuvudstad = lage?.kategori === 'huvudstader';
    return {
      namn: land.namn,
      lat: anvandHuvudstad ? rad.capitalLat : rad.countryLat,
      lon: anvandHuvudstad ? rad.capitalLon : rad.countryLon,
    };
  }

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }
      const { data } = await supabase.from('kompass_lagen').select('*').eq('aktiv', true).order('ordning');
      setLagen(data || []);
      setChecking(false);
    }
    init();
  }, [router]);

  async function startaParti(lageId) {
    setError(null);
    try {
      const data = await authedFetch('/api/kompass/start', { lageId });
      setPartiId(data.partiId);
      setLage(data.lage);
      setAktuelltLand(data.aktuelltLand);
      setMalLand(data.malLand);
      setBredd(90);
      setVinkel(null);
      setResultat(null);
      setSlutresultat(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function skickaGissning() {
    if (vinkel === null || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await authedFetch('/api/kompass/guess', { partiId, valdVinkel: vinkel });
      setResultat(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function nastaSteg() {
    if (resultat.partietSlut) {
      setSlutresultat(resultat);
      return;
    }
    setAktuelltLand({ iso2: resultat.facit.tillIso2, namn: resultat.facit.tillNamn });
    setMalLand(resultat.nastaMal);
    setBredd(resultat.nastaBredd);
    setVinkel(null);
    setResultat(null);
  }

  if (checking) {
    return (
      <div className="wrap">
        <p className="subhead">Laddar…</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">Alla spel</a>
      </div>

      <p className="eyebrow" style={{ marginTop: 20 }}>KAN DU ALLA</p>
      <h1 className="brand">Kompass</h1>
      <p className="subhead" style={{ marginBottom: 20 }}>
        Peka rätt väderstreck mot nästa land i kedjan.
      </p>

      {error && <p style={{ color: '#e78a6c', fontSize: 13 }}>{error}</p>}

      {!partiId ? (
        <div className="list-grid">
          {lagen.length === 0 && <p className="subhead">Inga spellägen är aktiva än.</p>}
          {lagen.map((l) => (
            <button
              key={l.id}
              onClick={() => startaParti(l.id)}
              className="plaque"
              style={{ textAlign: 'left', width: '100%', border: '1px solid var(--line)' }}
            >
              <span className="tag">{l.kategori === 'huvudstader' ? 'HUVUDSTÄDER' : 'LÄNDER'}</span>
              {l.namn}
            </button>
          ))}
        </div>
      ) : slutresultat ? (
        <div className={styles.gameWrap}>
          <div className={styles.resultBlock}>
            <p className={slutresultat.klaradeUtmaningen ? styles.resultHit : styles.resultMiss}>
              {slutresultat.klaradeUtmaningen ? 'Utmaningen klarad!' : 'Inte den här gången'}
            </p>
            <p className="subhead">
              {slutresultat.totalPoang} poäng · {slutresultat.antalTraffar} av {slutresultat.stegNummer} träffar
            </p>
            <button className={styles.secondaryBtn} onClick={() => setPartiId(null)}>
              Till alla lägen
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.gameWrap}>
          <p className={styles.progress}>
            {aktuelltLand?.namn} → {resultat ? resultat.facit.tillNamn : malLand?.namn}
          </p>
          <p className={styles.malText}>Peka mot</p>
          <p className={styles.malNamn}>{malLand?.namn}</p>

          <div className={styles.gameLayout}>
            <div className={styles.mapSide}>
              <VarldsKarta
                aktuell={punktFor(aktuelltLand)}
                mal={resultat ? punktFor({ iso2: resultat.facit.tillIso2, namn: resultat.facit.tillNamn }) : null}
                revealed={!!resultat}
              />
            </div>

            <div className={styles.compassSide}>
              <KompassRatt
                bredd={bredd}
                vinkel={vinkel}
                onVinkelChange={setVinkel}
                revealed={!!resultat}
                rattVinkel={resultat?.rattVinkel ?? null}
                traff={resultat?.traff ?? null}
                disabled={submitting}
              />

              {!resultat ? (
                <button className={styles.confirmBtn} disabled={vinkel === null || submitting} onClick={skickaGissning}>
                  Bekräfta riktning
                </button>
              ) : (
                <div className={styles.resultBlock}>
                  <p className={resultat.traff ? styles.resultHit : styles.resultMiss}>
                    {resultat.traff ? `Träff! +${resultat.poang}p` : 'Utanför konen'}
                  </p>
                  <p className="subhead">{Math.round(resultat.avvikelse)}° avvikelse</p>
                  <button className={styles.secondaryBtn} onClick={nastaSteg}>
                    {resultat.partietSlut ? 'Se slutresultat →' : 'Nästa land →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
