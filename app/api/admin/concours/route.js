import crypto from 'crypto';
import { sb, json } from '@/lib/server';
import { staffFrom, logAction, isGuest } from '@/lib/staff';
import { CONCOURS as C, DISCOUNT_PREFIX } from '@/lib/concours';
import { sendConcoursResults } from '@/lib/mail';
import { concoursFunnel } from '@/lib/concoursFunnel';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const auth = (req) => { const s = staffFrom(req); return !s ? [null, 401] : isGuest(s) ? [null, 403] : [s, 0]; };
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rand = (n) => Array.from(crypto.randomBytes(n), (x) => ABC[x % ABC.length]).join('');

export async function GET(req) {
  const [, bad] = auth(req);
  if (bad) return json({ error: 'auth' }, bad);
  const { data, error } = await sb().from('concours')
    .select('id, first_name, last_name, atelier, email, phone, won, code, result_sent_at, created_at').order('created_at');
  if (error) return json({ error: 'db', detail: error.message }, 500);
  // Résultats : chaque participant a-t-il pris sa place avec son code, et est-il venu ?
  const { data: tk } = await sb().from('tickets').select('numero, status, email, promo_code, scanned_at, paid_at').in('status', ['paid', 'refunded']);
  const { fate, ...funnel } = concoursFunnel(data || [], tk || []);
  const rows = (data || []).map((r) => ({ ...r, ticket: r.result_sent_at ? fate(r) : null }));
  return json({ rows, funnel, places: C.places, discount: C.discount, closesAt: C.closesAt, closesLabel: C.closesLabel });
}

// { action: 'toggle', id, won } : coche / décoche un gagnant (tant que son résultat n'est pas parti)
// { action: 'send' } : crée les codes et envoie les mails à tous ceux qui n'ont pas encore reçu leur résultat
export async function POST(req) {
  const [staff, bad] = auth(req);
  if (bad) return json({ error: 'auth' }, bad);
  const b = await req.json().catch(() => ({}));

  if (b.action === 'toggle') {
    const { error } = await sb().from('concours').update({ won: !!b.won }).eq('id', b.id).is('result_sent_at', null);
    if (error) return json({ error: "La modification n'a pas été enregistrée." }, 500);
    return json({ ok: true });
  }

  if (b.action === 'send') {
    const { data: rows, error } = await sb().from('concours').select('*').is('result_sent_at', null).order('created_at');
    if (error) return json({ error: 'db' }, 500);
    if (!rows?.length) return json({ error: 'Tout le monde a déjà reçu son résultat.' }, 400);
    // Un code par personne, enregistré avant l'envoi
    for (const r of rows) {
      if (r.code) continue;
      const code = r.won ? `B31-${rand(6)}` : `${DISCOUNT_PREFIX}${rand(6)}`;
      const { error: e1 } = await sb().from('promo_codes').insert({ code, percent_off: r.won ? null : C.discount });
      if (e1) return json({ error: 'Création des codes impossible : as-tu lancé supabase/concours.sql ?' }, 500);
      await sb().from('concours').update({ code }).eq('id', r.id);
      r.code = code;
    }
    let sent = 0;
    try { sent = await sendConcoursResults(rows); }
    catch (e) { console.error(e); return json({ error: `Envoi interrompu : ${e.message}` }, 500); }
    await sb().from('concours').update({ result_sent_at: new Date().toISOString() }).in('id', rows.map((r) => r.id));
    const wins = rows.filter((r) => r.won).length;
    await logAction(staff, 'concours', null, { gagnants: wins, reduction: rows.length - wins });
    return json({ ok: true, sent, wins });
  }
  return json({ error: 'Action inconnue.' }, 400);
}
