'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { PLAN_PRICES, COMPANY_PRICE_PER_SEAT, COMPANY_MIN_SEATS } from '../../../lib/swish';

export default function AdminBetalningar() {
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentResults, setPaymentResults] = useState([]);
  const [paymentSearching, setPaymentSearching] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');
  const [companySeats, setCompanySeats] = useState({});
  const [browsing, setBrowsing] = useState(true); // visar "senaste konton" tills man söker
  // pendingAsParent: { parentId: [{id, child_username_requested, child_profile_id}] }
  // pendingAsChild: { childProfileId: {id, ...} } - om raden SJÄLV är ett väntande barnkonto
  const [pendingAsParent, setPendingAsParent] = useState({});
  const [pendingAsChild, setPendingAsChild] = useState({});
  const [activePackages, setActivePackages] = useState({}); // { childProfileId: { id, paid_until } }
  const [pendingLifePurchases, setPendingLifePurchases] = useState({}); // { userId: [{id, created_at}] }
  const [myOwnId, setMyOwnId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMyOwnId(data.session?.user.id || null));
  }, []);

  async function loadPendingChildInfo(profileIds, childPackageIds) {
    if (profileIds.length === 0) { setPendingAsParent({}); setPendingAsChild({}); setActivePackages({}); setPendingLifePurchases({}); return; }
    const { data: lifePending } = await supabase
      .from('life_purchases')
      .select('id, user_id, created_at')
      .eq('activated', false)
      .in('user_id', profileIds);
    const byUser = {};
    (lifePending || []).forEach(p => {
      if (!byUser[p.user_id]) byUser[p.user_id] = [];
      byUser[p.user_id].push(p);
    });
    setPendingLifePurchases(byUser);

    const { data: pending } = await supabase
      .from('child_packages')
      .select('id, parent_id, child_username_requested, child_profile_id, paid_until')
      .eq('activated', false)
      .or(`parent_id.in.(${profileIds.join(',')}),child_profile_id.in.(${profileIds.join(',')})`);

    const byParent = {};
    const byChild = {};
    (pending || []).forEach(p => {
      if (!byParent[p.parent_id]) byParent[p.parent_id] = [];
      byParent[p.parent_id].push(p);
      if (p.child_profile_id) byChild[p.child_profile_id] = p;
    });
    setPendingAsParent(byParent);
    setPendingAsChild(byChild);

    const validPkgIds = (childPackageIds || []).filter(Boolean);
    if (validPkgIds.length > 0) {
      const { data: active } = await supabase
        .from('child_packages')
        .select('id, child_profile_id, paid_until')
        .in('id', validPkgIds)
        .eq('activated', true);
      const byChildActive = {};
      (active || []).forEach(p => { byChildActive[p.child_profile_id] = p; });
      setActivePackages(byChildActive);
    } else {
      setActivePackages({});
    }
  }

  async function loadRecent() {
    setPaymentSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, paid_until, is_child, created_at, child_package_id, is_admin, is_semi_admin')
      .order('created_at', { ascending: false })
      .limit(20);
    setPaymentSearching(false);
    setPaymentResults(data || []);
    setBrowsing(true);
    await loadPendingChildInfo((data || []).map(u => u.id), (data || []).map(u => u.child_package_id));
  }

  useEffect(() => { loadRecent(); }, []);

  async function activateExtraLife(purchaseId, userId, username) {
    const ok = window.confirm(`Aktivera ett extra liv (29 kr) för "${username}"?`);
    if (!ok) return;
    setPaymentMsg('');
    const { error } = await supabase
      .from('life_purchases')
      .update({ activated: true, activated_at: new Date().toISOString() })
      .eq('id', purchaseId);
    if (error) {
      setPaymentMsg('Kunde inte aktivera: ' + error.message);
      return;
    }
    setPendingLifePurchases(prev => ({ ...prev, [userId]: (prev[userId] || []).filter(p => p.id !== purchaseId) }));
    setPaymentMsg(`Extra liv aktiverat för "${username}".`);
  }

  async function activateChildPackage(packageId, childProfileId, parentId, childUsername) {
    const ok = window.confirm(`Aktivera barnpaket (99 kr/år) för "${childUsername}"?`);
    if (!ok) return;
    setPaymentMsg('');
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 366);
    const paidUntilStr = paidUntil.toISOString().slice(0, 10);

    const { error: pkgError } = await supabase
      .from('child_packages')
      .update({ activated: true, paid_until: paidUntilStr })
      .eq('id', packageId);
    if (pkgError) {
      setPaymentMsg('Kunde inte aktivera: ' + pkgError.message);
      return;
    }
    const { error: profileError } = await supabase.from('profiles').update({ child_package_id: packageId }).eq('id', childProfileId);
    if (profileError) {
      setPaymentMsg('Paketet markerades betalt, men kontot kunde inte kopplas: ' + profileError.message);
      return;
    }
    setPendingAsParent(prev => ({ ...prev, [parentId]: (prev[parentId] || []).filter(c => c.id !== packageId) }));
    setPendingAsChild(prev => { const next = { ...prev }; delete next[childProfileId]; return next; });
    setPaymentMsg(`Barnpaketet är aktiverat till och med ${paidUntilStr}.`);
  }

  async function renewChildPackage(packageId, childUsername) {
    const ok = window.confirm(`Förnya barnpaket (99 kr/år) för "${childUsername}"? Ger tillgång till hela biblioteket plus årets nya spel i ytterligare ett år.`);
    if (!ok) return;
    setPaymentMsg('');
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 366);
    const paidUntilStr = paidUntil.toISOString().slice(0, 10);

    const { error } = await supabase.from('child_packages').update({ paid_until: paidUntilStr }).eq('id', packageId);
    if (error) {
      setPaymentMsg('Kunde inte förnya: ' + error.message);
      return;
    }
    setPaymentResults(prev => [...prev]); // trigger re-render, faktiska data hämtas om vid nästa sök
    setPaymentMsg(`Förnyat till och med ${paidUntilStr}. Sök fram kontot igen för att se uppdaterat datum.`);
  }

  async function searchPayments(e) {
    e.preventDefault();
    setPaymentMsg('');
    const term = paymentSearch.trim();
    if (!term) { await loadRecent(); return; }
    setBrowsing(false);
    setPaymentSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, paid_until, is_child, created_at, child_package_id, is_admin, is_semi_admin')
      .ilike('username', `%${term}%`)
      .limit(20);
    setPaymentSearching(false);
    if (error) {
      setPaymentMsg('Sökning misslyckades: ' + error.message);
      return;
    }
    setPaymentResults(data || []);
    await loadPendingChildInfo((data || []).map(u => u.id), (data || []).map(u => u.child_package_id));
  }

  async function toggleAdmin(userId, username, currentValue) {
    if (currentValue && userId === myOwnId) {
      setPaymentMsg('Du kan inte ta bort admin-status från ditt eget konto härifrån, för att undvika att du låser ut dig själv.');
      return;
    }
    const action = currentValue ? 'Ta bort admin-status från' : 'Ge FULL admin-status till';
    const ok = window.confirm(`${action} "${username}"? ${currentValue ? '' : 'Detta ger fullständig tillgång till hela adminpanelen, inklusive betalningar och alla användares data.'}`);
    if (!ok) return;
    setPaymentMsg('');
    const { error } = await supabase.from('profiles').update({ is_admin: !currentValue }).eq('id', userId);
    if (error) {
      setPaymentMsg('Kunde inte ändra: ' + error.message);
      return;
    }
    setPaymentResults(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !currentValue } : u));
    setPaymentMsg(`"${username}" är ${!currentValue ? 'nu admin' : 'inte längre admin'}.`);
  }

  async function toggleSemiAdmin(userId, username, currentValue) {
    const action = currentValue ? 'Ta bort semi-admin från' : 'Gör';
    const ok = window.confirm(`${action} "${username}" ${currentValue ? '' : 'till semi-admin (bara tillgång till Spel-mappen i admin)'}?`);
    if (!ok) return;
    setPaymentMsg('');
    const { error } = await supabase.from('profiles').update({ is_semi_admin: !currentValue }).eq('id', userId);
    if (error) {
      setPaymentMsg('Kunde inte ändra: ' + error.message);
      return;
    }
    setPaymentResults(prev => prev.map(u => u.id === userId ? { ...u, is_semi_admin: !currentValue } : u));
    setPaymentMsg(`"${username}" är ${!currentValue ? 'nu semi-admin' : 'inte längre semi-admin'}.`);
  }

  async function markPaid(userId, planKey, username) {
    const ok = window.confirm(`Markera "${username}" som betald: ${PLAN_PRICES[planKey].label} (${PLAN_PRICES[planKey].amount} kr)?`);
    if (!ok) return;
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
    const seats = Math.max(COMPANY_MIN_SEATS, parseInt(companySeats[userId] || COMPANY_MIN_SEATS, 10));
    const price = seats * COMPANY_PRICE_PER_SEAT;
    const ok = window.confirm(`Markera "${username}" som betald: Företag, ${seats} platser (${price} kr)?`);
    if (!ok) return;
    setPaymentMsg('');

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
          placeholder="Sök på användarnamn… (lämna tomt för senaste kontona)"
          value={paymentSearch}
          onChange={e => setPaymentSearch(e.target.value)}
        />
        <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={paymentSearching}>
          {paymentSearching ? 'Söker…' : 'Sök'}
        </button>
      </form>
      {paymentMsg && <div className="toast" style={{ marginBottom: 10 }}>{paymentMsg}</div>}

      <p className="subhead" style={{ fontSize: 12, marginBottom: 10 }}>
        {browsing ? 'Visar de 20 senast registrerade kontona — sök om du letar efter någon specifik.' : `${paymentResults.length} träffar.`}
      </p>

      {paymentResults.map(u => {
        const isActive = u.paid_until && u.paid_until >= new Date().toISOString().slice(0, 10);
        const myPendingPackage = pendingAsChild[u.id]; // om DEN HÄR raden själv är ett väntande barn
        const myActivePackage = activePackages[u.id]; // om DEN HÄR raden redan har ett aktiverat barnpaket
        const childPkgActive = myActivePackage?.paid_until && myActivePackage.paid_until >= new Date().toISOString().slice(0, 10);
        return (
          <div key={u.id} className="panel" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase' }}>
                {u.username}
                {u.is_child && <span className="tag" style={{ marginLeft: 6 }}>Barn</span>}
                {u.is_admin && <span className="tag" style={{ marginLeft: 6, background: '#3a2c1a', color: '#e0b37f' }}>Admin</span>}
                {u.is_semi_admin && <span className="tag" style={{ marginLeft: 6, background: '#1a2c3a', color: '#7fa8c9' }}>Semi-admin</span>}
              </div>
              <div className="subhead" style={{ fontSize: 12.5 }}>
                {u.paid_until
                  ? (isActive ? `Betald t.o.m. ${u.paid_until}` : `Gick ut ${u.paid_until}`)
                  : 'Har aldrig betalat'}
              </div>
            </div>

            <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost"
                style={{ width: 'auto', padding: '4px 12px', fontSize: 12, borderColor: u.is_admin ? '#e0b37f' : undefined }}
                onClick={() => toggleAdmin(u.id, u.username, u.is_admin)}
              >
                {u.is_admin ? 'Ta bort admin' : 'Gör till admin (full tillgång)'}
              </button>
              {!u.is_admin && (
                <button
                  className="btn btn-ghost"
                  style={{ width: 'auto', padding: '4px 12px', fontSize: 12, borderColor: u.is_semi_admin ? '#7fa8c9' : undefined }}
                  onClick={() => toggleSemiAdmin(u.id, u.username, u.is_semi_admin)}
                >
                  {u.is_semi_admin ? 'Ta bort semi-admin' : 'Gör till semi-admin (bara Spel)'}
                </button>
              )}
            </div>

            {myPendingPackage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="subhead" style={{ fontSize: 12.5 }}>Väntar på aktivering av barnpaket.</span>
                <button
                  className="btn btn-ghost"
                  style={{ width: 'auto', borderColor: '#c98f4f', color: '#e0b37f' }}
                  onClick={() => activateChildPackage(myPendingPackage.id, myPendingPackage.child_profile_id, myPendingPackage.parent_id, u.username)}
                >
                  Aktivera barnpaket (99 kr/år)
                </button>
              </div>
            ) : myActivePackage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="subhead" style={{ fontSize: 12.5 }}>
                  Barnpaket {childPkgActive ? `aktivt t.o.m. ${myActivePackage.paid_until}` : `gick ut ${myActivePackage.paid_until}`}.
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ width: 'auto', borderColor: '#c98f4f', color: '#e0b37f' }}
                  onClick={() => renewChildPackage(myActivePackage.id, u.username)}
                >
                  Förnya barnpaket (99 kr/år)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {Object.entries(PLAN_PRICES).map(([key, val]) => (
                  <button key={key} className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => markPaid(u.id, key, u.username)}>
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
              </div>
            )}

            {pendingAsParent[u.id]?.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <div className="subhead" style={{ fontSize: 11.5, marginBottom: 6, color: '#e0b37f' }}>
                  Väntande barnkonton (skapade av {u.username}):
                </div>
                {pendingAsParent[u.id].map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{c.child_username_requested}</span>
                    <button
                      className="btn btn-ghost"
                      style={{ width: 'auto', borderColor: '#c98f4f', color: '#e0b37f', padding: '4px 12px', fontSize: 12 }}
                      onClick={() => activateChildPackage(c.id, c.child_profile_id, u.id, c.child_username_requested)}
                    >
                      Aktivera barnpaket (99 kr/år)
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pendingLifePurchases[u.id]?.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                <div className="subhead" style={{ fontSize: 11.5, marginBottom: 6, color: '#9ab8e6' }}>
                  Väntande köp av extra liv:
                </div>
                {pendingLifePurchases[u.id].map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className="subhead" style={{ fontSize: 12 }}>
                      Begärt {new Date(p.created_at).toLocaleDateString('sv-SE')}
                    </span>
                    <button
                      className="btn btn-ghost"
                      style={{ width: 'auto', borderColor: '#9ab8e6', color: '#9ab8e6', padding: '4px 12px', fontSize: 12 }}
                      onClick={() => activateExtraLife(p.id, u.id, u.username)}
                    >
                      Aktivera extra liv (29 kr)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
