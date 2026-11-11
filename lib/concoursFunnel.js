// Résultats du jeu concours : après l'envoi des codes (place offerte ou −50 %), qui a pris sa place, qui est venu.
// Un code est « utilisé » quand un billet payé (ou offert) porte ce code. On repère aussi les participants
// qui ont un billet sans leur code (acheté avant l'envoi des résultats, ou après au prix normal).

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// rows : participants (concours) ; tickets : billets payés ou remboursés (numero, status, email, promo_code, scanned_at, paid_at)
export function concoursFunnel(rows, tickets) {
  const live = (tickets || []).filter((t) => t.status === 'paid');
  const byCode = new Map(live.filter((t) => t.promo_code).map((t) => [String(t.promo_code).toUpperCase(), t]));
  const byMail = new Map();
  live.forEach((t) => { const k = String(t.email || '').toLowerCase(); if (k && !byMail.has(k)) byMail.set(k, t); });

  // ce que chaque participant a fait de son résultat
  const fate = (r) => {
    const t = r.code && byCode.get(String(r.code).toUpperCase());
    if (t) return { kind: 'code', numero: t.numero, scanned: !!t.scanned_at };
    const m = byMail.get(String(r.email || '').toLowerCase());
    if (m) return { kind: m.paid_at && r.result_sent_at && m.paid_at < r.result_sent_at ? 'avant' : 'sans', numero: m.numero, scanned: !!m.scanned_at };
    return { kind: 'rien' };
  };
  const group = (list) => {
    const f = list.map(fate);
    const used = f.filter((x) => x.kind === 'code'), before = f.filter((x) => x.kind === 'avant'), without = f.filter((x) => x.kind === 'sans');
    const came = (a) => a.filter((x) => x.scanned).length;
    return {
      sent: list.length,
      used: used.length, usedPct: pct(used.length, list.length), usedCame: came(used),
      before: before.length, without: without.length, otherCame: came(before) + came(without),
      none: f.filter((x) => x.kind === 'rien').length,
      came: came(f), camePct: pct(came(f), list.length),
    };
  };
  const sent = (rows || []).filter((r) => r.result_sent_at);
  return {
    participants: (rows || []).length,
    sent: sent.length,
    winners: group(sent.filter((r) => r.won)),
    discount: group(sent.filter((r) => !r.won)),
    fate,
  };
}
