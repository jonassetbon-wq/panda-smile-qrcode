import { json, readToken, readAll, people } from "./lib/common.mjs";

// Toutes les données brutes pour le tableau de bord. Réservé à l'administrateur.
export default async (req) => {
  const tok = await readToken(req);
  if (!tok?.admin) return json({ error: "Accès réservé" }, 401);
  const [scans, events, leads, logins] = await Promise.all([readAll("scans"), readAll("events"), readAll("leads"), readAll("logins")]);
  return json({
    generatedAt: new Date().toISOString(),
    people: people.map(({ id, label, fullName }) => ({ id, label, fullName })),
    scans, events, leads, logins,
  });
};

export const config = { path: "/api/admin/data" };
