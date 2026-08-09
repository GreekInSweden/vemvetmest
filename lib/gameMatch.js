// Delad spellogik för server-sidan gissningskontroll. Exakt samma
// regler som tidigare fanns i klienten (play/[slug] och daily/[id]),
// bara flyttad hit så svaren aldrig behöver skickas till webbläsaren
// i förväg.

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

// Kärnfunktionen: tar en rå gissning + alla items (med facit) + vilka
// ranks som redan gissats + spelläget, returnerar resultatet UTAN att
// någonsin läcka de items som fortfarande inte är gissade.
function checkGuess(rawGuess, items, guessedRanks, mode) {
  const guessedSet = new Set(guessedRanks);
  let n = normalize(rawGuess);
  let wasFuzzy = false;

  if (mode === 'strict_order') {
    const remaining = items.filter(item => !guessedSet.has(item.rank));
    if (remaining.length === 0) return { correct: false, done: true };
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

    if (!isMatch) return { correct: false };

    return {
      correct: true,
      matches: [{ rank: nextItem.rank, name: nextItem.name, value: nextItem.value }],
      wasFuzzy,
      remainingSameName: 0,
      allGuessed: guessedSet.size + 1 === items.length
    };
  }

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

  if (matching.length === 0) return { correct: false };

  const unguessedMatching = matching.filter(item => !guessedSet.has(item.rank));

  if (unguessedMatching.length === 0) {
    return { correct: false, alreadyGuessedName: matching[0].name };
  }

  let newMatches;
  let remainingSameName = 0;

  if (mode === 'multi_fill') {
    newMatches = unguessedMatching;
  } else {
    const exactUnguessed = unguessedMatching.filter(item => normalize(item.name) === n);
    remainingSameName = exactUnguessed.length > 1 ? exactUnguessed.length - 1 : 0;
    newMatches = exactUnguessed.length > 0
      ? [exactUnguessed.reduce((a, b) => (a.rank < b.rank ? a : b))]
      : unguessedMatching;
  }

  return {
    correct: true,
    matches: newMatches.map(m => ({ rank: m.rank, name: m.name, value: m.value })),
    wasFuzzy,
    remainingSameName,
    allGuessed: guessedSet.size + newMatches.length === items.length
  };
}

export { checkGuess, normalize };
