// Totais de uma fatura separados por dono. Função pura, sem banco.
// Responde "quanto dessa fatura é do Paulo, da Adri, da Empresa?".

export interface InvoiceItemLike {
  amount: string | number;
  ownerId?: string | null;
}

export function summarizeByOwner(
  items: InvoiceItemLike[],
  owners: { id: string; name: string }[]
): { ownerId: string | null; name: string; total: number; count: number }[] {
  const map = new Map<string | null, { total: number; count: number }>();
  for (const it of items) {
    const key = it.ownerId ?? null;
    const cur = map.get(key) ?? { total: 0, count: 0 };
    cur.total += Math.abs(Number(it.amount));
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
