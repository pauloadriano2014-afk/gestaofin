// Contas fixas agrupadas por categoria (Estudos, Financiamento, Assinaturas...).
// Função pura: a tela só desenha o resultado.

export interface FixedGroup<T> {
  id: string;
  name: string;
  items: T[];
  total: number;
  pendingCount: number;
  lateCount: number;
}

export function groupFixedByCategory<T extends { categoryId?: string | null; amount: string | number; isPaid?: boolean | null; date: string }>(
  items: T[],
  categories: { id: string; name: string }[],
  todayStr: string
): FixedGroup<T>[] {
  const map = new Map<string, FixedGroup<T>>();
  for (const it of items) {
    const id = it.categoryId || "none";
    const g = map.get(id) ?? { id, name: categories.find((c) => c.id === id)?.name ?? "Sem categoria", items: [], total: 0, pendingCount: 0, lateCount: 0 };
    g.items.push(it);
    g.total += Math.abs(Number(it.amount));
    if (!it.isPaid) {
      g.pendingCount += 1;
      if (it.date < todayStr) g.lateCount += 1;
    }
    map.set(id, g);
  }
  return Array.from(map.values())
    .map((g) => ({ ...g, total: Math.round(g.total * 100) / 100, items: g.items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) }))
    .sort((a, b) => b.total - a.total);
}
