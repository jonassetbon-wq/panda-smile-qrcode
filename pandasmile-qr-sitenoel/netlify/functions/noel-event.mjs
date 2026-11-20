import { store, json, newId, keyFor, parseUA } from "./lib/common.mjs";

const TYPES = new Set(["view", "form", "start"]);

// Suivi de la page concours : page ouverte, formulaire atteint (après l'animation), formulaire commencé.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  let b;
  try { b = JSON.parse(await req.text()); } catch { return json({ ok: false }, 400); }
  if (!TYPES.has(b.type)) return json({ ok: false }, 400);
  const t = new Date().toISOString();
  const id = newId();
  const ua = parseUA(req.headers.get("user-agent") || "");
  await store("noelevents").setJSON(keyFor(t, id), {
    id, t, type: b.type,
    s: typeof b.s === "string" ? b.s.slice(0, 40) : "",
    os: ua.os, device: ua.device,
  });
  return json({ ok: true });
};

export const config = { path: "/api/noel/event" };
