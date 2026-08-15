'use client';
import GameTierList from '../GameTierList';

export default function MedlemsSpel() {
  return (
    <>
      <div className="cat-title" style={{ marginTop: 0, color: '#9ab8e6' }}>📂 Medlemsspel</div>
      <GameTierList filterTier="member_exclusive" />
    </>
  );
}
