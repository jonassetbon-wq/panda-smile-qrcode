import { json, readToken, readAll, people } from "./lib/common.mjs";
import { attendees, WEBINAR } from "./lib/webinar.mjs";
import { NOEL, readState } from "./lib/noel.mjs";
import { GALETTE } from "./lib/galette.mjs";

// Toutes les données brutes pour le tableau de bord. Réservé à l'administrateur.
export default async (req) => {
  const tok = await readToken(req);
  if (!tok?.admin) return json({ error: "Accès réservé" }, 401);
  const [scans, events, leads, logins, webi, webiEvents, noel, noelEvents, noelState, galette, galetteEvents] = await Promise.all([readAll("scans"), readAll("events"), readAll("leads"), readAll("logins"), readAll("webi"), readAll("webievents"), readAll("noel"), readAll("noelevents"), readState(), readAll("galette"), readAll("galetteevents")]);
  return json({
    generatedAt: new Date().toISOString(),
    people: people.map(({ id, label, fullName }) => ({ id, label, fullName })),
    scans, events, leads, logins,
    webinar: { ...WEBINAR, attendees }, webi, webiEvents,
    noelGame: NOEL, noel, noelEvents, noelState,
    galetteEvent: GALETTE, galette, galetteEvents,
  });
};

export const config = { path: "/api/admin/data" };
