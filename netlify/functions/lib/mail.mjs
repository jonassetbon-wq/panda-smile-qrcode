// Envoi d'e-mails via Resend (https://resend.com).
// Variables d'environnement Netlify :
//   RESEND_API_KEY  clé API Resend (obligatoire pour envoyer)
//   MAIL_FROM       expéditeur, par défaut « PandaSmile <concours@pandasmile.shop> » (domaine à vérifier dans Resend)
//   MAIL_REPLY_TO   adresse de réponse (facultatif)
export const mailReady = () => !!process.env.RESEND_API_KEY;

export async function sendMail({ to, subject, html, text }) {
  if (!mailReady()) return { ok: false, error: "E-mails non configurés (clé RESEND_API_KEY absente)" };
  const body = {
    from: process.env.MAIL_FROM || "PandaSmile <concours@pandasmile.shop>",
    to: [to], subject, html, text,
  };
  if (process.env.MAIL_REPLY_TO) body.reply_to = process.env.MAIL_REPLY_TO;
  try {
    const r = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: d.message || `Erreur Resend ${r.status}` };
    return { ok: true, id: d.id || "" };
  } catch (e) {
    return { ok: false, error: "Service d'e-mail injoignable" };
  }
}
