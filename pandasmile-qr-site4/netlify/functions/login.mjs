import { json, findPerson, checkCode, signToken, store } from "./lib/common.mjs";

const MAX_TRIES = 8;
const LOCK_MIN = 15;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  const person = findPerson(body.id);
  const code = String(body.code || "").trim();
  if (!person || !/^\d{6}$/.test(code)) return json({ error: "Choisissez votre prénom et entrez un code à 6 chiffres." }, 400);

  // Anti-devinette : blocage 15 minutes après 8 essais ratés.
  const auth = store("auth");
  const st = (await auth.get(person.id, { type: "json" })) || { fails: 0, until: 0 };
  if (st.until > Date.now()) {
    const min = Math.ceil((st.until - Date.now()) / 60000);
    return json({ error: `Trop d'essais. Réessayez dans ${min} min.` }, 429);
  }
  if (!checkCode(person, code)) {
    const fails = st.fails + 1;
    await auth.setJSON(person.id, fails >= MAX_TRIES ? { fails: 0, until: Date.now() + LOCK_MIN * 60000 } : { fails, until: 0 });
    return json({ error: "Code incorrect." }, 401);
  }
  if (st.fails) await auth.setJSON(person.id, { fails: 0, until: 0 });

  await store("logins").setJSON(`${new Date().toISOString()}_${person.id}`, { a: person.id, t: new Date().toISOString() });

  const token = await signToken({ id: person.id, admin: person.admin, exp: Date.now() + 30 * 24 * 3600 * 1000 });
  return json({ token, id: person.id, label: person.label, admin: person.admin });
};

export const config = { path: "/api/login" };
