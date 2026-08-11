'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { timeUntil, formatCountdown } from '../../../lib/countdown';

function stockholmNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
}
function ymd(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function LaunchCountdownScreen({ launchAt }) {
  const [remaining, setRemaining] = useState(() => timeUntil(launchAt));

  useEffect(() => {
    const timer = setInterval(() => setRemaining(timeUntil(launchAt)), 1000);
    return () => clearInterval(timer);
  }, [launchAt]);

  return (
    <div className="wrap">
      <div className="topbar"><a className="btn btn-ghost" href="/">&larr; Alla spel</a></div>
      <div className="upgrade-card">
        <span className="upgrade-badge">Lanseras snart</span>
        <div className="upgrade-title">Dagens utmaning öppnar om</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 36, color: 'var(--amber-glow)', margin: '10px 0 18px' }}>
          {remaining ? formatCountdown(remaining) : '00:00'}
        </div>
        <p className="subhead">
          Du är redan medlem — så fort klockan slår noll öppnas Dagens utmaning automatiskt, ingen ny åtgärd behövs från dig.
        </p>
      </div>
    </div>
  );
}

export default function DailyPlayPage() {
  const router = useRouter();
  const params = useParams();
  const [userId, setUserId] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [list, setList] = useState(null);
  const [allRanks, setAllRanks] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [eligibility, setEligibility] = useState(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(null);

  const [guessedRanks, setGuessedRanks] = useState(new Set());
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [endReason, setEndReason] = useState(null);
  const [toast, setToast] = useState('');
  const [shake, setShake] = useState(false);
  const [guess, setGuess] = useState('');
  const [difficulty, setDifficulty] = useState('hard');
  const [hintMsg, setHintMsg] = useState('');
  const difficultyRef = useRef('hard');
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const guessedRef = useRef(new Set());
  const revealedRef = useRef({});
  const missesRef = useRef(0);
  const finishedRef = useRef(false);
  const timeLimitRef = useRef(300);
  const usingLifeRef = useRef(false);
  const listRef = useRef(null);
  const challengeRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/login'); return; }
      const uid = sessionData.session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase.from('profiles').select('difficulty, paid_until, is_admin').eq('id', uid).single();
      const todayForPayment = ymd(stockholmNow());
      const hasPaidAccess = !!profile?.is_admin || (!!profile?.paid_until && profile.paid_until >= todayForPayment);
      if (!hasPaidAccess) {
        setEligibility({ ok: false, reason: 'Dagens utmaning kräver ett betalt medlemskap.', needsPayment: true });
        return;
      }

      // Lanseringsnedräkning: helt separat spärr, oberoende av betalning.
      // Admin kommer alltid förbi, precis som barnpaket-spärren.
      if (!profile?.is_admin) {
        const { data: settingsRow } = await supabase.from('app_settings').select('launch_at').eq('id', 1).single();
        if (settingsRow?.launch_at && timeUntil(settingsRow.launch_at)) {
          setEligibility({ ok: false, reason: '', launchAt: settingsRow.launch_at });
          return;
        }
      }

      const diff = profile?.difficulty || 'hard';
      setDifficulty(diff);
      difficultyRef.current = diff;

      const { data: challengeRow } = await supabase
        .from('daily_challenges')
        .select('id, challenge_date, weekday, list_id')
        .eq('id', params.id)
        .single();

      if (!challengeRow) return;
      setChallenge(challengeRow);
      challengeRef.current = challengeRow;

      const { data: listRow } = await supabase
        .from('game_lists')
        .select('*')
        .eq('id', challengeRow.list_id)
        .single();
      setList(listRow);
      listRef.current = listRow;

      // Bara rank-siffrorna hämtas i förväg - aldrig namn/värden.
      const { data: rankRows } = await supabase
        .from('list_items')
        .select('rank')
        .eq('list_id', listRow.id)
        .order('rank');
      setAllRanks((rankRows || []).map(r => r.rank));

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

      const now = stockholmNow();
      const isoWeekday = ((now.getDay() + 6) % 7) + 1;
      const today = ymd(now);
      const isToday = challengeRow.challenge_date === today;
      const isFridayCatchup = isoWeekday === 5;

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
        const { count: purchasedCount } = await supabase
          .from('life_purchases')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('activated', true)
          .gte('created_at', yearStart);
        livesRemaining = Math.max(0, 5 + (purchasedCount || 0) - (count || 0));
      }

      if (isToday) {
        setEligibility({ ok: true, usingLife: false });
      } else if (isFridayCatchup && withinThisWeek && livesRemaining > 0) {
        setEligibility({ ok: true, usingLife: true, livesRemaining });
        usingLifeRef.current = true;
      } else if (isFridayCatchup && withinThisWeek && livesRemaining <= 0) {
        setEligibility({ ok: false, reason: 'Du har inga liv kvar i år.' });
      } else if (!isFridayCatchup && !isToday) {
        setEligibility({ ok: false, reason: 'Det här passet går bara att spela på sin egen dag, eller med ett liv på fredagen samma vecka.' });
      } else {
        setEligibility({ ok: false, reason: 'Det här passet går inte längre att spela.' });
      }

      const baseLimit = listRow.time_limit_seconds || 300;
      const limit = diff === 'easy' ? Math.round(baseLimit * 1.5) : baseLimit;
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
  }, [eligibility, allRanks]);

  // ---- Fuskskydd: byter man flik/app under ett pågående spel
  // försvinner 80% av återstående tid.
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
      // facit-hämtningen strulade - resultatet sparas ändå nedan
    }

    if (userId && challengeRef.current) {
      await supabase.from('daily_attempts').insert({
        user_id: userId,
        daily_challenge_id: challengeRef.current.id,
        guessed: guessedRef.current.size,
        total: allRanks.length,
        misses: missesRef.current,
        seconds: timeLimitRef.current - (reason === 'timeout' ? 0 : secondsLeft),
        completed: reason === 'complete',
        used_life: usingLifeRef.current,
        difficulty: difficultyRef.current
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
    }
    setHintMsg(`💡 Rad #${result.rank} börjar på "${result.firstLetter}"`);
    setTimeout(() => setHintMsg(''), 4000);
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

  if (eligibility && !eligibility.ok && eligibility.launchAt) {
    return <LaunchCountdownScreen launchAt={eligibility.launchAt} />;
  }

  if (eligibility && !eligibility.ok && eligibility.needsPayment) {
    return (
      <div className="wrap">
        <div className="topbar"><a className="btn btn-ghost" href="/">&larr; Alla spel</a></div>
        <div className="upgrade-card">
          <span className="upgrade-badge">Kräver medlemskap</span>
          <div className="upgrade-title">Lås upp Dagens Utmaning</div>
          <p className="subhead" style={{ marginBottom: 18 }}>{eligibility.reason}</p>
          <a href="/prenumerera" className="btn btn-primary" style={{ width: 'auto', padding: '13px 26px' }}>
            Bli medlem →
          </a>
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
          <button className="btn btn-ghost" onClick={giveUp} disabled={finished}>Ge upp &amp; visa facit</button>
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
