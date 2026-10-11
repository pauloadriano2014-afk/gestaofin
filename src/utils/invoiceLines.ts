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
  return norm(description).includes("fatura");
}

// Se o valor do pagamento bate com o total de UMA única fatura em aberto
// (tolerância de 1 centavo), devolve ela; com zero ou várias, devolve null.
export function matchInvoiceByAmount<T extends { total: number }>(amount: number, invoices: T[]): T | null {
  const hits = invoices.filter((i) => Math.abs(Math.abs(Number(i.total)) - Math.abs(amount)) < 0.011);
  return hits.length === 1 ? hits[0] : null;
}
