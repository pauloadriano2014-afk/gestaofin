// Linhas de uma fatura de cartão que NÃO são compra nem receita: o pagamento da
// fatura anterior aparece na fatura nova como um crédito ("Pagamento recebido").
// Importar isso como entrada somaria dinheiro que nunca entrou (e a IA costuma
// chutar "Salário"). As compras daquela fatura já foram contadas na data em
// que foram feitas, então essa linha deve ser descartada.
//
// "Estorno" fica de fora de propósito: é devolução de compra e pode ser legítima.

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const PATTERNS = [
  "pagamento recebido",
  "pagamento efetuado",
  "pagamento de fatura",
  "pagamento da fatura",
  "pagamento fatura",
  "pagamento on line",
  "pagamento online",
  "fatura anterior",
  "pendente do mes anterior",
];

export function looksLikeInvoicePayment(description: string): boolean {
  const d = norm(description);
  return PATTERNS.some((p) => d.includes(p));
}

// No EXTRATO DO BANCO o pagamento da fatura é uma saída ("Pagamento de fatura",
// "PAGAMENTO FATURA NUBANK"...). Aqui a linha é legítima: o que o app faz é
// oferecer dar baixa na fatura correspondente.
export function looksLikeBankInvoicePayment(description: string): boolean {
  const d = norm(description);
  // "fatura" ou pagamento do "cartão" (nem todo banco escreve "fatura" no extrato)
  return d.includes("fatura") || (d.includes("cartao") && /pagamento|pagto|pgto|boleto/.test(d));
}

// Se o valor do pagamento bate com o total de UMA única fatura em aberto
// (tolerância de 1 centavo), devolve ela; com zero ou várias, devolve null.
export function matchInvoiceByAmount<T extends { total: number }>(amount: number, invoices: T[]): T | null {
  const hits = invoices.filter((i) => Math.abs(Math.abs(Number(i.total)) - Math.abs(amount)) < 0.011);
  return hits.length === 1 ? hits[0] : null;
}

// ---------------------------------------------------------------------------
// IMPORTAR A MESMA FATURA DE NOVO NÃO DUPLICA
// ---------------------------------------------------------------------------
// Compara os itens do arquivo com os que o cartão já tem (mesma data, valor e
// descrição) CONTANDO as repetições: se já existem 3 compras de R$ 5,00 no
// mesmo dia e o arquivo traz 3, nenhuma entra; se traz 4, entra 1. Assim
// compras idênticas legítimas não são perdidas, e importar a fatura inteira
// depois de ter importado só uma parte só acrescenta o que faltava.

interface KeyedItem { date: string; amount: string | number; description: string }

const itemKey = (t: KeyedItem) => `${t.date}|${Math.abs(Number(t.amount)).toFixed(2)}|${norm(t.description).trim()}`;

export function dedupeAgainstExisting<T extends KeyedItem>(existing: KeyedItem[], incoming: T[]): { fresh: T[]; skipped: T[] } {
  const counts = new Map<string, number>();
  for (const e of existing) counts.set(itemKey(e), (counts.get(itemKey(e)) || 0) + 1);

  const fresh: T[] = [];
  const skipped: T[] = [];
  for (const t of incoming) {
    const k = itemKey(t);
    const left = counts.get(k) || 0;
    if (left > 0) { counts.set(k, left - 1); skipped.push(t); } else { fresh.push(t); }
  }
  return { fresh, skipped };
}
