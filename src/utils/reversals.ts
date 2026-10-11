// Compra que deu erro e foi estornada pelo banco: o extrato mostra a saída e,
// depois, "Estorno - <mesma descrição>" com o mesmo valor. As duas linhas se
// anulam, então o melhor é não salvar nenhuma (sobra só a compra que deu certo).

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const REVERSAL_PREFIX = /^(estorno|reembolso|devolucao|cancelamento)( de)?\s*-?\s*/;

export function isReversalDescription(description: string): boolean {
  return REVERSAL_PREFIX.test(norm(description));
}

interface RowLike { description: string; amount: string | number; type: string; date: string }

const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

// Pares [índice da compra, índice do estorno]. Cada linha entra em um par só
// (quatro linhas iguais = dois pares).
export function findReversalPairs(rows: RowLike[], maxDays = 7): [number, number][] {
  const used = new Set<number>();
  const pairs: [number, number][] = [];
  rows.forEach((rev, ri) => {
    if (used.has(ri) || !isReversalDescription(rev.description)) return;
    const base = norm(rev.description).replace(REVERSAL_PREFIX, "");
    const cents = Math.round(Math.abs(Number(rev.amount)) * 100);
    const oi = rows.findIndex((o, i) =>
      i !== ri && !used.has(i) && o.type !== rev.type && norm(o.description) === base &&
      Math.round(Math.abs(Number(o.amount)) * 100) === cents && daysBetween(o.date, rev.date) <= maxDays
    );
    if (oi >= 0) { used.add(ri); used.add(oi); pairs.push([oi, ri]); }
  });
  return pairs;
}
