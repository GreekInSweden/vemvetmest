'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { KartanSvgMap } from '../../../components/kartan/KartanSvgMap';
import styles from './admin.module.css';

async function authedFetch(url, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export default function AdminKartanPage() {
  const [testandeId, setTestandeId] = useState(null);
  const [oppetPaketId, setOppetPaketId] = useState(null);

  const [kategorier, setKategorier] = useState([]);
  const [rundor, setRundor] = useState([]);
  const [paket, setPaket] = useState([]);
  const [paketRundor, setPaketRundor] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const loadData = useCallback(async () => {
    const res = await authedFetch('/api/admin/kartan/list');
    const data = await res.json();
    if (!res.ok) {
      setLoadError(data.error ?? 'Kunde inte läsa data.');
      return;
    }
    setLoadError(null);
    setKategorier(data.kategorier ?? []);
    setRundor(data.rundor ?? []);
    setPaket(data.paket ?? []);
    setPaketRundor(data.paketRundor ?? []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rundorById = Object.fromEntries(rundor.map((r) => [r.id, r]));
  const rundorByKategori = {};
  for (const r of rundor) {
    if (!rundorByKategori[r.kategori_id]) rundorByKategori[r.kategori_id] = [];
    rundorByKategori[r.kategori_id].push(r);
  }

  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 4 }}>
        Kartan
      </p>
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>Innehåll & paket</h2>

      {loadError && <p className={styles.errorNote}>{loadError}</p>}

      <PaketSektion
        paket={paket}
        paketRundor={paketRundor}
        rundorById={rundorById}
        kategorier={kategorier}
        oppetPaketId={oppetPaketId}
        setOppetPaketId={setOppetPaketId}
        testandeId={testandeId}
        setTestandeId={setTestandeId}
        onChanged={loadData}
      />

      <NyKategoriForm onCreated={loadData} />

      <NyRundaForm kategorier={kategorier} onCreated={loadData} />

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Befintliga kategorier & rundor</p>
        {kategorier.length === 0 && <p className={styles.listItemMeta}>Inga kategorier ännu.</p>}
        {kategorier.map((k) => (
          <div key={k.id} style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {k.namn} <span className={styles.listItemMeta}>({k.typ})</span>
            </p>
            {(rundorByKategori[k.id] ?? []).map((r) => {
              const testarNu = testandeId === r.id;
              return (
                <div key={r.id} className={styles.listItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span>
                      {r.titel}{' '}
                      <span className={styles.listItemMeta}>
                        — {r.visad_varde} {r.is_aktiv ? '· aktiv' : '· inaktiv'}
                      </span>
                    </span>
                    <button
                      onClick={() => setTestandeId(testarNu ? null : r.id)}
                      className={styles.typeButton}
                      style={{ flexShrink: 0, color: testarNu ? 'var(--amber-glow)' : 'var(--muted)' }}
                    >
                      {testarNu ? 'Stäng' : 'Testa'}
                    </button>
                  </div>
                  {testarNu && <TestaKarta runda={r} />}
                </div>
              );
            })}
            {(rundorByKategori[k.id] ?? []).length === 0 && (
              <p className={styles.listItemMeta}>Inga rundor i denna kategori ännu.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TestaKarta({ runda }) {
  return (
    <div style={{ maxWidth: 280, margin: '10px 0' }}>
      <KartanSvgMap
        geoSource={runda.typ === 'kommun' ? 'sweden-municipalities' : 'sweden-regions'}
        clickMode={runda.typ === 'punkt' ? 'point' : 'region'}
        revealed={true}
        correctRegionId={runda.typ !== 'punkt' ? runda.ratt_plats_id : null}
        correctPoint={
          runda.typ === 'punkt' && runda.ratt_lat != null && runda.ratt_lon != null
            ? { lat: runda.ratt_lat, lon: runda.ratt_lon }
            : null
        }
      />
    </div>
  );
}

function PaketSektion({
  paket,
  paketRundor,
  rundorById,
  kategorier,
  oppetPaketId,
  setOppetPaketId,
  testandeId,
  setTestandeId,
  onChanged,
}) {
  const [lage, setLage] = useState('blandat');
  const [namn, setNamn] = useState('');
  const [valdaKategorier, setValdaKategorier] = useState(new Set());
  const [antalKommun, setAntalKommun] = useState(5);
  const [antalPunkt, setAntalPunkt] = useState(5);
  const [kraverMedlemskap, setKraverMedlemskap] = useState(true);
  const [skapar, setSkapar] = useState(false);
  const [error, setError] = useState(null);

  function toggleKategori(id) {
    setValdaKategorier((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function skapaPaket() {
    setSkapar(true);
    setError(null);
    try {
      const body = { antalKommun, antalPunkt, kraverMedlemskap };
      if (namn) body.namn = namn;
      if (lage === 'tema') {
        if (valdaKategorier.size === 0) {
          setError('Välj minst en kategori för temapaketet.');
          return;
        }
        body.kategoriIds = Array.from(valdaKategorier);
      }
      const res = await authedFetch('/api/admin/kartan/paket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Något gick fel.');
        return;
      }
      setNamn('');
      setValdaKategorier(new Set());
      onChanged();
    } finally {
      setSkapar(false);
    }
  }

  async function togglaStatus(p) {
    const nyStatus = p.status === 'publicerad' ? 'utkast' : 'publicerad';
    await authedFetch(`/api/admin/kartan/paket/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nyStatus }),
    });
    onChanged();
  }

  async function togglaMedlemskap(p) {
    await authedFetch(`/api/admin/kartan/paket/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kraverMedlemskap: !p.kraver_medlemskap }),
    });
    onChanged();
  }

  async function togglaDagligPool(p) {
    await authedFetch(`/api/admin/kartan/paket/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dagligPool: !p.daglig_pool }),
    });
    onChanged();
  }

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>Paket</p>

      <div className={styles.selectTypeRow}>
        <button
          className={`${styles.typeButton} ${lage === 'blandat' ? styles.typeButtonActive : ''}`}
          onClick={() => setLage('blandat')}
        >
          Slumpat blandpaket
        </button>
        <button
          className={`${styles.typeButton} ${lage === 'tema' ? styles.typeButtonActive : ''}`}
          onClick={() => setLage('tema')}
        >
          Temapaket
        </button>
      </div>

      {lage === 'blandat' ? (
        <p className={styles.pickerHint}>
          Slumpar {antalKommun} kommun + {antalPunkt} nålgissning ur HELA den oanvända poolen.
        </p>
      ) : (
        <>
          <p className={styles.pickerHint}>
            Kryssa i vilka kategorier som ska utgöra paketet (t.ex. bara Stockholm-kategorier).
          </p>
          <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 12 }}>
            {kategorier.map((k) => (
              <label
                key={k.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}
              >
                <input type="checkbox" checked={valdaKategorier.has(k.id)} onChange={() => toggleKategori(k.id)} />
                {k.namn} <span className={styles.listItemMeta}>({k.typ})</span>
              </label>
            ))}
          </div>
        </>
      )}

      <label className={styles.label}>Paketnamn (valfritt)</label>
      <input className={styles.input} value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="T.ex. Stockholm — landmärken" />

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div>
          <label className={styles.label}>Antal kommun-frågor</label>
          <input type="number" className={styles.input} value={antalKommun} onChange={(e) => setAntalKommun(Number(e.target.value))} min={0} />
        </div>
        <div>
          <label className={styles.label}>Antal nålgissningar</label>
          <input type="number" className={styles.input} value={antalPunkt} onChange={(e) => setAntalPunkt(Number(e.target.value))} min={0} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer', marginBottom: 16 }}>
        <input type="checkbox" checked={kraverMedlemskap} onChange={(e) => setKraverMedlemskap(e.target.checked)} />
        Kräver betalt medlemskap (avmarkera för ett fritt smakprov, synligt för alla)
      </label>

      <button className={styles.button} disabled={skapar} onClick={skapaPaket}>
        {skapar ? 'Skapar…' : lage === 'tema' ? 'Skapa temapaket' : 'Skapa nytt paket'}
      </button>
      {error && <p className={styles.errorNote}>{error}</p>}

      <div style={{ marginTop: 16 }}>
        {paket.length === 0 && <p className={styles.listItemMeta}>Inga paket ännu.</p>}
        {paket.map((p) => {
          const oppet = oppetPaketId === p.id;
          const rundorIPaket = paketRundor.filter((pr) => pr.paket_id === p.id).sort((a, b) => a.ordning - b.ordning);

          return (
            <div key={p.id} style={{ marginBottom: 10, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span onClick={() => setOppetPaketId(oppet ? null : p.id)} style={{ cursor: 'pointer', fontWeight: 600 }}>
                  {p.namn} <span className={styles.listItemMeta}>({rundorIPaket.length} frågor · {new Date(p.skapad_at).toLocaleDateString('sv-SE')})</span>
                </span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => togglaDagligPool(p)}
                    className={styles.typeButton}
                    style={{
                      borderColor: p.daglig_pool ? '#7cc4ed' : 'var(--line)',
                      color: p.daglig_pool ? '#7cc4ed' : 'var(--muted)',
                    }}
                  >
                    {p.daglig_pool ? '📅 I dagspoolen' : '– Ej i dagspoolen'}
                  </button>
                  <button
                    onClick={() => togglaMedlemskap(p)}
                    className={styles.typeButton}
                    style={{
                      borderColor: p.kraver_medlemskap ? 'var(--line)' : '#4ade80',
                      color: p.kraver_medlemskap ? 'var(--muted)' : '#4ade80',
                    }}
                  >
                    {p.kraver_medlemskap ? '🔒 Medlem' : '✓ Fritt'}
                  </button>
                  <button
                    onClick={() => togglaStatus(p)}
                    className={styles.typeButton}
                    style={{
                      borderColor: p.status === 'publicerad' ? '#4ade80' : 'var(--line)',
                      color: p.status === 'publicerad' ? '#4ade80' : 'var(--muted)',
                    }}
                  >
                    {p.status === 'publicerad' ? '● Publicerad' : '○ Utkast'}
                  </button>
                </div>
              </div>

              {oppet && (
                <div style={{ marginTop: 10, paddingLeft: 8 }}>
                  {rundorIPaket.map((pr, i) => {
                    const r = rundorById[pr.runda_id];
                    if (!r) return null;
                    const testarNu = testandeId === r.id;
                    return (
                      <div key={pr.runda_id} className={styles.listItem}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <span>
                            {i + 1}. {r.titel} <span className={styles.listItemMeta}>({r.typ}) — {r.visad_varde}</span>
                          </span>
                          <button
                            onClick={() => setTestandeId(testarNu ? null : r.id)}
                            className={styles.typeButton}
                            style={{ flexShrink: 0, color: testarNu ? 'var(--amber-glow)' : 'var(--muted)' }}
                          >
                            {testarNu ? 'Stäng' : 'Testa'}
                          </button>
                        </div>
                        {testarNu && <TestaKarta runda={r} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NyKategoriForm({ onCreated }) {
  const [namn, setNamn] = useState('');
  const [beskrivning, setBeskrivning] = useState('');
  const [typ, setTyp] = useState('kommun');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await authedFetch('/api/admin/kartan/kategorier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namn, beskrivning, typ }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Något gick fel.');
        return;
      }
      setSuccess(true);
      setNamn('');
      setBeskrivning('');
      onCreated();
    } catch {
      setError('Kunde inte nå servern.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>Ny kategori</p>
      <div className={styles.selectTypeRow}>
        <button className={`${styles.typeButton} ${typ === 'lan' ? styles.typeButtonActive : ''}`} onClick={() => setTyp('lan')}>
          Länsklick
        </button>
        <button className={`${styles.typeButton} ${typ === 'kommun' ? styles.typeButtonActive : ''}`} onClick={() => setTyp('kommun')}>
          Kommunklick
        </button>
        <button className={`${styles.typeButton} ${typ === 'punkt' ? styles.typeButtonActive : ''}`} onClick={() => setTyp('punkt')}>
          Nålgissning
        </button>
      </div>
      <label className={styles.label}>Namn</label>
      <input className={styles.input} value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="T.ex. Historiska händelser" />
      <label className={styles.label}>Beskrivning (valfritt)</label>
      <input className={styles.input} value={beskrivning} onChange={(e) => setBeskrivning(e.target.value)} />
      <button className={styles.button} disabled={!namn || submitting} onClick={handleSubmit}>
        Skapa kategori
      </button>
      {error && <p className={styles.errorNote}>{error}</p>}
      {success && <p className={styles.successNote}>Kategori skapad!</p>}
    </div>
  );
}

function NyRundaForm({ kategorier, onCreated }) {
  const [kategoriId, setKategoriId] = useState('');
  const [titel, setTitel] = useState('');
  const [visadVarde, setVisadVarde] = useState('');
  const [toleransKm, setToleransKm] = useState(15);
  const [pickedPlatsId, setPickedPlatsId] = useState(null);
  const [pickedPlatsNamn, setPickedPlatsNamn] = useState(null);
  const [pickedPoint, setPickedPoint] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const valdKategori = kategorier.find((k) => k.id === kategoriId);
  const typ = valdKategori?.typ;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await authedFetch('/api/admin/kartan/rundor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kategoriId,
          titel,
          typ,
          rattPlatsId: pickedPlatsId,
          rattLat: pickedPoint?.lat,
          rattLon: pickedPoint?.lon,
          toleransKm,
          visadVarde,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Något gick fel.');
        return;
      }
      setSuccess(true);
      setTitel('');
      setVisadVarde('');
      setPickedPlatsId(null);
      setPickedPlatsNamn(null);
      setPickedPoint(null);
      onCreated();
    } catch {
      setError('Kunde inte nå servern.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    kategoriId && titel && visadVarde && ((typ === 'lan' && pickedPlatsId) || (typ === 'kommun' && pickedPlatsId) || (typ === 'punkt' && pickedPoint));

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>Ny runda (manuell)</p>
      <label className={styles.label}>Kategori</label>
      <select
        className={styles.input}
        value={kategoriId}
        onChange={(e) => {
          setKategoriId(e.target.value);
          setPickedPlatsId(null);
          setPickedPlatsNamn(null);
          setPickedPoint(null);
        }}
      >
        <option value="">Välj kategori…</option>
        {kategorier.map((k) => (
          <option key={k.id} value={k.id}>
            {k.namn} ({k.typ})
          </option>
        ))}
      </select>

      {kategoriId && (
        <>
          <label className={styles.label}>Fråga</label>
          <input className={styles.input} value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="T.ex. I vilket län ligger Sveriges huvudstad?" />
          <label className={styles.label}>Facit-text (visas vid avslöjande)</label>
          <input className={styles.input} value={visadVarde} onChange={(e) => setVisadVarde(e.target.value)} placeholder="T.ex. Stockholm ligger i Stockholms län" />

          {typ === 'punkt' && (
            <>
              <label className={styles.label}>Tolerans (km för fullträff)</label>
              <input type="number" className={styles.input} value={toleransKm} onChange={(e) => setToleransKm(Number(e.target.value))} />
            </>
          )}

          <p className={styles.pickerHint}>
            {typ === 'lan' ? 'Klicka på rätt län i kartan nedan.' : typ === 'kommun' ? 'Klicka på rätt kommun i kartan nedan.' : 'Klicka på rätt plats i kartan nedan.'}
          </p>

          {pickedPlatsNamn && <p className={styles.pickedValue}>Vald {typ === 'kommun' ? 'kommun' : 'län'}: {pickedPlatsNamn}</p>}
          {pickedPoint && <p className={styles.pickedValue}>Vald punkt: {pickedPoint.lat.toFixed(4)}, {pickedPoint.lon.toFixed(4)}</p>}

          <div style={{ maxWidth: 320, marginBottom: 16 }}>
            <KartanSvgMap
              geoSource={typ === 'kommun' ? 'sweden-municipalities' : 'sweden-regions'}
              clickMode={typ === 'punkt' ? 'point' : 'region'}
              guessRegionId={pickedPlatsId}
              guessPoint={pickedPoint}
              revealed={false}
              onRegionClick={(id, namn) => {
                setPickedPlatsId(id);
                setPickedPlatsNamn(namn);
              }}
              onMapClick={(lat, lon) => setPickedPoint({ lat, lon })}
            />
          </div>

          <button className={styles.button} disabled={!canSubmit || submitting} onClick={handleSubmit}>
            Skapa runda
          </button>
          {error && <p className={styles.errorNote}>{error}</p>}
          {success && <p className={styles.successNote}>Runda skapad och aktiverad!</p>}
        </>
      )}
    </div>
  );
}
