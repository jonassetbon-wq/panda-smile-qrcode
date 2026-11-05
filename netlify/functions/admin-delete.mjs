import { store, json, readToken, keyFor } from "./lib/common.mjs";

// Suppression manuelle (réservée à l'administrateur) : un inscrit, ou remise à zéro complète.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const tok = await readToken(req);
  if (!tok?.admin) return json({ error: "Accès réservé" }, 401);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }

  if (b.reset === true) {
    let n = 0;
    for (const name of ["leads", "leadidx", "scans", "seen", "events"]) {
      const s = store(name);
      const { blobs } = await s.list();
      for (const x of blobs) { await s.delete(x.key); n++; }
    }
    return json({ ok: true, deleted: n });
  }

  if (typeof b.id === "string" && typeof b.t === "string") {
    const leads = store("leads"), idx = store("leadidx");
    const key = keyFor(b.t, b.id);
    const rec = await leads.get(key, { type: "json" });
    if (!rec || rec.id !== b.id) return json({ error: "Inscrit introuvable" }, 404);
    await leads.delete(key);
    const { blobs } = await idx.list();
    for (const x of blobs) { if ((await idx.get(x.key)) === key) await idx.delete(x.key); }
    return json({ ok: true });
  }
  return json({ error: "Requête invalide" }, 400);
};

export const config = { path: "/api/admin/delete" };
