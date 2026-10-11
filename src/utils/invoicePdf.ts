// Leitura direta (sem IA) do texto de uma fatura de cartão em PDF, no formato dos grandes
// emissores brasileiros (testado com a fatura do Itaú): vencimento, fechamento, total, os
// lançamentos (com a categoria que o banco informa) e os encargos. Quando o texto não tem esse
// formato, devolve poucos itens e quem chamou cai na leitura por IA.
//
// Função pura: só recebe o texto já extraído do PDF.

export interface InvoicePdfRow { date: string; amount: number; description: string; hint?: string }
export interface InvoicePdfMeta {
  dueDate: string | null;     // vencimento (AAAA-MM-DD)
  closingDay: number | null;  // dia do fechamento (da "previsão do próximo fechamento")
  total: number | null;       // total a pagar da fatura
}

const money = (s: string) => {
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};
const brDate = (d: string, m: string, y: string) => `${y}-${m}-${d}`;

export function parseInvoiceText(text: string): { rows: InvoicePdfRow[]; meta: InvoicePdfMeta } {
  const t = (text || "").replace(/\r/g, "");

  const dueMatch = t.match(/Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i) || t.match(/vencimento em:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const dueDate = dueMatch ? brDate(dueMatch[1], dueMatch[2], dueMatch[3]) : null;

  const closeMatch = t.match(/Previs[aã]o\s+pr[oó]x\.?\s*Fechamento:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const closingDay = closeMatch ? Number(closeMatch[1]) : null;

  const totalMatch = t.match(/Total desta fatura\s*([\d.]+,\d{2})/i) || t.match(/O total da sua fatura é:\s*R\$\s*([\d.]+,\d{2})/i);
  const total = totalMatch ? money(totalMatch[1]) : null;

  const emission = t.match(/Emiss[aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const refYear = Number((dueDate || (emission ? brDate(emission[1], emission[2], emission[3]) : "") || "").slice(0, 4)) || new Date().getFullYear();
  const refMonth = Number((dueDate || "").slice(5, 7)) || (emission ? Number(emission[2]) : 12);

  // só o trecho dos lançamentos (se o texto marcar), para não confundir com a ficha do boleto
  const lines = t.split("\n").map((l) => l.trimEnd());
  const start = lines.findIndex((l) => /Lan[cç]amentos:\s*compras/i.test(l));
  const body = start >= 0 ? lines.slice(start) : lines;

  const rows: InvoicePdfRow[] = [];
  const itemRe = /^(\d{2})\/(\d{2})(.+?)(-?\d{1,3}(?:\.\d{3})*,\d{2})$/;
  for (let i = 0; i < body.length; i++) {
    const m = body[i].match(itemRe);
    if (!m) continue;
    const amount = money(m[4]);
    const description = m[3].replace(/\s+/g, " ").trim();
    if (!description || Number.isNaN(amount)) continue;
    if (amount < 0 && /pagamento/i.test(description)) continue; // pagamento da fatura anterior não é item
    const month = Number(m[2]);
    const year = month > refMonth ? refYear - 1 : refYear; // compra de dezembro numa fatura de janeiro
    const hintMatch = (body[i + 1] || "").match(/^([a-zà-ú]+)\s{2,}/);
    rows.push({ date: brDate(m[1], m[2], String(year)), amount, description, ...(hintMatch ? { hint: hintMatch[1] } : {}) });
  }

  // encargos (juros, multa, IOF): fazem parte do total a pagar
  const charges = t.match(/Total de encargos em R\$\s*([\d.]+,\d{2})/i);
  if (charges) {
    const v = money(charges[1]);
    const when = emission ? brDate(emission[1], emission[2], emission[3]) : dueDate;
    if (v > 0 && when) rows.push({ date: when, amount: v, description: "Encargos da fatura (juros, multa e IOF)", hint: "encargos" });
  }

  return { rows, meta: { dueDate, closingDay, total } };
}
