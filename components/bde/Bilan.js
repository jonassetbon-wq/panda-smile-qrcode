'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const eur = (n) => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const nb = (n) => Number(n).toLocaleString('fr-FR');
const DAYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const SRC = { direct: 'Accès direct', instagram: 'Instagram', facebook: 'Facebook', google: 'Google', stripe: 'Retour Stripe', mail: 'Mail', qr: 'QR code', insta: 'Instagram (lien)', tiktok: 'TikTok' };
const PAGE = { '/': 'Billetterie', '/concours': 'Concours', '/recrutement': 'Recrutement', '/merci': 'Merci (achat)', '/atelier': 'Atelier' };

// Bilan : un résumé recalculé à chaque ouverture, et un résumé approfondi façon bilan Back to Reality
export default function Bilan({ code, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState({});   // barre touchée dans chaque graphique

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/bilan', { headers: { 'x-staff-token': code }, cache: 'no-store' });
      if (!r.ok) throw new Error();
      setD(await r.json());
    } catch { setErr('Bilan indisponible. Vérifie le réseau.'); }
    setBusy(false);
  }, [code]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  // Graphique en bâtons : la légende dit ce que mesure la hauteur ; toucher un bâton le met en avant (les autres passent en gris)
  // et affiche sa valeur exacte ; toucher encore (ou ailleurs dans le graphique) revient à la vue d'ensemble
  const Chart = ({ id, data, labels, full, legend, unit }) => {
    const m = Math.max(1, ...data), sel = pick[id];
    const u = (v) => `${nb(v)} ${v > 1 ? unit[1] : unit[0]}`;
    const tap = (i) => setPick((p) => ({ ...p, [id]: p[id] === i ? undefined : i }));
    return (
      <div className="bl-chart">
        <p className="bl-leg"><span><i aria-hidden />{legend}</span>
          <em>{sel != null ? <><b>{full[sel]}</b> : {u(data[sel])}</> : 'Touche une barre pour le détail'}</em></p>
        <div className={`bl-bars${sel != null ? ' has-sel' : ''}`} style={{ '--n': data.length }} onClick={(e) => { if (e.target === e.currentTarget) setPick((p) => ({ ...p, [id]: undefined })); }}>
          {data.map((v, i) => (
            <button type="button" key={i} className={`bl-bar${sel === i ? ' sel' : ''}`} onClick={() => tap(i)} aria-label={`${full[i]} : ${u(v)}`} aria-pressed={sel === i}>
              <i style={{ height: `${Math.max(2, (v / m) * 100)}%` }} /><b>{v || ''}</b>{labels && <span>{labels[i]}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  };
  const Row = ({ l, v, sub }) => <div className="bl-row"><span>{l}</span><b>{v}</b>{sub && <small>{sub}</small>}</div>;
  const Cmp = ({ l, a, b }) => <div className="bl-cmp"><span>{l}</span><b>{a}</b><em>{b}</em></div>;

  const host = typeof document !== 'undefined' ? document.querySelector('.bde-app') || document.body : null;
  const s = d?.sales;
  const dayLabel = (k) => { const x = new Date(k + 'T12:00:00'); return `${DAYS[x.getDay()]} ${x.getDate()}`; };
  const dayFull = (k) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const bil = (n) => `${nb(n)} billet${n > 1 ? 's' : ''}`;
  const BILLET = ['billet vendu', 'billets vendus'], VISITE = ['visite', 'visites'], ENTREE = ['entrée', 'entrées'];
  const YEARS = [['P1', 'P1 (1re année)'], ['2', '2e année'], ['3', '3e année'], ['4', '4e année'], ['5', '5e année'], ['EXT', 'Extérieurs']];
  const quarterEnd = (k) => { const [h, m] = k.split('h').map(Number); const t = h * 60 + m + 15; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}h${String(t % 60).padStart(2, '0')}`; };
  const peak = d?.night.quarters.reduce((a, q) => (q[1] > (a?.[1] || 0) ? q : a), null);

  const ui = (
    <div className="rg bl" role="dialog" aria-modal="true" aria-label="Bilan">
      <div className="rg-in">
        <div className="rg-head">
          <h2>Bilan<small>{d ? `à ${new Date(d.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}` : ''}</small></h2>
          <div className="rg-hb">
            <button type="button" className={`rg-ico${busy ? ' spin' : ''}`} onClick={load} aria-label="Actualiser"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" /></svg></button>
            <button type="button" className="rg-ico" onClick={onClose} aria-label="Fermer"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          </div>
        </div>
        {err && <p className="rg-msg">{err}</p>}
        {!d && !err && <p className="rg-me">Calcul du bilan…</p>}

        {d && (<>
          {/* ── Résumé ── */}
          <section className="bl-hero">
            <span className="bl-k">Billets vendus</span>
            <b className="bl-big">{nb(s.sold)}<small> / {nb(s.capacity)} places</small></b>
            <span className="bl-bar1"><i style={{ width: `${Math.min(100, s.fill)}%` }} /></span>
            <span className="bl-sub">{s.fill} % des places vendues · {s.today > 0 ? `${s.today} billet${s.today > 1 ? 's' : ''} vendu${s.today > 1 ? 's' : ''} aujourd'hui` : "aucun billet vendu aujourd'hui"}</span>
          </section>
          <div className="bl-kpis">
            <div><span>Encaissé, billets et frais</span><b>{eur(d.money.gross)}</b></div>
            <div><span>{d.event.started ? 'Personnes entrées' : 'Visiteurs du site'}</span><b>{d.event.started ? nb(d.night.inside) : d.site ? nb(d.site.unique) : '…'}</b></div>
            <div><span>{d.event.started ? 'Billets utilisés' : 'Visiteurs qui achètent'}</span><b>{d.event.started ? `${d.night.presence} %` : d.site?.conv != null ? `${d.site.conv} %` : 'trop tôt'}</b></div>
          </div>
          <section className="rg-sec">
            <h3>Billets vendus par jour<small>Depuis l'ouverture de la billetterie, {s.days.length} jour{s.days.length > 1 ? 's' : ''} de vente</small></h3>
            <Chart id="days" data={s.days.map((x) => x.n)} labels={s.days.map((x) => dayLabel(x.d))} full={s.days.map((x) => dayFull(x.d))} legend="Hauteur : billets vendus ce jour-là" unit={BILLET} />
          </section>
          <section className="rg-sec">
            <h3>Face à Back to Reality<small>{d.btr.when}</small></h3>
            <div className="bl-cmph"><span /><b>Afterwork</b><em>BTR</em></div>
            <Cmp l="Billets vendus au même jour de vente" a={nb(s.sold)} b={`≈ ${nb(d.btr.sameDay)}`} />
            <Cmp l="Billets vendus le 1er jour" a={nb(s.firstDay)} b={nb(d.btr.firstDay)} />
            <Cmp l="Billets vendus au total" a={nb(s.sold)} b={nb(d.btr.sold)} />
            <Cmp l="Encaissé" a={eur(Math.round(d.money.gross))} b={eur(d.btr.gross)} />
          </section>
          {d.site && d.site.sources.length > 0 && (
            <section className="rg-sec">
              <h3>D'où viennent les visiteurs<small>{nb(d.site.views)} pages vues sur le site</small></h3>
              {d.site.sources.slice(0, 4).map(([k, v]) => <Row key={k} l={SRC[k] || k} v={`${nb(v)} ${v > 1 ? 'visites' : 'visite'}`} sub={`${pc(v, d.site.views)} % des visites`} />)}
            </section>
          )}

          <button type="button" className={`bl-deep${deep ? ' on' : ''}`} onClick={() => setDeep(!deep)}>
            <span>{deep ? 'Masquer le résumé approfondi' : 'Résumé approfondi'}</span><i aria-hidden>↓</i>
          </button>

          {/* ── Résumé approfondi ── */}
          {deep && (<>
            <section className="rg-sec">
              <h3>L'argent</h3>
              <Row l="Encaissé" v={eur(d.money.gross)} sub="Prix des billets et frais de service, avant remboursements" />
              <Row l="Remboursé" v={`− ${eur(d.money.refunded)}`} sub={`${s.refunded} billet${s.refunded > 1 ? 's' : ''} remboursé${s.refunded > 1 ? 's' : ''}`} />
              <Row l="Net estimé" v={eur(d.money.net)} sub="Encaissé moins remboursements et frais Stripe (1,5 % + 0,25 € par paiement)" />
              <Row l="Net par billet vendu" v={s.sold ? eur(Math.round((d.money.net / s.sold) * 100) / 100) : '…'} />
            </section>
            <section className="rg-sec">
              <h3>La vente</h3>
              {s.tiers.map((t) => (t.hidden
                ? <Row key={t.name} l={`Place ${t.name}, ${eur(t.price)}`} v={bil(t.taken)} sub="Tarif retiré de la vente, billets déjà vendus avant" />
                : <Row key={t.name} l={`Place ${t.name}, ${eur(t.price)}`} v={`${nb(t.taken)} / ${nb(t.capacity)}`} sub={`${Math.min(100, pc(t.taken, Math.max(1, t.capacity)))} % des places de ce tarif vendues`} />))}
              <Row l="Commandes" v={nb(s.orders)} sub={`${String(s.perOrder).replace('.', ',')} billet par commande en moyenne (BTR : 1,05)`} />
              <Row l="Acheteurs qui acceptent les mails du BDE" v={`${s.optin} %`} sub="BTR : 38 %" />
              <h4 className="bl-h4">Heure d'achat</h4>
              <Chart id="hours" data={s.hours} labels={s.hours.map((_, i) => (i % 3 === 0 ? `${i}h` : ''))} full={s.hours.map((_, i) => `De ${i}h à ${(i + 1) % 24}h`)} legend="Hauteur : billets vendus à cette heure-là, tous jours confondus" unit={BILLET} />
            </section>
            <section className="rg-sec">
              <h3>Le public<small>Année et filière renseignées sur chaque billet</small></h3>
              <Chart id="years" data={YEARS.map(([k]) => d.public.years[k] || 0)} labels={['P1', '2e', '3e', '4e', '5e', 'Ext.']} full={YEARS.map(([, l]) => l)} legend="Hauteur : billets par année d'études" unit={['billet', 'billets']} />
              {YEARS.map(([k, l]) => <Row key={k} l={l} v={bil(d.public.years[k] || 0)} sub={`${pc(d.public.years[k] || 0, s.sold)} % des billets${k === 'P1' ? ' (BTR : 30 %)' : k === 'EXT' ? ' (BTR : 18 %)' : ''}`} />)}
              <h4 className="bl-h4">Filières</h4>
              <Row l="Architecture intérieure (AI)" v={bil(d.public.fil.AI || 0)} sub={`${pc(d.public.fil.AI || 0, s.sold)} % des billets`} />
              <Row l="Communication (C)" v={bil(d.public.fil.C || 0)} sub={`${pc(d.public.fil.C || 0, s.sold)} % des billets`} />
              <Row l="Direction artistique (DA)" v={bil(d.public.fil.DA || 0)} sub={`${pc(d.public.fil.DA || 0, s.sold)} % des billets`} />
              <Row l="Billets avec l'atelier renseigné" v={`${d.public.ateliers} %`} sub="BTR : 94 %" />
            </section>
            <section className="rg-sec">
              <h3>La soirée</h3>
              {d.night.quarters.length ? (<>
                <Chart id="night" data={d.night.quarters.map(([, n]) => n)} labels={d.night.quarters.map(([k], i) => (i % 2 === 0 ? k : ''))} full={d.night.quarters.map(([k]) => `De ${k} à ${quarterEnd(k)}`)} legend="Hauteur : personnes entrées en 15 minutes" unit={ENTREE} />
                <Row l="Personnes entrées" v={`${nb(d.night.inside)} / ${nb(s.sold)}`} sub={`${d.night.presence} % des billets vendus ont été utilisés (BTR : 87 %)`} />
                {peak && <Row l="Plus grosse arrivée" v={`${peak[1]} entrées`} sub={`De ${peak[0]} à ${quarterEnd(peak[0])} (BTR : 53 en 15 minutes)`} />}
              </>) : <p className="rg-me">Les entrées apparaîtront ici dès les premiers scans, avec les arrivées quart d'heure par quart d'heure.</p>}
            </section>
            {d.site && (
              <section className="rg-sec">
                <h3>Le site<small>Visites anonymes, comptées depuis la mise en ligne du compteur</small></h3>
                <Row l="Pages vues" v={nb(d.site.views)} />
                <Row l="Visiteurs uniques" v={nb(d.site.unique)} sub={d.site.conv != null ? `${d.site.conv} % d'entre eux ont acheté un billet` : 'Le taux d’achat s’affiche à partir de 20 visiteurs'} />
                <Chart id="visits" data={d.site.byDay} labels={s.days.map((x) => dayLabel(x.d))} full={s.days.map((x) => dayFull(x.d))} legend="Hauteur : pages vues ce jour-là" unit={VISITE} />
                <h4 className="bl-h4">Sources</h4>
                {d.site.sources.map(([k, v]) => <Row key={k} l={SRC[k] || k} v={`${nb(v)} ${v > 1 ? 'visites' : 'visite'}`} />)}
                <h4 className="bl-h4">Pages</h4>
                {d.site.pages.map(([k, v]) => <Row key={k} l={PAGE[k] || k} v={`${nb(v)} ${v > 1 ? 'vues' : 'vue'}`} />)}
              </section>
            )}
            <section className="rg-sec">
              <h3>Concours, codes, recrutement</h3>
              {d.concours && <Row l="Participants au concours" v={nb(d.concours.participants)} sub={`${d.concours.winners} gagnant${d.concours.winners > 1 ? 's' : ''}, ${d.concours.sent} résultat${d.concours.sent > 1 ? 's' : ''} envoyé${d.concours.sent > 1 ? 's' : ''} par mail`} />}
              {d.concours?.funnel?.sent > 0 && [['Gagnants (place offerte)', d.concours.funnel.winners], ['Code −50 %', d.concours.funnel.discount]].map(([t, g]) => g.sent > 0 && (
                <Row key={t} l={`${t} : ont pris leur place`} v={`${g.used} / ${g.sent} (${g.usedPct} %)`}
                  sub={`${g.before} avaient déjà un billet, ${g.without} ont acheté sans le code, ${g.none} n'ont rien pris${d.event.started ? `. Venus à la soirée : ${g.came} sur ${g.sent} (${g.camePct} %)` : ''}`} />
              ))}
              <Row l="Codes invitation utilisés" v={nb(d.codes.invitations)} sub="Un code = un billet offert" />
              <Row l="Codes −50 % utilisés" v={nb(d.codes.discounts)} sub="Envoyés aux participants du concours non gagnants" />
              {d.recrutement != null && <Row l="Entretiens de recrutement réservés" v={nb(d.recrutement)} />}
            </section>
            <section className="rg-sec">
              <h3>Afterwork et Back to Reality</h3>
              <div className="bl-cmph"><span /><b>Afterwork</b><em>BTR</em></div>
              <Cmp l="Billets vendus" a={nb(s.sold)} b={nb(d.btr.sold)} />
              <Cmp l="Encaissé" a={eur(Math.round(d.money.gross))} b={eur(d.btr.gross)} />
              <Cmp l="Net estimé" a={eur(Math.round(d.money.net))} b={eur(d.btr.net)} />
              <Cmp l="Vendus le 1er jour" a={`${nb(s.firstDay)} (${pc(s.firstDay, s.sold)} %)`} b="186 (46 %)" />
              <Cmp l="Billets par commande" a={String(s.perOrder).replace('.', ',')} b="1,05" />
              <Cmp l="Acceptent les mails du BDE" a={`${s.optin} %`} b="38 %" />
              <Cmp l="Part de P1" a={`${d.public.p1} %`} b="30 %" />
              <Cmp l="Part d'extérieurs" a={`${d.public.ext} %`} b="18 %" />
              <Cmp l="Billets utilisés le soir" a={d.event.started ? `${d.night.presence} %` : 'jeudi'} b="87 %" />
            </section>
          </>)}
        </>)}
      </div>
    </div>
  );
  return host ? createPortal(ui, host) : ui;
}
