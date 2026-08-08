'use client';
import GameTierList from '../GameTierList';

export default function TestadeSpel() {
  return (
    <>
      <div className="cat-title" style={{ marginTop: 0, color: '#e0b37f' }}>📂 Testade spel</div>
      <p className="subhead" style={{ marginBottom: 14 }}>
        Spel du kvalitetstestat och godkänt — oavsett om de dessutom är synliga, medlemsspel eller i poolen.
        Ett sätt att hålla koll på vad du faktiskt hunnit gå igenom.
      </p>
      <GameTierList filterTier="tested" />
    </>
  );
}
