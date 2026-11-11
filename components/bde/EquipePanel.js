'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EQUIPE, rolesDe, personnes } from '@/lib/equipe';

// Carte radiale (ordinateur) : coordonnées d'une scène de 1780 x 980, mise à l'échelle de l'écran
const SW = 1780, SH = 980, CX = 890, CY = 515, R = 168, CW = 374;
const POS = {
  merch: { x: 80, y: 85 }, part: { x: CX - CW / 2, y: 30 }, event: { x: SW - 80 - CW, y: 85 },
  com: { x: 0, y: null }, treso: { x: SW - CW, y: null },
  graph: { x: 230, y: 770 }, tech: { x: CX - CW / 2, y: 770 }, proj: { x: SW - 230 - CW, y: 770 },
};
const BOTTOM = ['graph', 'tech', 'proj'];
const RADIAL_MIN = 980;            // en dessous : version téléphone (pôles empilés sur deux colonnes)
const STACK = ['merch', 'event', 'com', 'treso', 'part', 'proj', 'graph', 'tech'];

const pad = (n) => String(n).padStart(2, '0');

function Pill({ name, lead, white, tag, sel, onPick }) {
  const on = sel?.type === 'person' && sel.name === name;
  return (
    <button type="button" className={`eq-pp${lead || white ? ' lead' : ''}${on ? ' me' : ''}`}
      onClick={(e) => { e.stopPropagation(); onPick(name); }}>
      {lead && <i>Resp.</i>}{tag && <i>{tag}</i>}{name}
    </button>
  );
}

function Pole({ p, sel, active, onPole, onPick, style, innerRef }) {
  const n = p.resp.length + p.membres.length;
  const dim = sel && !active;
  return (
    <div ref={innerRef} id={`eq-${p.id}`} style={style} role="button" tabIndex={0}
      className={`eq-card${active ? ' on' : ''}${dim ? ' eq-dim' : ''}`}
      onClick={() => onPole(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPole(p.id); } }}>
      <span className="eq-tick" aria-hidden />
      <div className="eq-ch"><span className="eq-nm">{p.nom}</span><span className="eq-ct">{pad(n)}</span></div>
      {p.sous && <p className="eq-sub">{p.sous}</p>}
      <div className="eq-pl">
        {p.resp.map((x) => <Pill key={'r' + x} name={x} lead sel={sel} onPick={onPick} />)}
        {p.membres.map((x) => <Pill key={'m' + x} name={x} sel={sel} onPick={onPick} />)}
      </div>
    </div>
  );
}

function Core({ sel, dim, onPick, style }) {
  return (
    <div className={`eq-core${dim ? ' eq-dim' : ''}`} style={style}>
      <span className="eq-k">BDE</span>
      <span className="eq-b">B31</span>
      <div className="eq-pl">{EQUIPE.presidence.map((x) => <Pill key={x.nom} name={x.nom} white={x.lead} tag={x.tag} sel={sel} onPick={onPick} />)}</div>
      <span className="eq-t">Présidence</span>
    </div>
  );
}

function Essai({ sel, onPick }) {
  const dim = sel && !(sel.type === 'person' && EQUIPE.essai.includes(sel.name));
  return (
    <div className={`eq-essai${dim ? ' eq-dim' : ''}`}>
      <span className="eq-lb">À l'essai</span>
      <div className="eq-pl">{EQUIPE.essai.map((x) => <Pill key={x} name={x} sel={sel} onPick={onPick} />)}</div>
    </div>
  );
}

export default function EquipePanel({ active = true }) {
  const [sel, setSel] = useState(null);            // { type:'pole', id } | { type:'person', name } | null
  const [w, setW] = useState(0);
  const [vh, setVh] = useState(900);
  const [links, setLinks] = useState([]);
  const wrap = useRef(null), stage = useRef(null);
  const people = useMemo(() => personnes(), []);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    const f = () => setVh(window.innerHeight); f(); window.addEventListener('resize', f);
    return () => { ro.disconnect(); window.removeEventListener('resize', f); };
  }, []);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') setSel(null); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const radial = w >= RADIAL_MIN;
  // toute la carte tient dans l'écran : limitée par la largeur et par la hauteur disponibles
  const k = radial ? Math.min(1, w / SW, Math.max(0.55, (vh - 330) / SH)) : 1;

  // Pôle actif : celui choisi, ou ceux de la personne choisie
  const isOn = useCallback((p) => {
    if (!sel) return false;
    if (sel.type === 'pole') return sel.id === p.id;
    return p.resp.includes(sel.name) || p.membres.includes(sel.name);
  }, [sel]);
  const coreDim = sel && !(sel.type === 'person' && EQUIPE.presidence.some((x) => x.nom === sel.name)) && sel.type !== 'pole';
  const onPole = (id) => setSel((s) => (s?.type === 'pole' && s.id === id ? null : { type: 'pole', id }));
  const onPick = (name) => setSel((s) => (s?.type === 'person' && s.name === name ? null : { type: 'person', name }));

  // Mise en place de la carte radiale : Communication et Trésorerie centrées sur le cercle,
  // la rangée du bas à la même hauteur, puis les liens courbes du cercle vers chaque pôle
  const layout = useCallback(() => {
    const st = stage.current; if (!st) return;
    const get = (id) => st.querySelector(`#eq-${id}`);
    BOTTOM.forEach((id) => { get(id).style.height = ''; });
    const h = Math.max(...BOTTOM.map((id) => get(id).offsetHeight));
    BOTTOM.forEach((id) => { get(id).style.height = h + 'px'; });
    ['com', 'treso'].forEach((id) => { const e = get(id); e.style.top = (CY - e.offsetHeight / 2) + 'px'; });
    const out = EQUIPE.poles.map((p) => {
      const c = get(p.id);
      const L = c.offsetLeft, T = c.offsetTop, Wd = c.offsetWidth, Hd = c.offsetHeight;
      const tx = L + Wd / 2, ty = T + Hd / 2;
      const side = Math.abs(CX - tx) > Math.abs(CY - ty) * 1.2;
      const ex = side ? (tx < CX ? L + Wd : L) : tx, ey = side ? ty : (ty < CY ? T + Hd : T);
      const a = Math.atan2(ey - CY, ex - CX);
      const sx = CX + Math.cos(a) * (R + 6), sy = CY + Math.sin(a) * (R + 6);
      const qx = sx + Math.cos(a) * 90, qy = sy + Math.sin(a) * 90;
      return { id: p.id, d: `M${sx} ${sy} Q${qx} ${qy} ${ex} ${ey}`, ex, ey, sx, sy };
    });
    setLinks(out);
  }, []);
  useLayoutEffect(() => { if (radial) layout(); }, [radial, layout]);
  useEffect(() => { if (!radial) return; document.fonts?.ready?.then(layout); }, [radial, layout]);

  // Colonne vertébrale de la version téléphone : du cercle jusqu'au dernier pôle
  const grid = useRef(null);
  const [spine, setSpine] = useState(0);
  useLayoutEffect(() => {
    if (radial || !grid.current) return;
    const fit = () => {
      const cards = grid.current?.querySelectorAll('.eq-card'); if (!cards?.length) return;
      const last = cards[cards.length - 1];
      setSpine(last.offsetTop + 30 + 26);   // part du bas du cercle (26 px au-dessus de la grille)
    };
    fit(); document.fonts?.ready?.then(fit);
    const ro = new ResizeObserver(fit); ro.observe(grid.current); return () => ro.disconnect();
  }, [radial, w]);

  const nbPeople = people.length;
  const info = sel?.type === 'person'
    ? { t: sel.name, s: rolesDe(sel.name).map((r) => (r.kind === 'lead' ? `Resp. ${r.t}` : r.t)).join(' · ') }
    : sel?.type === 'pole'
      ? (() => { const p = EQUIPE.poles.find((x) => x.id === sel.id); const n = p.resp.length + p.membres.length; return { t: p.nom, s: `${n} personne${n > 1 ? 's' : ''}${p.resp.length ? ` · Resp. ${p.resp.join(', ')}` : ' · pas de responsable'}` }; })()
      : null;

  return (
    <div className="eq" onClick={(e) => { if (!e.target.closest('.eq-card, .eq-pp, .eq-pers, .eq-info')) setSel(null); }}>
      <div className="eq-ray eq-r1" aria-hidden /><div className="eq-ray eq-r2" aria-hidden />
      <div className="eq-word" aria-hidden>Bureau 31</div>

      <header className="eq-top">
        <span><b>Organigramme</b>BDE Penninghen · {EQUIPE.annee}</span>
        <span>{nbPeople} personnes · {EQUIPE.poles.length} pôles</span>
      </header>

      {/* bandeau : seulement quand un pôle ou un prénom est choisi ; il flotte en bas, au-dessus de la barre d'onglets,
          pour ne jamais couvrir le cercle du BDE ; toucher ailleurs remet la vue d'ensemble */}
      {info && active && typeof document !== 'undefined' && createPortal(
        <div className="eq-info eq-float" aria-live="polite" key={info.t}>
          <b>{info.t}</b><span>{info.s}</span><button type="button" onClick={() => setSel(null)}>Tout voir</button>
        </div>, document.querySelector('.bde-app') || document.body)}

      <div className="eq-map" ref={wrap} onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
        {radial ? (
          <div className="eq-fit" style={{ height: SH * k }}>
            <div className="eq-stage" ref={stage} style={{ width: SW, height: SH, left: Math.max(0, (w - SW * k) / 2), transform: `scale(${k})` }}
              onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
              <svg className="eq-links" width={SW} height={SH} aria-hidden>
                <defs><filter id="eqgl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter></defs>
                {links.map((l) => {
                  const on = isOn(EQUIPE.poles.find((p) => p.id === l.id));
                  return (
                    <g key={l.id} className={`eq-ln${on ? ' on' : ''}${sel && !on ? ' eq-dim' : ''}`}>
                      <path d={l.d} className="g" filter="url(#eqgl)" />
                      <path d={l.d} className="l" />
                      <circle cx={l.ex} cy={l.ey} r="5" className="e" /><circle cx={l.sx} cy={l.sy} r="3.5" className="s" />
                    </g>
                  );
                })}
              </svg>
              <div className="eq-halo" style={{ left: CX - R - 60, top: CY - R - 60, width: 2 * R + 120, height: 2 * R + 120 }} />
              <Core sel={sel} dim={coreDim} onPick={onPick} style={{ left: CX - R, top: CY - R, width: 2 * R, height: 2 * R }} />
              {EQUIPE.poles.map((p) => (
                <Pole key={p.id} p={p} sel={sel} active={isOn(p)} onPole={onPole} onPick={onPick}
                  style={{ left: POS[p.id].x, top: POS[p.id].y ?? 0, width: CW }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="eq-stack">
            <Core sel={sel} dim={coreDim} onPick={onPick} />
            <div className="eq-grid" ref={grid}>
              <span className="eq-spine" style={{ height: spine }} aria-hidden />
              {STACK.map((id) => EQUIPE.poles.find((p) => p.id === id)).map((p) => (
                <Pole key={p.id} p={p} sel={sel} active={isOn(p)} onPole={onPole} onPick={onPick} />
              ))}
            </div>
          </div>
        )}
        <Essai sel={sel} onPick={onPick} />
      </div>

      <section className="eq-roles">
        <h3><span>Rôle de chacun</span><i>{pad(nbPeople)}</i></h3>
        <div className="eq-people">
          {people.map((n) => {
            const rs = rolesDe(n);
            const on = sel?.type === 'person' && sel.name === n;
            const inPole = sel?.type === 'pole' && rs.some((r) => r.id === sel.id);
            const dim = sel && !on && !inPole;
            return (
              <button type="button" key={n} className={`eq-pers${on || inPole ? ' on' : ''}${dim ? ' eq-dim' : ''}`} onClick={() => onPick(n)}>
                <span className="eq-pn">{n}</span>
                <span className="eq-rl">
                  {rs.map((r, i) => (
                    <span key={i} className={`eq-r ${r.kind}`}>{r.kind === 'lead' && <i>Resp.</i>}{r.t}</span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="eq-foot">
        <span className="eq-lg"><span><i className="a" />Responsable du pôle</span><span><i className="b" />Membre</span></span>
        <span>Bureau 31 · bureau31.fr</span>
      </footer>
      <div className="eq-grain" aria-hidden />
    </div>
  );
}
