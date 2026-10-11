// Checklist de fechamento do mês: o que ainda precisa de atenção antes de dar
// o mês por conferido. Função pura, sem banco nem tela.

import { findDuplicateIds, type QuickFilter } from "./txFilters";
import { matchesView } from "./owners";

export interface CheckItem {
  id: string;
  ok: boolean;
  title: string;
  detail: string;
  target?: { section: "lancamentos" | "contas"; quick?: QuickFilter };
}

const abs = (t: any) => Math.abs(Number(t.amount));
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function monthChecklist(raw: any, viewMode: string, cards: any[] = []): { items: CheckItem[]; done: number; total: number } {
  const txs = (raw?.transactions || []).filter((t: any) => matchesView(t, viewMode));
  const items: CheckItem[] = [];

  const unpaidFixed = txs.filter((t: any) => t.isFixed && t.type === "expense" && !t.isPaid);
  const unpaidTotal = unpaidFixed.reduce((s: number, t: any) => s + abs(t), 0);
  items.push({
    id: "contas-fixas",
    ok: unpaidFixed.length === 0,
    title: "Contas fixas pagas",
    detail: unpaidFixed.length === 0 ? "Todas as contas fixas do período têm baixa." : `${unpaidFixed.length} conta(s) sem baixa (${money(unpaidTotal)}).`,
    target: { section: "contas" },
  });

  const closedUnpaid = cards.filter((c) => (c.closedUnpaidCycles || []).length > 0);
  const closedCount = closedUnpaid.reduce((s, c) => s + c.closedUnpaidCycles.length, 0);
  const closedTotal = closedUnpaid.reduce((s, c) => s + (c.closedUnpaidTotal || 0), 0);
  items.push({
    id: "faturas",
    ok: closedCount === 0,
    title: "Faturas de cartão em dia",
    detail: closedCount === 0 ? "Nenhuma fatura fechada pendente de pagamento." : `${closedCount} fatura(s) fechada(s) sem pagamento (${money(closedTotal)}).`,
    target: { section: "contas" },
  });

  const semCategoria = txs.filter((t: any) => t.type !== "transfer" && !t.categoryId);
  items.push({
    id: "categorias",
    ok: semCategoria.length === 0,
    title: "Tudo categorizado",
    detail: semCategoria.length === 0 ? "Todos os lançamentos têm categoria." : `${semCategoria.length} lançamento(s) sem categoria (${money(semCategoria.reduce((s: number, t: any) => s + abs(t), 0))}).`,
    target: { section: "lancamentos", quick: "sem-categoria" },
  });

  const semDono = txs.filter((t: any) => !t.ownerId);
  items.push({
    id: "donos",
    ok: semDono.length === 0,
    title: "Todos com dono",
    detail: semDono.length === 0 ? "Todos os lançamentos têm dono." : `${semDono.length} lançamento(s) sem dono: somem das visões de cada nome.`,
    target: { section: "lancamentos", quick: "sem-dono" },
  });

  const dup = findDuplicateIds(txs);
  items.push({
    id: "duplicados",
    ok: dup.size === 0,
    title: "Sem possíveis duplicados",
    detail: dup.size === 0 ? "Nenhum lançamento idêntico encontrado." : `${dup.size} lançamento(s) idênticos (mesma data, valor e descrição). Confira se não é importação repetida.`,
    target: { section: "lancamentos", quick: "duplicados" },
  });

  return { items, done: items.filter((i) => i.ok).length, total: items.length };
}
