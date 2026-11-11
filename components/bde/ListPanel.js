'use client';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { EVENT } from '@/lib/event';
import { eur } from '@/lib/money';
import ExtraTicket from './ExtraTicket';
import { YEARS, FILIERES, P1_GROUPS, groupsFor, EXTERIEUR, FILTER_YEARS, FILTER_GROUPS, emptyAtSel, atSelCount, matchAtelier, atAvailable } from '@/lib/ateliers';

const FEE = EVENT.serviceFee / 100;
// Montant lisible : 3 183,50 € (espaces insécables, pas de retour à la ligne)
const money = (x) => { const c = Math.round(x * 100); return `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/\s/g, '\u202f')}\u00a0€`; };

const fr = (d) => (d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) : '');
const hhmm = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const no = (n) => String(n).padStart(4, '0');
const SCAN_TXT = { valid: 'a validé une entrée', 'valid-force': "a laissé entrer un billet après l'heure limite", 'valid-supplement': 'a fait entrer un retardataire avec supplément', already: 'a scanné un billet déjà utilisé', unknown: 'a scanné un QR code inconnu', refunded: 'a scanné un billet remboursé', late: "a scanné un billet après l'heure limite" };
const ACTIONS = {
  connexion: () => "s'est connecté",
  scan: (l) => `${SCAN_TXT[l.details?.resultat] || 'a scanné un billet'}${l.numero ? `, billet n° ${String(l.numero).padStart(4, '0')}` : ''}`,
  remboursement: (l) => `a remboursé ${l.details?.mode === 'moitié' ? 'à moitié ' : ''}le billet n° ${String(l.numero).padStart(4, '0')}${l.details?.montant ? ` (${l.details.montant} €)` : ''}`,
  renvoi: (l) => `a renvoyé le billet n° ${String(l.numero).padStart(4, '0')} à ${l.details?.email || ''}`,
  export: (l) => (l.details?.recrutement != null ? `a exporté les candidatures du recrutement (${l.details.recrutement})` : 'a exporté la liste en Excel'),
  recrutement: (l) => `a libéré le créneau de ${l.details?.libere || '?'}${l.details?.nom ? ` (${l.details.nom})` : ''}`,
  supplement: (l) => `a encaissé un supplément de ${l.details?.montant ?? '?'} € (billet n° ${String(l.numero).padStart(4, '0')})`,
  extra: (l) => `a créé un billet extra pour ${l.details?.nom || ''}${l.details?.prix ? ` (${l.details.prix} €)` : ''}`,
  relance: (l) => (l.numero ? `a envoyé le mail atelier du billet n° ${String(l.numero).padStart(4, '0')}${l.details?.email ? ` à ${l.details.email}` : ''}` : `a envoyé la relance atelier (${l.details?.mails ?? '?'} mails)`),
};
// Offerts : billets gratuits (code invitation ou gagnant du concours) ; −50 % : billets payés avec un code de réduction
const FILTERS = [['all', 'Tous'], ['out', 'Pas entrés'], ['in', 'Entrés'], ['free', 'Offerts'], ['half', '−50 %'], ['refunded', 'Remboursés']];
const GUEST_FILTERS = FILTERS.filter(([k]) => k !== 'refunded');   // le compte Invité ne voit pas « Remboursés »
// Filtres de la relance atelier : visibles seulement tant que des billets n'ont pas d'atelier
const AT_FILTERS = [['atnone', 'Sans atelier'], ['atfresh', 'Ateliers récents']];
const SORTS = [
  ['name-az', 'Nom, de A à Z'],
  ['name-za', 'Nom, de Z à A'],
  ['first-az', 'Prénom, de A à Z'],
  ['date-new', 'Commande, plus récentes'],
  ['date-old', 'Commande, plus anciennes'],
  ['entry-new', 'Entrée, derniers entrés'],
];
const DEFAULT_SORT = 'name-az';
// Filtres mémorisés sur ce téléphone : ils restent en place (même après avoir quitté Safari) jusqu'à ce qu'on les enlève
const FKEY = 'b31-bde-filtres';
const savedFilters = () => { try { return JSON.parse(localStorage.getItem(FKEY) || '{}') || {}; } catch { return {}; } };
const byName = (a, b) => a.last_name.localeCompare(b.last_name, 'fr') || a.first_name.localeCompare(b.first_name, 'fr');
const SORTERS = {
  'name-az': byName,
  'name-za': (a, b) => -byName(a, b),
  'first-az': (a, b) => a.first_name.localeCompare(b.first_name, 'fr') || a.last_name.localeCompare(b.last_name, 'fr'),
  'date-new': (a, b) => (b.paid_at || '').localeCompare(a.paid_at || ''),
  'date-old': (a, b) => (a.paid_at || '').localeCompare(b.paid_at || ''),
  'entry-new': (a, b) => (b.scanned_at || '').localeCompare(a.scanned_at || '') || byName(a, b),
};

// Petite flèche qui pivote quand le bloc est ouvert
const Chevron = ({ open }) => (
  <svg className={`chev ${open ? 'up' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function ListPanel({ code, guest, active, refreshKey, onAuthLost }) {
  const [rows, setRows] = useState(null);
  const [cap, setCap] = useState([]);      // jauges des paliers
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [init] = useState(savedFilters);
  const [filter, setFilter] = useState([...(guest ? GUEST_FILTERS : FILTERS), ...(guest ? [] : AT_FILTERS)].some(([k]) => k === init.filter) ? init.filter : 'all');
  const [sort, setSort] = useState(SORTERS[init.sort] ? init.sort : DEFAULT_SORT);
  const [tierSel, setTierSel] = useState(Array.isArray(init.tierSel) ? init.tierSel : []);      // paliers cochés (vide = tous)
  const [optin, setOptin] = useState(['all', 'yes', 'no'].includes(init.optin) ? init.optin : 'all');       // emails du BDE : all | yes | no
  const [panel, setPanel] = useState(false);
  const [atSel, setAtSel] = useState(() => (init.at && Array.isArray(init.at.y) && Array.isArray(init.at.f) && Array.isArray(init.at.g) ? init.at : emptyAtSel()));   // filtre Atelier
  const [atPanel, setAtPanel] = useState(false);
  const [team, setTeam] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [revOpen, setRevOpen] = useState(false);    // détail des recettes, fermé par défaut
  const [teamOpen, setTeamOpen] = useState(false);  // bloc Équipe, fermé par défaut
  const [atOpen, setAtOpen] = useState(false);      // tableau classe par classe des Ateliers, fermé par défaut
  const [fillOpen, setFillOpen] = useState(false);  // détail du remplissage par palier, fermé par défaut
  const [xtOpen, setXtOpen] = useState(false);     // fenêtre « Billet extra »
  const [ringNum, setRingNum] = useState({});       // cercle touché : affiche le nombre au lieu du pourcentage
  const flipRing = (k) => setRingNum((x) => ({ ...x, [k]: !x[k] }));
  const [open, setOpen] = useState(null);
  const [at, setAt] = useState(null);
  const [mail, setMail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/list', { headers: { 'x-staff-token': code }, cache: 'no-store' });
      if (r.status === 401) return onAuthLost?.();
      if (!r.ok) throw new Error();
      const d = await r.json(); setRows(d.rows); setCap(d.tiers || []); setAt(new Date()); setErr('');
      if (!guest) { const a = await fetch('/api/admin/activity', { headers: { 'x-staff-token': code }, cache: 'no-store' }); if (a.ok) setTeam(await a.json()); }
    } catch { setErr('Mise à jour impossible. Vérifie le réseau.'); }
  }, [code, guest, onAuthLost]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { try { localStorage.setItem(FKEY, JSON.stringify({ filter, sort, tierSel, optin, at: atSel })); } catch {} }, [filter, sort, tierSel, optin, atSel]);
  useEffect(() => { if (!active) return; load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [active, load]);

  const stats = useMemo(() => {
    const paid = (rows || []).filter((r) => r.status !== 'refunded');
    const tiers = {};
    const tierRev = {};   // argent rapporté par chaque palier (prix des billets, hors frais)
    const invites = {};   // invitations gratuites par palier : elles occupent une place sans rien rapporter
    paid.forEach((r) => { tiers[r.tier] = (tiers[r.tier] || 0) + 1; tierRev[r.tier] = (tierRev[r.tier] || 0) + r.price; if (!r.price) invites[r.tier] = (invites[r.tier] || 0) + 1; });
    const payants = paid.filter((r) => r.price > 0).length;   // les invitations n'ont pas de frais
    return {
      paid: paid.length, inside: paid.filter((r) => r.scanned_at).length,
      total: paid.reduce((a, r) => a + r.price, 0)
        + (rows || []).filter((r) => r.status === 'refunded' && r.refunded_amount != null).reduce((a, r) => a + (r.price - r.refunded_amount), 0),   // moitié gardée
      orders: new Set(paid.map((r) => r.order)).size,
      refunded: (rows || []).length - paid.length, tiers, tierRev, payants, invites,
    };
  }, [rows]);

  // Objectif : ce qu'on encaisse si toutes les places sont vendues (prix des paliers en centimes dans la base)
  const goal = useMemo(() => {
    if (!cap.length || cap.some((t) => t.price == null)) return null;
    // Objectif : les places occupées par une invitation ne rapportent rien (ni billet, ni frais)
    const payable = (t) => Math.max(0, t.capacity - (stats.invites[t.name] || 0));
    const places = cap.reduce((x, t) => x + payable(t), 0);
    return { total: cap.reduce((x, t) => x + payable(t) * t.price, 0) / 100, fees: places * FEE, tier: (t) => (payable(t) * t.price) / 100 };
  }, [cap, stats.invites]);

  // Ateliers récents : tous les billets qui ont un atelier. Ceux dont l'heure est connue (remplis depuis la
  // mise à jour) passent en tête, du plus récent au plus ancien ; les autres suivent.
  const hasAtelier = useCallback((r) => r.status !== 'refunded' && !!r.atelier, []);

  // Billets par atelier (billets payés, hors remboursés)
  const ateliers = useMemo(() => {
    const c = {};
    (rows || []).filter((r) => r.status !== 'refunded').forEach((r) => { const k = r.atelier || ''; c[k] = (c[k] || 0) + 1; });
    const n = (k) => c[k] || 0;
    const years = YEARS.filter(([y]) => y !== 'EXT').map(([y, label]) => {
      const fils = y === 'P1'
        ? [{ name: '', groups: P1_GROUPS.map((g) => ({ g, n: n(`P1${g}`) })) }]   // P1 : pas de filière, juste les groupes
        : FILIERES.map((f) => ({ name: `${f}${y}`, groups: groupsFor(y, f).map((g) => ({ g, n: n(`${f}${y} ${g}`) })) }));
      fils.forEach((f) => { f.total = f.groups.reduce((x, g) => x + g.n, 0); });
      return { label: y === 'P1' ? 'P1' : `${label} année`, total: fils.reduce((x, f) => x + f.total, 0), fils };
    });
    const ext = n(EXTERIEUR), none = n('');
    const filled = years.reduce((x, y) => x + y.total, 0) + ext;
    const max = Math.max(1, ...years.map((y) => y.total), ext);
    // Billets par filière (AI, C, DA), toutes années confondues
    const fil = Object.fromEntries(FILIERES.map((f) => [f, years.reduce((x, y) => x + y.fils.filter((g) => g.name.startsWith(f)).reduce((z, g) => z + g.total, 0), 0)]));
    // Billets dont l'atelier a été rempli via le mail de relance (heure enregistrée)
    const recent = (rows || []).filter(hasAtelier).length;
    return { years, ext, none, filled, max, fil, recent };
  }, [rows, hasAtelier]);

  // Les filtres atelier disparaissent quand tout le monde a rempli son atelier
  const atChips = false;   // filtres « Sans atelier » et « Ateliers récents » retirés : l'atelier est obligatoire à l'achat
  const curFilter = !atChips && (filter === 'atnone' || filter === 'atfresh') ? 'all' : filter;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filter = curFilter;
    const list = (rows || []).filter((r) => {
      if (filter === 'atnone' && (r.atelier || r.status === 'refunded')) return false;
      if (filter === 'atfresh' && !hasAtelier(r)) return false;
      if (filter === 'in' && !(r.scanned_at && r.status !== 'refunded')) return false;
      if (filter === 'out' && (r.scanned_at || r.status === 'refunded')) return false;
      if (filter === 'refunded' && r.status !== 'refunded') return false;
      if (filter === 'free' && (r.price > 0 || r.status === 'refunded')) return false;
      if (filter === 'half' && !(r.price > 0 && r.promo_code)) return false;
      if (tierSel.length && !tierSel.includes(r.tier)) return false;
      if (optin === 'yes' && r.marketing_optout) return false;
      if (optin === 'no' && !r.marketing_optout) return false;
      if (!matchAtelier(r.atelier, atSel)) return false;
      if (!s) return true;
      return `${r.first_name} ${r.last_name} ${r.email} ${no(r.numero)} ${r.order}`.toLowerCase().includes(s);
    });
    // Ateliers récents : les derniers à avoir rempli en premier
    return filter === 'atfresh' ? list.sort((a, b) => (b.atelier_at || '').localeCompare(a.atelier_at || '') || byName(a, b)) : list.sort(SORTERS[sort]);
  }, [rows, q, curFilter, sort, tierSel, optin, atSel, hasAtelier]);

  // paliers présents dans la liste, du moins cher au plus cher
  const tierList = useMemo(() => [...new Map((rows || []).map((r) => [r.tier, r.price])).entries()].sort((a, b) => a[1] - b[1]).map(([t]) => t), [rows]);
  const atOn = atSelCount(atSel) > 0;
  const atAv = useMemo(() => atAvailable(atSel), [atSel]);   // options qui n'existent pas avec les autres choix : grisées
  const atOff = (k, v) => !atAv[k].has(v) && !atSel[k].includes(v);
  const toggleAt = (k, v) => setAtSel((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
  const filtersOn = sort !== DEFAULT_SORT || tierSel.length > 0 || optin !== 'all';
  const reset = () => { setSort(DEFAULT_SORT); setTierSel([]); setOptin('all'); setPanel(false); };
  const toggleTier = (t) => { setTierSel((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t])); setPanel(false); };

  const [refOpen, setRefOpen] = useState(null);   // billet dont les options de remboursement sont ouvertes
  const refund = async (r, mode = 'full') => {
    const amount = mode === 'half' ? Math.round(r.price * 50) / 100 : r.price;
    if (!r.price) {   // invitation (code) : simple annulation
      if (!confirm(`Annuler l'invitation de ${r.first_name} ${r.last_name} (billet n° ${no(r.numero)}) ?\n\nSon QR code ne passera plus à l'entrée et sa place sera remise en vente. Le code utilisé ne pourra pas resservir.`)) return;
    } else if (!confirm(`Rembourser ${eur(amount)} à ${r.first_name} ${r.last_name} (billet n° ${no(r.numero)}) ?\n\n${mode === 'half' ? `Remboursement à moitié : le BDE garde ${eur(r.price - amount)} du billet et` : 'Remboursement total du billet :'} les ${eur(FEE)} de frais de service ne sont pas rendus. Le billet sera annulé : son QR code ne passera plus à l'entrée et sa place sera remise en vente.`)) return;
    setRefOpen(null);
    const res = await fetch('/api/admin/refund', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify({ numero: r.numero, mode }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error || 'Le remboursement a échoué.');
    load();
  };
  const resend = async (r) => {
    setSending(true); setSent(''); setErr('');
    try {
      const res = await fetch('/api/admin/resend', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify({ numero: r.numero, email: mail }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setErr(d.error || "Le renvoi a échoué.");
      else { setSent(`Billet${d.count > 1 ? 's' : ''} renvoyé${d.count > 1 ? 's' : ''} à ${d.email}`); load(); }
    } catch { setErr('Connexion impossible.'); }
    setSending(false);
  };
  const exportXlsx = async () => {
    const qs = new URLSearchParams();
    if (tierSel.length) qs.set('tiers', tierSel.join('|'));
    if (optin !== 'all') qs.set('optin', optin);
    if (atOn) ['y', 'f', 'g'].forEach((k) => atSel[k].length && qs.set(`a${k}`, atSel[k].join('|')));
    const r = await fetch(`/api/admin/export${qs.toString() ? `?${qs}` : ''}`, { headers: { 'x-staff-token': code } });
    if (!r.ok) return setErr("L'export n'a pas pu être généré.");
    const url = URL.createObjectURL(await r.blob());
    Object.assign(document.createElement('a'), { href: url, download: `inscrits-${EVENT.slug}.xlsx` }).click();
    URL.revokeObjectURL(url);
  };

  if (!rows) return <div className="listp"><p className="note" style={{ padding: 20 }}>{err || 'Chargement des inscrits…'}</p></div>;
  const pct = stats.paid ? Math.round((stats.inside / stats.paid) * 100) : 0;

  return (
    <div className="listp">
      <div className="listp-side">
      <section className={`kpis ${guest ? 'kpis-guest' : ''}`}>
        <div className="kpi-c big">
          <span className="kpi-l">Entrées</span>
          <span className="kpi-v">{stats.inside}<small> / {stats.paid}</small></span>
          <span className="kpi-bar"><i style={{ width: `${pct}%` }} /></span>
        </div>
        <div className="kpi-c"><span className="kpi-l">Billets</span><span className="kpi-v">{stats.paid}</span></div>
        {!guest && (<>
        <div className="kpi-c"><span className="kpi-l">Commandes</span><span className="kpi-v">{stats.orders}</span></div>
        <div className="kpi-c"><span className="kpi-l">Remboursés</span><span className="kpi-v">{stats.refunded}</span></div>
        </>)}
      </section>

      {!guest && (() => {
        const fees = stats.payants * FEE;
        const brut = stats.total + fees;
        const goalBrut = goal ? goal.total + goal.fees : 0;
        const p = goalBrut ? Math.min(100, Math.round((brut / goalBrut) * 100)) : 0;
        const of = (v) => (goal ? <small> / {money(v)}</small> : null);
        return (
          <section className={`rev ${revOpen ? 'open' : ''}`}>
            <button className="rev-sum" onClick={() => setRevOpen((v) => !v)} aria-expanded={revOpen} aria-label={revOpen ? 'Masquer le détail des recettes' : 'Voir le détail des recettes'}>
              <span className="fill-head">
                <span className="kpi-l">Recettes</span>
                <span className="rev-pct">{goal && `${p} % de l'objectif`}<Chevron open={revOpen} /></span>
              </span>
              <span className="rev-v">{money(brut)}{of(goalBrut)}</span>
              {goal && <span className="fill-bar"><i style={{ width: `${p}%` }} /></span>}
            </button>
            {revOpen && <div className="rev-rows">
              {cap.length ? cap.map((t) => (
                <Fragment key={t.name}><span className="rev-l">{t.name}</span><span className="rev-n">{money(stats.tierRev[t.name] || 0)}{t.price != null && goal && <small> / {money(goal.tier(t))}</small>}</span></Fragment>
              )) : (<><span className="rev-l">Billets</span><span className="rev-n">{money(stats.total)}</span></>)}
              <span className="rev-sep" />
              <span className="rev-l">Frais de service</span><span className="rev-n">{money(fees)}{of(goal?.fees)}</span>
            </div>}
          </section>
        );
      })()}

      {!guest && cap.length > 0 && (() => {
        const total = cap.reduce((x, t) => x + t.capacity, 0);
        const pctOf = (n, c) => (c ? Math.min(100, Math.round((n / c) * 100)) : 0);
        return (
          <section className={`fill rev ${fillOpen ? 'open' : ''}`}>
            <button className="rev-sum" onClick={() => setFillOpen((v) => !v)} aria-expanded={fillOpen} aria-label={fillOpen ? 'Masquer le détail par palier' : 'Voir le détail par palier'}>
              <span className="fill-head">
                <span className="kpi-l">Remplissage</span>
                <span className="rev-pct">{pctOf(stats.paid, total)} % des places vendues<Chevron open={fillOpen} /></span>
              </span>
              <span className="rev-v">{stats.paid}<small> / {total} billets</small></span>
              <span className="fill-bar"><i style={{ width: `${pctOf(stats.paid, total)}%` }} /></span>
            </button>
            {fillOpen && <div className="fill-tiers">
              {cap.map((t) => {
                const n = stats.tiers[t.name] || 0;
                return (
                  <div key={t.name} className={`fill-t ${n >= t.capacity ? 'full' : ''}`}>
                    <span className="fill-tn">{t.name}</span>
                    <span className="fill-tb"><i style={{ width: `${pctOf(n, t.capacity)}%` }} /></span>
                    <span className="fill-tv">{n} / {t.capacity}</span>
                  </div>
                );
              })}
            </div>}
          </section>
        );
      })()}

      {!guest && (
        <section className={`ate ${atOpen ? 'open' : ''}`}>
          <button className="team-head" onClick={() => setAtOpen((v) => !v)} aria-expanded={atOpen} aria-label={atOpen ? 'Masquer le détail classe par classe' : 'Voir le détail classe par classe'}>
            <span className="kpi-l">Ateliers</span>
            <span className="rev-pct">{ateliers.filled} renseigné{ateliers.filled > 1 ? 's' : ''}<Chevron open={atOpen} /></span>
          </button>
          <div className="ate-body">
              {/* Toujours visibles : barres par année et cercles. La flèche ouvre le tableau classe par classe */}
              <div className="ate-sum">
                {/* À gauche : part de chaque année. À droite : part de chaque filière, en cercles */}
                <div className="ate-bars">
                  {[...ateliers.years.map((y) => [y.label === 'P1' ? 'P1' : y.label.replace(' année', ''), y.total]), ['Ext.', ateliers.ext]].map(([l, n]) => {
                    const pc = ateliers.filled ? Math.round((n / ateliers.filled) * 100) : 0;
                    return (
                      <div key={l} className="ate-st" title={`${n} billet${n > 1 ? 's' : ''}`}>
                        <span className="ate-stn">{l}</span>
                        <span className="fill-tb"><i style={{ width: `${pc}%` }} /></span>
                        <span className="ate-stv">{pc} %</span>
                      </div>
                    );
                  })}
                </div>
                <div className="ate-rings">
                  {/* Cercles en pyramide : AI en haut, C et DA, puis P1 et extérieurs. Touche un cercle : nombre de personnes */}
                  {[...FILIERES.map((f) => [f, f, ateliers.fil[f] || 0]), ['P1', 'P1', ateliers.years.find((y) => y.label === 'P1')?.total || 0], ['ext', 'Ext.', ateliers.ext]].map(([k, l, n]) => {
                    const pc = ateliers.filled ? Math.round((n / ateliers.filled) * 100) : 0;
                    const C = 2 * Math.PI * 30;
                    return (
                      <button type="button" key={k} className={`ate-ring ${k === 'ext' || k === 'P1' ? 'ate-ring-alt' : ''}`} onClick={() => flipRing(k)} aria-label={`${l} : ${n} personne${n > 1 ? 's' : ''}, ${pc} %`}>
                        <svg viewBox="0 0 72 72" aria-hidden="true">
                          <circle cx="36" cy="36" r="30" className="rg-track" />
                          <circle cx="36" cy="36" r="30" className="rg-fill" strokeDasharray={`${(C * pc) / 100} ${C}`} transform="rotate(-90 36 36)" />
                        </svg>
                        <span className="rg-t"><b>{l}</b><i>{ringNum[k] ? `${n} pers.` : `${pc} %`}</i></span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {atOpen && <div className="ate-detail">
              {ateliers.years.map((y) => (
                <div key={y.label} className="ate-y">
                  <div className="ate-yh2">
                    <span>{y.label}</span>
                    <span>{y.total}</span>
                  </div>
                  {y.fils.map((f) => (
                    <div key={f.name} className="ate-f">
                      <span className="ate-fn">{f.name}</span>
                      <span className="ate-g">{f.groups.map((g) => <span key={g.g} className={g.n ? '' : 'z'}>{g.g} <b>{g.n}</b></span>)}</span>
                      <span className="ate-ft">{f.name ? f.total : ''}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="ate-yh2 ate-ext">
                <span>Extérieur</span>
                <span>{ateliers.ext}</span>
              </div>
              </div>}
            </div>
        </section>
      )}

      {!guest && team && (
        <section className={`team ${teamOpen ? 'open' : ''}`}>
          <button className="team-head" onClick={() => setTeamOpen((v) => !v)} aria-expanded={teamOpen}>
            <span className="team-t">Équipe</span><Chevron open={teamOpen} />
          </button>
          {teamOpen && (<>
          <div className="team-grid">
            <span className="th">Prénom</span><span className="th">Scans</span><span className="th">Rembours.</span><span className="th">Renvois</span>
            {team.team.map((m) => (
              <Fragment key={m.name}><span className="tn">{m.name}</span><span>{m.scans}</span><span>{m.refunds}</span><span>{m.resends}</span></Fragment>
            ))}
          </div>
          <button className="team-more" onClick={() => setShowLog((v) => !v)}>{showLog ? 'Masquer le journal' : 'Voir le journal des actions'}</button>
          {showLog && (
            <ul className="journal">
              {team.log.map((l, i) => (
                <li key={i}><span className="j-at">{fr(l.at)}</span><span><b>{l.staff}</b> {ACTIONS[l.action]?.(l) || l.action}</span></li>
              ))}
              {!team.log.length && <li>Aucune action pour l'instant.</li>}
            </ul>
          )}
          </>)}
        </section>
      )}

      {!guest && <button className="cta listp-export listp-extra" onClick={() => setXtOpen(true)}><span>Billet extra</span><span>+</span></button>}
      {!guest && <button className="cta listp-export" onClick={exportXlsx}><span>Exporter en Excel</span><span>.xlsx</span></button>}
      {xtOpen && <ExtraTicket code={code} fee={FEE} price={cap.length ? cap[cap.length - 1].price / 100 : null} onClose={() => { setXtOpen(false); load(); }} onPaid={load} />}
      </div>

      <div className="listp-main">
      <section className="tools">
        <div className="tools-top">
          <input className="search" type="search" placeholder="Nom, email ou n°" value={q} onChange={(e) => setQ(e.target.value)} />
          {!guest && (
            <button className={`atbtn ${atPanel || atOn ? 'on' : ''}`} onClick={() => { setAtPanel((v) => !v); setPanel(false); }} aria-expanded={atPanel}>
              Atelier{atOn && <i className="fdot" />}
            </button>
          )}
          <button className={`fbtn ${panel ? 'on' : ''}`} onClick={() => { setPanel((v) => !v); setAtPanel(false); }} aria-expanded={panel} aria-label="Trier et filtrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            {filtersOn && <i className="fdot" />}
          </button>
        </div>
        <div className="chips">
          {[...(guest ? GUEST_FILTERS : FILTERS).slice(0, 1), ...(atChips ? AT_FILTERS : []), ...(guest ? GUEST_FILTERS : FILTERS).slice(1)].map(([k, l]) => <button key={k} className={`${curFilter === k ? 'on' : ''} ${k.startsWith('at') ? 'chip-at' : ''}`} onClick={() => setFilter(k)}>{l}{k === 'atnone' ? ` ${ateliers.none}` : k === 'atfresh' ? ` ${ateliers.recent}` : ''}</button>)}
        </div>
        {atPanel && (
          <div className="fpanel atpanel">
            <div className="fsec">
              <p className="flabel">Année</p>
              <div className="fchips">
                {FILTER_YEARS.map(([k, l]) => <button key={k} className={atSel.y.includes(k) ? 'on' : ''} aria-pressed={atSel.y.includes(k)} disabled={atOff('y', k)} onClick={() => toggleAt('y', k)}>{l}</button>)}
              </div>
            </div>
            <div className="fsec">
              <p className="flabel">Filière</p>
              <div className="fchips">
                {FILIERES.map((f) => <button key={f} className={atSel.f.includes(f) ? 'on' : ''} aria-pressed={atSel.f.includes(f)} disabled={atOff('f', f)} onClick={() => toggleAt('f', f)}>{f}</button>)}
              </div>
            </div>
            <div className="fsec">
              <p className="flabel">Groupe</p>
              <div className="fchips">
                {FILTER_GROUPS.map((g) => <button key={g} className={atSel.g.includes(g) ? 'on' : ''} aria-pressed={atSel.g.includes(g)} disabled={atOff('g', g)} onClick={() => toggleAt('g', g)}>{g}</button>)}
              </div>
            </div>
            <div className="ffoot">
              <button className="freset" onClick={() => setAtSel(emptyAtSel())} disabled={!atOn}>Réinitialiser</button>
              <button className="atok" onClick={() => setAtPanel(false)}>Voir {shown.length} résultat{shown.length > 1 ? 's' : ''}</button>
            </div>
          </div>
        )}
        {panel && (
          <div className="fpanel">
            <div className="fsec">
              <p className="flabel">Trier par</p>
              <div className="fopts">
                {SORTS.map(([k, l]) => (
                  <button key={k} className={`fopt ${sort === k ? 'on' : ''}`} onClick={() => { setSort(k); setPanel(false); }}><i />{l}</button>
                ))}
              </div>
            </div>
            <div className="fsec">
              <p className="flabel">Palier</p>
              <div className="fchips">
                {tierList.map((t) => <button key={t} className={tierSel.includes(t) ? 'on' : ''} onClick={() => toggleTier(t)}>{t}</button>)}
              </div>
            </div>
            <div className="fsec">
              <p className="flabel">Emails du BDE</p>
              <div className="fchips">
                {[['all', 'Tous'], ['yes', 'Acceptés'], ['no', 'Refusés']].map(([k, l]) => <button key={k} className={optin === k ? 'on' : ''} onClick={() => { setOptin(k); setPanel(false); }}>{l}</button>)}
              </div>
            </div>
            <div className="ffoot">
              <span>{shown.length} résultat{shown.length > 1 ? 's' : ''}</span>
              <button className="freset" onClick={reset} disabled={!filtersOn}>Réinitialiser</button>
            </div>
          </div>
        )}
      </section>

      {err && <p className="err" style={{ margin: '0 0 8px' }}>{err}</p>}


      <ul className="people">
        {shown.map((r) => {
          const st = r.status === 'refunded' ? 'refunded' : r.scanned_at ? 'in' : 'out';
          const isOpen = open === r.numero;
          return (
            <li key={r.numero} className={`person ${st} ${isOpen ? 'open' : ''}`}>
              <button className="person-row" onClick={() => { setOpen(isOpen ? null : r.numero); setMail(r.email); setSent(''); }} aria-expanded={isOpen}>
                <span className="p-main">
                  <span className="p-name">{r.first_name} <b>{r.last_name}</b></span>
                  <span className="p-sub">{r.tier}, {r.price ? `${eur(r.price)} + ${eur(FEE)}${r.promo_code ? ' (−50 %)' : ''}` : 'offert'}, n° {no(r.numero)}</span>
                </span>
                <span className="p-state">{curFilter === 'atfresh' && r.atelier ? (r.atelier_at ? `${r.atelier}, rempli à ${hhmm(r.atelier_at)}` : r.atelier) : st === 'in' ? `Entré ${hhmm(r.scanned_at)}${r.scanned_by ? ` par ${r.scanned_by}` : ''}` : st === 'refunded' ? (r.refunded_amount != null && r.refunded_amount < r.price ? 'Remboursé à moitié' : 'Remboursé') : 'Pas entré'}</span>
              </button>
              {isOpen && (
                <div className="p-more">
                  <dl>
                    <dt>Commande</dt><dd>{r.order}</dd>
                    <dt>Email</dt><dd><a href={`mailto:${r.email}`}>{r.email}</a></dd>
                    <dt>Téléphone</dt><dd><a href={`tel:${r.phone.replace(/\s/g, '')}`}>{r.phone}</a></dd>
                    <dt>Atelier</dt><dd>{r.atelier || 'Non renseigné'}</dd>
                    <dt>Emails du BDE</dt><dd>{r.marketing_optout ? 'Refusés' : 'Acceptés'}</dd>
                    {r.price ? (<><dt>Payé</dt><dd>{eur(r.price + FEE)} (billet {eur(r.price)} + frais {eur(FEE)}){r.promo_code ? `, code ${r.promo_code} (−50 %)` : ''}</dd></>) : (<><dt>Billet offert</dt><dd>Code {r.promo_code}, rien payé</dd></>)}
                    <dt>Achat</dt><dd>{fr(r.paid_at)}</dd>
                    {r.scanned_at && (<><dt>Entrée</dt><dd>{fr(r.scanned_at)}{r.scanned_by ? `, par ${r.scanned_by}` : ''}</dd></>)}
                    {r.refunded_at && (<><dt>Remboursé</dt><dd>{fr(r.refunded_at)}{r.refunded_by ? `, par ${r.refunded_by}` : ''}{r.refunded_amount != null && r.price > 0 ? `, ${eur(r.refunded_amount)}${r.refunded_amount < r.price ? ' (moitié)' : ''}` : ''}</dd></>)}
                  </dl>
                  {!guest && st !== 'refunded' && (
                    <div className="resend">
                      <label htmlFor={`rs${r.numero}`}>Renvoyer les billets de la commande à :</label>
                      <div className="resend-row">
                        <input id={`rs${r.numero}`} type="email" value={mail} onChange={(e) => setMail(e.target.value)} />
                        <button onClick={() => resend(r)} disabled={sending}>{sending ? 'Envoi…' : 'Renvoyer'}</button>
                      </div>
                      {sent && <p className="resend-ok">{sent}</p>}
                    </div>
                  )}
                  {!guest && st === 'out' && !r.price && <button className="refund" onClick={() => refund(r)}>Annuler l'invitation</button>}
                  {!guest && st === 'out' && r.price > 0 && (refOpen !== r.numero ? (
                    <button className="refund" onClick={() => setRefOpen(r.numero)}>Rembourser le billet</button>
                  ) : (
                    <div className="refopts">
                      <span className="refopts-l">Rembourser, frais de service gardés</span>
                      <button className="refund" onClick={() => refund(r, 'full')}>Totalement ({eur(r.price)})</button>
                      <button className="refund" onClick={() => refund(r, 'half')}>À moitié ({eur(Math.round(r.price * 50) / 100)})</button>
                      <button className="refopts-x" onClick={() => setRefOpen(null)}>Annuler</button>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="empty">{rows.length ? 'Aucun résultat.' : "Aucun billet vendu pour l'instant."}</li>}
      </ul>

      <div className="listp-foot">
        <p className="note">Mise à jour automatique toutes les 10 secondes{at ? `, dernière à ${at.toLocaleTimeString('fr-FR')}` : ''}.</p>
      </div>
      </div>
    </div>
  );
}
