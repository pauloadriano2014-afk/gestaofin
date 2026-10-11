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
