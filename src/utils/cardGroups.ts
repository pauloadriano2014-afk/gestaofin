// Agrupa as compras de cartão por fatura para a lista de Lançamentos: em vez de
// dezenas de linhas soltas, aparece uma linha por fatura que se abre quando a
// pessoa quer. Funções puras (sem banco, sem tela).

import { cycleKeyOfTransaction, getCycleDatesForCycleKey } from "./creditCard";

export interface InvoiceGroup {
  kind: "invoice";
  key: string;
  cardId: string;
  cardName: string;
  cycleKey: string;
  closingDate: string;
  dueDate: string;
  total: number;
  count: number;
  allPaid: boolean;
  sortDate: string;
  items: any[];
}
export interface TxEntry { kind: "tx"; tx: any; sortDate: string }
export type ListEntry = InvoiceGroup | TxEntry;

const signed = (t: any) => (t.type === "income" ? -1 : 1) * Math.abs(Number(t.amount));

// Lançamentos de cartão (de um cartão que o app conhece) viram grupos por
// fatura; todo o resto continua como linha solta. Ordenado do mais recente
// para o mais antigo (um grupo vale pela data do seu item mais recente).
export function groupCardItems(
  rows: any[],
  cards: { id: string; name: string; closingDay: number; dueDay: number }[]
): ListEntry[] {
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const groups = new Map<string, InvoiceGroup>();
  const entries: ListEntry[] = [];

  for (const t of rows) {
    const card = t.creditCardId ? cardById.get(t.creditCardId) : undefined;
    if (!card) { entries.push({ kind: "tx", tx: t, sortDate: t.date }); continue; }

    const cycleKey = cycleKeyOfTransaction(t, card);
    const key = `${card.id}|${cycleKey}`;
    let g = groups.get(key);
    if (!g) {
      const dates = getCycleDatesForCycleKey(cycleKey, card.closingDay, card.dueDay);
      g = { kind: "invoice", key, cardId: card.id, cardName: card.name, cycleKey, ...dates, total: 0, count: 0, allPaid: true, sortDate: t.date, items: [] };
      groups.set(key, g);
      entries.push(g);
    }
    g.items.push(t);
    g.total += signed(t);
    g.count += 1;
    if (!t.isPaid) g.allPaid = false;
    if (t.date > g.sortDate) g.sortDate = t.date;
  }

  for (const g of groups.values()) {
    g.total = Math.round(g.total * 100) / 100;
    g.items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  return entries.sort((a, b) => (a.sortDate < b.sortDate ? 1 : a.sortDate > b.sortDate ? -1 : 0));
}
