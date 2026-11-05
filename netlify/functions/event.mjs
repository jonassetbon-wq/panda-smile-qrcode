import { store, json, findPerson, newId, keyFor } from "./lib/common.mjs";

const TYPES = new Set(["view", "start", "abandon"]);

// Suivi de l'entonnoir : page vue, formulaire commencé, abandon (dernier champ touché).
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  let b;
  try { b = JSON.parse(await req.text()); } catch { return json({ ok: false }, 400); }
  if (!TYPES.has(b.type)) return json({ ok: false }, 400);
  const t = new Date().toISOString();
  const id = newId();
  await store("events").setJSON(keyFor(t, id), {
    id, t, type: b.type,
    a: findPerson(b.a) ? b.a : "",
    s: typeof b.s === "string" ? b.s.slice(0, 40) : "",
    field: typeof b.field === "string" ? b.field.slice(0, 30) : "",
    filled: Number.isFinite(b.filled) ? b.filled : null,
  });
  return json({ ok: true });
};

export const config = { path: "/api/event" };
