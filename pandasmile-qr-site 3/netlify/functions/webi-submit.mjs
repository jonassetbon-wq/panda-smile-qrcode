import { store, json, newId, keyFor } from "./lib/common.mjs";
import { findAttendee, CHOICES, WEBINAR } from "./lib/webinar.mjs";

const clean = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Code postal → commune, département, coordonnées (Base Adresse Nationale, gratuite).
async function geoPostcode(cp) {
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?type=municipality&limit=1&q=${cp}`, { signal: AbortSignal.timeout(4000) });
    const f = (await r.json()).features?.[0];
    if (!f) return null;
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties;
    const [deptCode = "", deptName = "", region = ""] = (p.context || "").split(",").map((s) => s.trim());
    return { lat, lon, label: `${cp} ${p.city}`, city: p.city, postcode: cp, deptCode, deptName, region };
  } catch {
    return null;
  }
}

/*
  POST /api/webi/submit
  - { action: "status", who }            → a-t-il déjà répondu ?
  - { action: "answer", who, ... }        → enregistre les réponses (une seule réponse par inscrit, la dernière compte)
  - { action: "referral", ref, id, ... }  → ajoute la recommandation d'un confrère à une réponse
*/
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const answers = store("webi"), idx = store("webiidx");

  if (b.action === "status") {
    const who = findAttendee(b.who);
    if (!who) return json({ answered: false });
    return json({ answered: !!(await idx.get(who.id)) });
  }

  if (b.action === "referral") {
    if (typeof b.ref !== "string" || typeof b.id !== "string") return json({ error: "Requête invalide" }, 400);
    const rec = await answers.get(b.ref, { type: "json" });
    if (!rec || rec.id !== b.id) return json({ error: "Réponse introuvable" }, 404);
    const email = clean(b.email, 150).toLowerCase();
    if (!EMAIL.test(email)) return json({ error: "E-mail invalide", fields: ["email"] }, 400);
    rec.referral = { prenom: clean(b.prenom, 80), email, profession: clean(b.profession, 60), t: new Date().toISOString() };
    await answers.setJSON(b.ref, rec);
    return json({ ok: true });
  }

  if (b.action !== "answer") return json({ error: "Requête invalide" }, 400);

  // Qui répond : un inscrit de la liste, ou une personne absente de la liste (nom + e-mail saisis).
  let who = findAttendee(b.who), person;
  if (who) person = { attendee: who.id, name: who.name, email: who.email, listed: true };
  else {
    const name = clean(b.name, 120), email = clean(b.email, 150).toLowerCase();
    if (!name || !EMAIL.test(email)) return json({ error: "Nom et e-mail requis", fields: ["name", "email"] }, 400);
    person = { attendee: "", name, email, listed: false };
  }

  const rating = Number(b.rating);
  const pick = (v, list) => (list.includes(v) ? v : "");
  const other = (v, list, n = 80) => (list.includes(v) ? { v, other: "" } : clean(v, n) ? { v: "Autre", other: clean(v, n) } : { v: "", other: "" });
  const prof = other(b.profession, CHOICES.profession);
  const src = other(b.source, CHOICES.source);
  const cp = clean(b.postcode, 5);

  const missing = [];
  if (!(rating >= 1 && rating <= 5)) missing.push("rating");
  if (!pick(b.learned, CHOICES.learned)) missing.push("learned");
  if (!pick(b.tryApp, CHOICES.tryApp)) missing.push("tryApp");
  if (!prof.v) missing.push("profession");
  if (!src.v) missing.push("source");
  if (!/^\d{5}$/.test(cp)) missing.push("postcode");
  if (missing.length) return json({ error: "Champs manquants", fields: missing }, 400);

  const t = new Date().toISOString();
  const id = newId();
  const rec = {
    id, t, webinar: WEBINAR.id, ...person,
    rating: Math.round(rating),
    learned: b.learned,
    length: pick(b.length, CHOICES.length),
    tryApp: b.tryApp,
    profession: prof.v === "Autre" ? prof.other : prof.v,
    professionOther: prof.v === "Autre",
    source: src.v, sourceOther: src.other,
    postcode: cp,
    topic: clean(b.topic, 400),
    message: clean(b.message, 600),
    geo: await geoPostcode(cp),
    durationSec: Number.isFinite(Date.parse(b.startedAt)) ? Math.max(0, Math.round((Date.now() - Date.parse(b.startedAt)) / 1000)) : null,
  };

  // Une seule réponse par inscrit : la nouvelle remplace l'ancienne (on garde sa recommandation éventuelle).
  const idxKey = person.listed ? person.attendee : `e_${person.email.replace(/[^\w@.+-]/g, "_")}`;
  const old = await idx.get(idxKey);
  if (old) {
    const prev = await answers.get(old, { type: "json" });
    if (prev?.referral) rec.referral = prev.referral;
    await answers.delete(old);
  }
  const key = keyFor(t, id);
  await answers.setJSON(key, rec);
  await idx.set(idxKey, key);
  return json({ ok: true, id, ref: key });
};

export const config = { path: "/api/webi/submit" };
