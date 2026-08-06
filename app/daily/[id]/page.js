'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

function stockholmNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
}
function ymd(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function normalize(s) {
  return s.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
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
function fuzzyThreshold(len) {
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}
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

export default function DailyPlayPage() {
  const router = useRouter();
  const params = useParams();
  const [userId, setUserId] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [eligibility, setEligibility] = useState(null); // { ok, reason, usingLife }
  const [alreadyPlayed, setAlreadyPlayed] = useState(null);

  const [guessedRanks, setGuessedRanks] = useState(new Set());
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [endReason, setEndReason] = useState(null);
  const [toast, setToast] = useState('');
  const [shake, setShake] = useState(false);
  const [guess, setGuess] = useState('');
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const guessedRef = useRef(new Set());
  const missesRef = useRef(0);
  const finishedRef = useRef(false);
  const timeLimitRef = useRef(300);
  const usingLifeRef = useRef(false);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/login'); return; }
      const uid = sessionData.session.user.id;
      setUserId(uid);

      const { data: challengeRow } = await supabase
        .from('daily_challenges')
        .select('id, challenge_date, weekday, list_id')
        .eq('id', params.id)
        .single();

      if (!challengeRow) return;
      setChallenge(challengeRow);

      const { data: listRow } = await supabase
        .from('game_lists')
        .select('*')
        .eq('id', challengeRow.list_id)
        .single();
      setList(listRow);

      const { data: itemRows } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listRow.id)
        .order('rank');
      setItems(itemRows || []);

      const { data: existingAttempt } = await supabase
        .from('daily_attempts')
        .select('*')
        .eq('user_id', uid)
        .eq('daily_challenge_id', challengeRow.id)
        .maybeSingle();

      if (existingAttempt) {
        setAlreadyPlayed(existingAttempt);
        return;
      }

      // Beräkna rätt till spel: idag = fritt, annars bara på helgen inom
      // samma vecka, och bara om man har liv kvar.
      const now = stockholmNow();
      const isoWeekday = ((now.getDay() + 6) % 7) + 1;
      const today = ymd(now);
      const isToday = challengeRow.challenge_date === today;
      const isWeekend = isoWeekday === 6 || isoWeekday === 7;

      const monday = new Date(now);
      monday.setDate(now.getDate() - (isoWeekday - 1));
      const mondayStr = ymd(monday);
      const withinThisWeek = challengeRow.challenge_date >= mondayStr && challengeRow.challenge_date <= today;

      let livesRemaining = 0;
      if (!isToday) {
        const yearStart = `${now.getFullYear()}-01-01`;
        const { count } = await supabase
          .from('daily_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('used_life', true)
          .gte('created_at', yearStart);
        livesRemaining = Math.max(0, 5 - (count || 0));
      }

      if (isToday) {
        setEligibility({ ok: true, usingLife: false });
      } else if (isWeekend && withinThisWeek && livesRemaining > 0) {
        setEligibility({ ok: true, usingLife: true, livesRemaining });
        usingLifeRef.current = true;
      } else if (isWeekend && withinThisWeek && livesRemaining <= 0) {
        setEligibility({ ok: false, reason: 'Du har inga liv kvar i år.' });
      } else if (!isWeekend && !isToday) {
        setEligibility({ ok: false, reason: 'Det här passet går bara att spela på sin egen dag, eller med ett liv på helgen.' });
      } else {
        setEligibility({ ok: false, reason: 'Det här passet går inte längre att spela.' });
      }

      const limit = listRow.time_limit_seconds || 300;
      timeLimitRef.current = limit;
      setSecondsLeft(limit);
    }
    load();
    return () => clearInterval(timerRef.current);
  }, [params.id, router]);

  useEffect(() => {
    if (eligibility?.ok && inputRef.current) {
      startTimer();
      inputRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibility, items]);

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

    if (userId && challenge) {
      await supabase.from('daily_attempts').insert({
        user_id: userId,
        daily_challenge_id: challenge.id,
        guessed: guessedRef.current.size,
        total: items.length,
        misses: missesRef.current,
        seconds: timeLimitRef.current - (reason === 'timeout' ? 0 : secondsLeft),
        completed: reason === 'complete',
        used_life: usingLifeRef.current
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

    // Exakta namnträffar (flera rader med samma namn) fylls en i taget;
    // alias som matchar flera OLIKA namn fylls alla samtidigt.
    const exactUnguessed = unguessedMatching.filter(item => normalize(item.name) === n);
    const remainingSameName = exactUnguessed.length > 1 ? exactUnguessed.length - 1 : 0;
    const newMatches = exactUnguessed.length > 0
      ? [exactUnguessed.reduce((a, b) => (a.rank < b.rank ? a : b))]
      : unguessedMatching;

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

  if (!challenge || !list) {
    return <div className="wrap"><p className="subhead">Laddar…</p></div>;
  }

  if (alreadyPlayed) {
    return (
      <div className="wrap">
        <div className="topbar"><a className="btn btn-ghost" href="/">&larr; Alla spel</a></div>
        <div className="panel">
          <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 22 }}>{list.title}</div>
          <div className="subhead" style={{ marginBottom: 16 }}>{challenge.weekday}ens utmaning — {challenge.challenge_date}</div>
          <div className="end-banner">
            Redan spelat! Du fick {alreadyPlayed.guessed} av {alreadyPlayed.total} på {formatTime(alreadyPlayed.seconds)}
            {alreadyPlayed.used_life ? ' (med ett liv)' : ''}.
          </div>
        </div>
      </div>
    );
  }

  if (eligibility && !eligibility.ok) {
    return (
      <div className="wrap">
        <div className="topbar"><a className="btn btn-ghost" href="/">&larr; Alla spel</a></div>
        <div className="panel">
          <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 22 }}>{list.title}</div>
          <div className="subhead" style={{ marginBottom: 16 }}>{challenge.weekday}ens utmaning — {challenge.challenge_date}</div>
          <div className="error-msg" style={{ fontSize: 14 }}>{eligibility.reason}</div>
        </div>
      </div>
    );
  }

  if (!eligibility || !eligibility.ok) {
    return <div className="wrap"><p className="subhead">Kontrollerar behörighet…</p></div>;
  }

  const isLowTime = secondsLeft <= 30 && !finished;

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <div className="panel">
        <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 22, marginBottom: 2 }}>
          {list.title}
        </div>
        <div className="subhead" style={{ marginBottom: 4 }}>
          {challenge.weekday && challenge.weekday[0].toUpperCase() + challenge.weekday.slice(1)}ens utmaning — {challenge.challenge_date}
        </div>
        {eligibility.usingLife && (
          <div className="subhead" style={{ marginBottom: 14, color: 'var(--amber-glow)' }}>
            Du använder ett liv för att spela detta i efterhand ({eligibility.livesRemaining} kvar innan denna omgång).
          </div>
        )}

        <div className="stats">
          <div className="stat">Gissade: <b>{guessedRanks.size}</b> / {items.length}</div>
          <div className="stat">Tid kvar: <b style={isLowTime ? { color: 'var(--miss)' } : undefined}>{formatTime(secondsLeft)}</b></div>
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
          <button className="btn btn-ghost" onClick={giveUp} disabled={finished}>Ge upp &amp; visa facit</button>
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
