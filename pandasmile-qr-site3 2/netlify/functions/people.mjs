import { people, json } from "./lib/common.mjs";

// Liste des prénoms affichés sur l'écran de connexion (jamais les codes).
export default async () => json(people.map(({ id, label }) => ({ id, label })), 200, { "cache-control": "public, max-age=300" });

export const config = { path: "/api/people" };
