// Filtros da tela de Lançamentos. Funções puras (sem banco, sem tela).

export type QuickFilter = "todos" | "sem-categoria" | "sem-dono" | "duplicados" | "pendentes";

export interface TxFilters {
  search: string;
  type: "all" | "income" | "expense" | "transfer";
  categoryId: string; // 'all' ou id
  status: "all" | "paid" | "pending";
  origin: "all" | "card" | "no-card";
  accountId: string; // 'all' ou id
  quick: QuickFilter;
}

export const EMPTY_FILTERS: TxFilters = {
  search: "", type: "all", categoryId: "all", status: "all", origin: "all", accountId: "all", quick: "todos",
};

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const absAmount = (t: any) => Math.abs(Number(t.amount));

// Lançamentos "idênticos" (mesma data, tipo, valor e descrição): provável
// duplicidade de importação. Devolve os ids de todos os membros desses grupos.
export function findDuplicateIds(txs: any[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const t of txs) {
    const key = `${t.date}|${t.type}|${absAmount(t).toFixed(2)}|${norm(t.description).trim()}`;
    const list = groups.get(key) || [];
    list.push(t.id);
    groups.set(key, list);
  }
  const ids = new Set<string>();
  for (const list of groups.values()) if (list.length > 1) list.forEach((id) => ids.add(id));
  return ids;
}

export function filterTransactions(txs: any[], f: TxFilters): any[] {
  const tokens = norm(f.search).split(/\s+/).filter(Boolean);
  const dupIds = f.quick === "duplicados" ? findDuplicateIds(txs) : null;

  return txs.filter((t) => {
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.categoryId !== "all" && t.categoryId !== f.categoryId) return false;
    if (f.status === "paid" && !t.isPaid) return false;
    if (f.status === "pending" && t.isPaid) return false;
    if (f.origin === "card" && !t.creditCardId) return false;
    if (f.origin === "no-card" && t.creditCardId) return false;
    if (f.accountId !== "all" && t.accountId !== f.accountId) return false;

    if (f.quick === "sem-categoria" && (t.type === "transfer" || t.categoryId)) return false;
    if (f.quick === "sem-dono" && t.ownerId) return false;
    if (f.quick === "pendentes" && t.isPaid) return false;
    if (dupIds && !dupIds.has(t.id)) return false;

    if (tokens.length > 0) {
      const hay = norm(t.description);
      const amount = absAmount(t).toFixed(2);
      // todas as palavras precisam aparecer; número casa com o valor ("129" acha 129,00)
      if (!tokens.every((tok) => hay.includes(tok) || amount.replace(".", ",").includes(tok) || amount.includes(tok))) return false;
    }
    return true;
  });
}

export function summarizeTxs(txs: any[]) {
  let income = 0, expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += absAmount(t);
    else if (t.type === "expense") expense += absAmount(t);
  }
  return { count: txs.length, income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100 };
}

export function hasActiveFilters(f: TxFilters): boolean {
  return JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);
}
