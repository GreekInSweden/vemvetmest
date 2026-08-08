'use client';
import GameTierList from '../GameTierList';

export default function EjTilldeladeSpel() {
  return (
    <>
      <div className="cat-title" style={{ marginTop: 0, color: '#bbb' }}>📂 Ej tilldelade (testläge)</div>
      <p className="subhead" style={{ marginBottom: 14 }}>
        Nya spel hamnar här automatiskt. Syns ingenstans för vanliga besökare — bara du kan testspela dem
        via 🔍-länken. Bocka i minst en kategori nedan för att flytta ett spel härifrån.
      </p>
      <GameTierList filterTier="untested" />
    </>
  );
}
