'use client';

import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { PLAN_PRICES, COMPANY_PRICE_PER_SEAT, COMPANY_MIN_SEATS } from '../../../lib/swish';

export default function AdminBetalningar() {
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentResults, setPaymentResults] = useState([]);
  const [paymentSearching, setPaymentSearching] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');
  const [companySeats, setCompanySeats] = useState({});
  const [childUsernames, setChildUsernames] = useState({});
  const [childCodes, setChildCodes] = useState({}); // { parentId: { code, label } }

  async function createChildPackage(parentId) {
    setPaymentMsg('');
    const label = childUsernames[parentId] || '';
    const { data, error } = await supabase
      .from('child_packages')
      .insert({ parent_id: parentId, child_username_requested: label })
      .select('invite_code')
      .single();
    if (error) {
      setPaymentMsg('Kunde inte skapa barnpaket: ' + error.message);
      return;
    }
    setChildCodes(prev => ({ ...prev, [parentId]: { code: data.invite_code, label } }));
    setPaymentMsg(`Barnpaket skapat! Kod: ${data.invite_code} — ge den till barnet att lösa in under sin profil.`);
  }

  async function searchPayments(e) {
    e.preventDefault();
    setPaymentMsg('');
    const term = paymentSearch.trim();
    if (!term) { setPaymentResults([]); return; }
    setPaymentSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, paid_until, is_child')
      .ilike('username', `%${term}%`)
      .limit(20);
    setPaymentSearching(false);
    if (error) {
      setPaymentMsg('Sökning misslyckades: ' + error.message);
      return;
    }
    setPaymentResults(data || []);
  }

  async function markPaid(userId, planKey) {
    setPaymentMsg('');
    const days = PLAN_PRICES[planKey].days;
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + days);
    const paidUntilStr = paidUntil.toISOString().slice(0, 10);

    const { error } = await supabase.from('profiles').update({ paid_until: paidUntilStr }).eq('id', userId);
    if (error) {
      setPaymentMsg('Kunde inte markera betald: ' + error.message);
      return;
    }

    if (planKey === 'family') {
      const { data: existing } = await supabase
        .from('family_plans')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();
      if (!existing) {
        const { error: famError } = await supabase.from('family_plans').insert({ owner_id: userId });
        if (famError) {
          setPaymentMsg('Betald markerad, men kunde inte skapa familjeplan: ' + famError.message);
        }
      }
    }

    setPaymentResults(prev => prev.map(p => p.id === userId ? { ...p, paid_until: paidUntilStr } : p));
    setPaymentMsg(`Markerad betald till och med ${paidUntilStr}.`);
  }

  async function markPaidCompany(userId, username) {
    setPaymentMsg('');
    const seats = Math.max(COMPANY_MIN_SEATS, parseInt(companySeats[userId] || COMPANY_MIN_SEATS, 10));
    const price = seats * COMPANY_PRICE_PER_SEAT;

    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 366);
    const paidUntilStr = paidUntil.toISOString().slice(0, 10);

    const { error } = await supabase.from('profiles').update({ paid_until: paidUntilStr }).eq('id', userId);
    if (error) {
      setPaymentMsg('Kunde inte markera betald: ' + error.message);
      return;
    }

    const { data: existingPlan } = await supabase
      .from('family_plans')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (existingPlan) {
      await supabase.from('family_plans').update({ max_members: seats }).eq('id', existingPlan.id);
    } else {
      const { error: famError } = await supabase.from('family_plans').insert({ owner_id: userId, max_members: seats });
      if (famError) {
        setPaymentMsg('Betald markerad, men kunde inte skapa platser: ' + famError.message);
        return;
      }
    }

    const { data: existingLeague } = await supabase
      .from('leagues')
      .select('id')
      .eq('owner_id', userId)
      .eq('status', 'approved')
      .maybeSingle();

    if (!existingLeague) {
      const { error: leagueError } = await supabase
        .from('leagues')
        .insert({ name: `${username} — Företag`, owner_id: userId, status: 'approved' });
      if (leagueError) {
        setPaymentMsg(`Betald markerad, ${seats} platser skapade, men liga kunde inte skapas: ` + leagueError.message);
        return;
      }
    }

    setPaymentResults(prev => prev.map(p => p.id === userId ? { ...p, paid_until: paidUntilStr } : p));
    setPaymentMsg(`Markerad betald till ${paidUntilStr} (${seats} platser, ${price} kr/år). Familjeplan och liga klara — hämta koderna under personens profil.`);
  }

  return (
    <>
      <div className="cat-title" style={{ marginTop: 0 }}>Markera betalning</div>

      <form onSubmit={searchPayments} className="input-row" style={{ marginBottom: 12 }}>
        <input
          className="field"
          type="text"
          placeholder="Sök på användarnamn…"
          value={paymentSearch}
          onChange={e => setPaymentSearch(e.target.value)}
        />
        <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={paymentSearching}>
          {paymentSearching ? 'Söker…' : 'Sök'}
        </button>
      </form>
      {paymentMsg && <div className="toast" style={{ marginBottom: 10 }}>{paymentMsg}</div>}

      {paymentResults.map(u => {
        const isActive = u.paid_until && u.paid_until >= new Date().toISOString().slice(0, 10);
        return (
          <div key={u.id} className="panel" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase' }}>
                {u.username} {u.is_child && <span className="tag" style={{ marginLeft: 6 }}>Barn</span>}
              </div>
              <div className="subhead" style={{ fontSize: 12.5 }}>
                {u.paid_until
                  ? (isActive ? `Betald t.o.m. ${u.paid_until}` : `Gick ut ${u.paid_until}`)
                  : 'Har aldrig betalat'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {Object.entries(PLAN_PRICES).map(([key, val]) => (
                <button key={key} className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => markPaid(u.id, key)}>
                  {val.label} ({val.amount} kr)
                </button>
              ))}
              <span style={{ borderLeft: '1px solid var(--line)', height: 24, margin: '0 4px' }} />
              <input
                type="number"
                min={COMPANY_MIN_SEATS}
                value={companySeats[u.id] ?? COMPANY_MIN_SEATS}
                onChange={e => setCompanySeats(prev => ({ ...prev, [u.id]: e.target.value }))}
                className="field"
                style={{ width: 60, padding: '8px 10px' }}
              />
              <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => markPaidCompany(u.id, u.username)}>
                Företag ({(Math.max(COMPANY_MIN_SEATS, parseInt(companySeats[u.id] || COMPANY_MIN_SEATS, 10))) * COMPANY_PRICE_PER_SEAT} kr)
              </button>
              <span style={{ borderLeft: '1px solid var(--line)', height: 24, margin: '0 4px' }} />
              <input
                type="text"
                placeholder="Önskat barn-användarnamn (valfritt)"
                value={childUsernames[u.id] ?? ''}
                onChange={e => setChildUsernames(prev => ({ ...prev, [u.id]: e.target.value }))}
                className="field"
                style={{ width: 200, padding: '8px 10px' }}
              />
              <button className="btn btn-ghost" style={{ width: 'auto', borderColor: '#c98f4f', color: '#e0b37f' }} onClick={() => createChildPackage(u.id)}>
                Skapa barnpaket (99 kr)
              </button>
            </div>
            {childCodes[u.id] && (
              <div className="toast" style={{ marginTop: 8 }}>
                Kod till {childCodes[u.id].label || 'barnet'}: <b style={{ fontFamily: "'JetBrains Mono', monospace" }}>{childCodes[u.id].code}</b>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
