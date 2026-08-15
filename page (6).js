'use client';
import GameTierList from '../GameTierList';

export default function SynligaSpel() {
  return (
    <>
      <div className="cat-title" style={{ marginTop: 0, color: 'var(--amber-glow)' }}>📂 Synliga spel</div>
      <GameTierList filterTier="featured" />
    </>
  );
}
