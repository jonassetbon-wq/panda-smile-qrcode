import { sb, json } from '@/lib/server';
import { staffFrom, isGuest } from '@/lib/staff';
import { EVENT } from '@/lib/event';
import { parseAtelier } from '@/lib/ateliers';
import { BTR } from '@/lib/btr';
import { concoursFunnel } from '@/lib/concoursFunnel';
export const dynamic = 'force-dynamic';

const DAY = 864e5;
const paris = (t) => new Date(new Date(t).toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
const dayKey = (t) => { const d = paris(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Bilan de la soirée, recalculé à chaque ouverture : ventes, argent, public, entrées, site, concours, comparaison avec BTR
export async function GET(req) {
  const me = staffFrom(req);
  if (!me) return json({ error: 'auth' }, 401);
  if (isGuest(me)) return json({ error: 'interdit' }, 403);

  const open = Date.parse(EVENT.salesOpenAt), start = Date.parse(EVENT.startsAt);
  const [tk, tiersR, cc, rec, codes, visits] = await Promise.all([
    sb().from('tickets').select('numero, order_id, status, price, paid_at, scanned_at, atelier, marketing_optout, refunded_amount, email, promo_code, tiers(name)').in('status', ['paid', 'refunded']),
    sb().rpc('tier_status'),
    sb().from('concours').select('won, result_sent_at, code, email'),
    sb().from('recrutement').select('slot'),
    sb().from('promo_codes').select('used_at, percent_off'),
    sb().from('site_visits').select('at, path, source, visitor').gte('at', new Date(open - 7 * DAY).toISOString()).limit(50000),
  ]);
  const all = tk.data || [];
  const paid = all.filter((t) => t.status === 'paid');
  const refunded = all.filter((t) => t.status === 'refunded');
  const fee = (EVENT.serviceFee || 0) / 100;
  const priced = (t) => t.price > 0;

  // Argent
  const gross = all.reduce((a, t) => a + t.price / 100 + (priced(t) ? fee : 0), 0);
  const back = refunded.reduce((a, t) => a + (t.refunded_amount ?? t.price) / 100, 0);
  const payments = new Set(all.filter(priced).map((t) => t.order_id)).size;
  const net = gross - back - payments * 0.25 - gross * 0.015;   // frais Stripe estimés (1,5 % + 0,25 € par paiement)

  // Ventes jour par jour depuis l'ouverture
  const days = [];
  for (let t = open; t < Math.max(Date.now(), open + DAY) && days.length < 30; t += DAY) days.push(dayKey(t));
  const byDay = Object.fromEntries(days.map((d) => [d, 0]));
  const dated = paid.filter((t) => t.paid_at);
  dated.forEach((t) => { const k = dayKey(t.paid_at); if (k in byDay) byDay[k]++; });
  let cum = 0;
  const curve = days.map((d) => (cum += byDay[d]));
  const hours = Array(24).fill(0); dated.forEach((t) => { hours[paris(t.paid_at).getHours()]++; });
  const today = byDay[dayKey(Date.now())] || 0;

  // Commandes
  const orders = new Set(paid.map((t) => t.order_id)).size;
  const optin = paid.filter((t) => t.marketing_optout === false).length;

  // Public : années, filières, extérieurs
  const years = { P1: 0, '2': 0, '3': 0, '4': 0, '5': 0, EXT: 0, NONE: 0 }, fil = { AI: 0, C: 0, DA: 0 };
  paid.forEach((t) => { const a = parseAtelier(t.atelier); years[a.y] = (years[a.y] || 0) + 1; if (a.f) fil[a.f] = (fil[a.f] || 0) + 1; });

  // Soirée : entrées par quart d'heure
  const inside = paid.filter((t) => t.scanned_at);
  const q = {}; inside.forEach((t) => { const d = paris(t.scanned_at); const k = `${String(d.getHours()).padStart(2, '0')}h${String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0')}`; q[k] = (q[k] || 0) + 1; });
  const quarters = Object.entries(q).sort(([a], [b]) => (a < '12' ? '24' + a : a).localeCompare(b < '12' ? '24' + b : b));

  // Site : visites anonymes
  const V = visits.error ? null : visits.data || [];
  const site = V && {
    views: V.length,
    unique: new Set(V.map((v) => `${dayKey(v.at)}:${v.visitor}`)).size,
    sources: Object.entries(V.reduce((o, v) => ({ ...o, [v.source]: (o[v.source] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 8),
    pages: Object.entries(V.reduce((o, v) => ({ ...o, [v.path]: (o[v.path] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]),
    byDay: days.map((d) => V.filter((v) => dayKey(v.at) === d).length),
  };
  // Taux d'achat : seulement les billets vendus depuis le début du comptage, sinon le chiffre n'a pas de sens
  if (site) {
    const since = V.reduce((m, v) => Math.min(m, Date.parse(v.at)), Infinity);
    const sold = dated.filter((t) => Date.parse(t.paid_at) >= since).length;
    site.since = Number.isFinite(since) ? new Date(since).toISOString() : null;
    site.conv = site.unique >= 20 ? Math.min(100, pct(sold, site.unique)) : null;
  }

  const tiers = (tiersR.data || []).filter((t) => !(EVENT.hiddenTiers || []).includes(t.id) || t.taken > 0);
  const capacity = tiers.reduce((a, t) => a + Math.max(t.capacity, t.taken), 0);
  const dayIdx = Math.max(0, days.length - 1);
  return json({
    at: new Date().toISOString(),
    event: { title: EVENT.title, open, start, started: Date.now() >= start },
    sales: { sold: paid.length, capacity, fill: pct(paid.length, capacity), today, firstDay: curve[0] || 0, days: days.map((d, i) => ({ d, n: byDay[d], cum: curve[i] })), hours,
      orders, perOrder: orders ? Math.round((paid.length / orders) * 100) / 100 : 0, optin: pct(optin, paid.length), refunded: refunded.length,
      tiers: tiers.map((t) => ({ name: t.name, taken: t.taken, capacity: t.capacity, price: t.price / 100, hidden: (EVENT.hiddenTiers || []).includes(t.id) })) },
    money: { gross: Math.round(gross * 100) / 100, refunded: Math.round(back * 100) / 100, net: Math.round(net * 100) / 100 },
    public: { years, fil, ext: pct(years.EXT, paid.length), p1: pct(years.P1, paid.length), ateliers: pct(paid.length - years.NONE, paid.length) },
    night: { inside: inside.length, presence: pct(inside.length, paid.length), quarters, peak: quarters.reduce((m, [, n]) => Math.max(m, n), 0) },
    concours: cc.error ? null : (() => { const { fate, ...f } = concoursFunnel(cc.data || [], all); return { participants: (cc.data || []).length, winners: (cc.data || []).filter((r) => r.won).length, sent: (cc.data || []).filter((r) => r.result_sent_at).length, funnel: f }; })(),
    codes: { invitations: (codes.data || []).filter((c) => c.percent_off == null && c.used_at).length, discounts: (codes.data || []).filter((c) => c.percent_off != null && c.used_at).length },
    recrutement: rec.error ? null : (rec.data || []).length,
    site,
    btr: { ...BTR, sameDay: BTR.curve[Math.min(dayIdx, BTR.curve.length - 1)] },
  });
}
