import { store, json } from "./lib/common.mjs";

const RANGES = new Set(["<20", "20-50", "50-100", "100-200", ">200"]);

// Après le formulaire : nombre de patients en éducation fonctionnelle (facultatif).
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  if (!RANGES.has(b.patients) || typeof b.ref !== "string" || typeof b.id !== "string") return json({ error: "Requête invalide" }, 400);
  const leads = store("leads");
  const rec = await leads.get(b.ref, { type: "json" });
  if (!rec || rec.id !== b.id) return json({ error: "Inscription introuvable" }, 404);
  rec.patients = b.patients;
  await leads.setJSON(b.ref, rec);
  return json({ ok: true });
};

export const config = { path: "/api/patients" };
