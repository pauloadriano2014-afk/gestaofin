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

function parseItauStyle(text: string): { rows: InvoicePdfRow[]; meta: InvoicePdfMeta } {
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

// ---------------------------------------------------------------------------
// Formato do Nubank: a data vem sozinha numa linha ("31 AGO"), depois "•••• 0067Comerciante"
// (com o valor "R$ 39,90" no fim ou, em compra internacional, numa linha só dele) e o IOF
// em linhas próprias. O ano não aparece: vem do vencimento ("Data de vencimento: 07 OUT 2026").
// ---------------------------------------------------------------------------
const MONTHS: Record<string, number> = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
const pad2 = (n: number) => String(n).padStart(2, "0");

function parseNubankStyle(text: string): { rows: InvoicePdfRow[]; meta: InvoicePdfMeta } {
  const t = (text || "").replace(/\r/g, "");

  const due = t.match(/Data de vencimento:\s*(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})/i);
  const dueDate = due ? `${due[3]}-${pad2(MONTHS[due[2].toUpperCase()])}-${due[1]}` : null;
  const closing = t.match(/Fechamento da pr[oó]xima fatura\s*(\d{2})\s+[A-Z]{3}\s+\d{4}/i);
  const closingDay = closing ? Number(closing[1]) : null;
  const totalMatch = t.match(/no valor de\s*R\$\s*([\d.]+,\d{2})/i) || t.match(/Total a pagarR\$\s*([\d.]+,\d{2})/i);
  const total = totalMatch ? money(totalMatch[1]) : null;
  const refYear = due ? Number(due[3]) : new Date().getFullYear();
  const refMonth = due ? MONTHS[due[2].toUpperCase()] : 12;

  const lines = t.split("\n").map((l) => l.trim());
  const first = lines.findIndex((l) => l === "TRANSAÇÕES");
  const body = first >= 0 ? lines.slice(first) : lines;

  const dateLine = /^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)$/;
  const amountEnd = /([−-])?R\$\s*([\d.]+,\d{2})\s*$/;
  const rows: InvoicePdfRow[] = [];
  let pending: { day: string; month: number; lines: string[] } | null = null;

  const flush = () => {
    if (!pending || pending.lines.length === 0) { pending = null; return; }
    let amountText: string | null = null;
    let negative = false;
    for (let i = pending.lines.length - 1; i >= 0; i--) {
      const m = pending.lines[i].match(amountEnd);
      if (m) { amountText = m[2]; negative = !!m[1]; break; }
    }
    const description = pending.lines[0]
      .replace(/^•+\s*\d{4}\s*/, "")
      .replace(amountEnd, "")
      .replace(/\s+/g, " ")
      .trim();
    const amount = amountText ? money(amountText) : NaN;
    if (description && !Number.isNaN(amount) && !negative && !/^pagamento/i.test(description)) {
      const year = pending.month > refMonth ? refYear - 1 : refYear;
      rows.push({
        date: `${year}-${pad2(pending.month)}-${pending.day}`,
        amount,
        description,
        ...(/^IOF\b/i.test(description) ? { hint: "impostos e taxas" } : {}),
      });
    }
    pending = null;
  };

  for (const line of body) {
    const d = line.match(dateLine);
    if (d) { flush(); pending = { day: d[1], month: MONTHS[d[2]], lines: [] }; continue; }
    if (!pending) continue;
    // fim de uma transação: rodapé de página, cabeçalho de seção ou texto legal
    if (/^\d+ de \d+$/.test(line) || /^Em cumprimento/i.test(line) || /^Pagamentos( e Financiamentos)?\s*[−-]?R\$/i.test(line) || /^FATURA \d{2}/.test(line)) { flush(); continue; }
    if (line) pending.lines.push(line);
  }
  flush();

  return { rows, meta: { dueDate, closingDay, total } };
}

// Escolhe o formato que lê mais itens (Itaú e similares x Nubank).
export function parseInvoiceText(text: string): { rows: InvoicePdfRow[]; meta: InvoicePdfMeta } {
  const a = parseItauStyle(text);
  const b = parseNubankStyle(text);
  return b.rows.length > a.rows.length ? b : a;
}
