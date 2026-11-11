import { store, RETENTION_DAYS } from "./lib/common.mjs";

// Chaque nuit : supprime tout ce qui a plus de 3 mois (engagement des CGU).
export default async () => {
  const limit = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString().replace(/[:.]/g, "-");
  let removed = 0;
  for (const name of ["leads", "scans", "events", "logins", "webi", "webievents"]) {
    const s = store(name);
    const { blobs } = await s.list();
    for (const b of blobs) {
      if (b.key.slice(0, limit.length) < limit) { await s.delete(b.key); removed++; }
    }
  }
  // Index anti-doublon : on retire les entrées qui pointent vers des inscrits effacés.
  for (const name of ["leadidx", "webiidx"]) {
    const s = store(name);
    const { blobs } = await s.list();
    for (const b of blobs) { const k = await s.get(b.key); if (k && k.slice(0, limit.length) < limit) { await s.delete(b.key); removed++; } }
  }
  console.log(`cleanup: ${removed} enregistrements supprimés`);
};

export const config = { schedule: "@daily" };
