// Delad hjälpfunktion för lanseringsnedräkningen. Returnerar null om
// tiden redan passerat (dvs lanserat), annars antal dagar/timmar/
// minuter/sekunder kvar.
export function timeUntil(targetIso) {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000)
  };
}

export function formatCountdown(parts) {
  if (!parts) return '';
  const pad = n => String(n).padStart(2, '0');
  if (parts.days > 0) return `${parts.days}d ${pad(parts.hours)}t ${pad(parts.minutes)}m`;
  return `${pad(parts.hours)}t ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
}
