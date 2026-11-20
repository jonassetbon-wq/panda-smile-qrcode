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

/* État du jeu : poids réel, gagnants choisis par le cabinet, historique. */
export async function readState() {
  return (await store("noelstate").get("state", { type: "json" })) || { realWeight: null, casque: null, peluche: null, history: [] };
}
