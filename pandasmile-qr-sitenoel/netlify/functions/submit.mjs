import { store, json, findPerson, newId, keyFor, readCookie } from "./lib/common.mjs";

const PROFESSIONS = ["Dentiste", "Orthodontiste", "Chirurgien-dentiste", "Orthophoniste", "Kinésithérapeute"];
const clean = (v, n = 200) => String(v ?? "").trim().slice(0, n);

async function geocode(q) {
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(4000) });
    const f = (await r.json()).features?.[0];
    if (!f) return null;
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties;
    const [deptCode = "", deptName = "", region = ""] = (p.context || "").split(",").map((s) => s.trim());
    return { lat, lon, label: p.label, city: p.city, postcode: p.postcode, deptCode, deptName, region, score: Math.round((p.score || 0) * 100) / 100 };
  } catch {
    return null;
  }
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }

  const lead = {
    prenom: clean(b.prenom, 80),
    nom: clean(b.nom, 80),
    profession: clean(b.profession, 40),
    cabinet: clean(b.cabinet, 150),
    adresse: clean(b.adresse, 250),
    tel: clean(b.tel, 30),
    email: clean(b.email, 150).toLowerCase(),
  };
  const missing = Object.entries(lead).filter(([k, v]) => !v && k !== "cabinet").map(([k]) => k); // cabinet facultatif
  if (missing.length) return json({ error: "Champs manquants", fields: missing }, 400);
  if (!PROFESSIONS.includes(lead.profession)) return json({ error: "Profession inconnue" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return json({ error: "E-mail invalide", fields: ["email"] }, 400);
  if (b.consent !== true) return json({ error: "Consentement requis" }, 400);

  const t = new Date().toISOString();
  const id = newId();
  const geo = await geocode(lead.adresse);
  const started = Date.parse(b.startedAt);
  const rec = {
    id, t,
    a: findPerson(b.a) ? b.a : "",
    s: clean(b.s, 40),
    vid: readCookie(req, "ps_vid") || "",
    ...lead,
    consent: true,
    consentText: clean(b.consentText, 300),
    durationSec: Number.isFinite(started) ? Math.max(0, Math.round((Date.now() - started) / 1000)) : null,
    geo,
  };
  // Anti-doublon : un même e-mail ou un même téléphone ne compte qu'une fois (on garde la dernière version).
  const leads = store("leads"), idx = store("leadidx");
  const phone = lead.tel.replace(/\D/g, "").replace(/^33/, "0");
  const idxKeys = [`e_${lead.email}`, phone.length >= 9 ? `t_${phone}` : null].filter(Boolean).map((k) => k.replace(/[^\w@.+-]/g, "_"));
  for (const k of idxKeys) {
    const old = await idx.get(k);
    if (old) {
      const prev = await leads.get(old, { type: "json" });
      if (prev) {
        if (prev.patients && !rec.patients) rec.patients = prev.patients;
        rec.duplicateOf = (prev.duplicateOf || 0) + 1;
        if (!rec.a && prev.a) rec.a = prev.a;
        await leads.delete(old);
      }
    }
  }
  const key = keyFor(t, id);
  await leads.setJSON(key, rec);
  for (const k of idxKeys) await idx.set(k, key);
  return json({ ok: true, id, ref: key });
};

export const config = { path: "/api/submit" };
