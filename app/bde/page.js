'use client';
import { EVENT } from '@/lib/event';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ListPanel from '@/components/bde/ListPanel';
import ScanPanel from '@/components/bde/ScanPanel';
import RecrutementPanel from '@/components/bde/RecrutementPanel';
import ConcoursPanel from '@/components/bde/ConcoursPanel';
import EquipePanel from '@/components/bde/EquipePanel';
import Reglages from '@/components/bde/Reglages';
import Tuto from '@/components/bde/Tuto';
import Bilan from '@/components/bde/Bilan';
import MerchPanel from '@/components/bde/MerchPanel';
import { KINDS as ALL_KINDS, LABELS, THEMES, DEFAULT_PREFS, loadPrefs, savePrefs, tutoKey, edgeColors } from '@/lib/prefs';
import { syncPush } from '@/lib/pushClient';

const KEY = 'b31-bde-session';                 // nouvelle session personnelle
const OLD_KEYS = ['b31-bde-code'];               // ancien mot de passe commun : supprimé
// Les cinq écrans (l'ordre se règle dans les Réglages ; le compte Invité n'a que Scan et Inscrits)
const SUBS = { scan: 'Valider les entrées', ins: 'Chiffres et liste', cc: 'Les gagnants', rec: 'Les candidatures', eq: 'Qui fait quoi', merch: 'À remettre' };
const GUEST_KINDS = ['scan', 'ins'];

export default function BdeApp() {
  const [code, setCode] = useState(null);     // jeton de session
  const [me, setMe] = useState('');           // prénom de la personne connectée
  const [boot, setBoot] = useState(true);
  const [names, setNames] = useState([]);
  const [guestOn, setGuestOn] = useState(false);   // bouton Invité affiché si BDE_INVITE existe
  const [guest, setGuest] = useState(false);       // la personne connectée est le compte Invité
  const [who, setWho] = useState('');
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState(1);   // on arrive sur Inscrits ; Scan est à gauche
  const [refreshKey, setRefreshKey] = useState(0);
  const panes = useRef(null);
  const app = useRef(null);
  const nav = useRef(null);
  const toTopRef = useRef(null);
  const [press, setPress] = useState(false);   // pastille de la barre enfoncée (effet rebond)
  const [prefs, setPrefsState] = useState(DEFAULT_PREFS);
  const [rgOpen, setRgOpen] = useState(false);
  const [tuto, setTuto] = useState(false);
  const [pendingN, setPendingN] = useState(0);  // demandes de Gaspard en attente (pour Jonas)
  const [toasts, setToasts] = useState([]);
  const [blOpen, setBlOpen] = useState(false);
  const [hasMerch, setHasMerch] = useState(false);   // l'onglet Merch apparaît quand la liste est importée
  const [rgData, setRgData] = useState(null);         // réglages de la soirée, gardés à jour : la fenêtre Réglages s'ouvre déjà remplie
  const [reqHide, setReqHide] = useState('');         // bandeau des demandes masqué (jusqu'à la prochaine demande)
  const [reqBusy, setReqBusy] = useState('');
  const [pushOn, setPushOn] = useState(false);        // ce téléphone reçoit les notifications même appli fermée
  const kinds = guest ? prefs.order.filter((k) => GUEST_KINDS.includes(k)) : hasMerch ? [...prefs.order, 'merch'] : prefs.order;
  const n = kinds.length;
  const cur = kinds[tab] || 'ins';
  const setPrefs = (p) => { setPrefsState(p); savePrefs(me, p); };
  const theme = THEMES.find((t) => t.id === prefs.theme) || THEMES[0];

  // Session mémorisée sur ce téléphone ; l'ancien accès commun est effacé
  useEffect(() => {
    try { OLD_KEYS.forEach((k) => localStorage.removeItem(k)); } catch {}
    fetch('/api/bde/login', { cache: 'no-store' }).then((r) => r.json()).then((d) => { setNames(d.names || []); setGuestOn(!!d.guest); }).catch(() => {});
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
    if (saved?.token) { setCode(saved.token); setMe(saved.name); setGuest(!!saved.guest); }
    setBoot(false);
  }, []);

  const login = async (e) => {
    e.preventDefault(); setErr('');
    if (!who) return setErr('Choisis ton prénom.');
    const r = await fetch('/api/bde/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: who, pin: input }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.token) return setErr('Code incorrect.');
    try { localStorage.setItem(KEY, JSON.stringify({ token: d.token, name: d.name, guest: !!d.guest })); } catch {}
    setCode(d.token); setMe(d.name); setGuest(!!d.guest); setInput('');
  };
  const logout = useCallback(() => {
    if (code) syncPush(code, {}).catch(() => {});   // ce téléphone ne reçoit plus les notifications de la personne
    try { localStorage.removeItem(KEY); } catch {} setCode(null); setMe(''); setGuest(false); setInput(''); setRgData(null);
  }, [code]);

  // Les écrans sont collés côte à côte et suivent le doigt (ou le trackpad) : défilement horizontal natif, aimanté.
  // --p = position exacte (0 = Scan, 1 = Inscrits…) : le repère de la barre du bas glisse en continu avec le geste.
  const ticking = useRef(false);
  const onScroll = () => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const el = panes.current; if (!el) return;
      const p = el.scrollLeft / el.clientWidth;
      app.current?.style.setProperty('--p', p.toFixed(4));
      const i = Math.round(p);
      setTab((t) => (t === i ? t : i));
    });
  };
  const go = (i) => {
    const el = panes.current; if (!el) return;
    if (i === tab) return toTop();
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  // Barre d'onglets façon Apple : on appuie, la pastille de verre gonfle ; on glisse le doigt, elle suit et les écrans
  // défilent avec elle ; on lâche, elle se pose sur l'onglet le plus proche en rebondissant. Un simple toucher change d'onglet.
  const drag = useRef(null);
  const navPos = (x) => {
    const r = nav.current.getBoundingClientRect(), cell = (r.width - 12) / n;
    return Math.max(0, Math.min(n - 1, (x - r.left - 6) / cell - 0.5));
  };
  const onNavDown = (e) => {
    if (e.button > 0) return;
    drag.current = { x0: e.clientX, moved: false };
    try { nav.current.setPointerCapture(e.pointerId); } catch {}
    setPress(true);
  };
  const onNavMove = (e) => {
    const d = drag.current; if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) < 6) return;
    d.moved = true;
    const el = panes.current; el.style.scrollSnapType = 'none';
    el.scrollLeft = navPos(e.clientX) * el.clientWidth;
  };
  const onNavUp = (e) => {
    const d = drag.current; drag.current = null; setPress(false); if (!d) return;
    const el = panes.current;
    const i = Math.round(navPos(e.clientX));
    if (!d.moved && i === tab) { el.style.scrollSnapType = ''; return toTop(); }
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setTimeout(() => { el.style.scrollSnapType = ''; }, 450);
  };
  // Appli ajoutée à l'écran d'accueil (iPhone) : on cale l'appli sur la hauteur réelle de l'écran, sinon iOS laisse
  // une bande noire en bas ; le fond de la page prend la couleur de l'écran affiché pour qu'aucune bordure ne se voie
  useEffect(() => {
    const html = document.documentElement;
    const pwa = window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
    html.classList.toggle('pwa', !!pwa);
    if (!pwa) return;
    const fit = () => { const portrait = window.innerHeight >= window.innerWidth; html.style.setProperty('--screen-h', `${Math.max(window.innerHeight, portrait ? screen.height : screen.width)}px`); };
    // Toucher l'heure (barre d'état) : l'iPhone ne fait remonter que la page elle-même, pas les écrans de l'appli.
    // La page est donc gardée 1 pixel plus bas que son haut ; quand l'iPhone la remonte à 0, on remonte l'écran affiché
    // puis on la replace. Le reste du temps (clavier refermé, etc.), elle reste exactement à cette place.
    const typing = () => document.activeElement?.matches?.('input, textarea');
    const top = () => {
      if (typing()) return;
      if (window.scrollY < 1) { toTopRef.current?.(); requestAnimationFrame(() => window.scrollTo(0, 1)); }
      else if (window.scrollY > 1) window.scrollTo(0, 1);
    };
    const out = () => setTimeout(top, 80);
    fit(); window.addEventListener('resize', fit); window.addEventListener('orientationchange', fit);
    window.addEventListener('scroll', top, { passive: true }); document.addEventListener('focusout', out);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('orientationchange', fit); window.removeEventListener('scroll', top); document.removeEventListener('focusout', out); };
  }, []);
  useEffect(() => {
    if (!code) return;
    // Safari colore la zone de l'heure avec theme-color (haut) et le dessous de sa barre avec le fond de la page (bas) :
    // les deux prennent la couleur de l'écran affiché, au lieu d'une bande noire
    // (les deux suivent aussi la couleur choisie dans les Réglages)
    const [top, bottom] = edgeColors(theme, cur);
    document.documentElement.style.backgroundColor = bottom;
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content');
    meta?.setAttribute('content', top);
    return () => { document.documentElement.style.backgroundColor = ''; if (meta && prev) meta.setAttribute('content', prev); };
  }, [cur, code, theme.id]); // eslint-disable-line
  // L'en-tête ne se floute que quand le contenu passe dessous
  useEffect(() => {
    const el = panes.current; if (!el) return;
    const f = (e) => { const t = e.target; if (t === el || !t.classList?.contains('bde-pane')) return; if (Number(t.dataset.i) === tab) app.current?.classList.toggle('scrolled', t.scrollTop > 4); };
    el.addEventListener('scroll', f, true);
    const cur = el.querySelector(`.bde-pane[data-i="${tab}"]`);
    app.current?.classList.toggle('scrolled', (cur?.scrollTop || 0) > 4);
    return () => el.removeEventListener('scroll', f, true);
  }, [tab, code]);
  // Réglages perso de la personne connectée (ordre, couleur, écran d'ouverture…)
  const [prefsReady, setPrefsReady] = useState(false);
  useEffect(() => { if (me) { setPrefsState(loadPrefs(me)); setPrefsReady(true); } else setPrefsReady(false); }, [me]);
  // À l'ouverture : l'écran choisi dans les Réglages (Inscrits au départ) ; si la fenêtre change de taille, on reste sur le même écran
  const startIdx = Math.max(0, kinds.indexOf(kinds.includes(prefs.start) ? prefs.start : 'ins'));
  const orderKey = kinds.join(',');
  const lastOrder = useRef(orderKey);
  useLayoutEffect(() => {
    const el = panes.current; if (!el || !prefsReady) return;
    lastOrder.current = orderKey;
    el.scrollLeft = startIdx * el.clientWidth; setTab(startIdx); app.current?.style.setProperty('--p', String(startIdx));
  }, [code, boot, prefsReady]); // eslint-disable-line
  // Ordre des onglets changé : on reste sur le même écran
  useLayoutEffect(() => {
    if (lastOrder.current === orderKey) return;
    const prev = lastOrder.current.split(',')[tab]; lastOrder.current = orderKey;
    const i = Math.max(0, kinds.indexOf(prev)); const el = panes.current; if (!el) return;
    el.scrollLeft = i * el.clientWidth; setTab(i); app.current?.style.setProperty('--p', String(i));
  }, [orderKey]); // eslint-disable-line
  // Aller à un écran par son nom (tuto)
  const goKind = useCallback((k) => { const el = panes.current; const i = kinds.indexOf(k); if (!el || i < 0) return; el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); }, [orderKey]); // eslint-disable-line
  useEffect(() => {
    if (!code || guest) return setHasMerch(false);
    fetch('/api/admin/merch', { headers: { 'x-staff-token': code }, cache: 'no-store' }).then((r) => r.json()).then((d) => setHasMerch((d.rows || []).length > 0)).catch(() => {});
  }, [code, guest]);
  // Tuto : une seule fois, à la première connexion de chacun
  useEffect(() => { if (!code || !me) return; let seen = true; try { seen = !!localStorage.getItem(tutoKey(me)); } catch {} if (!seen) setTimeout(() => setTuto(true), 900); }, [code, me]);
  const endTuto = () => { try { localStorage.setItem(tutoKey(me), '1'); } catch {} setTuto(false); };

  // Notifications (désactivées au départ, activables dans les Réglages) et pastille des demandes pour Jonas
  const toast = (title, text) => { const id = Date.now() + Math.random(); setToasts((t) => [...t.slice(-2), { id, title, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000); };
  const seen = useRef({});
  useEffect(() => {
    if (!code || guest) return;
    const H = { 'x-staff-token': code };
    const nf = prefs.notifs;
    const tick = async () => {
      const s = seen.current;
      try {
        const g = await fetch('/api/admin/reglages', { headers: H, cache: 'no-store' }).then((r) => r.json());
        if (g.role) setRgData(g);
        if (g.role === 'owner') setPendingN((g.requests || []).filter((r) => r.status === 'pending').length);
        // Gaspard : la réponse de Jonas s'affiche dès qu'elle arrive (une seule fois par demande)
        if (g.role === 'editor') {
          const k = `b31-dec-${me}`; let known = null;
          try { known = JSON.parse(localStorage.getItem(k) || 'null'); } catch {}
          const dec = (g.requests || []).filter((r) => r.status !== 'pending');
          if (known) dec.filter((r) => !known.includes(r.id)).forEach((r) => toast(r.status === 'done' ? 'Jonas a validé ta demande' : 'Jonas a refusé ta demande', r.summary));
          try { localStorage.setItem(k, JSON.stringify(dec.map((r) => r.id))); } catch {}
        }
      } catch {}
      if (pushOn) return;   // ce téléphone reçoit déjà les notifications du système
      if (nf.vente || nf.palier) try {
        const l = await fetch('/api/admin/list', { headers: H, cache: 'no-store' }).then((r) => r.json());
        const paid = (l.rows || []).filter((r) => r.status === 'paid').length;
        if (s.paid !== undefined && paid > s.paid) {
          if (nf.vente) toast(paid - s.paid > 1 ? `${paid - s.paid} nouvelles ventes` : 'Nouvelle vente', `${paid} billets vendus`);
          if (nf.palier && Math.floor(paid / 25) > Math.floor(s.paid / 25)) toast('Palier atteint', `${Math.floor(paid / 25) * 25} billets vendus`);
        }
        s.paid = paid;
      } catch {}
      if (nf.candidat) try {
        const c = await fetch('/api/admin/recrutement', { headers: H, cache: 'no-store' }).then((r) => r.json());
        const k = (c.rows || []).length;
        if (s.cand !== undefined && k > s.cand) toast('Nouveau candidat', `${k} entretiens réservés`);
        s.cand = k;
      } catch {}
      if (nf.concours) try {
        const c = await fetch('/api/admin/concours', { headers: H, cache: 'no-store' }).then((r) => r.json());
        const k = (c.rows || []).length;
        if (s.cc !== undefined && k > s.cc) toast('Inscription au concours', `${k} participants`);
        s.cc = k;
      } catch {}
    };
    tick(); const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [code, guest, prefs.notifs, pushOn]); // eslint-disable-line
  // Notifications appli fermée : le serveur suit les choix de ce téléphone
  useEffect(() => {
    if (!code || guest || !prefsReady) return;
    syncPush(code, prefs.notifs).then((x) => setPushOn(x?.state === 'on')).catch(() => {});
  }, [code, guest, prefsReady, JSON.stringify(prefs.notifs)]); // eslint-disable-line
  // Jonas : une demande de Gaspard s'affiche en bandeau dès l'ouverture, avec Valider et Refuser
  const pendingReqs = rgData?.role === 'owner' ? (rgData.requests || []).filter((r) => r.status === 'pending') : [];
  const reqKey = pendingReqs.map((r) => r.id).join(',');
  const decide = async (id, ok) => {
    setReqBusy(id + ok);
    try {
      const r = await fetch('/api/admin/reglages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify({ decide: id, ok }) });
      const x = await r.json().catch(() => ({}));
      toast(r.ok ? (ok ? 'Modification appliquée' : 'Demande refusée') : 'Échec', r.ok ? (pendingReqs.find((q) => q.id === id)?.summary || '') : (x.error || 'Réessaie.'));
      const g = await fetch('/api/admin/reglages', { headers: { 'x-staff-token': code }, cache: 'no-store' }).then((q) => q.json());
      if (g.role) { setRgData(g); setPendingN((g.requests || []).filter((q) => q.status === 'pending').length); }
    } catch { toast('Pas de réseau', 'Réessaie dans un instant.'); }
    setReqBusy('');
  };
  useEffect(() => {
    const f = () => { const el = panes.current; if (el) el.scrollLeft = Math.round(el.scrollLeft / el.clientWidth) * el.clientWidth; };
    window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  // Ordinateur : flèches gauche / droite du clavier pour changer d'écran
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (rgOpen || tuto || blOpen) return;
      if (e.key === 'ArrowRight' && tab < n - 1) go(tab + 1);
      if (e.key === 'ArrowLeft' && tab > 0) go(tab - 1);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  // Remonter tout en haut de l'écran affiché (chaque écran défile dans son propre cadre)
  const toTop = () => panes.current?.querySelector(`.bde-pane[data-i="${tab}"]`)?.scrollTo({ top: 0, behavior: 'smooth' });
  toTopRef.current = toTop;
  // Toucher le bandeau du haut (hors logo et boutons) ramène en haut
  const onHead = (e) => { if (!e.target.closest('a, button')) toTop(); };
  // Rien ne doit pouvoir être tiré ou rebondir hors des listes : la page elle-même ne défile plus
  useEffect(() => {
    if (!code) return;
    document.documentElement.classList.add('bde-lock');
    // appli de l'écran d'accueil : la page se place 1 pixel plus bas (voir « toucher l'heure » plus haut)
    if (document.documentElement.classList.contains('pwa')) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, 1)));
    return () => document.documentElement.classList.remove('bde-lock');
  }, [code]);

  if (boot) return <main className="bde-boot bdx" />;

  if (!code) return (
    <main className="bde-login bdx">
      <div className="bde-brand"><img src="/bde-logo.png" alt={EVENT.logoAlt} /><span>{EVENT.appName}</span></div>
      <h1 className="d">{EVENT.title}</h1>
      <form onSubmit={login}>
        <p className="who-l">Qui es-tu ?</p>
        <div className="who">
          {names.map((n) => <button type="button" key={n} className={who === n ? 'on' : ''} onClick={() => { setWho(n); setErr(''); }}>{n}</button>)}
        </div>
        {guestOn && <button type="button" className={`who-guest ${who === 'Invité' ? 'on' : ''}`} onClick={() => { setWho('Invité'); setErr(''); }}>Invité</button>}
        <div className="f"><label htmlFor="pw">Ton code à 6 chiffres</label>
          <input id="pw" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))} /></div>
        <p className="err" role="alert">{err}</p>
        <button className="cta" type="submit"><span>Entrer</span><span>→</span></button>
      </form>
      <p className="note">Chacun a son propre code. Ce téléphone restera connecté à ton nom : chaque scan, remboursement et renvoi est enregistré à ton nom.</p>
    </main>
  );

  const panel = (k) => ({
    scan: <ScanPanel code={code} active={cur === 'scan'} onScanned={() => setRefreshKey((x) => x + 1)} />,
    ins: <ListPanel code={code} guest={guest} active={cur === 'ins'} refreshKey={refreshKey} onAuthLost={logout} />,
    cc: <ConcoursPanel code={code} active={cur === 'cc'} onAuthLost={logout} />,
    rec: <RecrutementPanel code={code} active={cur === 'rec'} onAuthLost={logout} />,
    eq: <EquipePanel active={cur === 'eq'} />,
    merch: <MerchPanel code={code} active={cur === 'merch'} />,
  })[k];

  return (
    <main ref={app} className={`bde-app bdx on-${cur}${prefs.big ? ' big' : ''}${prefs.calm ? ' calm' : ''}`}
      style={{ '--n': n, '--acc-a': theme.a, '--acc-b': theme.b, '--acc-c': theme.c, '--acc-t': theme.t, '--acc-r': theme.r }}>
      <div className="bde-blur" aria-hidden><i /><i /><i /><i /><i /><i /></div>
      <header className="bde-head" onClick={onHead}>
        <a className="bde-home" href="/" aria-label="Aller à la billetterie"><img className="bde-logo" src="/bde-logo.png" alt={EVENT.logoAlt} /></a>
        <span className="bde-me"><b>{me}</b>
          {!guest && <button type="button" className="bde-gear" onClick={() => setBlOpen(true)} aria-label="Bilan">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 20V11M12 20V5M19 20v-6" /></svg>
          </button>}
          <button type="button" className="bde-gear" onClick={() => setRgOpen(true)} aria-label={`Réglages${pendingN ? `, ${pendingN} demande${pendingN > 1 ? 's' : ''} en attente` : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></svg>
            {pendingN > 0 && <em>{pendingN}</em>}
          </button>
        </span>
      </header>
      <div className="bde-panes" ref={panes} onScroll={onScroll}>
        {kinds.map((k, i) => (
          <section key={k} className={`bde-pane pane-${k}${tab === i ? ' on' : ''}`} data-i={i} aria-label={LABELS[k]}>
            <header className="pane-hero"><span className="ph-n">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span><h2>{LABELS[k]}</h2><span className="ph-s">{SUBS[k]}</span></header>
            {panel(k)}
          </section>
        ))}
      </div>
      <nav ref={nav} className={`bde-nav${press ? ' press' : ''}`} data-n={n} role="tablist"
        onPointerDown={onNavDown} onPointerMove={onNavMove} onPointerUp={onNavUp} onPointerCancel={() => { drag.current = null; setPress(false); if (panes.current) panes.current.style.scrollSnapType = ''; }}>
        <span className="nav-pill" aria-hidden><i /></span>
        {kinds.map((k, i) => (
          <button key={k} type="button" role="tab" aria-selected={tab === i} className={`k-${k}${tab === i ? ' on' : ''}`} onClick={(e) => { if (e.detail === 0) go(i); }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[k === 'merch' ? 5 : ALL_KINDS.indexOf(k)]}</svg>
            <span>{LABELS[k]}</span>
          </button>
        ))}
      </nav>
      {pendingReqs.length > 0 && reqHide !== reqKey && !rgOpen && !tuto && (
        <div className="bde-req" role="alert">
          <div className="bde-req-t"><span>{pendingReqs.length > 1 ? `${pendingReqs.length} demandes de ${pendingReqs[0].by_name}` : `Demande de ${pendingReqs[0].by_name}`}</span>
            <button type="button" className="bde-req-x" onClick={() => setReqHide(reqKey)} aria-label="Masquer"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
          <p>{pendingReqs[0].summary}</p>
          <div className="bde-req-b">
            <button type="button" className="ok" disabled={!!reqBusy} onClick={() => decide(pendingReqs[0].id, true)}>{reqBusy === pendingReqs[0].id + true ? '…' : 'Valider'}</button>
            <button type="button" disabled={!!reqBusy} onClick={() => decide(pendingReqs[0].id, false)}>{reqBusy === pendingReqs[0].id + false ? '…' : 'Refuser'}</button>
            {pendingReqs.length > 1 && <button type="button" onClick={() => setRgOpen(true)}>Tout voir</button>}
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="bde-toasts" aria-live="polite">
          {toasts.map((t) => <button key={t.id} type="button" className="bde-toast" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><b>{t.title}</b><span>{t.text}</span></button>)}
        </div>
      )}
      {rgOpen && <Reglages code={code} me={me} guest={guest} prefs={prefs} setPrefs={setPrefs} initial={rgData} onData={setRgData} onPush={setPushOn} onClose={() => setRgOpen(false)}
        onTuto={() => { setRgOpen(false); setTimeout(() => setTuto(true), 250); }} onLogout={() => { setRgOpen(false); logout(); }}
        onChanged={async () => { try { const g = await fetch('/api/admin/reglages', { headers: { 'x-staff-token': code }, cache: 'no-store' }).then((r) => r.json()); setPendingN((g.requests || []).filter((r) => r.status === 'pending').length * (g.role === 'owner' ? 1 : 0)); } catch {} }} />}
      {tuto && <Tuto guest={guest} goKind={goKind} onDone={endTuto} />}
      {blOpen && <Bilan code={code} onClose={() => setBlOpen(false)} />}
    </main>
  );
}

// Icônes de la barre du bas (trait, 24 px)
const ICONS = [
  <><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M7 12h10" /></>,
  <><path d="M9 7h11M9 12h11M9 17h11" /><circle cx="4.75" cy="7" r="1.25" /><circle cx="4.75" cy="12" r="1.25" /><circle cx="4.75" cy="17" r="1.25" /></>,
  <><path d="M3.5 8.5V6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v2a2.5 2.5 0 0 0 0 5v2A1.5 1.5 0 0 1 19 17H5a1.5 1.5 0 0 1-1.5-1.5v-2a2.5 2.5 0 0 0 0-5Z" /><path d="m12 8.4.95 1.95 2.15.3-1.55 1.5.37 2.13L12 13.27l-1.92 1.01.37-2.13-1.55-1.5 2.15-.3Z" /></>,
  <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 19.5c.6-3.4 3.2-5.5 6.5-5.5 1.3 0 2.5.3 3.5.9M18 14v6M15 17h6" /></>,
  <><circle cx="12" cy="12" r="3" /><circle cx="5" cy="5" r="1.75" /><circle cx="19" cy="5" r="1.75" /><circle cx="5" cy="19" r="1.75" /><circle cx="19" cy="19" r="1.75" /><path d="M6.3 6.3 9.9 9.9M17.7 6.3l-3.6 3.6M6.3 17.7l3.6-3.6M17.7 17.7l-3.6-3.6" /></>,
  <><path d="M8.5 3.5 4 6l1.6 4.2 2.4-.9V20.5h8V9.3l2.4.9L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0Z" /></>,
];
