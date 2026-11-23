import { store, json, newId, keyFor, parseUA } from "./lib/common.mjs";
import { normPhone, idxKeys } from "./lib/noel.mjs";
import { GALETTE, isOpenGalette } from "./lib/galette.mjs";

const clean = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
  POST /api/galette/submit  { prenom, nom, email, tel, consent, startedAt, s }
  Une seule inscription par e-mail et par téléphone : la première compte.
*/
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!isOpenGalette()) return json({ error: "Les inscriptions sont closes.", closed: true }, 403);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }

  const prenom = clean(b.prenom, 60), nom = clean(b.nom, 80);
  const email = clean(b.email, 150).toLowerCase();
  const tel = clean(b.tel, 30);
  const phone = normPhone(tel);

  const bad = [];
  if (!prenom) bad.push("prenom");
  if (!nom) bad.push("nom");
  if (!EMAIL.test(email)) bad.push("email");
  if (!/^0[1-9]\d{8}$/.test(phone) && !/^\+?\d{10,15}$/.test(tel.replace(/[\s.-]/g, ""))) bad.push("tel");
  if (b.consent !== true) bad.push("consent");
  if (bad.length) return json({ error: "Champs manquants ou invalides", fields: bad }, 400);

  const regs = store("galette"), idx = store("galetteidx");
  const keys = idxKeys(email, phone);
  for (const k of keys) {
    const old = await idx.get(k);
    if (old) {
      const prev = await regs.get(old, { type: "json" });
      if (prev) return json({ error: "already", already: true, prenom: prev.prenom, by: k.startsWith("e_") ? "email" : "tel" }, 409);
    }
  }

  const t = new Date().toISOString();
  const id = newId();
  const started = Date.parse(b.startedAt);
  const ua = parseUA(req.headers.get("user-agent") || "");
  const rec = {
    id, t, event: GALETTE.id,
    prenom, nom, email, tel, phone,
    consent: true,
    s: clean(b.s, 40),
    os: ua.os, device: ua.device,
    durationSec: Number.isFinite(started) ? Math.max(0, Math.round((Date.now() - started) / 1000)) : null,
  };
  const key = keyFor(t, id);
  await regs.setJSON(key, rec);
  for (const k of keys) await idx.set(k, key);
  return json({ ok: true, id, prenom });
};

export const config = { path: "/api/galette/submit" };
