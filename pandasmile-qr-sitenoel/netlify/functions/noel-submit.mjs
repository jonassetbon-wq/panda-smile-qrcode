import { store, json, newId, keyFor, parseUA } from "./lib/common.mjs";
import { NOEL, WEIGHTS, normPhone, isOpen, idxKeys, mailConfirmation, fmtWeight } from "./lib/noel.mjs";
import { sendMail } from "./lib/mail.mjs";

const clean = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
  POST /api/noel/submit  { prenom, nom, email, tel, guess, consent, startedAt, s }
  Une seule participation par e-mail et par téléphone : la première compte, les suivantes sont refusées.
*/
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  if (!isOpen()) return json({ error: "Le jeu est terminé.", closed: true }, 403);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }

  const prenom = clean(b.prenom, 60), nom = clean(b.nom, 80);
  const email = clean(b.email, 150).toLowerCase();
  const tel = clean(b.tel, 30);
  const phone = normPhone(tel);
  const guess = Number(b.guess);

  const bad = [];
  if (!prenom) bad.push("prenom");
  if (!nom) bad.push("nom");
  if (!EMAIL.test(email)) bad.push("email");
  if (!/^0[1-9]\d{8}$/.test(phone) && !/^\+?\d{10,15}$/.test(tel.replace(/[\s.-]/g, ""))) bad.push("tel");
  if (!WEIGHTS.includes(guess)) bad.push("guess");
  if (b.consent !== true) bad.push("consent");
  if (bad.length) return json({ error: "Champs manquants ou invalides", fields: bad }, 400);

  const parts = store("noel"), idx = store("noelidx");
  const keys = idxKeys(email, phone);
  for (const k of keys) {
    const old = await idx.get(k);
    if (old) {
      const prev = await parts.get(old, { type: "json" });
      if (prev) return json({ error: "already", already: true, guess: prev.guess, guessLabel: fmtWeight(prev.guess), by: k.startsWith("e_") ? "email" : "tel" }, 409);
    }
  }

  const t = new Date().toISOString();
  const id = newId();
  const started = Date.parse(b.startedAt);
  const ua = parseUA(req.headers.get("user-agent") || "");
  const rec = {
    id, t, game: NOEL.id,
    prenom, nom, email, tel, phone, guess,
    consent: true,
    s: clean(b.s, 40),
    os: ua.os, device: ua.device,
    durationSec: Number.isFinite(started) ? Math.max(0, Math.round((Date.now() - started) / 1000)) : null,
    mail: null,
  };
  const key = keyFor(t, id);
  await parts.setJSON(key, rec);
  for (const k of keys) await idx.set(k, key);

  // E-mail de confirmation : la participation compte même si l'envoi échoue.
  const m = await sendMail({ to: email, ...mailConfirmation(rec) });
  rec.mail = m.ok ? { ok: true, id: m.id, t: new Date().toISOString() } : { ok: false, error: m.error };
  await parts.setJSON(key, rec);

  return json({ ok: true, id, guess, guessLabel: fmtWeight(guess), mailSent: m.ok });
};

export const config = { path: "/api/noel/submit" };
