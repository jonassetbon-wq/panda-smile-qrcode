import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import people from "./people.mjs";

export { people };
export const RETENTION_DAYS = 90; // 3 mois, comme annoncé dans les CGU

export const store = (name) => getStore({ name, consistency: "strong" });

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export const findPerson = (id) => people.find((p) => p.id === id);

// Clé de signature des sessions : créée une fois, gardée dans le stockage Netlify.
let cachedSecret;
async function secret() {
  if (cachedSecret) return cachedSecret;
  const cfg = store("config");
  let s = await cfg.get("session-secret");
  if (!s) {
    s = crypto.randomBytes(32).toString("hex");
    await cfg.set("session-secret", s);
  }
  return (cachedSecret = s);
}

const b64u = (s) => Buffer.from(s).toString("base64url");

export async function signToken(payload) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac("sha256", await secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export async function readToken(req) {
  const h = req.headers.get("authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [body, mac] = tok.split(".");
  if (!body || !mac) return null;
  const good = crypto.createHmac("sha256", await secret()).update(body).digest("base64url");
  if (good.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(mac))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (p.exp && p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export function checkCode(person, code) {
  const h = crypto.pbkdf2Sync(String(code), Buffer.from(person.salt, "hex"), 150000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(person.hash));
}

export const newId = () => crypto.randomUUID();
export const keyFor = (iso, id) => `${iso.replace(/[:.]/g, "-")}_${id}`;

// Lit tous les enregistrements d'un magasin (quelques centaines à quelques milliers).
export async function readAll(name) {
  const s = store(name);
  const { blobs } = await s.list();
  const out = [];
  for (let i = 0; i < blobs.length; i += 50) {
    const part = await Promise.all(blobs.slice(i, i + 50).map((b) => s.get(b.key, { type: "json" })));
    out.push(...part.filter(Boolean));
  }
  return out;
}

export function parseUA(ua = "") {
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : "Autre";
  const browser = /CriOS|Chrome\//.test(ua) && !/Edg/.test(ua) ? "Chrome" : /FxiOS|Firefox/.test(ua) ? "Firefox" : /Edg/.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /Safari/.test(ua) ? "Safari" : "Autre";
  const device = /iPad|Tablet/.test(ua) ? "Tablette" : /Mobi|iPhone|Android/.test(ua) ? "Mobile" : "Ordinateur";
  return { os, browser, device };
}

export function readCookie(req, name) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
