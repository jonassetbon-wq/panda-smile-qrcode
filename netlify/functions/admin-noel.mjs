import crypto from "node:crypto";
import { store, json, readToken, readAll } from "./lib/common.mjs";
import { mailWinner, fmtWeight, readState } from "./lib/noel.mjs";
import { sendMail } from "./lib/mail.mjs";

/*
  Tirage et gagnants du jeu de Noël (réservé à l'administrateur).
  POST /api/admin/noel
  - { action: "weight", grams }       poids réel du nounours, en grammes
  - { action: "draw" }                tire au sort le gagnant du casque parmi les bonnes réponses
                                      (pronostic = poids réel arrondi à 100 g ; s'il n'y en a aucune : les pronostics les plus proches)
  - { action: "pick", id }            choisit à la main le gagnant du nounours
  - { action: "clear", kind }         annule un gagnant (tant que son e-mail n'est pas parti)
  - { action: "notify", kind }        envoie l'e-mail au gagnant (casque ou peluche)
*/
const KINDS = new Set(["casque", "peluche"]);

const save = (st) => store("noelstate").setJSON("state", st);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const tok = await readToken(req);
  if (!tok?.admin) return json({ error: "Accès réservé" }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const st = await readState();
  st.history = st.history || [];
  const now = new Date().toISOString();

  if (b.action === "weight") {
    const g = Math.round(Number(b.grams));
    if (!(g >= 1 && g <= 20000)) return json({ error: "Poids invalide" }, 400);
    st.realWeight = g;
    st.history.push({ t: now, what: `Poids réel enregistré : ${fmtWeight(g)}` });
    await save(st);
    return json({ ok: true, state: st });
  }

  const parts = (await readAll("noel")).filter((p) => p && p.id);
  const byId = (id) => parts.find((p) => p.id === id);

  if (b.action === "draw") {
    if (!st.realWeight) return json({ error: "Indique d'abord le poids réel du nounours." }, 400);
    if (st.casque?.notifiedAt) return json({ error: "Le gagnant du casque a déjà été prévenu : nouveau tirage impossible." }, 409);
    const target = Math.round(st.realWeight / 100) * 100;
    let pool = parts.filter((p) => p.guess === target && p.id !== st.peluche?.id);
    let poolKind = "exact";
    if (!pool.length) {
      const others = parts.filter((p) => p.id !== st.peluche?.id);
      if (!others.length) return json({ error: "Aucun participant pour l'instant." }, 400);
      const best = Math.min(...others.map((p) => Math.abs(p.guess - st.realWeight)));
      pool = others.filter((p) => Math.abs(p.guess - st.realWeight) === best);
      poolKind = "closest";
    }
    const w = pool[crypto.randomInt(pool.length)];
    st.casque = { id: w.id, at: now, poolKind, poolSize: pool.length, poolIds: pool.map((p) => p.id), target };
    st.history.push({ t: now, what: `Tirage du casque : ${w.prenom} ${w.nom} (${pool.length} ${poolKind === "exact" ? "bonne(s) réponse(s)" : "pronostic(s) les plus proches"})` });
    await save(st);
    return json({ ok: true, state: st });
  }

  if (b.action === "pick") {
    const w = byId(b.id);
    if (!w) return json({ error: "Participant introuvable" }, 404);
    if (st.peluche?.notifiedAt) return json({ error: "Le gagnant du nounours a déjà été prévenu." }, 409);
    if (st.casque?.id === w.id) return json({ error: "Cette personne a déjà gagné le casque." }, 409);
    st.peluche = { id: w.id, at: now };
    st.history.push({ t: now, what: `Nounours attribué à ${w.prenom} ${w.nom}` });
    await save(st);
    return json({ ok: true, state: st });
  }

  if (b.action === "clear") {
    if (!KINDS.has(b.kind)) return json({ error: "Requête invalide" }, 400);
    if (st[b.kind]?.notifiedAt) return json({ error: "L'e-mail est déjà parti : impossible d'annuler." }, 409);
    st[b.kind] = null;
    st.history.push({ t: now, what: `Gagnant ${b.kind === "casque" ? "du casque" : "du nounours"} annulé` });
    await save(st);
    return json({ ok: true, state: st });
  }

  if (b.action === "notify") {
    if (!KINDS.has(b.kind) || !st[b.kind]) return json({ error: "Aucun gagnant choisi." }, 400);
    if (st[b.kind].notifiedAt) return json({ error: "E-mail déjà envoyé." }, 409);
    const w = byId(st[b.kind].id);
    if (!w) return json({ error: "Participant introuvable (supprimé ?)" }, 404);
    const m = await sendMail({ to: w.email, ...mailWinner(b.kind, w, st.realWeight) });
    if (!m.ok) return json({ error: m.error }, 502);
    st[b.kind].notifiedAt = now; st[b.kind].mailId = m.id;
    st.history.push({ t: now, what: `E-mail envoyé à ${w.prenom} ${w.nom} (${b.kind === "casque" ? "casque" : "nounours"})` });
    await save(st);
    return json({ ok: true, state: st });
  }

  return json({ error: "Requête invalide" }, 400);
};

export const config = { path: "/api/admin/noel" };
