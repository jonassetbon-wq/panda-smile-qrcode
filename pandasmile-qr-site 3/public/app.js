/* Espace ambassadeurs PandaSmile : connexion, QR code personnel, stats en direct (admin) */
(() => {
const KEY = 'ps-session';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Europe/Paris';
const hhmm = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const frDate = (d) => new Date(d).toLocaleString('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dayKey = (d) => new Date(d).toLocaleDateString('fr-CA', { timeZone: TZ });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const PROF_COLORS = { Dentiste: '#5fb8ff', Orthodontiste: '#7ed957', 'Chirurgien-dentiste': '#ffd166', Orthophoniste: '#ff9eb5', 'Kinésithérapeute': '#c49bff' };
const PROFS = Object.keys(PROF_COLORS);
const FIELD_NAMES = { prenom: 'Prénom', nom: 'Nom', profession: 'Profession', cabinet: 'Cabinet / société', adresse: 'Adresse', tel: 'Téléphone', email: 'E-mail', rgpd: 'Case RGPD' };

let session = null;
/* Catégorie affichée dans l'admin : journée de l'orthodontie (JO) ou webinaire (Webi). */
let CAT = 'jo';
try { CAT = localStorage.getItem('ps-cat') === 'webi' ? 'webi' : 'jo'; } catch {}
const W_COLORS = { ...PROF_COLORS, 'Kinésithérapeute maxillo-facial': '#c49bff' };
try { session = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}

/* ---------- Connexion ---------- */
let chosen = '';
async function showLogin() {
  $('#app').hidden = true; $('#login').hidden = false;
  const box = $('#who');
  try {
    const people = await fetch('/api/people').then((r) => r.json());
    box.innerHTML = people.map((p) => `<button type="button" role="radio" aria-checked="false" data-id="${esc(p.id)}" class="${p.id.startsWith('invite') ? 'guest' : ''}">${esc(p.label)}</button>`).join('');
  } catch { $('#login-err').textContent = 'Impossible de charger la liste. Vérifie ta connexion.'; }
}
$('#who').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  chosen = b.dataset.id;
  document.querySelectorAll('#who button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
  $('#login-err').textContent = ''; $('#pin').focus();
});
$('#pin').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-err'); err.textContent = '';
  if (!chosen) return (err.textContent = 'Choisis ton prénom.');
  const code = $('#pin').value;
  if (code.length !== 6) return (err.textContent = 'Le code fait 6 chiffres.');
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: chosen, code }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return (err.textContent = d.error || 'Code incorrect.');
    session = d;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
    $('#pin').value = '';
    showApp();
  } catch { err.textContent = 'Pas de connexion internet.'; }
});
$('#logout').addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch {} session = null; stopLive(); showLogin(); });

/* ---------- Application ---------- */
const panes = $('#panes');
let tabs = [];
let current = 0;
function showApp() {
  $('#login').hidden = true; $('#app').hidden = false;
  $('#me-name').textContent = session.label; $('#qr-name').textContent = session.label;
  const admin = !!session.admin;
  tabs = admin ? [['pane-qr', 'QR code'], ['pane-stats', 'Stats'], ['pane-leads', 'Inscrits'], ['pane-map', 'Carte']] : [['pane-qr', 'QR code']];
  ['pane-stats', 'pane-leads', 'pane-map'].forEach((id) => ($('#' + id).hidden = !admin));
  $('#tabs').hidden = !admin;
  $('#cat').hidden = !admin;
  setCat(CAT, true);
  $('#swipe-hint').hidden = !admin;
  $('#tabs').innerHTML = tabs.map(([, l], i) => `<button type="button" role="tab" data-i="${i}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('');
  drawQR();
  keepAwake();
  if (admin) startLive();
}
function setCat(c, quiet) {
  CAT = c;
  try { localStorage.setItem('ps-cat', c); } catch {}
  document.querySelectorAll('#cat button').forEach((b) => { b.classList.toggle('on', b.dataset.v === c); b.setAttribute('aria-checked', String(b.dataset.v === c)); });
  const w = c === 'webi';
  $('#webi-stats').hidden = !w; $('#jo-stats').hidden = w; $('#jo-selects').hidden = w;
  $('#q').placeholder = w ? 'Rechercher un nom, une profession, une ville…' : 'Rechercher un nom, un cabinet, une ville…';
  $('#reset-note').textContent = w ? 'Efface toutes les réponses au questionnaire du webinaire. Les stats de la journée de l’orthodontie ne changent pas.' : 'Efface tous les scans et tous les inscrits de la journée de l’orthodontie (par exemple après les essais). Le webinaire et les codes des ambassadeurs ne changent pas.';
  $('#export').textContent = w ? 'Exporter le webinaire en Excel' : 'Exporter tout en Excel';
  mapFitted = false;
  if (!quiet) render();
}
$('#cat').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.v !== CAT) setCat(b.dataset.v); });
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) panes.scrollTo({ left: +b.dataset.i * panes.clientWidth, behavior: 'smooth' }); });
panes.addEventListener('scroll', () => {
  const i = Math.round(panes.scrollLeft / panes.clientWidth);
  if (i === current) return;
  current = i;
  document.querySelectorAll('#tabs button').forEach((b, j) => b.classList.toggle('on', j === i));
  if (tabs[i]?.[0] === 'pane-map') initMap();
  if (tabs[i]?.[0] !== 'pane-qr') load();
}, { passive: true });

/* ---------- QR code ---------- */
function myUrl() { return `${location.origin}/s/${session.id}`; }
function drawQR() {
  const qr = qrcode(0, 'H'); qr.addData(myUrl()); qr.make();
  $('#qr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
  const svg = $('#qr svg'); svg.querySelectorAll('path').forEach((p) => p.setAttribute('fill', '#0b0f19'));
  $('#qr-url').textContent = myUrl().replace(/^https?:\/\//, '');
}
$('#copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(myUrl()); $('#copy').textContent = 'Copié'; setTimeout(() => ($('#copy').textContent = 'Copier'), 1500); } catch {}
});
let wake;
async function keepAwake() { try { wake = await navigator.wakeLock?.request('screen'); } catch {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && session) { keepAwake(); load(); } });

/* ---------- Données (admin) ---------- */
let DATA = null, timer = null, lastLoad = 0, loading = false;
function startLive() { load(); timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000); setInterval(tickLive, 1000); }
function stopLive() { clearInterval(timer); timer = null; DATA = null; }
function tickLive() {
  if (!lastLoad) return;
  const s = Math.round((Date.now() - lastLoad) / 1000);
  $('#live-txt').textContent = `En direct · mis à jour il y a ${s < 5 ? 'quelques secondes' : s + ' s'}`;
}
async function load() {
  if (!session?.admin || loading) return;
  loading = true;
  try {
    const r = await fetch('/api/admin/data', { headers: { Authorization: 'Bearer ' + session.token }, cache: 'no-store' });
    if (r.status === 401) { $('#logout').click(); return; }
    DATA = dedupe(await r.json());
    lastLoad = Date.now(); $('.dot').classList.remove('off');
    fillFilterOptions(); render();
  } catch { $('.dot').classList.add('off'); $('#live-txt').textContent = 'Hors ligne · nouvel essai dans 15 s'; }
  finally { loading = false; }
}
$('#refresh').addEventListener('click', load);

/* Doublons : un téléphone = un scan par ambassadeur ; un e-mail ou un téléphone = un inscrit (le plus récent). */
function dedupe(d) {
  const seen = new Set();
  d.scans = d.scans.sort((a, b) => a.t.localeCompare(b.t)).filter((s) => { const k = s.a + '|' + s.vid; if (seen.has(k)) return false; seen.add(k); return true; });
  const byKey = new Set();
  d.leads = d.leads.sort((a, b) => b.t.localeCompare(a.t)).filter((l) => {
    const keys = [l.email && 'e' + l.email.toLowerCase(), (l.tel || '').replace(/\D/g, '').length >= 9 && 't' + l.tel.replace(/\D/g, '').replace(/^33/, '0')].filter(Boolean);
    if (keys.some((k) => byKey.has(k))) return false;
    keys.forEach((k) => byKey.add(k)); return true;
  });
  return d;
}
const PATIENTS = { '<20': 'Moins de 20 / an', '20-50': '20 à 50 / an', '50-100': '50 à 100 / an', '100-200': '100 à 200 / an', '>200': 'Plus de 200 / an' };

/* ---------- Filtres ---------- */
const F = { period: 'today', amb: '', prof: '', dept: '' };
try { Object.assign(F, JSON.parse(localStorage.getItem('ps-filters') || '{}')); } catch {}
function saveF() { try { localStorage.setItem('ps-filters', JSON.stringify(F)); } catch {} }
document.querySelectorAll('#f-period button').forEach((b) => b.classList.toggle('on', b.dataset.v === F.period));
$('#f-period').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  F.period = b.dataset.v; saveF();
  document.querySelectorAll('#f-period button').forEach((x) => x.classList.toggle('on', x === b));
  render();
});
[['#f-amb', 'amb'], ['#f-prof', 'prof'], ['#f-dept', 'dept']].forEach(([s, k]) => $(s).addEventListener('change', (e) => { F[k] = e.target.value; saveF(); render(); }));
function fillFilterOptions() {
  const set = (sel, first, opts, val) => {
    const el = $(sel); const html = `<option value="">${first}</option>` + opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    if (el.dataset.sig !== html) { el.innerHTML = html; el.dataset.sig = html; }
    el.value = val;
  };
  set('#f-amb', 'Tous les ambassadeurs', DATA.people.map((p) => [p.id, p.label]), F.amb);
  set('#f-prof', 'Toutes professions', PROFS.map((p) => [p, p]), F.prof);
  const depts = [...new Map(DATA.leads.filter((l) => l.geo?.deptCode).map((l) => [l.geo.deptCode, `${l.geo.deptCode} · ${l.geo.deptName}`])).entries()].sort();
  set('#f-dept', 'Tous départements', depts, F.dept);
}
function since() {
  const now = Date.now();
  if (F.period === '24h') return now - 864e5;
  if (F.period === '7d') return now - 7 * 864e5;
  if (F.period === 'today') { const d = new Date(new Date().toLocaleString('en-US', { timeZone: TZ })); const off = Date.now() - d.getTime(); d.setHours(0, 0, 0, 0); return d.getTime() + off; }
  return 0;
}
function filtered() {
  const from = since();
  const inP = (x) => Date.parse(x.t) >= from;
  const inA = (x) => !F.amb || x.a === F.amb;
  const leads = DATA.leads.filter((l) => inP(l) && inA(l) && (!F.prof || l.profession === F.prof) && (!F.dept || l.geo?.deptCode === F.dept));
  // Profession et département ne concernent que les inscrits : les scans ne suivent que la période et l'ambassadeur.
  const scans = DATA.scans.filter((s) => inP(s) && inA(s));
  const events = DATA.events.filter((e) => inP(e) && inA(e));
  return { scans, events, leads };
}
const nameOf = (id) => DATA.people.find((p) => p.id === id)?.label || (id ? id : 'Sans ambassadeur');

/* ---------- Rendu ---------- */
let chart;
function render() {
  if (!DATA) return;
  if (CAT === 'webi') { renderWebi(); renderLeads(); renderMap(); return; }
  const { scans, events, leads } = filtered();
  const uniq = new Set(scans.map((s) => s.vid)).size;
  const starts = new Set(events.filter((e) => e.type === 'start').map((e) => e.s || e.id)).size;
  const durs = leads.map((l) => l.durationSec).filter((x) => Number.isFinite(x) && x < 3600);
  const avg = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : null;
  $('#kpis').innerHTML = [
    [scans.length, 'Scans'],
    [uniq, 'Personnes uniques'],
    [starts, 'Formulaires commencés'],
    [leads.length, 'Inscrits', 'hl'],
    [pct(leads.length, uniq) + ' %', 'Conversion (inscrits / personnes)'],
    [avg == null ? '–' : avg >= 60 ? `${Math.floor(avg / 60)} min ${String(avg % 60).padStart(2, '0')}`.replace(' min ', ' min\u00a0') : `${avg} s`, 'Temps moyen pour remplir'],
  ].map(([v, l, c]) => `<div class="kpi ${c || ''}"><b>${v}</b><span>${l}</span></div>`).join('');

  renderTime(scans, leads);
  renderFunnel(scans.length, uniq, starts, leads.length);
  renderAmb(scans, events, leads);
  bars('#b-prof', count(leads, (l) => l.profession), PROF_COLORS);
  bars('#b-dept', count(leads, (l) => (l.geo?.deptCode ? `${l.geo.deptCode} · ${l.geo.deptName}` : 'Adresse non reconnue')), null, 8);
  bars('#b-os', count(scans, (s) => s.os));
  bars('#b-pat', count(leads.filter((l) => l.patients), (l) => PATIENTS[l.patients]), null, 6, 'Pas encore de réponse.');
  const ab = events.filter((e) => e.type === 'abandon');
  bars('#b-ab', count(ab, (e) => FIELD_NAMES[e.field] || e.field || 'Inconnu'), null, 8, 'Aucun abandon pour l’instant.');
  bars('#b-city', count(scans, (s) => s.city || 'Inconnue'), null, 8);
  bars('#b-hour', count(scans, (s) => `${new Date(s.t).toLocaleString('fr-FR', { hour: '2-digit', hour12: false, timeZone: TZ }).replace(/\D/g, '')} h`), null, 8);
  renderFeed(scans, leads);
  renderLeads();
  renderMap();
}
function count(arr, fn) { const m = new Map(); arr.forEach((x) => { const k = fn(x); m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); }
function bars(sel, entries, colors, max = 10, empty = 'Rien pour l’instant.') {
  const el = $(sel);
  if (!entries.length) { el.innerHTML = `<p class="empty">${empty}</p>`; return; }
  const top = entries[0][1];
  el.innerHTML = entries.slice(0, max).map(([k, v]) => `<div class="bar"><span class="n" title="${esc(k)}">${esc(k)}</span><span class="t"><i style="width:${Math.max(3, (v / top) * 100)}%;${colors?.[k] ? `background:${colors[k]}` : ''}"></i></span><span class="v">${v}</span></div>`).join('');
}
function renderFunnel(sc, un, st, ld) {
  const steps = [['Scans', sc], ['Personnes uniques', un], ['Ont commencé', st], ['Inscrits', ld]];
  const top = Math.max(1, sc);
  $('#funnel').innerHTML = steps.map(([l, v], i) => `<div class="fstep"><span>${l}</span><span class="t"><i style="width:${Math.max(2, (v / top) * 100)}%"></i></span><span class="v">${v}${i ? ` <small>${pct(v, steps[i - 1][1])} %</small>` : ''}</span></div>`).join('');
}
function bucket15(t) { const d = new Date(t); d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0); return d.getTime(); }
function renderTime(scans, leads) {
  const box = $('#ch-time'), empty = $('#ch-empty');
  if (!window.Chart) { setTimeout(() => renderTime(scans, leads), 300); return; }
  if (!scans.length && !leads.length) { box.parentElement.hidden = true; empty.hidden = false; return; }
  box.parentElement.hidden = false; empty.hidden = true;
  const all = [...scans, ...leads].map((x) => Date.parse(x.t));
  let start = bucket15(Math.min(...all)), end = bucket15(Math.max(Date.now(), ...all));
  if (F.period === 'today' || F.period === '24h') end = bucket15(Date.now());
  let step = 15 * 60e3;
  while ((end - start) / step > 96) step *= 4; // au-delà de 24 h : regroupe par heure, puis par 4 h
  const keys = []; for (let t = start - ((start % step) % step); t <= end; t += step) keys.push(t);
  const idx = (t) => Math.min(keys.length - 1, Math.max(0, Math.floor((Date.parse(t) - keys[0]) / step)));
  const s = keys.map(() => 0), l = keys.map(() => 0);
  scans.forEach((x) => s[idx(x.t)]++); leads.forEach((x) => l[idx(x.t)]++);
  const multiDay = new Set(keys.map(dayKey)).size > 1;
  const labels = keys.map((t) => (multiDay ? frDate(t) : hhmm(t)));
  const cfg = {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Scans', data: s, backgroundColor: '#9aa6ff', borderRadius: 4 },
      { label: 'Inscrits', data: l, backgroundColor: '#7ed957', borderRadius: 4 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#a6b0c8', boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { title: (it) => `${labels[it[0].dataIndex]} · tranche de ${step / 60e3} min` } } },
      scales: {
        x: { ticks: { color: '#a6b0c8', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: '#a6b0c8', precision: 0 }, grid: { color: '#2a345466' } },
      },
    },
  };
  if (chart) { chart.data = cfg.data; chart.options = cfg.options; chart.update('none'); } else chart = new Chart(box, cfg);
}
function ambRows(scans, events, leads) {
  return DATA.people.map((p) => {
    const sc = scans.filter((s) => s.a === p.id);
    const ld = leads.filter((l) => l.a === p.id);
    const un = new Set(sc.map((s) => s.vid)).size;
    const st = new Set(events.filter((e) => e.a === p.id && e.type === 'start').map((e) => e.s || e.id)).size;
    const last = sc.reduce((m, s) => (s.t > m ? s.t : m), '');
    return { p, scans: sc.length, uniq: un, starts: st, leads: ld.length, conv: pct(ld.length, un), last };
  }).sort((a, b) => b.leads - a.leads || b.scans - a.scans || a.p.label.localeCompare(b.p.label, 'fr'));
}
function renderAmb(scans, events, leads) {
  const rows = ambRows(scans, events, leads);
  $('#t-amb').innerHTML = `<thead><tr><th>Ambassadeur</th><th>Scans</th><th>Uniques</th><th>Inscrits</th><th>Conv.</th><th>Dernier</th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr class="${r.scans || r.leads ? '' : 'zero'}"><td><span class="rank ${r.scans || r.leads ? 'r' + (i + 1) : ''}">${i + 1}</span>${esc(r.p.label)}</td><td>${r.scans}</td><td>${r.uniq}</td><td><b>${r.leads}</b></td><td>${r.uniq ? r.conv + ' %' : '–'}</td><td>${r.last ? hhmm(r.last) : '–'}</td></tr>`).join('') + '</tbody>';
}
function renderFeed(scans, leads) {
  const items = [...scans.map((s) => ({ t: s.t, a: s.a, txt: `${s.os}${s.city ? ' · ' + s.city : ''}`, kind: 'scan', firstVisit: s.firstVisit })),
    ...leads.map((l) => ({ t: l.t, a: l.a, txt: `${l.prenom} ${l.nom} · ${l.profession}`, kind: 'lead' }))]
    .sort((a, b) => b.t.localeCompare(a.t)).slice(0, 15);
  $('#feed').innerHTML = items.length ? items.map((x) => `<li><time>${hhmm(x.t)}</time><span><b>${esc(nameOf(x.a))}</b> · ${esc(x.txt)}</span><span class="tag ${x.kind === 'lead' ? 'ok' : ''}">${x.kind === 'lead' ? 'Inscrit' : x.firstVisit ? 'Nouveau scan' : 'Re-scan'}</span></li>`).join('') : '<li class="muted">Aucune activité sur cette période.</li>';
}

/* ---------- Liste des inscrits ---------- */
$('#q').addEventListener('input', renderLeads);
$('#sort').addEventListener('change', renderLeads);
function renderLeads() {
  if (!DATA) return;
  if (CAT === 'webi') return renderWebiLeads();
  const q = $('#q').value.trim().toLowerCase();
  let rows = filtered().leads.filter((l) => !q || [l.prenom, l.nom, l.cabinet, l.adresse, l.email, l.tel, l.geo?.city, l.profession, nameOf(l.a)].join(' ').toLowerCase().includes(q));
  const s = $('#sort').value;
  rows.sort(s === 'old' ? (a, b) => a.t.localeCompare(b.t) : s === 'name' ? (a, b) => a.nom.localeCompare(b.nom, 'fr') : s === 'dept' ? (a, b) => (a.geo?.deptCode || 'zz').localeCompare(b.geo?.deptCode || 'zz') : (a, b) => b.t.localeCompare(a.t));
  $('#leads-count').textContent = `${rows.length} inscrit${rows.length > 1 ? 's' : ''}${F.period !== 'all' ? ' sur la période' : ''}`;
  $('#leads').innerHTML = rows.length ? rows.map((l) => `<li><details class="lead"><summary><span class="pdot" style="background:${PROF_COLORS[l.profession] || '#888'}"></span><span class="nm">${esc(l.prenom)} ${esc(l.nom)}</span><span class="when">${frDate(l.t)}</span><span class="sub">${esc(l.profession)}${l.cabinet ? ' · ' + esc(l.cabinet) : ''}</span></summary>
    <dl><dt>Téléphone</dt><dd>${esc(l.tel)}</dd><dt>E-mail</dt><dd>${esc(l.email)}</dd><dt>Adresse</dt><dd>${esc(l.adresse)}</dd>${l.geo ? `<dt>Département</dt><dd>${esc(l.geo.deptCode)} · ${esc(l.geo.deptName)}, ${esc(l.geo.region)}</dd>` : ''}<dt>Patients EF par an</dt><dd>${l.patients ? PATIENTS[l.patients] : 'Non renseigné'}</dd><dt>Ambassadeur</dt><dd>${esc(nameOf(l.a))}</dd><dt>Rempli en</dt><dd>${Number.isFinite(l.durationSec) ? l.durationSec + ' s' : '–'}</dd></dl><button type="button" class="del" data-id="${esc(l.id)}" data-t="${esc(l.t)}">Supprimer cet inscrit</button></details></li>`).join('') : '<li class="muted">Aucun inscrit pour ces filtres.</li>';
}

/* Suppression : deux appuis pour confirmer (pas de fenêtre de confirmation du navigateur). */
function armed(btn, label) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1'; const old = btn.textContent; btn.textContent = label; btn.classList.add('armed');
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; btn.classList.remove('armed'); }, 4000);
  return false;
}
async function adminPost(body) {
  const r = await fetch('/api/admin/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token }, body: JSON.stringify(body) });
  return r.ok;
}
$('#leads').addEventListener('click', async (e) => {
  const wb = e.target.closest('.del-webi');
  if (wb) {
    if (!armed(wb, 'Appuie encore pour supprimer définitivement')) return;
    wb.disabled = true; wb.textContent = 'Suppression…';
    if (await adminPost({ webiId: wb.dataset.id, t: wb.dataset.t })) { DATA.webi = DATA.webi.filter((x) => x.id !== wb.dataset.id); render(); load(); }
    else { wb.disabled = false; wb.textContent = 'Échec, réessaie'; }
    return;
  }
  const b = e.target.closest('.del'); if (!b) return;
  if (!armed(b, 'Appuie encore pour supprimer définitivement')) return;
  b.disabled = true; b.textContent = 'Suppression…';
  if (await adminPost({ id: b.dataset.id, t: b.dataset.t })) { DATA.leads = DATA.leads.filter((l) => l.id !== b.dataset.id); render(); load(); }
  else { b.disabled = false; b.textContent = 'Échec, réessaie'; }
});
$('#reset').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  if (!armed(b, 'Appuie encore : tout sera effacé')) return;
  b.disabled = true; b.textContent = 'Effacement…';
  const ok = await adminPost({ reset: true, cat: CAT });
  b.disabled = false; b.textContent = ok ? 'Stats remises à zéro ✓' : 'Échec, réessaie';
  setTimeout(() => (b.textContent = 'Remettre les stats à zéro'), 3000);
  load();
});

/* ---------- Carte ----------
   Dézoomé : un cercle par département (zoom ≤ 7) ou par ville (zoom 8 à 10), taille proportionnelle au nombre d'inscrits.
   Zoomé (≥ 11) : un point par cabinet, coloré selon la profession. */
let map, layer, mapFitted = false;
function initMap() {
  if (map || !window.L) { if (!window.L) setTimeout(initMap, 300); return; }
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView([46.6, 2.4], 6);
  // Fond de carte OpenStreetMap : gratuit, sans clé ni compte. Passé en gris clair par CSS (.tiles-grey).
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'tiles-grey', attribution: '© les contributeurs OpenStreetMap' }).addTo(map);
  layer = L.layerGroup().addTo(map);
  map.on('zoomend', () => renderMap());
  renderMap(true);
}
function groupLeads(leads, level) {
  const m = new Map();
  leads.forEach((l) => {
    const k = level === 'dept' ? l.geo.deptCode || '?' : `${l.geo.postcode}|${l.geo.city}`;
    if (!m.has(k)) m.set(k, { label: level === 'dept' ? `${l.geo.deptCode} · ${l.geo.deptName}` : `${l.geo.city} (${l.geo.postcode})`, items: [] });
    m.get(k).items.push(l);
  });
  return [...m.values()];
}
function renderMap(fit) {
  if (!map || !DATA) return;
  setTimeout(() => map.invalidateSize(), 50);
  layer.clearLayers();
  const leads = mapItems().filter((l) => l.geo?.lat);
  const COL = CAT === 'webi' ? W_COLORS : PROF_COLORS;
  const z = map.getZoom();
  const level = z <= 7 ? 'dept' : z <= 10 ? 'city' : 'point';
  if (level === 'point') {
    leads.forEach((l) => {
      L.circleMarker([l.geo.lat, l.geo.lon], { radius: 8, color: '#0b0f19', weight: 2, fillColor: COL[l.profession] || '#fff', fillOpacity: 0.95 })
        .bindPopup(`<b>${esc(l.prenom)} ${esc(l.nom)}</b><br>${esc(l.profession)}<br>${l.cabinet ? esc(l.cabinet) + '<br>' : ''}${esc(l.geo.label || l.adresse)}<br><small>${l.src ? esc(l.src) : 'Ambassadeur : ' + esc(nameOf(l.a))}</small>`)
        .addTo(layer);
    });
    const profs = CAT === 'webi' ? [...new Set(leads.map((l) => l.profession))] : PROFS;
    $('#legend').innerHTML = `<b>${CAT === 'webi' ? 'Webinaire · un point par répondant' : 'Un point par cabinet'}</b>` + profs.map((p) => `<span><i style="background:${COL[p] || '#888'}"></i>${esc(p)}</span>`).join('');
  } else {
    // Regroupe les cercles qui se chevauchent à l'écran : un seul cercle avec le total de la zone.
    let groups = groupLeads(leads, level).map((g) => ({ ...g, labels: [g.label] }));
    let max = Math.max(1, ...groups.map((g) => g.items.length));
    let rad = (n) => 9 + 34 * Math.sqrt(n / max); // surface proportionnelle au nombre d'inscrits
    const center = (g) => { const n = g.items.length; return [g.items.reduce((s, l) => s + l.geo.lat, 0) / n, g.items.reduce((s, l) => s + l.geo.lon, 0) / n]; };
    for (let pass = 0; pass < 6; pass++) {
      let merged = false;
      groups.sort((x, y) => y.items.length - x.items.length);
      const out = [];
      for (const g of groups) {
        const pg = map.latLngToContainerPoint(center(g));
        const host = out.find((h) => map.latLngToContainerPoint(center(h)).distanceTo(pg) < rad(h.items.length) + rad(g.items.length) + 2);
        if (host) { host.items.push(...g.items); host.labels.push(...g.labels); merged = true; }
        else out.push({ ...g, items: [...g.items], labels: g.labels || [g.label] });
      }
      groups = out.map((g) => ({ ...g, labels: g.labels || [g.label] }));
      max = Math.max(1, ...groups.map((g) => g.items.length));
      if (!merged) break;
    }
    groups.forEach((g) => { g.label = g.labels.length > 1 ? `Zone : ${g.labels.slice(0, 4).join(', ')}${g.labels.length > 4 ? '…' : ''}` : g.labels[0]; });
    groups.sort((a, b) => b.items.length - a.items.length).forEach((g) => {
      const n = g.items.length;
      const [lat, lon] = center(g);
      const byProf = count(g.items, (l) => l.profession).map(([p, v]) => `<span style="color:${COL[p] || '#888'}">●</span> ${esc(p)} : <b>${v}</b>`).join('<br>');
      L.circleMarker([lat, lon], { radius: rad(n), color: '#ffffff', weight: 1.5, fillColor: '#e5484d', fillOpacity: 0.78 })
        .bindTooltip(String(n), { permanent: true, direction: 'center', className: 'cnt' })
        .bindPopup(`<b>${esc(g.label)}</b><br>${n} ${CAT === 'webi' ? 'répondant' : 'inscrit'}${n > 1 ? 's' : ''}<br>${byProf}`)
        .addTo(layer);
    });
    const steps = [...new Set([max, Math.ceil(max / 2), 1])].filter((v) => v > 0);
    $('#legend').innerHTML = `<b>${CAT === 'webi' ? 'Webinaire · répondants' : 'Inscrits'} par zone${level === 'dept' ? ' (départements)' : ' (villes)'}</b>` +
      steps.map((v) => `<span><i style="width:${Math.round(rad(v) * 1.1)}px;height:${Math.round(rad(v) * 1.1)}px;background:#e5484dc7;border:1px solid #fff"></i>${v}</span>`).join('') +
      '<small>Zoome pour le détail</small>';
  }
  if ((fit || !mapFitted) && leads.length) { mapFitted = true; map.fitBounds(leads.map((l) => [l.geo.lat, l.geo.lon]), { padding: [40, 40], maxZoom: 7 }); }
}

/* ---------- Export Excel ---------- */
$('#export').addEventListener('click', () => {
  if (!DATA || !window.XLSX) return;
  if (CAT === 'webi') return exportWebi();
  const { scans, events, leads } = filtered();
  const wb = XLSX.utils.book_new();
  const add = (name, rows, widths) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucune donnée' }]); if (rows.length) ws['!autofilter'] = { ref: ws['!ref'] }; if (widths) ws['!cols'] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
  const dt = (t) => new Date(t).toLocaleString('fr-FR', { timeZone: TZ });
  add('Inscrits', leads.map((l) => ({ 'Date et heure': dt(l.t), Ambassadeur: nameOf(l.a), Prénom: l.prenom, Nom: l.nom, Profession: l.profession, 'Cabinet / société': l.cabinet, Adresse: l.adresse, 'Code postal': l.geo?.postcode || '', Ville: l.geo?.city || '', Département: l.geo ? `${l.geo.deptCode} ${l.geo.deptName}` : '', Région: l.geo?.region || '', Téléphone: l.tel, 'E-mail': l.email, 'Patients en éducation fonctionnelle par an': l.patients ? PATIENTS[l.patients] : '', 'Rempli en (s)': l.durationSec ?? '', Latitude: l.geo?.lat ?? '', Longitude: l.geo?.lon ?? '' })), [18, 14, 14, 16, 18, 26, 40, 10, 16, 20, 22, 15, 28, 12, 10, 10]);
  add('Scans', scans.map((s) => ({ 'Date et heure': dt(s.t), Ambassadeur: nameOf(s.a), 'Visiteur (anonyme)': s.vid.slice(0, 8), 'Premier scan de ce téléphone': s.firstVisit ? 'Oui' : 'Non', Système: s.os, Navigateur: s.browser, Appareil: s.device, Langue: s.lang, 'Ville approx.': s.city, Région: s.region, Pays: s.country })), [18, 14, 14, 12, 10, 10, 10, 8, 16, 18, 6]);
  // Par 15 minutes
  const m = new Map();
  const slot = (t) => { const k = bucket15(t); if (!m.has(k)) m.set(k, { s: 0, u: new Set(), l: 0 }); return m.get(k); };
  scans.forEach((s) => { const b = slot(s.t); b.s++; b.u.add(s.vid); }); leads.forEach((l) => slot(l.t).l++);
  add('Par 15 minutes', [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ Jour: new Date(k).toLocaleDateString('fr-FR', { timeZone: TZ }), Début: hhmm(k), Fin: hhmm(k + 15 * 60e3), Scans: v.s, 'Personnes uniques': v.u.size, Inscrits: v.l })), [12, 8, 8, 8, 16, 9]);
  add('Par ambassadeur', ambRows(scans, events, leads).map((r, i) => ({ Rang: i + 1, Ambassadeur: r.p.label, 'Nom complet': r.p.fullName, Scans: r.scans, 'Personnes uniques': r.uniq, 'Formulaires commencés': r.starts, Inscrits: r.leads, 'Conversion (%)': r.uniq ? r.conv : '', 'Dernier scan': r.last ? dt(r.last) : '' })), [6, 14, 22, 8, 16, 20, 9, 13, 18]);
  const cross = PROFS.map((p) => { const row = { Profession: p, Total: leads.filter((l) => l.profession === p).length }; DATA.people.forEach((a) => (row[a.label] = leads.filter((l) => l.profession === p && l.a === a.id).length)); return row; });
  add('Par profession', cross);
  add('Par département', count(leads, (l) => (l.geo ? `${l.geo.deptCode} ${l.geo.deptName}` : 'Non reconnu')).map(([k, v]) => ({ Département: k, Inscrits: v })), [28, 9]);
  add('Abandons', events.filter((e) => e.type === 'abandon').map((e) => ({ 'Date et heure': dt(e.t), Ambassadeur: nameOf(e.a), 'Dernier champ touché': FIELD_NAMES[e.field] || e.field, 'Champs remplis': e.filled ?? '' })), [18, 14, 20, 14]);
  const stamp = new Date().toLocaleString('fr-FR', { timeZone: TZ }).replace(/[/:]/g, '-').replace(/\s/g, '_');
  XLSX.writeFile(wb, `PandaSmile_stats_${stamp}.xlsx`);
});

/* ---------- Webinaire ---------- */
const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const att = (id) => (DATA.webinar?.attendees || []).find((a) => a.id === id);
function webiFiltered() {
  const from = since();
  const inP = (x) => Date.parse(x.t) >= from;
  return { answers: (DATA.webi || []).filter(inP).sort((a, b) => b.t.localeCompare(a.t)), events: (DATA.webiEvents || []).filter(inP) };
}
function mapItems() {
  if (CAT !== 'webi') return filtered().leads;
  return webiFiltered().answers.map((r) => ({ prenom: r.name, nom: '', profession: r.profession, cabinet: '', geo: r.geo, adresse: r.postcode, a: '', src: 'Webinaire · note ' + r.rating + '/5' }));
}
const fixed = (arr, fn, order) => { const c = new Map(count(arr, fn)); const extra = [...c.keys()].filter((k) => !order.includes(k)); return [...order, ...extra].map((k) => [k, c.get(k) || 0]).filter(([k, v]) => v || order.includes(k)); };
function renderWebi() {
  const { answers, events } = webiFiltered();
  const total = (DATA.webinar?.attendees || []).length;
  const listed = answers.filter((r) => r.listed).length;
  const avg = answers.length ? (answers.reduce((s, r) => s + r.rating, 0) / answers.length).toFixed(1).replace('.', ',') : '–';
  const refs = answers.filter((r) => r.referral).length;
  const sess = (t) => new Set(events.filter((e) => e.type === t).map((e) => e.s || e.id)).size;
  const promo = new Set(events.filter((e) => e.type === 'copy' || e.type === 'open').map((e) => e.s || e.id)).size;
  $('#w-kpis').innerHTML = [
    [`${listed} / ${total}`, 'Inscrits qui ont répondu'],
    [pct(listed, total) + ' %', 'Taux de réponse'],
    [avg + (answers.length ? ' / 5' : ''), 'Note moyenne', 'hl'],
    [answers.filter((r) => r.tryApp === 'Oui, dès maintenant').length, 'Veulent essayer PandaSmile'],
    [refs, 'Confrères recommandés'],
    [promo, 'Codes promo copiés ou ouverts'],
  ].map(([v, l, c]) => `<div class="kpi ${c || ''}"><b>${v}</b><span>${l}</span></div>`).join('');
  const steps = [['Page ouverte', sess('view')], ['Nom choisi', sess('pick')], ['Questionnaire envoyé', answers.length], ['Code promo copié', promo]];
  const top = Math.max(1, ...steps.map((x) => x[1]));
  $('#w-funnel').innerHTML = steps.map(([l, v], i) => `<div class="fstep"><span>${l}</span><span class="t"><i style="width:${Math.max(2, (v / top) * 100)}%"></i></span><span class="v">${v}${i && steps[i - 1][1] ? ` <small>${pct(v, steps[i - 1][1])} %</small>` : ''}</span></div>`).join('');
  bars('#w-rating', [5, 4, 3, 2, 1].map((n) => [STARS(n), answers.filter((r) => r.rating === n).length]), null, 5, 'Pas encore de réponse.');
  bars('#w-learned', fixed(answers, (r) => r.learned, ['Énormément', 'Beaucoup', 'Un peu']), null, 5, 'Pas encore de réponse.');
  bars('#w-try', fixed(answers, (r) => r.tryApp, ['Oui, dès maintenant', "Je veux d'abord en savoir plus", "Pas pour l'instant"]), { 'Oui, dès maintenant': '#7ed957', "Je veux d'abord en savoir plus": '#ffd166', "Pas pour l'instant": '#a6b0c8' }, 5, 'Pas encore de réponse.');
  bars('#w-prof', count(answers, (r) => r.profession), W_COLORS, 8, 'Pas encore de réponse.');
  bars('#w-source', count(answers, (r) => (r.source === 'Autre' ? 'Autre : ' + r.sourceOther : r.source)), null, 10, 'Pas encore de réponse.');
  bars('#w-length', fixed(answers.filter((r) => r.length), (r) => r.length, ['Trop courte', 'Parfaite', 'Trop longue']), null, 5, 'Pas encore de réponse.');
  bars('#w-dept', count(answers, (r) => (r.geo?.deptCode ? `${r.geo.deptCode} · ${r.geo.deptName}` : 'Code postal ' + r.postcode)), null, 8, 'Pas encore de réponse.');
  const lst = (sel, key, empty) => { const xs = answers.filter((r) => r[key]); $(sel).innerHTML = xs.length ? xs.map((r) => `<li><span><b>${esc(r.name)}</b> · ${esc(r[key])}</span></li>`).join('') : `<li class="muted">${empty}</li>`; };
  lst('#w-topics', 'topic', 'Aucun sujet proposé pour l’instant.');
  lst('#w-msgs', 'message', 'Aucun message pour l’instant.');
  const done = new Set((DATA.webi || []).map((r) => r.attendee));
  const miss = (DATA.webinar?.attendees || []).filter((a) => !done.has(a.id));
  $('#w-missing').innerHTML = miss.length ? miss.map((a) => `<span>${esc(a.name)}</span>`).join('') : '<p class="empty">Tout le monde a répondu.</p>';
}
function renderWebiLeads() {
  const q = $('#q').value.trim().toLowerCase();
  let rows = webiFiltered().answers.filter((r) => !q || [r.name, r.email, r.profession, r.geo?.city, r.postcode, r.source, r.referral?.email].join(' ').toLowerCase().includes(q));
  const s = $('#sort').value;
  rows.sort(s === 'old' ? (a, b) => a.t.localeCompare(b.t) : s === 'name' ? (a, b) => a.name.localeCompare(b.name, 'fr') : s === 'dept' ? (a, b) => (a.geo?.deptCode || 'zz').localeCompare(b.geo?.deptCode || 'zz') : (a, b) => b.t.localeCompare(a.t));
  $('#leads-count').textContent = `${rows.length} réponse${rows.length > 1 ? 's' : ''} au webinaire${F.period !== 'all' ? ' sur la période' : ''}`;
  const dd = (k, v) => (v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '');
  const items = rows.map((r) => `<li><details class="lead"><summary><span class="pdot" style="background:${W_COLORS[r.profession] || '#888'}"></span><span class="nm">${esc(r.name)}</span><span class="when">${frDate(r.t)}</span><span class="sub"><span class="stars-s">${STARS(r.rating)}</span> · ${esc(r.profession)}${r.geo?.city ? ' · ' + esc(r.geo.city) : ''}${r.referral ? ' · 1 confrère recommandé' : ''}</span></summary>
    <dl>${dd('E-mail', r.email)}${dd('Note', r.rating + ' / 5')}${dd('A appris', r.learned)}${dd('Durée', r.length)}${dd('PandaSmile', r.tryApp)}${dd('Connu par', r.source === 'Autre' ? 'Autre : ' + r.sourceOther : r.source)}${dd('Cabinet', r.geo ? `${r.geo.city} (${r.postcode}) · ${r.geo.deptName}` : r.postcode)}${dd('Sujet proposé', r.topic)}${dd('Message', r.message)}${r.referral ? dd('Confrère recommandé', [r.referral.prenom, r.referral.email, r.referral.profession].filter(Boolean).join(' · ')) : ''}${r.listed ? '' : dd('Liste', 'Absent de la liste des inscrits')}${dd('Rempli en', Number.isFinite(r.durationSec) ? r.durationSec + ' s' : '')}</dl>
    <button type="button" class="del del-webi" data-id="${esc(r.id)}" data-t="${esc(r.t)}">Supprimer cette réponse</button></details></li>`);
  const refs = rows.filter((r) => r.referral);
  const extra = refs.length ? `<li><p class="sec-title">Confrères recommandés (${refs.length})</p></li>` + refs.map((r) => `<li><details class="lead"><summary><span class="pdot" style="background:#ffd166"></span><span class="nm">${esc(r.referral.prenom || r.referral.email)}</span><span class="when">${frDate(r.referral.t || r.t)}</span><span class="sub">${esc(r.referral.email)}${r.referral.profession ? ' · ' + esc(r.referral.profession) : ''} · recommandé par ${esc(r.name)}</span></summary></details></li>`).join('') : '';
  $('#leads').innerHTML = items.length ? items.join('') + extra : '<li class="muted">Aucune réponse au questionnaire pour l’instant.</li>';
}
function exportWebi() {
  const { answers } = webiFiltered();
  const wb = XLSX.utils.book_new();
  const add = (name, rows, widths) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucune donnée' }]); if (rows.length) ws['!autofilter'] = { ref: ws['!ref'] }; if (widths) ws['!cols'] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
  const dt = (t) => new Date(t).toLocaleString('fr-FR', { timeZone: TZ });
  add('Réponses', answers.map((r) => ({ 'Date et heure': dt(r.t), Nom: r.name, 'E-mail': r.email, 'Dans la liste': r.listed ? 'Oui' : 'Non', Note: r.rating, 'A appris': r.learned, Durée: r.length, 'Essayer PandaSmile': r.tryApp, Profession: r.profession, 'Connu par': r.source === 'Autre' ? 'Autre : ' + r.sourceOther : r.source, 'Code postal': r.postcode, Ville: r.geo?.city || '', Département: r.geo ? `${r.geo.deptCode} ${r.geo.deptName}` : '', 'Sujet proposé': r.topic, Message: r.message, 'Confrère : prénom': r.referral?.prenom || '', 'Confrère : e-mail': r.referral?.email || '', 'Confrère : profession': r.referral?.profession || '', 'Rempli en (s)': r.durationSec ?? '' })), [18, 22, 28, 8, 6, 14, 12, 26, 18, 18, 8, 16, 20, 30, 30, 14, 26, 18, 10]);
  const done = new Set((DATA.webi || []).map((r) => r.attendee));
  add('Pas encore répondu', (DATA.webinar?.attendees || []).filter((a) => !done.has(a.id)).map((a) => ({ Nom: a.name, 'E-mail': a.email })), [24, 32]);
  add('Confrères recommandés', answers.filter((r) => r.referral).map((r) => ({ Prénom: r.referral.prenom, 'E-mail': r.referral.email, Profession: r.referral.profession, 'Recommandé par': r.name, Date: dt(r.referral.t || r.t) })), [14, 30, 22, 22, 18]);
  add('Synthèse', [
    ...[5, 4, 3, 2, 1].map((n) => ({ Question: 'Note', Réponse: n + ' / 5', Nombre: answers.filter((r) => r.rating === n).length })),
    ...count(answers, (r) => r.learned).map(([k, v]) => ({ Question: 'A appris', Réponse: k, Nombre: v })),
    ...count(answers, (r) => r.tryApp).map(([k, v]) => ({ Question: 'Essayer PandaSmile', Réponse: k, Nombre: v })),
    ...count(answers, (r) => r.profession).map(([k, v]) => ({ Question: 'Profession', Réponse: k, Nombre: v })),
    ...count(answers, (r) => (r.source === 'Autre' ? 'Autre : ' + r.sourceOther : r.source)).map(([k, v]) => ({ Question: 'Connu par', Réponse: k, Nombre: v })),
  ], [22, 36, 9]);
  const stamp = new Date().toLocaleString('fr-FR', { timeZone: TZ }).replace(/[/:]/g, '-').replace(/\s/g, '_');
  XLSX.writeFile(wb, `PandaSmile_webinaire_${stamp}.xlsx`);
}

/* ---------- Démarrage ---------- */
if (session?.token) showApp(); else showLogin();
})();
