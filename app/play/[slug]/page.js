'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

function normalize(s) {
  return s.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
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
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
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
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState(false);
  const [toast, setToast] = useState('');
  const [shake, setShake] = useState(false);
  const [guess, setGuess] = useState('');
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const guessedRef = useRef(new Set());
  const finishedRef = useRef(false);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }
      setUserId(sessionData.session.user.id);

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

      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    load();
    return () => clearInterval(timerRef.current);
  }, [params.slug, router]);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, [items]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(''), 1800);
  }

  async function endGame(won) {
    finishedRef.current = true;
    setFinished(true);
    clearInterval(timerRef.current);
    if (userId && list) {
      await supabase.from('results').insert({
        user_id: userId,
        list_id: list.id,
        guessed: guessedRef.current.size,
        total: items.length,
        misses,
        seconds,
        completed: won
      });
    }
  }

  function submitGuess(e) {
    e.preventDefault();
    if (finishedRef.current) return;
    const raw = guess.trim();
    if (!raw) return;
    const n = normalize(raw);

    for (const rank of guessedRef.current) {
      const item = items.find(i => i.rank === rank);
      if (normalize(item.name) === n || (item.aliases || []).some(a => normalize(a) === n)) {
        showToast('Redan gissat: ' + item.name);
        setGuess('');
        return;
      }
    }

    const match = items.find(item =>
      !guessedRef.current.has(item.rank) &&
      (normalize(item.name) === n || (item.aliases || []).some(a => normalize(a) === n))
    );

    if (match) {
      const next = new Set(guessedRef.current);
      next.add(match.rank);
      guessedRef.current = next;
      setGuessedRanks(next);
      setGuess('');
      showToast('Rätt! #' + match.rank + ' ' + match.name);
      if (next.size === items.length) endGame(true);
    } else {
      setMisses(m => m + 1);
      setShake(true);
      setTimeout(() => setShake(false), 300);
      showToast('Inte med på listan.');
    }
  }

  function giveUp() {
    if (finishedRef.current) return;
    endGame(false);
  }

  function restart() {
    guessedRef.current = new Set();
    finishedRef.current = false;
    setGuessedRanks(new Set());
    setMisses(0);
    setSeconds(0);
    setFinished(false);
    setToast('');
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
  }

  if (!list) {
    return <div className="wrap"><p className="subhead">Laddar listan…</p></div>;
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <div className="panel">
        <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 22, letterSpacing: '.03em', marginBottom: 2 }}>
          {list.title}
        </div>
        <div className="subhead" style={{ marginBottom: 18 }}>
          {list.subtitle} — {list.source}
        </div>

        <div className="stats">
          <div className="stat">Gissade: <b>{guessedRanks.size}</b> / {items.length}</div>
          <div className="stat">Tid: <b>{formatTime(seconds)}</b></div>
          <div className="stat">Fel: <b>{misses}</b></div>
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
            {guessedRanks.size === items.length
              ? `Full pott! ${items.length} av ${items.length} på ${formatTime(seconds)}, ${misses} fel.`
              : `Facit visat — du fick ${guessedRanks.size} av ${items.length} själv.`}
          </div>
        )}

        <div className="board-list" style={{ marginTop: 18 }}>
          {items.map(item => {
            const isGuessed = guessedRanks.has(item.rank);
            const isRevealedByGiveUp = finished && !isGuessed;
            return (
              <div className="row" key={item.rank}>
                <div className="rank">{item.rank}</div>
                <div className={`flap ${isGuessed ? 'revealed' : ''} ${isRevealedByGiveUp ? 'given-up' : ''}`}>
                  {isGuessed || isRevealedByGiveUp ? (
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
