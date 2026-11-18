import { store, json, newId, keyFor } from "./lib/common.mjs";
import { findAttendee } from "./lib/webinar.mjs";

const TYPES = new Set(["view", "pick", "copy", "open"]);

// Suivi du questionnaire webinaire : page ouverte, nom choisi, code promo copié, lien PandaSmile Pro ouvert.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  let b;
  try { b = JSON.parse(await req.text()); } catch { return json({ ok: false }, 400); }
  if (!TYPES.has(b.type)) return json({ ok: false }, 400);
  const t = new Date().toISOString();
  const id = newId();
  await store("webievents").setJSON(keyFor(t, id), {
    id, t, type: b.type,
    who: findAttendee(b.who) ? b.who : "",
    s: typeof b.s === "string" ? b.s.slice(0, 40) : "",
  });
  return json({ ok: true });
};

export const config = { path: "/api/webi/event" };
