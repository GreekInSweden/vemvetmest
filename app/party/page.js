'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import styles from './party.module.css';

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

export default function PartyPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [vy, setVy] = useState('valj');
  const [error, setError] = useState(null);

  // Skapa-formulär
  const [nyttNamn, setNyttNamn] = useState('');
  const [ledareSmeknamn, setLedareSmeknamn] = useState('');
  const [radtext, setRadtext] = useState('');
  const [allaListor, setAllaListor] = useState([]);
  const [listSok, setListSok] = useState('');
  const [valdaListor, setValdaListor] = useState([]); // [{id,title,subtitle}]
  const [listaTidsgrans, setListaTidsgrans] = useState(240);

  // Gå med-formulär
  const [inKod, setInKod] = useState('');
  const [smeknamn, setSmeknamn] = useState('');

  // Aktivt party-tillstånd
  const [partyId, setPartyId] = useState(null);
  const [partyKod, setPartyKod] = useState(null);
  const [isLedare, setIsLedare] = useState(false);
  const [partyStatus, setPartyStatus] = useState('lobby');
  const [deltagare, setDeltagare] = useState([]);
  const [runda, setRunda] = useState(null);
  const [kvarSekunder, setKvarSekunder] = useState(null);
  const [mittSvar, setMittSvar] = useState('');
  const [harSvarat, setHarSvarat] = useState(false);
  const [mittResultat, setMittResultat] = useState(null);
  const [avslutat, setAvslutat] = useState(false);

  // Listrunda-specifikt
  const [hittadeItems, setHittadeItems] = useState([]); // [{rank,namn}]
  const [allaRanks, setAllaRanks] = useState([]); // [1,2,3...] — bara positioner, inga svar
  const [listFel, setListFel] = useState(false);
  const listInputRef = useRef(null);

  const channelRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/login');
        return;
      }
      setChecking(false);
    });
  }, [router]);

  useEffect(() => {
    if (vy !== 'skapa') return;
    supabase
      .from('game_lists')
      .select('id, title, subtitle, child_package, categories ( name )')
      .order('title')
      .then(({ data }) => setAllaListor(data || []));
  }, [vy]);

  async function hamtaDeltagare(pid) {
    const { data } = await supabase
      .from('party_deltagare')
      .select('id, smeknamn, poang_total, spelare_id')
      .eq('party_id', pid)
      .order('poang_total', { ascending: false });
    setDeltagare(data || []);
  }

  async function hamtaRunda(pid, ordning, startadAt) {
    const { data } = await supabase
      .from('party_rundor_public')
      .select('typ, list_id, fraga, tidsgrans_sekunder')
      .eq('party_id', pid)
      .eq('ordning', ordning)
      .single();
    if (data) {
      let listTitel = null;
      let ranks = [];
      if (data.typ === 'kanduallalista') {
        const { data: listRow } = await supabase.from('game_lists').select('title, subtitle').eq('id', data.list_id).single();
        listTitel = listRow;
        // Bara positionsnumren, aldrig namn/värde — de förblir hemliga
        // tills man faktiskt gissat rätt.
        const { data: rankRows } = await supabase
          .from('list_items')
          .select('rank')
          .eq('list_id', data.list_id)
          .order('rank');
        ranks = (rankRows || []).map((r) => r.rank);
      }
      setRunda({
        ordning,
        typ: data.typ,
        listId: data.list_id,
        listTitel,
        fraga: data.fraga,
        tidsgransSekunder: data.tidsgrans_sekunder,
        startadAt,
      });
      setAllaRanks(ranks);
      setMittSvar('');
      setHarSvarat(false);
      setMittResultat(null);
      setHittadeItems([]);
      setListFel(false);
    }
  }

  function prenumereraPaParty(pid) {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`party-${pid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'party', filter: `id=eq.${pid}` },
        (payload) => {
          const p = payload.new;
          setPartyStatus(p.status);
          if (p.status === 'avslutad') {
            setAvslutat(true);
          } else if (p.status === 'aktiv') {
            hamtaRunda(pid, p.aktuell_runda_index, p.aktuell_runda_startad_at);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_deltagare', filter: `party_id=eq.${pid}` },
        () => hamtaDeltagare(pid)
      )
      .subscribe();

    channelRef.current = channel;
  }

  useEffect(() => {
    if (!runda) return;
    const uppdatera = () => {
      const forfluten = (Date.now() - new Date(runda.startadAt).getTime()) / 1000;
      const kvar = Math.max(0, Math.ceil(runda.tidsgransSekunder - forfluten));
      setKvarSekunder(kvar);
    };
    uppdatera();
    const iv = setInterval(uppdatera, 250);
    return () => clearInterval(iv);
  }, [runda]);

  useEffect(() => {
    if (runda?.typ === 'kanduallalista') listInputRef.current?.focus();
  }, [runda, hittadeItems]);

  function toggleValdList(list) {
    setValdaListor((prev) =>
      prev.some((l) => l.id === list.id) ? prev.filter((l) => l.id !== list.id) : [...prev, list]
    );
  }

  async function skapaParty() {
    setError(null);
    const textRundor = radtext
      .split('\n')
      .map((rad) => rad.trim())
      .filter(Boolean)
      .map((rad) => {
        const [fraga, rattSvar] = rad.split('|');
        return { typ: 'text', fraga: fraga?.trim(), rattSvar: rattSvar?.trim(), tidsgransSekunder: 20 };
      })
      .filter((r) => r.fraga && r.rattSvar);

    const listRundor = valdaListor.map((l) => ({
      typ: 'kanduallalista',
      listId: l.id,
      tidsgransSekunder: listaTidsgrans,
    }));

    const rundor = [...listRundor, ...textRundor];

    if (!nyttNamn || rundor.length === 0) {
      setError('Namn krävs, och minst en runda (välj en lista eller skriv en snabbfråga).');
      return;
    }

    try {
      const data = await authedFetch('/api/party/create', {
        namn: nyttNamn,
        rundor,
        ledareSmeknamn: ledareSmeknamn || 'Ledaren',
      });
      setPartyId(data.partyId);
      setPartyKod(data.kod);
      setIsLedare(true);
      setVy('i-party');
      await hamtaDeltagare(data.partyId);
      prenumereraPaParty(data.partyId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function gaMed() {
    setError(null);
    if (!inKod || !smeknamn) {
      setError('Kod och smeknamn krävs.');
      return;
    }
    try {
      const data = await authedFetch('/api/party/join', { kod: inKod, smeknamn });
      setPartyId(data.partyId);
      setPartyKod(inKod.toUpperCase());
      setIsLedare(false);
      setVy('i-party');
      await hamtaDeltagare(data.partyId);
      prenumereraPaParty(data.partyId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function startaNastaOmgang() {
    setError(null);
    try {
      await authedFetch('/api/party/start-round', { partyId });
    } catch (e) {
      setError(e.message);
    }
  }

  async function skickaSvar() {
    if (!mittSvar.trim() || harSvarat) return;
    setHarSvarat(true);
    try {
      const data = await authedFetch('/api/party/answer', { partyId, svar: mittSvar });
      setMittResultat(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function skickaListgissning(e) {
    e.preventDefault();
    if (!mittSvar.trim() || kvarSekunder === 0) return;
    const gissning = mittSvar;
    setMittSvar('');
    try {
      const result = await authedFetch('/api/party/lista-gissning', { partyId, guess: gissning });
      if (result.correct) {
        setHittadeItems((prev) => [...prev, ...result.matches].sort((a, b) => a.rank - b.rank));
        setListFel(false);
      } else {
        setListFel(true);
        setTimeout(() => setListFel(false), 400);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  if (checking) {
    return (
      <div className="wrap">
        <p className="subhead">Laddar…</p>
      </div>
    );
  }

  const filtreradeListor = allaListor.filter((l) => l.title.toLowerCase().includes(listSok.toLowerCase()));

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">Alla spel</a>
      </div>

      <p className="eyebrow" style={{ marginTop: 20 }}>KAN DU ALLA</p>
      <h1 className="brand">Party</h1>

      {error && <p style={{ color: '#e78a6c', fontSize: 13 }}>{error}</p>}

      {vy === 'valj' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setVy('skapa')}>
            Skapa party (ledare)
          </button>
          <button className="btn btn-ghost" onClick={() => setVy('ga-med')}>
            Gå med i party
          </button>
        </div>
      )}

      {vy === 'skapa' && (
        <div className={styles.formBox} style={{ maxWidth: 520 }}>
          <label className={styles.label}>Partyts namn</label>
          <input className={styles.input} value={nyttNamn} onChange={(e) => setNyttNamn(e.target.value)} />
          <label className={styles.label}>Ditt smeknamn (du gissar också)</label>
          <input className={styles.input} value={ledareSmeknamn} onChange={(e) => setLedareSmeknamn(e.target.value)} />

          <p className={styles.sektionsrubrik}>KanDuAlla-listor</p>
          <label className={styles.label}>Tidsgräns per lista (sekunder)</label>
          <input
            type="number"
            className={styles.input}
            value={listaTidsgrans}
            onChange={(e) => setListaTidsgrans(Number(e.target.value))}
          />
          <input
            className={styles.input}
            placeholder="Sök lista…"
            value={listSok}
            onChange={(e) => setListSok(e.target.value)}
          />
          <div className={styles.listPicker}>
            {filtreradeListor.map((l) => (
              <label key={l.id} className={styles.listPickerRad}>
                <input type="checkbox" checked={valdaListor.some((v) => v.id === l.id)} onChange={() => toggleValdList(l)} />
                <span className={styles.listPickerTitel}>{l.title}</span>
                <span className={styles.listPickerKategori}>{l.categories?.name}</span>
                {l.child_package && <span className={styles.barnMarkning}>BARN</span>}
              </label>
            ))}
          </div>
          {valdaListor.length > 0 && (
            <p className={styles.valdaCount}>{valdaListor.length} lista(or) valda</p>
          )}

          <p className={styles.sektionsrubrik}>Egna snabbfrågor (valfritt)</p>
          <label className={styles.label}>En per rad, format: fråga|svar</label>
          <textarea className={styles.textarea} rows={4} value={radtext} onChange={(e) => setRadtext(e.target.value)} />

          <button className="btn btn-primary" style={{ width: 'auto', marginTop: 12 }} onClick={skapaParty}>
            Skapa party
          </button>
        </div>
      )}

      {vy === 'ga-med' && (
        <div className={styles.formBox}>
          <label className={styles.label}>Partykod</label>
          <input className={styles.input} value={inKod} onChange={(e) => setInKod(e.target.value.toUpperCase())} maxLength={5} />
          <label className={styles.label}>Ditt smeknamn</label>
          <input className={styles.input} value={smeknamn} onChange={(e) => setSmeknamn(e.target.value)} />
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={gaMed}>
            Gå med
          </button>
        </div>
      )}

      {vy === 'i-party' && (
        <div className={styles.partyWrap}>
          {isLedare && (
            <p className={styles.kodVisning}>
              Kod: <b>{partyKod}</b>
            </p>
          )}

          {avslutat ? (
            <div className={styles.resultBlock}>
              <p className={styles.slutrubrik}>Partyt är slut!</p>
              <div className={styles.topplista}>
                {deltagare.map((d, i) => (
                  <div key={d.id} className={styles.topplistaRad}>
                    <span>#{i + 1} {d.smeknamn}</span>
                    <span>{d.poang_total}p</span>
                  </div>
                ))}
              </div>
            </div>
          ) : partyStatus === 'lobby' ? (
            <>
              <p className="subhead">Väntar i lobbyn…</p>
              <div className={styles.topplista}>
                {deltagare.map((d) => (
                  <div key={d.id} className={styles.topplistaRad}>
                    <span>{d.smeknamn}</span>
                  </div>
                ))}
              </div>
              {isLedare && (
                <button className="btn btn-primary" style={{ width: 'auto', marginTop: 12 }} onClick={startaNastaOmgang}>
                  Starta första omgången
                </button>
              )}
            </>
          ) : runda ? (
            <>
              <p className={styles.timer}>{kvarSekunder}s</p>

              {runda.typ === 'kanduallalista' ? (
                <>
                  <p className={styles.fraga}>{runda.listTitel?.title}</p>
                  {runda.listTitel?.subtitle && <p className="subhead">{runda.listTitel.subtitle}</p>}
                  <p className={styles.progress}>{hittadeItems.length} hittade</p>

                  <form onSubmit={skickaListgissning} className={`${styles.guessRow} ${listFel ? styles.shake : ''}`}>
                    <input
                      ref={listInputRef}
                      className={styles.input}
                      value={mittSvar}
                      onChange={(e) => setMittSvar(e.target.value)}
                      disabled={kvarSekunder === 0}
                      autoComplete="off"
                    />
                    <button className="btn btn-primary" style={{ width: 'auto' }} disabled={kvarSekunder === 0}>
                      Gissa
                    </button>
                  </form>

                  <div className="board-list" style={{ marginTop: 10, maxHeight: 320, overflowY: 'auto' }}>
                    {allaRanks.map((rank) => {
                      const funnet = hittadeItems.find((item) => item.rank === rank);
                      return (
                        <div className="row" key={rank}>
                          <div className="rank">{rank}</div>
                          <div className={`flap ${funnet ? 'revealed' : ''}`}>
                            {funnet ? (
                              <span className="name">{funnet.name || funnet.namn}</span>
                            ) : (
                              <span className="placeholder">— — — — — —</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.fraga}>{runda.fraga}</p>
                  {!harSvarat ? (
                    <div className={styles.guessRow}>
                      <input
                        className={styles.input}
                        value={mittSvar}
                        onChange={(e) => setMittSvar(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && skickaSvar()}
                        disabled={kvarSekunder === 0}
                      />
                      <button className="btn btn-primary" style={{ width: 'auto' }} onClick={skickaSvar} disabled={kvarSekunder === 0}>
                        Svara
                      </button>
                    </div>
                  ) : (
                    <p className={mittResultat?.ratt ? styles.resultHit : styles.resultMiss}>
                      {mittResultat ? (mittResultat.ratt ? `Rätt! +${mittResultat.poang}p` : 'Fel svar') : 'Svar skickat, väntar…'}
                    </p>
                  )}
                </>
              )}

              <div className={styles.topplista}>
                {deltagare.map((d) => (
                  <div key={d.id} className={styles.topplistaRad}>
                    <span>{d.smeknamn}</span>
                    <span>{d.poang_total}p</span>
                  </div>
                ))}
              </div>

              {isLedare && (
                <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={startaNastaOmgang}>
                  Nästa omgång →
                </button>
              )}
            </>
          ) : (
            <p className="subhead">Laddar omgång…</p>
          )}
        </div>
      )}
    </div>
  );
}
