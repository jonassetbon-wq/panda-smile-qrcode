import { json } from "./lib/common.mjs";
import { attendees, WEBINAR } from "./lib/webinar.mjs";

// Liste publique des inscrits au webinaire : identifiant et « Prénom + initiale » seulement, jamais l'e-mail.
export default async () => json({ title: WEBINAR.title, people: attendees.map(({ id, label }) => ({ id, label })) });

export const config = { path: "/api/webi/people" };
