'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

function formatValue(item, list) {
  const v = Number(item.value);
  switch (list.value_format) {
    case 'millions_inv':
      return (v / 1e6).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' milj. inv.';
    case 'year':
      return 'tillträdde ' + v;
    default:
      return v.toLocaleString('sv-SE') + (list.value_suffix || '');
  }
}

function formatTime(s) {
  const clamped = Math.max(0, s);
  const m = String(Math.floor(clamped / 60)).padStart(2, '0');
  const sec = String(clamped % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

export default function PlayPage() {
  const router = useRouter();
  const params = useParams();
  const [userId, setUserId] = useState(null);
  const [list, setList] = useState(null);
  const [allRanks, setAllRanks] = useState([]); // bara rank-siffrorna, ALDRIG namn/värden i förväg
  const [revealed, setRevealed] = useState({}); // rank -> { name, value } - bara för bekräftat rätta/spelet-slut
  const [guessedRanks, setGuessedRanks] = useState(new Set());
  const [misses, setMisses] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [endReason, setEndReason] = useState(null); // 'complete' | 'timeout' | 'giveup'
  const [toast, setToast] = useState('');
  const [shake, setShake] = useState(false);
  const [guess, setGuess] = useState('');
  const [difficulty, setDifficulty] = useState('hard');
  const [hintMsg, setHintMsg] = useState('');
  const difficultyRef = useRef('hard');
  const [memberLocked, setMemberLocked] = useState(false);
  const [childPackageLocked, setChildPackageLocked] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const guessedRef = useRef(new Set());
  const revealedRef = useRef({});
  const missesRef = useRef(0);
  const finishedRef = useRef(false);
  const timeLimitRef = useRef(300);
  const listRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session ? sessionData.session.user.id : null;
      setUserId(uid);

      let diff = 'hard';
      let childPackageActive = false;
      let isAdmin = false;
      if (uid) {
        const { data: profile } = await supabase.from('profiles').select('difficulty, child_package_id, is_admin').eq('id', uid).single();
        diff = profile?.difficulty || 'hard';
        isAdmin = !!profile?.is_admin;
        if (profile?.child_package_id) {
          const { data: pkg } = await supabase.from('child_packages').select('paid_until').eq('id', profile.child_package_id).single();
          const todayStr = new Date().toISOString().slice(0, 10);
          childPackageActive = !!pkg?.paid_until && pkg.paid_until >= todayStr;
        }
      }
      setDifficulty(diff);
      difficultyRef.current = diff;

      const { data: listRow } = await supabase
        .from('game_lists')
        .select('*')
        .eq('slug', params.slug)
        .single();
      if (!listRow) return;
      setList(listRow);
      listRef.current = listRow;

      if (listRow.child_package && !childPackageActive && !isAdmin) {
        setChildPackageLocked(true);
        return;
      }

      if (listRow.member_exclusive && !uid) {
        setMemberLocked(true);
        return;
      }

      // Hämtar BARA rank-siffrorna för att kunna rita upp brädet - inga
      // namn eller värden hämtas i förväg. Databasen är dessutom låst så
      // att bara "rank"-kolumnen går att läsa direkt överhuvudtaget.
      const { data: rankRows } = await supabase
        .from('list_items')
        .select('rank')
        .eq('list_id', listRow.id)
        .order('rank');
      setAllRanks((rankRows || []).map(r => r.rank));

      const baseLimit = listRow.time_limit_seconds || 300;
      const limit = diff === 'easy' ? Math.round(baseLimit * 1.5) : baseLimit;
      timeLimitRef.current = limit;
      setSecondsLeft(limit);
      startTimer();
    }
    load();
    return () => clearInterval(timerRef.current);
  }, [params.slug, router]);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, [allRanks]);

  // ---- Fuskskydd: byter man flik/app under ett pågående spel
  // försvinner 80% av återstående tid. Enkel, ärlig spärr mot att
  // googla svaren på en annan skärm eller i en annan app.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !finishedRef.current && listRef.current) {
        setSecondsLeft(s => {
          const penalized = Math.max(1, Math.floor(s * 0.2));
          showToast('⚠️ Du bytte flik/app — 80% av återstående tid försvann!');
          return penalized;
        });
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  function startTimer() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setTimeout(() => endGame('timeout'), 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(''), 1800);
  }

  async function endGame(reason) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    setEndReason(reason);
    clearInterval(timerRef.current);

    // Nu när spelet är slut - hämta hela facit för att visa i brädet
    try {
      const res = await fetch('/api/game/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: listRef.current.id })
      });
      const data = await res.json();
      const fullRevealed = { ...revealedRef.current };
      (data.items || []).forEach(it => { fullRevealed[it.rank] = { name: it.name, value: it.value }; });
      revealedRef.current = fullRevealed;
      setRevealed(fullRevealed);
    } catch {
      // Om facit-hämtningen skulle strula visas i värsta fall bara
      // de redan gissade raderna - spara-resultatet nedan går ändå igenom.
    }

    const elapsed = timeLimitRef.current - (reason === 'timeout' ? 0 : secondsLeft);

    if (listRef.current) {
      await supabase.from('results').insert({
        user_id: userId || null,
        list_id: listRef.current.id,
        guessed: guessedRef.current.size,
        total: allRanks.length,
        misses: missesRef.current,
        seconds: elapsed,
        difficulty: difficultyRef.current,
        completed: reason === 'complete'
      });
    }
  }

  async function submitGuess(e) {
    e.preventDefault();
    if (finishedRef.current) return;
    const raw = guess.trim();
    if (!raw || !listRef.current) return;

    let result;
    try {
      const res = await fetch('/api/game/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: listRef.current.id,
          guess: raw,
          guessedRanks: Array.from(guessedRef.current)
        })
      });
      result = await res.json();
    } catch {
      showToast('Kunde inte kontrollera gissningen - försök igen.');
      return;
    }

    if (!result.correct) {
      if (result.alreadyGuessedName) {
        showToast('Redan gissat: ' + result.alreadyGuessedName);
        setGuess('');
        return;
      }
      missesRef.current += 1;
      setMisses(missesRef.current);
      setShake(true);
      setTimeout(() => setShake(false), 300);
      showToast(listRef.current.guess_mode === 'strict_order'
        ? 'Fel — det är inte nästa svar i ordningen.'
        : 'Inte med på listan.');
      setGuess('');
      return;
    }

    const next = new Set(guessedRef.current);
    const nextRevealed = { ...revealedRef.current };
    result.matches.forEach(m => {
      next.add(m.rank);
      nextRevealed[m.rank] = { name: m.name, value: m.value };
    });
    guessedRef.current = next;
    revealedRef.current = nextRevealed;
    setGuessedRanks(next);
    setRevealed(nextRevealed);
    setGuess('');

    if (result.matches.length > 1) {
      showToast(`Rätt! ${result.matches.length} träffar: ` + result.matches.map(m => '#' + m.rank + ' ' + m.name).join(', '));
    } else if (result.remainingSameName > 0) {
      showToast(`Rätt! #${result.matches[0].rank} ${result.matches[0].name} (${result.remainingSameName} till kvar i listan — gissa igen)`);
    } else if (result.wasFuzzy) {
      showToast(`Rätt! #${result.matches[0].rank} ${result.matches[0].name} (tolkat trots stavfel)`);
    } else {
      showToast('Rätt! #' + result.matches[0].rank + ' ' + result.matches[0].name);
    }

    if (result.allGuessed) endGame('complete');
  }

  async function handleHint() {
    if (finishedRef.current || difficultyRef.current === 'hard' || !listRef.current) return;
    let result;
    try {
      const res = await fetch('/api/game/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: listRef.current.id, guessedRanks: Array.from(guessedRef.current) })
      });
      result = await res.json();
    } catch {
      return;
    }
    if (result.done) return;

    if (difficultyRef.current === 'medium') {
      missesRef.current += 1;
      setMisses(missesRef.current);
    }
    setHintMsg(`💡 Rad #${result.rank} börjar på "${result.firstLetter}"`);
    setTimeout(() => setHintMsg(''), 4000);
  }

  function giveUp() {
    if (finishedRef.current) return;
    endGame('giveup');
  }

  function restart() {
    guessedRef.current = new Set();
    revealedRef.current = {};
    missesRef.current = 0;
    finishedRef.current = false;
    setGuessedRanks(new Set());
    setRevealed({});
    setMisses(0);
    setSecondsLeft(timeLimitRef.current);
    setFinished(false);
    setEndReason(null);
    setToast('');
    startTimer();
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
  }

  if (childPackageLocked) {
    return (
      <div className="wrap">
        <div className="topbar"><a className="btn btn-ghost" href="/">&larr; Alla spel</a></div>
        <div className="upgrade-card">
          <span className="upgrade-badge">Barnpaket krävs</span>
          <div className="upgrade-title">Det här spelet ingår i Barnpaketet</div>
          <p className="subhead" style={{ marginBottom: 18 }}>
            En förälder köper Barnpaketet (99 kr/år) och paketet aktiveras av oss — ingen kod behövs.
            Kontot är kanske inte aktiverat än, eller så har prenumerationen gått ut och behöver förnyas.
          </p>
          <a href="/prenumerera" className="btn btn-primary" style={{ width: 'auto', padding: '13px 26px' }}>
            Läs mer →
          </a>
        </div>
      </div>
    );
  }

  if (memberLocked) {
    return (
      <div className="wrap">
        <div className="topbar"><a className="btn btn-ghost" href="/">&larr; Alla spel</a></div>
        <div className="upgrade-card">
          <span className="upgrade-badge">Gratis medlemsspel</span>
          <div className="upgrade-title">Skapa ett konto för att spela</div>
          <p className="subhead" style={{ marginBottom: 18 }}>
            Det här spelet är gratis, men kräver ett konto — inget betalt medlemskap behövs.
          </p>
          <a href="/signup" className="btn btn-primary" style={{ width: 'auto', padding: '13px 26px' }}>
            Skapa konto (gratis) →
          </a>
        </div>
      </div>
    );
  }

  if (!list) {
    return <div className="wrap"><p className="subhead">Laddar listan…</p></div>;
  }

  const isLowTime = secondsLeft <= 30 && !finished;

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <div className="panel">
        <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 22, letterSpacing: '.03em', marginBottom: 2 }}>
          {list.title}
        </div>
        <div className="subhead" style={{ marginBottom: 6 }}>
          {list.subtitle}
          {finished && list.source && <> — {list.source}</>}
        </div>
        {list.guess_mode === 'strict_order' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--amber)', color: '#241505',
            fontFamily: "'Oswald', sans-serif", fontSize: 12.5, fontWeight: 700,
            letterSpacing: '.04em', textTransform: 'uppercase',
            padding: '7px 14px', borderRadius: 4, marginBottom: 14
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: '50%', background: '#241505',
              color: 'var(--amber)', fontSize: 11, fontWeight: 700, flexShrink: 0
            }}>!</span>
            Rätt ordning krävs — gissa svar #1 först, sen i tur och ordning
          </div>
        )}
        {list.guess_mode === 'multi_fill' && (
          <div className="subhead" style={{ marginBottom: 12, fontStyle: 'italic' }}>
            Ett namn kan ge flera träffar på en gång om det förekommer flera gånger i listan.
          </div>
        )}
        {difficulty !== 'hard' && (
          <div className="subhead" style={{ marginBottom: 12 }}>
            Spelar på nivå <b style={{ color: 'var(--amber-glow)' }}>{difficulty === 'easy' ? 'Lätt' : 'Medel'}</b>
            {difficulty === 'easy' ? ' — räknas inte i topplistorna.' : '.'}
          </div>
        )}

        <div className="stats">
          <div className="stat">Gissade: <b>{guessedRanks.size}</b> / {allRanks.length}</div>
          <div className="stat">
            Tid kvar: <b style={isLowTime ? { color: 'var(--miss)' } : undefined}>{formatTime(secondsLeft)}</b>
          </div>
        </div>

        <form onSubmit={submitGuess} className={`input-row ${shake ? 'shake' : ''}`}>
          <input
            ref={inputRef}
            className="field"
            type="text"
            autoComplete="off"
            placeholder="Skriv ett namn och tryck Enter…"
            value={guess}
            onChange={e => setGuess(e.target.value)}
            disabled={finished}
          />
          <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={finished}>Gissa</button>
          {difficulty !== 'hard' && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: 'auto' }}
              onClick={handleHint}
              disabled={finished}
            >
              Ledtråd{difficulty === 'medium' ? ' (kostar ett fel)' : ''}
            </button>
          )}
        </form>
        {hintMsg && <div className="toast" style={{ color: 'var(--amber-glow)' }}>{hintMsg}</div>}
        <div className="toast">{toast}</div>

        <div className="foot-actions">
          <button className="btn btn-ghost" onClick={giveUp}>Ge upp &amp; visa facit</button>
          <button className="btn btn-ghost" onClick={restart}>Starta om</button>
        </div>

        {finished && (
          <div className="end-banner">
            {endReason === 'complete' && `Full pott! ${allRanks.length} av ${allRanks.length} på ${formatTime(timeLimitRef.current - secondsLeft)}.`}
            {endReason === 'timeout' && `Tiden tog slut — du fick ${guessedRanks.size} av ${allRanks.length}.`}
            {endReason === 'giveup' && `Facit visat — du fick ${guessedRanks.size} av ${allRanks.length} själv.`}
          </div>
        )}

        <div className="board-list" style={{ marginTop: 10 }}>
          {allRanks.map(rank => {
            const isGuessed = guessedRanks.has(rank);
            const data = revealed[rank];
            return (
              <div className="row" key={rank}>
                <div className="rank">{rank}</div>
                <div className={`flap ${isGuessed ? 'revealed' : ''} ${finished && !isGuessed ? 'given-up' : ''}`}>
                  {data ? (
                    <>
                      <span className="name">{data.name}</span>
                      <span className="value">{formatValue(data, list)}</span>
                    </>
                  ) : (
                    <span className="placeholder">— — — — — —</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
