'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EVENT } from '@/lib/event';
import { scanPrefs } from '@/lib/prefs';

const beep = (ok) => {
  const pr = scanPrefs();   // vibration et bip réglables dans les Réglages
  if (pr.sound) try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const tone = (f, t0, d) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = f; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.25, a.currentTime + t0); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + d); };
    ok ? tone(1320, 0, 0.12) : (tone(220, 0, 0.18), tone(180, 0.22, 0.25));
  } catch {}
  if (pr.vibrate) try { navigator.vibrate?.(ok ? 80 : [200, 100, 200]); } catch {}
};
const hhmm = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const no = (n) => String(n).padStart(4, '0');
// La réponse du scan s'affiche au-dessus de toute l'appli (en-tête et barre d'onglets compris)
const toTop = (node) => (typeof document === 'undefined' ? node : createPortal(node, document.querySelector('.bde-app') || document.body));

export default function ScanPanel({ code, active, onScanned }) {
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const [entries, setEntries] = useState(null);
  const [mine, setMine] = useState(null);
  const busy = useRef(false), last = useRef({ code: '', at: 0 });

  const call = async (body) => {
    const r = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify(body) });
    return r.json();
  };

  useEffect(() => { call({ check: true }).then((d) => { setEntries(d.entries); setMine(d.mine); }).catch(() => {}); }, []); // eslint-disable-line

  // La caméra s'ouvre une seule fois puis reste allumée en arrière-plan : changer d'onglet la met en pause
  // au lieu de la couper, donc le téléphone ne redemande plus l'autorisation.
  const qr = useRef(null), starting = useRef(false);
  const startCam = async () => {
    if (starting.current) return;
    starting.current = true; setErr('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!qr.current) qr.current = new Html5Qrcode('bde-reader', { verbose: false });
      // toute l'image est lue (pas de cadre à viser) : la caméra remplit l'écran
      await qr.current.start({ facingMode: 'environment' }, { fps: 12 }, (t) => onCode(t), () => {});
    } catch { setErr("La caméra n'a pas pu s'ouvrir. Autorise l'accès à la caméra pour ce site, puis recharge la page."); }
    starting.current = false;
  };
  const camState = () => { try { return qr.current?.getState?.() ?? 1; } catch { return 1; } };   // 1 arrêtée, 2 en marche, 3 en pause

  useEffect(() => {
    const q = qr.current;
    if (active) {
      if (camState() === 3) {
        try { q.resume(); } catch { q.stop().catch(() => {}).finally(startCam); }   // flux coupé par le téléphone : on relance
      } else if (camState() !== 2) startCam();
    } else if (camState() === 2) {
      try { q.pause(true); } catch {}
    }
  }, [active]); // eslint-disable-line

  // Retour dans l'appli après l'avoir quittée : iOS peut avoir coupé le flux, on le relance si besoin
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !active || !qr.current) return;
      const v = document.querySelector('#bde-reader video');
      const live = v?.srcObject?.getVideoTracks?.().some((t) => t.readyState === 'live');
      if (!live) { const q = qr.current; (camState() >= 2 ? q.stop() : Promise.resolve()).catch(() => {}).finally(startCam); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active]); // eslint-disable-line

  useEffect(() => () => { const q = qr.current; if (q && camState() >= 2) q.stop().then(() => q.clear()).catch(() => {}); }, []); // eslint-disable-line

  // Mise au point comme l'appareil photo : toucher l'image fait la mise au point à cet endroit,
  // rester appuyé la bloque (toucher encore la débloque). Lampe si le téléphone le permet.
  // iPhone : Safari ne laisse aucun site régler la mise au point ; la caméra la fait seule (et passe en macro de près).
  const track = () => document.querySelector('#bde-reader video')?.srcObject?.getVideoTracks?.()[0];
  const [caps, setCaps] = useState({ focus: false, torch: false });
  const [fx, setFx] = useState(null);       // carré de mise au point { x, y, lock, id }
  const [hint, setHint] = useState('');
  const [torch, setTorch] = useState(false);
  const press = useRef(null);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      try { const c = track()?.getCapabilities?.() || {}; setCaps({ focus: (c.focusMode || []).some((m) => m === 'single-shot' || m === 'manual') || !!c.pointsOfInterest, torch: !!c.torch }); } catch {}
    }, 1200);
    return () => clearTimeout(t);
  }, [active]); // eslint-disable-line
  const focusAt = async (cx, cy, lock) => {
    const box = document.querySelector('.scanp-cam')?.getBoundingClientRect(), v = document.querySelector('#bde-reader video');
    if (!box) return;
    const x = cx - box.left, y = cy - box.top;
    if (!caps.focus) {
      setHint('Mise au point automatique sur ce téléphone : rapproche ou éloigne un peu le billet.');
      setTimeout(() => setHint(''), 2800);
      return;
    }
    setFx({ x, y, lock, id: Date.now() });
    try { navigator.vibrate?.(lock ? 18 : 8); } catch {}
    // point touché, ramené aux coordonnées de l'image (la vidéo remplit l'écran, donc elle est recadrée)
    const vw = v?.videoWidth || box.width, vh = v?.videoHeight || box.height, k = Math.max(box.width / vw, box.height / vh);
    const px = Math.min(1, Math.max(0, (x - (box.width - vw * k) / 2) / (vw * k))), py = Math.min(1, Math.max(0, (y - (box.height - vh * k) / 2) / (vh * k)));
    const c = track()?.getCapabilities?.() || {};
    const mode = lock ? ((c.focusMode || []).includes('manual') ? 'manual' : 'single-shot') : ((c.focusMode || []).includes('single-shot') ? 'single-shot' : 'continuous');
    try { await track()?.applyConstraints({ advanced: [{ pointsOfInterest: [{ x: px, y: py }], focusMode: mode }] }); } catch {}
    if (!lock) setTimeout(() => { try { track()?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch {} setFx((f) => (f && !f.lock ? null : f)); }, 1600);
  };
  const unlock = () => { setFx(null); try { track()?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch {} };
  const camDown = (e) => {
    if (e.button > 0) return;
    const p = { x: e.clientX, y: e.clientY, moved: false, long: false };
    p.timer = setTimeout(() => { if (!p.moved) { p.long = true; focusAt(p.x, p.y, true); } }, 600);
    press.current = p;
  };
  const camMove = (e) => { const p = press.current; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) { p.moved = true; clearTimeout(p.timer); } };
  const camUp = () => {
    const p = press.current; press.current = null; if (!p) return;
    clearTimeout(p.timer);
    if (p.moved || p.long) return;
    if (fx?.lock) return unlock();
    focusAt(p.x, p.y, false);
  };
  const flip = async () => { try { await track()?.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch); } catch {} };

  async function onCode(text) {
    const now = Date.now();
    if (busy.current || (text === last.current.code && now - last.current.at < 4000)) return;
    last.current = { code: text, at: now };
    await check(text, false);
  }

  // force = l'équipe laisse entrer un billet Early arrivé après l'heure limite
  async function check(text, force, supplement) {
    busy.current = true;
    let hold = 2600;
    try {
      const d = await call({ code: text, force, supplement });
      setRes({ ...d, code: text }); hold = d.result === 'valid' && d.noAtelier ? 4500 : 2600; if (d.entries != null) setEntries(d.entries); if (d.mine != null) setMine(d.mine); beep(d.result === 'valid');
      if (d.result === 'valid') onScanned?.();
      if (d.result === 'late') return; // on attend la décision
      if (d.result === 'valid' && d.merch) return; // merch à remettre : on attend « Donné » ou « Plus tard »
    } catch { setRes({ result: 'offline' }); beep(false); }
    setTimeout(() => { setRes(null); busy.current = false; }, hold);   // plus long quand l'atelier manque, le temps de lire
  }
  const refuse = () => { setRes(null); setSupp(null); busy.current = false; };

  // Supplément d'entrée tardive : QR code Stripe affiché, la personne paie sur son téléphone
  const [supp, setSupp] = useState(null);   // { session, qr, amount } | { error }
  const askSupplement = async () => {
    setSupp({ loading: true });
    try {
      const r = await fetch('/api/scan/supplement', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify({ code: res.code }) });
      const d = await r.json();
      setSupp(r.ok ? d : { error: d.error || 'Paiement impossible.' });
    } catch { setSupp({ error: 'Pas de réseau.' }); }
  };
  const cancelSupplement = () => {
    if (supp?.session) fetch('/api/scan/supplement', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify({ cancel: supp.session }) }).catch(() => {});
    setSupp(null);   // retour aux trois choix
  };
  useEffect(() => {
    if (!supp?.session) return;
    const iv = setInterval(async () => {
      const d = await fetch(`/api/scan/supplement?session=${encodeURIComponent(supp.session)}`, { headers: { 'x-staff-token': code }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (d?.paid) { clearInterval(iv); const s = supp.session; setSupp(null); check(res.code, false, s); }
      else if (d?.expired) { clearInterval(iv); setSupp({ error: 'Le paiement a expiré.' }); }
    }, 2500);
    return () => clearInterval(iv);
  }, [supp?.session]); // eslint-disable-line

  // Merch remis (ou plus tard) : on referme l'écran violet
  const [merchBusy, setMerchBusy] = useState(false);
  const merchDone = async (given) => {
    if (given && res?.merch) {
      setMerchBusy(true);
      for (const id of res.merch.ids) await fetch('/api/admin/merch', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-staff-token': code }, body: JSON.stringify({ id, collected: true }) }).catch(() => {});
      setMerchBusy(false);
    }
    setRes(null); busy.current = false;
  };

  const view = res && (res.result === 'valid' && res.merch
    ? { tone: 'merch', title: 'Entrée validée', l1: res.name, l2: `Merch à récupérer : ${res.merch.items}`, l3: res.noAtelier ? "N'a pas rempli son atelier : demande-lui sa classe." : `Billet n° ${no(res.numero)}` }
    : null) || res && (res.result === 'valid' && res.noAtelier
    ? { tone: 'atl', title: 'Sans atelier', l1: res.name, l2: "N'a pas rempli son atelier", l3: `Entrée validée, billet n° ${no(res.numero)}. Demande-lui sa classe.` }
    : null) || res && {
    valid: { tone: 'ok', title: res.supplement ? `Supplément payé` : 'Entrée validée', l1: res.name, l2: res.price ? `${res.tier}, ${res.price} €` : `${res.tier}, invitation`, l3: `Billet n° ${no(res.numero)}` },
    already: { tone: 'no', title: 'Déjà scanné', l1: res.name, l2: res.at ? `Entré à ${hhmm(res.at)}${res.by ? `, scanné par ${res.by}` : ''}` : '', l3: "Refuser l'entrée" },
    late: { tone: 'warn', title: `${(res.tier || 'Billet').replace(/ avant .*/, '')} après ${res.label}`, l1: res.name, l2: `Billet n° ${no(res.numero)}, valable seulement avant ${res.label}`, l3: 'À toi de décider' },
    refunded: { tone: 'no', title: 'Billet remboursé', l1: res.name, l2: 'Ce billet a été annulé', l3: "Refuser l'entrée" },
    unknown: { tone: 'no', title: 'Billet inconnu', l1: 'QR code non reconnu', l2: 'Faux ou modifié', l3: "Refuser l'entrée" },
    offline: { tone: 'warn', title: 'Pas de réseau', l1: 'Vérification impossible', l2: 'Réessaie dans un instant', l3: '' },
  }[res.result];

  return (
    <div className="scanp">
      <div className="scanp-cam" onPointerDown={camDown} onPointerMove={camMove} onPointerUp={camUp} onPointerCancel={() => { if (press.current) clearTimeout(press.current.timer); press.current = null; }} onContextMenu={(e) => e.preventDefault()}>
        <div id="bde-reader" />
        {!active && <div className="scanp-off">Caméra en pause</div>}
        {/* zone idéale : deux équerres en verre sur une diagonale (repère seulement, toute l'image est lue) */}
        <Aim />
        {fx && <span key={fx.id} className={`scanp-fx${fx.lock ? ' lock' : ''}`} style={{ left: fx.x, top: fx.y }} aria-hidden />}
      </div>
      {fx?.lock && <p className="scanp-lock">Mise au point bloquée · touche pour débloquer</p>}
      {hint && <p className="scanp-lock">{hint}</p>}
      {caps.torch && (
        <button type="button" className={`scanp-torch${torch ? ' on' : ''}`} onClick={flip} aria-label={torch ? 'Éteindre la lampe' : 'Allumer la lampe'} aria-pressed={torch}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 2h8l-1 6H9L8 2ZM9 8v12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V8M12 12v3" /></svg>
        </button>
      )}
      <div className="scanp-top">
        <span className="scanp-count"><b>{entries ?? '…'}</b> entrées</span>
        <span className="scanp-mine">dont <b>{mine ?? '…'}</b> par toi</span>
      </div>
      {err && <p className="scanp-err" role="alert">{err}</p>}
      <p className="scanp-foot">Vise le QR code du billet<small>Glisse sur le côté pour changer d’écran</small></p>

      {view && toTop(
        <div className={`scan-res ${view.tone}`} role="alert">
          <div className="scan-res-t">{view.title}</div>
          <div className="scan-res-1">{view.l1}</div>
          {res.atelier && <div className="scan-res-at">{res.atelier}</div>}
          <div className="scan-res-2">{view.l2}</div>
          <div className="scan-res-3">{view.l3}</div>
          {res.result === 'valid' && res.merch && (
            <div className="scan-res-btns">
              <button className="sr-yes" disabled={merchBusy} onClick={() => merchDone(true)}>{merchBusy ? '…' : 'Merch donné'}</button>
              <button className="sr-no" disabled={merchBusy} onClick={() => merchDone(false)}>Plus tard</button>
            </div>
          )}
          {res.result === 'late' && !supp && (
            <div className="scan-res-btns">
              <button className="sr-yes" onClick={() => check(res.code, true)}>Laisser entrer</button>
              <button className="sr-pay" onClick={askSupplement}>Supplément {(EVENT.lateFee || 500) / 100} €</button>
              <button className="sr-no" onClick={refuse}>Refuser</button>
            </div>
          )}
          {res.result === 'late' && supp && (
            <div className="sr-supp">
              {supp.loading && <p className="sr-wait">Préparation du paiement…</p>}
              {supp.qr && (<>
                <div className="sr-qr"><img src={supp.qr} alt="QR code de paiement du supplément" /></div>
                <p className="sr-wait"><i aria-hidden="true" />Il scanne et paie {supp.amount} € sur son téléphone…</p>
              </>)}
              {supp.error && <p className="sr-wait">{supp.error}</p>}
              <button className="sr-no" onClick={cancelSupplement}>Annuler</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Zone idéale du scan : un carré de verre liquide posé sur l'image. Son liseré est très fin et presque invisible ;
// deux reflets se font face (bord gauche en haut, bord droit en bas), épais au milieu et qui s'effacent aux bouts.
// Simple repère visuel : toute l'image reste lue.
const S = 300, RX = 68;
const lens = (x, y1, y2, w) => { const m = (y1 + y2) / 2; return `M${x} ${y1}Q${x - w} ${m} ${x} ${y2}Q${x + w * 0.35} ${m} ${x} ${y1}Z`; };

function Aim() {
  return (
    <div className="scanp-aim" aria-hidden>
      <svg viewBox={`-10 -10 ${S + 20} ${S + 20}`}>
        <defs>
          <linearGradient id="aim-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".35" stopColor="#fff" stopOpacity=".12" />
            <stop offset=".65" stopColor="#fff" stopOpacity=".1" /><stop offset="1" stopColor="#fff" stopOpacity=".45" />
          </linearGradient>
          <linearGradient id="aim-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".09" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity=".05" />
          </linearGradient>
          <linearGradient id="aim-spec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect className="aim-depth" x="1" y="2" width={S - 2} height={S - 2} rx={RX} />
        <rect className="aim-sheen" x="0" y="0" width={S} height={S} rx={RX} fill="url(#aim-sheen)" />
        <rect className="aim-rim" x="0" y="0" width={S} height={S} rx={RX} stroke="url(#aim-rim)" />
        <g className="aim-glint">
          <path d={lens(0, 70, 170, 7)} /><path d={lens(S, 130, 230, -7)} />
        </g>
        <g className="aim-spec" fill="url(#aim-spec)">
          <path d={lens(0, 76, 164, 4.5)} /><path d={lens(S, 136, 224, -4.5)} />
        </g>
      </svg>
    </div>
  );
}
