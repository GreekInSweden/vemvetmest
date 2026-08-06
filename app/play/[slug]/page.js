'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

function normalize(s) {
  return s.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Litet redigeringsavstånd (Levenshtein) för att tolerera enstaka
// stavfel - en bortglömd, felskriven eller extra bokstav.
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Kortare namn tål mindre marginal (annars blir korta ord som "USA" för
// lätta att träffa av misstag) - längre namn tål lite mer.
function fuzzyThreshold(len) {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

// Om ingen exakt träff finns: leta efter ett unikt, "nästan rätt" namn
// eller alias i hela listan. Returnerar det normaliserade rätta namnet
// om det är otvetydigt, annars null (då räknas gissningen som fel).
function resolveFuzzyTarget(n, items) {
  const seen = new Set();
  const candidates = [];
  for (const item of items) {
    const targets = [item.name, ...(item.aliases || [])];
    for (const t of targets) {
      const nt = normalize(t);
      if (seen.has(nt)) continue;
      seen.add(nt);
      const dist = levenshtein(n, nt);
      const threshold = Math.min(fuzzyThreshold(nt.length), fuzzyThreshold(n.length));
      if (dist > 0 && dist <= threshold) candidates.push({ target: nt, dist });
    }
  }
  if (candidates.length === 0) return null;
  const minDist = Math.min(...candidates.map(c => c.dist));
  const closest = [...new Set(candidates.filter(c => c.dist === minDist).map(c => c.target))];
  return closest.length === 1 ? closest[0] : null;
}

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
  const [items, setItems] = useState([]);
  const [guessedRanks, setGuessedRanks] = useState(new Set());
  const [misses, setMisses] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [endReason, setEndReason] = useState(null); // 'complete' | 'timeout' | 'giveup'
  const [toast, setToast] = useState('');
  const [shake, setShake] = useState(false);
  const [guess, setGuess] = useState('');
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const guessedRef = useRef(new Set());
  const missesRef = useRef(0);
  const finishedRef = useRef(false);
  const timeLimitRef = useRef(300);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      // Ingen inloggning krävs för att TESTA ett övningsspel - resultatet
      // sparas bara om man är inloggad (userId är null annars, vilket
      // insert-anropet vid spelslut redan hanterar gracefully).
      setUserId(sessionData.session ? sessionData.session.user.id : null);

      const { data: listRow } = await supabase
        .from('game_lists')
        .select('*')
        .eq('slug', params.slug)
        .single();
      if (!listRow) return;
      setList(listRow);

      const { data: itemRows } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listRow.id)
        .order('rank');
      setItems(itemRows || []);

      const limit = listRow.time_limit_seconds || 300;
      timeLimitRef.current = limit;
      setSecondsLeft(limit);
      startTimer();
    }
    load();
    return () => clearInterval(timerRef.current);
  }, [params.slug, router]);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, [items]);

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

    const elapsed = timeLimitRef.current - (reason === 'timeout' ? 0 : secondsLeft);

    if (userId && list) {
      await supabase.from('results').insert({
        user_id: userId,
        list_id: list.id,
        guessed: guessedRef.current.size,
        total: items.length,
        misses: missesRef.current,
        seconds: elapsed,
        completed: reason === 'complete'
      });
    }
  }

  function submitGuess(e) {
    e.preventDefault();
    if (finishedRef.current) return;
    const raw = guess.trim();
    if (!raw) return;
    let n = normalize(raw);
    let wasFuzzy = false;
    const mode = list?.guess_mode || 'default';

    // ---- Läge: rätt ordning krävs ----
    // Bara nästa olästa rad (lägsta rank) räknas som rätt svar, oavsett
    // om gissningen finns någon annanstans i listan.
    if (mode === 'strict_order') {
      const remaining = items.filter(item => !guessedRef.current.has(item.rank));
      if (remaining.length === 0) return;
      const nextItem = remaining.reduce((a, b) => (a.rank < b.rank ? a : b));

      let isMatch = normalize(nextItem.name) === n || (nextItem.aliases || []).some(a => normalize(a) === n);
      if (!isMatch) {
        for (const t of [nextItem.name, ...(nextItem.aliases || [])]) {
          const nt = normalize(t);
          const dist = levenshtein(n, nt);
          const threshold = Math.min(fuzzyThreshold(nt.length), fuzzyThreshold(n.length));
          if (dist > 0 && dist <= threshold) { isMatch = true; wasFuzzy = true; break; }
        }
      }

      if (!isMatch) {
        missesRef.current += 1;
        setMisses(missesRef.current);
        setShake(true);
        setTimeout(() => setShake(false), 300);
        showToast('Fel — det är inte nästa svar i ordningen.');
        return;
      }

      const next = new Set(guessedRef.current);
      next.add(nextItem.rank);
      guessedRef.current = next;
      setGuessedRanks(next);
      setGuess('');
      showToast(wasFuzzy
        ? `Rätt! #${nextItem.rank} ${nextItem.name} (tolkat trots stavfel)`
        : `Rätt! #${nextItem.rank} ${nextItem.name}`);
      if (next.size === items.length) endGame('complete');
      return;
    }

    // ---- Läge: standard eller flera träffar ----
    let matching = items.filter(item =>
      normalize(item.name) === n || (item.aliases || []).some(a => normalize(a) === n)
    );

    if (matching.length === 0) {
      const resolved = resolveFuzzyTarget(n, items);
      if (resolved) {
        n = resolved;
        wasFuzzy = true;
        matching = items.filter(item =>
          normalize(item.name) === n || (item.aliases || []).some(a => normalize(a) === n)
        );
      }
    }

    if (matching.length === 0) {
      missesRef.current += 1;
      setMisses(missesRef.current);
      setShake(true);
      setTimeout(() => setShake(false), 300);
      showToast('Inte med på listan.');
      return;
    }

    const unguessedMatching = matching.filter(item => !guessedRef.current.has(item.rank));

    if (unguessedMatching.length === 0) {
      showToast('Redan gissat: ' + matching[0].name);
      setGuess('');
      return;
    }

    let newMatches;
    let remainingSameName = 0;

    if (mode === 'multi_fill') {
      // Alla olästa träffar (samma namn eller alias) fylls i på en gång.
      newMatches = unguessedMatching;
    } else {
      // Standard: exakta namnträffar (t.ex. flera rader som alla heter
      // "Tyskland") fylls bara en i taget. Alias som matchar flera OLIKA
      // namn (t.ex. "Eskilstuna") fylls alla samtidigt.
      const exactUnguessed = unguessedMatching.filter(item => normalize(item.name) === n);
      remainingSameName = exactUnguessed.length > 1 ? exactUnguessed.length - 1 : 0;
      newMatches = exactUnguessed.length > 0
        ? [exactUnguessed.reduce((a, b) => (a.rank < b.rank ? a : b))]
        : unguessedMatching;
    }

    const next = new Set(guessedRef.current);
    newMatches.forEach(item => next.add(item.rank));
    guessedRef.current = next;
    setGuessedRanks(next);
    setGuess('');

    if (newMatches.length > 1) {
      showToast(`Rätt! ${newMatches.length} träffar: ` + newMatches.map(m => '#' + m.rank + ' ' + m.name).join(', '));
    } else if (remainingSameName > 0) {
      showToast(`Rätt! #${newMatches[0].rank} ${newMatches[0].name} (${remainingSameName} till kvar i listan — gissa igen)`);
    } else if (wasFuzzy) {
      showToast(`Rätt! #${newMatches[0].rank} ${newMatches[0].name} (tolkat trots stavfel)`);
    } else {
      showToast('Rätt! #' + newMatches[0].rank + ' ' + newMatches[0].name);
    }

    if (next.size === items.length) endGame('complete');
  }

  function giveUp() {
    if (finishedRef.current) return;
    endGame('giveup');
  }

  function restart() {
    guessedRef.current = new Set();
    missesRef.current = 0;
    finishedRef.current = false;
    setGuessedRanks(new Set());
    setMisses(0);
    setSecondsLeft(timeLimitRef.current);
    setFinished(false);
    setEndReason(null);
    setToast('');
    startTimer();
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
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
          {list.subtitle} — {list.source}
        </div>
        {list.guess_mode === 'strict_order' && (
          <div style={{ display: 'inline-block', background: 'var(--amber)', color: '#241505', fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 3, marginBottom: 12 }}>
            🔢 Måste gissas i rätt ordning
          </div>
        )}
        {list.guess_mode === 'multi_fill' && (
          <div className="subhead" style={{ marginBottom: 12, fontStyle: 'italic' }}>
            💡 Ett namn kan ge flera träffar på en gång om det förekommer flera gånger i listan.
          </div>
        )}

        <div className="stats">
          <div className="stat">Gissade: <b>{guessedRanks.size}</b> / {items.length}</div>
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
        </form>
        <div className="toast">{toast}</div>

        <div className="foot-actions">
          <button className="btn btn-ghost" onClick={giveUp}>Ge upp &amp; visa facit</button>
          <button className="btn btn-ghost" onClick={restart}>Starta om</button>
        </div>

        {finished && (
          <div className="end-banner">
            {endReason === 'complete' && `Full pott! ${items.length} av ${items.length} på ${formatTime(timeLimitRef.current - secondsLeft)}.`}
            {endReason === 'timeout' && `Tiden tog slut — du fick ${guessedRanks.size} av ${items.length}.`}
            {endReason === 'giveup' && `Facit visat — du fick ${guessedRanks.size} av ${items.length} själv.`}
          </div>
        )}

        <div className="board-list" style={{ marginTop: 10 }}>
          {items.map(item => {
            const isGuessed = guessedRanks.has(item.rank);
            const isRevealedByEnd = finished && !isGuessed;
            return (
              <div className="row" key={item.rank}>
                <div className="rank">{item.rank}</div>
                <div className={`flap ${isGuessed ? 'revealed' : ''} ${isRevealedByEnd ? 'given-up' : ''}`}>
                  {isGuessed || isRevealedByEnd ? (
                    <>
                      <span className="name">{item.name}</span>
                      <span className="value">{formatValue(item, list)}</span>
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
