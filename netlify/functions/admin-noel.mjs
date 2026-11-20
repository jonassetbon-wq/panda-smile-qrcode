import { store, json, readToken, readAll } from "./lib/common.mjs";
import { fmtWeight, readState } from "./lib/noel.mjs";

/*
  Gagnants du jeu de Noël, choisis à la main par le cabinet (réservé à l'administrateur).
  Aucun tirage au sort, aucun e-mail : le cabinet prévient lui-même les gagnants.
  POST /api/admin/noel
  - { action: "weight", grams }   poids réel du nounours, en grammes (classe les participants du plus juste au moins juste)
  - { action: "pick", kind, id }  donne le casque (kind "casque") ou le nounours (kind "peluche") à un participant
  - { action: "clear", kind }     retire ce lot à son gagnant
*/
const KINDS = new Set(["casque", "peluche"]);
const LOT = { casque: "le casque", peluche: "le nounours" };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const tok = await readToken(req);
  if (!tok?.admin) return json({ error: "Accès réservé" }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const st = await readState();
  st.history = st.history || [];
  const now = new Date().toISOString();
  const save = () => store("noelstate").setJSON("state", st);

  if (b.action === "weight") {
    const g = Math.round(Number(b.grams));
    if (!(g >= 1 && g <= 20000)) return json({ error: "Poids invalide" }, 400);
    st.realWeight = g;
    st.history.push({ t: now, what: `Poids réel enregistré : ${fmtWeight(g)}` });
    await save();
    return json({ ok: true, state: st });
  }

  if (!KINDS.has(b.kind)) return json({ error: "Requête invalide" }, 400);
  const other = b.kind === "casque" ? "peluche" : "casque";

  if (b.action === "pick") {
    const w = (await readAll("noel")).find((p) => p && p.id === b.id);
    if (!w) return json({ error: "Participant introuvable" }, 404);
    if (st[other]?.id === w.id) return json({ error: `Cette personne a déjà ${LOT[other]}.` }, 409);
    st[b.kind] = { id: w.id, at: now };
    st.history.push({ t: now, what: `${LOT[b.kind][0].toUpperCase() + LOT[b.kind].slice(1)} attribué à ${w.prenom} ${w.nom} (pronostic ${fmtWeight(w.guess)})` });
    await save();
    return json({ ok: true, state: st });
  }

  if (b.action === "clear") {
    if (!st[b.kind]) return json({ ok: true, state: st });
    st[b.kind] = null;
    st.history.push({ t: now, what: `${LOT[b.kind][0].toUpperCase() + LOT[b.kind].slice(1)} retiré à son gagnant` });
    await save();
    return json({ ok: true, state: st });
  }

  return json({ error: "Requête invalide" }, 400);
};

export const config = { path: "/api/admin/noel" };
