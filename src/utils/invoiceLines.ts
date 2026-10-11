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

// Na FATURA, qualquer entrada cuja descrição começa com "pagamento" (inclusive só
// "Pagamento") é a quitação da fatura anterior, não receita.
export function looksLikeInvoicePaymentLine(t: { description: string; type?: string }): boolean {
  return looksLikeInvoicePayment(t.description) || (t.type === "income" && /^\s*pagamento\b/.test(norm(t.description)));
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

const cents = (t: KeyedItem) => Math.round(Math.abs(Number(t.amount)) * 100);

// Nomes parecidos: a IA e os leitores de PDF/CSV escrevem o mesmo comerciante de jeitos
// diferentes ("Dl*Google Canva", "Google Canva", 'IOF de "Cloudflare"'). Compara só letras e
// números e aceita nome igual, um contido no outro ou uma palavra de 4+ letras em comum.
const STOP = new Set(["de", "da", "do", "dos", "das", "com", "the", "ltda", "sao", "paulo"]);
const tokens = (s: string) =>
  norm(s).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 3 && !STOP.has(w));
function similarDescription(a: string, b: string): boolean {
  const ca = norm(a).replace(/[^a-z0-9]+/g, "");
  const cb = norm(b).replace(/[^a-z0-9]+/g, "");
  if (ca === cb) return true;
  if (ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))) return true;
  const tb = new Set(tokens(b));
  return tokens(a).some((w) => w.length >= 4 && tb.has(w));
}

export function dedupeAgainstExisting<T extends KeyedItem>(existing: KeyedItem[], incoming: T[]): { fresh: T[]; skipped: T[] } {
  const used = new Set<number>();
  const fresh: T[] = [];
  const skipped: T[] = [];
  for (const t of incoming) {
    // mesma data e mesmo valor, com nome parecido; cada item existente só vale uma vez
    const i = existing.findIndex((e, idx) => !used.has(idx) && e.date === t.date && cents(e) === cents(t) && similarDescription(e.description, t.description));
    if (i >= 0) { used.add(i); skipped.push(t); } else { fresh.push(t); }
  }
  return { fresh, skipped };
}

// "cartão|AAAA-MM" -> [cartão, ciclo]; qualquer outra coisa (vazio, incompleto) -> null.
// Cuidado clássico: "".split("|") dá [""], que é "verdadeiro" e já causou bug.
export function parseLinkedInvoice(value: unknown): [string, string] | null {
  if (typeof value !== "string") return null;
  const parts = value.split("|");
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}
