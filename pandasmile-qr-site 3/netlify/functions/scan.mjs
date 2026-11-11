import { store, findPerson, newId, keyFor, parseUA, readCookie } from "./lib/common.mjs";

// Chaque QR code pointe ici : /s/<ambassadeur>. On note le scan, puis on ouvre le formulaire.
export default async (req, context) => {
  const id = context.params?.id || new URL(req.url).pathname.split("/").pop();
  const person = findPerson(id);
  const base = new URL(req.url).origin;
  if (!person) return Response.redirect(`${base}/f/`, 302);

  let vid = readCookie(req, "ps_vid");
  const firstVisit = !vid;
  if (!vid) vid = newId();

  const t = new Date().toISOString();
  const scanId = newId();
  const ua = req.headers.get("user-agent") || "";
  const geo = context.geo || {};
  const rec = {
    id: scanId,
    t,
    a: person.id,
    vid,
    firstVisit,
    ...parseUA(ua),
    lang: (req.headers.get("accept-language") || "").split(",")[0] || "",
    city: geo.city || "",
    region: geo.subdivision?.name || "",
    country: geo.country?.code || "",
  };
  // Anti-doublon : un même téléphone qui rescanne le QR code du même ambassadeur ne compte qu'une fois.
  // Pas d'adresse IP stockée : seulement la ville approximative.
  let sid = scanId;
  try {
    const seen = store("seen");
    const seenKey = `${person.id}_${vid}`;
    const prev = firstVisit ? null : await seen.get(seenKey);
    if (prev) sid = prev;
    else {
      await store("scans").setJSON(keyFor(t, scanId), rec);
      await seen.set(seenKey, scanId);
    }
  } catch (e) { console.error("scan store", e); }

  return new Response(null, {
    status: 302,
    headers: {
      location: `${base}/f/?a=${encodeURIComponent(person.id)}&s=${sid}`,
      "set-cookie": `ps_vid=${vid}; Path=/; Max-Age=${90 * 24 * 3600}; SameSite=Lax; Secure; HttpOnly`,
      "cache-control": "no-store",
    },
  });
};

export const config = { path: "/s/:id" };
