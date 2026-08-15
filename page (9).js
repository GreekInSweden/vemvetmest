'use client';
import GameTierList from '../GameTierList';

export default function PoolSpel() {
  return (
    <>
      <div className="cat-title" style={{ marginTop: 0, color: '#7fc98f' }}>📂 Dagens utmaning-pool</div>
      <GameTierList filterTier="daily_pool" />
    </>
  );
}
