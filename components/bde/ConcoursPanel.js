'use client';
import { EVENT } from '@/lib/event';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Onglet Concours de l'appli BDE : participants, case « gagnant », envoi des résultats par mail.
export default function ConcoursPanel({ code, active, onAuthLost }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(false);
  const [showRes, setShowRes] = useState(false);   // résultats du concours (après l'envoi)
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/concours', { headers: { 'x-staff-token': code }, cache: 'no-store' });
      if (r.status === 401) return onAuthLost?.();
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || '');
      setD(j); setErr('');
    } catch (e) { setErr(/concours/.test(String(e.message)) ? "La table du concours n'existe pas encore : lance supabase/concours.sql." : 'Mise à jour impossible. Vérifie le réseau.'); }
  }, [code, onAuthLost]);
  useEffect(() => { if (!active) return; load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, [active, load]);

  const rows = d?.rows || [];
  const wins = rows.filter((r) => r.won).length;
  const pending = rows.filter((r) => !r.result_sent_at);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return rows.filter((r) => (!only || r.won) && (!n || `${r.first_name} ${r.last_name} ${r.atelier} ${r.email}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(n)));
  }, [rows, q, only]);

  const toggle = async (r) => {
    if (r.result_sent_at) return;
    setD((x) => ({ ...x, rows: x.rows.map((y) => (y.id === r.id ? { ...y, won: !r.won } : y)) }));
    const res = await fetch('/api/admin/concours', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify({ action: 'toggle', id: r.id, won: !r.won }) });
    if (!res.ok) { setErr("La case n'a pas été enregistrée."); load(); }
  };
  const send = async () => {
    const w = pending.filter((r) => r.won).length;
    if (!confirm(`Envoyer les résultats à ${pending.length} participant${pending.length > 1 ? 's' : ''} ?\n\n${w} gagnant${w > 1 ? 's' : ''} : place offerte\n${pending.length - w} autre${pending.length - w > 1 ? 's' : ''} : code −${d.discount} %\n\nLes mails partent tout de suite et on ne peut pas les annuler.`)) return;
    setBusy(true); setErr(''); setOk('');
    const res = await fetch('/api/admin/concours', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify({ action: 'send' }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setOk(`${j.sent} mails envoyés, dont ${j.wins} gagnant${j.wins > 1 ? 's' : ''}.`); else setErr(j.error || "L'envoi a échoué.");
    setBusy(false); load();
  };

  if (!d) return <div className="ccp"><p className="ccp-note">{err || 'Chargement…'}</p></div>;
  return (
    <div className="ccp">
      <div className="ccp-kpi">
        <div><b>{rows.length}</b><span>participants</span></div>
        <div><b>{wins} / {d.places}</b><span>gagnants cochés</span></div>
        <div><b>{rows.length - pending.length}</b><span>résultats envoyés</span></div>
      </div>
      {ok && <p className="ccp-ok">{ok}</p>}
      {err && <p className="err">{err}</p>}
      <div className="ccp-bar">
        <input placeholder="Nom ou atelier" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className={only ? 'on' : ''} onClick={() => setOnly(!only)}>Gagnants</button>
        {d.funnel?.sent > 0 && <button type="button" className={showRes ? 'on' : ''} onClick={() => setShowRes(!showRes)}>Résultats</button>}
      </div>
      {showRes && d.funnel?.sent > 0 && <Results f={d.funnel} discount={d.discount} />}
      {list.map((r) => (
        <label key={r.id} className="ccp-row">
          <input type="checkbox" checked={r.won} disabled={!!r.result_sent_at} onChange={() => toggle(r)} />
          <span><b>{r.first_name} {r.last_name.toUpperCase()}</b><small>{r.atelier} · {r.email}</small></span>
          <em className={r.won ? 'w' : ''}>{r.result_sent_at ? (r.won ? 'Gagnant, envoyé' : `−${d.discount} %, envoyé`) : r.won ? 'Gagnant' : ''}
            {r.ticket && <i className={`ccp-t ${r.ticket.kind}`}>{r.ticket.kind === 'rien' ? 'Pas de billet' : `${r.ticket.kind === 'code' ? 'Billet' : r.ticket.kind === 'avant' ? 'Avait déjà' : 'Sans le code'} n° ${String(r.ticket.numero).padStart(4, '0')}${r.ticket.scanned ? ', venu' : ''}`}</i>}
          </em>
        </label>
      ))}
      {!list.length && <p className="ccp-note">Aucun participant pour l'instant.</p>}
      <button className="cta ccp-send" type="button" disabled={busy || !pending.length} onClick={send}>
        <span>{busy ? 'Envoi…' : pending.length ? `Envoyer les résultats (${pending.length})` : 'Résultats envoyés'}</span><span>→</span>
      </button>
      <p className="ccp-note">Coche les gagnants, puis envoie. Chaque gagnant reçoit un code place offerte, chacun des autres un code −{d.discount} % personnel. Les inscriptions ferment {d.closesLabel}. Un participant arrivé après l'envoi pourra recevoir son résultat avec un nouvel envoi.</p>
    </div>
  );
}

// Résultats du concours : les gens ont-ils pris leur place après avoir reçu leur code ? Sont-ils venus ?
function Results({ f, discount }) {
  const after = Date.now() >= Date.parse(EVENT.startsAt) || f.winners.came + f.discount.came > 0;
  const Card = ({ t, g, unit }) => (
    <div className="ccp-rc">
      <span className="ccp-rk">{t}</span>
      <b className="ccp-rb">{g.usedPct} %</b>
      <span className="ccp-rs">ont pris leur place avec le code ({g.used} sur {g.sent} envoyés)</span>
      <span className="ccp-rbar"><i style={{ width: `${g.usedPct}%` }} /></span>
      <dl>
        <dt>{unit} avec le code</dt><dd>{g.used}</dd>
        {after && <><dt>Dont venus à la soirée</dt><dd>{g.usedCame} sur {g.used}</dd></>}
        <dt>Avaient déjà un billet</dt><dd>{g.before}</dd>
        <dt>Ont acheté sans le code</dt><dd>{g.without}</dd>
        <dt>Rien pris</dt><dd>{g.none}</dd>
        {after && <><dt>Venus en tout</dt><dd>{g.came} sur {g.sent} ({g.camePct} %)</dd></>}
      </dl>
    </div>
  );
  return (
    <section className="ccp-res" aria-label="Résultats du concours">
      <div className="ccp-rg">
        <Card t="Place offerte" g={f.winners} unit="Billets offerts pris" />
        <Card t={`Code −${discount} %`} g={f.discount} unit="Billets achetés" />
      </div>
      <p className="ccp-note">Calculé en direct sur les {f.sent} participants qui ont reçu leur résultat. Un code compte dès qu'un billet le porte. « Avaient déjà un billet » : acheté avant l'envoi des résultats, avec le même mail.</p>
    </section>
  );
}
