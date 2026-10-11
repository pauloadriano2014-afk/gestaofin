// Transferências entre contas/pessoas e sugestões na revisão de importação.
// Funções puras (sem banco, sem tela).

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const abs = (v: string | number) => Math.abs(Number(v));

// Descrições típicas de dinheiro que só trocou de mãos (e que a IA costuma
// chutar como "Salário" ou "Despesas Variadas").
export function looksLikeTransfer(description: string): boolean {
  const d = norm(description);
  return /transferencia|\bpix\b|\bted\b|\bdoc\b|reembolso recebido|reembolso enviado/.test(d);
}

const dayNumber = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
export const daysApart = (a: string, b: string) => Math.abs(dayNumber(a) - dayNumber(b));

interface MoneyRow { date: string; amount: string | number; type: string; description: string }

// Pares dentro da própria lista: uma saída e uma entrada do MESMO valor em até
// `windowDays` dias, em que pelo menos uma parece transferência. Cada linha entra
// em no máximo um par (o de menor distância de data). Devolve índice -> parceiro.
export function pairWithinList(rows: MoneyRow[], windowDays = 3): Map<number, number> {
  const candidates: { i: number; j: number; gap: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.type === b.type || (a.type !== "income" && a.type !== "expense") || (b.type !== "income" && b.type !== "expense")) continue;
      if (Math.abs(abs(a.amount) - abs(b.amount)) > 0.005) continue;
      const gap = daysApart(a.date, b.date);
      if (gap > windowDays) continue;
      if (!looksLikeTransfer(a.description) && !looksLikeTransfer(b.description)) continue;
      candidates.push({ i, j, gap });
    }
  }
  candidates.sort((x, y) => x.gap - y.gap || x.i - y.i);
  const result = new Map<number, number>();
  for (const c of candidates) {
    if (result.has(c.i) || result.has(c.j)) continue;
    result.set(c.i, c.j); result.set(c.j, c.i);
  }
  return result;
}

// Melhor "outra ponta" já salva para uma linha nova: tipo oposto, mesmo valor,
// até `windowDays` dias, e que ainda não seja de um grupo neutro (já tratado).
export function bestExistingMatch<T extends MoneyRow & { id: string }>(row: MoneyRow, existing: T[], windowDays = 3): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const e of existing) {
    if (e.type === row.type || (e.type !== "income" && e.type !== "expense")) continue;
    if (Math.abs(abs(e.amount) - abs(row.amount)) > 0.005) continue;
    const gap = daysApart(e.date, row.date);
    if (gap > windowDays) continue;
    if (!looksLikeTransfer(e.description) && !looksLikeTransfer(row.description)) continue;
    if (gap < bestGap) { best = e; bestGap = gap; }
  }
  return best;
}

// Contas fixas pendentes ordenadas para a linha do extrato: as de valor
// parecido (até 15% de diferença) primeiro, marcadas como sugestão; depois as
// outras por data de vencimento.
export function rankFixedBills<T extends { date: string; amount: string | number }>(rowAmount: string | number, bills: T[]): (T & { suggested: boolean })[] {
  const target = abs(rowAmount) || 1;
  const scored = bills.map((b) => ({ ...b, diff: Math.abs(abs(b.amount) - target) / target }));
  const near = scored.filter((b) => b.diff <= 0.15).sort((a, b) => a.diff - b.diff || (a.date < b.date ? -1 : 1));
  const rest = scored.filter((b) => b.diff > 0.15).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return [...near.map((b) => ({ ...b, suggested: true })), ...rest.map((b) => ({ ...b, suggested: false }))].map(({ diff, ...rest2 }) => rest2 as any);
}
