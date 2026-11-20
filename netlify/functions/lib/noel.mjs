// Jeu concours de Noël 2026 : « Combien pèse le nounours ? »
import { store } from "./common.mjs";
export const NOEL = {
  id: "noel-2026",
  title: "Combien pèse le nounours ?",
  // Fin du jeu : 31/12/2026 à minuit, heure de Paris.
  closesAt: "2026-12-31T23:00:00.000Z",
  min: 100, max: 3000, step: 100,
  prizes: {
    casque: "le casque JBL Tune 680NC",
    peluche: "le nounours lui-même",
  },
  cabinet: "Cabinet d'orthodontie du Dr Helena Sebag Setbon et du Dr Olivier Setbon",
};

export const WEIGHTS = [];
for (let g = NOEL.min; g <= NOEL.max; g += NOEL.step) WEIGHTS.push(g);

export const fmtWeight = (g) => (g < 1000 ? `${g} g` : `${(g / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`);
export const normPhone = (tel) => String(tel || "").replace(/\D/g, "").replace(/^0033/, "0").replace(/^33(?=\d{9}$)/, "0");
export const isOpen = (now = Date.now()) => now < Date.parse(NOEL.closesAt);
export const idxKeys = (email, phone) => [`e_${email}`, phone.length >= 9 ? `t_${phone}` : null].filter(Boolean).map((k) => k.replace(/[^\w@.+-]/g, "_"));

/* ---------- E-mails (contenu) ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function layout(title, body) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f8f0e1;font-family:Helvetica,Arial,sans-serif;color:#0d3a2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f0e1"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:#b3172b;padding:22px 26px;color:#f8f0e1;font-size:13px;letter-spacing:3px;font-weight:bold">JEU DE NOËL · PANDASMILE</td></tr>
<tr><td style="padding:26px">
<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-style:italic;font-size:28px;line-height:1.15;color:#b3172b">${title}</h1>
${body}
</td></tr>
<tr><td style="background:#0d3a2b;padding:16px 26px;color:#e9b44c;font-size:12px;line-height:1.5">${esc(NOEL.cabinet)}</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (t) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.5">${t}</p>`;

export function mailConfirmation(r) {
  return {
    subject: "Ta participation au jeu de Noël est bien enregistrée 🎄",
    html: layout(`Merci ${esc(r.prenom)} !`,
      p(`Ta réponse au jeu « Combien pèse le nounours ? » est bien enregistrée.`) +
      p(`<b>Ton pronostic : ${fmtWeight(r.guess)}</b>`) +
      p(`Le jeu se termine le 31 décembre 2026. Le gagnant du casque JBL Tune 680NC sera tiré au sort parmi les bonnes réponses, et un second gagnant repartira avec le nounours. Les gagnants seront prévenus par e-mail.`) +
      p(`Bonne chance !`)),
    text: `Merci ${r.prenom} ! Ta réponse au jeu « Combien pèse le nounours ? » est bien enregistrée. Ton pronostic : ${fmtWeight(r.guess)}. Le jeu se termine le 31 décembre 2026. Les gagnants seront prévenus par e-mail. Bonne chance !`,
  };
}

export function mailWinner(kind, r, realWeight) {
  const prize = NOEL.prizes[kind];
  const weightLine = realWeight ? p(`Le nounours pesait <b>${fmtWeight(realWeight)}</b>, et ton pronostic était <b>${fmtWeight(r.guess)}</b>.`) : "";
  return {
    subject: kind === "casque" ? "Tu as gagné le casque JBL du jeu de Noël ! 🎧" : "Tu as gagné le nounours du jeu de Noël ! 🧸",
    html: layout(`Bravo ${esc(r.prenom)}, tu as gagné !`,
      p(`Tu remportes <b>${esc(prize)}</b> au jeu « Combien pèse le nounours ? ».`) +
      weightLine +
      p(`Le cabinet va te contacter au ${esc(r.tel)} pour convenir de la remise de ton cadeau.`) +
      p(`Joyeuses fêtes !`)),
    text: `Bravo ${r.prenom}, tu as gagné ! Tu remportes ${prize} au jeu « Combien pèse le nounours ? ». ${realWeight ? `Le nounours pesait ${fmtWeight(realWeight)}, ton pronostic était ${fmtWeight(r.guess)}. ` : ""}Le cabinet va te contacter au ${r.tel} pour convenir de la remise de ton cadeau. Joyeuses fêtes !`,
  };
}

/* État du tirage : poids réel, gagnants, historique. */
export async function readState() {
  return (await store("noelstate").get("state", { type: "json" })) || { realWeight: null, casque: null, peluche: null, history: [] };
}
