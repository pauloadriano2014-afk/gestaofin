// Totais de uma fatura separados por dono. Função pura, sem banco.
// Responde "quanto dessa fatura é do Paulo, da Adri, da Empresa?".

export interface InvoiceItemLike {
  amount: string | number;
  type?: string;
  ownerId?: string | null;
}

// Valor de um item na fatura: compra soma, crédito/estorno (entrada) abate.
export function invoiceAmount(it: { amount: string | number; type?: string }): number {
  const v = Math.abs(Number(it.amount));
  return it.type === "income" ? -v : v;
}

export function summarizeByOwner(
  items: InvoiceItemLike[],
  owners: { id: string; name: string }[]
): { ownerId: string | null; name: string; total: number; count: number }[] {
  const map = new Map<string | null, { total: number; count: number }>();
  for (const it of items) {
    const key = it.ownerId ?? null;
    const cur = map.get(key) ?? { total: 0, count: 0 };
    cur.total += invoiceAmount(it);
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([ownerId, v]) => ({
      ownerId,
      name: owners.find((o) => o.id === ownerId)?.name ?? "Sem dono",
      total: Math.round(v.total * 100) / 100,
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface InvoiceCategoryGroup<T> { id: string; name: string; items: T[]; total: number; count: number }

// Itens da fatura agrupados por categoria (maior total primeiro). Crédito/estorno abate.
export function groupInvoiceItemsByCategory<T extends { amount: string | number; type?: string; categoryId?: string | null }>(
  items: T[],
  categories: { id: string; name: string }[]
): InvoiceCategoryGroup<T>[] {
  const map = new Map<string, InvoiceCategoryGroup<T>>();
  for (const it of items) {
    const id = it.categoryId || "none";
    const g = map.get(id) ?? { id, name: categories.find((c) => c.id === id)?.name ?? "Sem categoria", items: [], total: 0, count: 0 };
    g.items.push(it);
    g.total += invoiceAmount(it);
    g.count += 1;
    map.set(id, g);
  }
  return Array.from(map.values()).map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 })).sort((a, b) => b.total - a.total);
}
