import { addMonthsClamped, todayDateStr } from "./dates";

export { todayDateStr };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dayInMonth(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${pad(month)}-${pad(Math.min(day, lastDay))}`;
}

export interface InvoiceCycle {
  cycleKey: string; // "YYYY-MM" do mês em que a fatura FECHA — identifica a fatura de forma única
  closingDate: string; // "YYYY-MM-DD" em que a fatura fecha
  dueDate: string; // "YYYY-MM-DD" em que a fatura vence
}

// Dada a data de uma compra e a configuração do cartão (dia de fechamento e
// dia de vencimento), descobre a qual fatura essa compra pertence.
//
// Regra padrão de cartão de crédito no Brasil:
// - Comprou até o dia de fechamento (inclusive) -> entra na fatura que fecha ESTE mês.
// - Comprou depois do fechamento -> entra na fatura que fecha no mês SEGUINTE.
// - O vencimento cai no mesmo mês do fechamento se dueDay >= closingDay,
//   senão cai no mês seguinte ao fechamento (caso comum: fecha dia 28, vence dia 5).
export function getInvoiceCycleForDate(purchaseDateStr: string, closingDay: number, dueDay: number): InvoiceCycle {
  const [y, m, d] = purchaseDateStr.split("-").map(Number);

  let closingYear = y;
  let closingMonth = m;
  if (d > closingDay) {
    const next = addMonthsClamped(`${y}-${pad(m)}-01`, 1);
    [closingYear, closingMonth] = next.split("-").map(Number);
  }

  const closingDate = dayInMonth(closingYear, closingMonth, closingDay);

  let dueYear = closingYear;
  let dueMonth = closingMonth;
  if (dueDay < closingDay) {
    const next = addMonthsClamped(`${closingYear}-${pad(closingMonth)}-01`, 1);
    [dueYear, dueMonth] = next.split("-").map(Number);
  }
  const dueDate = dayInMonth(dueYear, dueMonth, dueDay);

  return { cycleKey: `${closingYear}-${pad(closingMonth)}`, closingDate, dueDate };
}

// Mesmo cálculo de closingDate/dueDate acima, mas a partir do "cycleKey"
// (ex: "2026-08") em vez de uma data de compra — usado quando a fatura foi
// declarada na mão (sem nenhuma transação lançada), então não existe uma
// data de compra real pra descobrir o ciclo.
export function getCycleDatesForCycleKey(cycleKey: string, closingDay: number, dueDay: number): { closingDate: string; dueDate: string } {
  const [closingYear, closingMonth] = cycleKey.split("-").map(Number);
  const closingDate = dayInMonth(closingYear, closingMonth, closingDay);

  let dueYear = closingYear;
  let dueMonth = closingMonth;
  if (dueDay < closingDay) {
    const next = addMonthsClamped(`${closingYear}-${pad(closingMonth)}-01`, 1);
    [dueYear, dueMonth] = next.split("-").map(Number);
  }
  const dueDate = dayInMonth(dueYear, dueMonth, dueDay);

  return { closingDate, dueDate };
}

// ---------------------------------------------------------------------------
// FATURA EXPLÍCITA
// ---------------------------------------------------------------------------
// Por padrão a fatura de uma compra é decidida pela DATA contra o dia de
// fechamento do cartão. Isso erra quando o banco lança a compra dias depois
// (compra internacional, IOF) ou quando o dia de fechamento está um pouco
// diferente do real: a compra cai na fatura vizinha. Quando a pessoa importa
// uma fatura (ou move itens de fatura), a fatura escolhida fica gravada no
// próprio lançamento, numa etiqueta "fatura:AAAA-MM" (AAAA-MM = mês em que a
// fatura FECHA, o mesmo "cycleKey" do resto do app). A etiqueta vence a data.
// Fica nas etiquetas (ai_tags, que já existe) de propósito, para não exigir
// migração de banco.

export const INVOICE_TAG_PREFIX = "fatura:";

export function invoiceTagFor(cycleKey: string): string {
  return `${INVOICE_TAG_PREFIX}${cycleKey}`;
}

export function cycleKeyFromTags(tags: string[] | null | undefined): string | null {
  const tag = (tags || []).find((t) => typeof t === "string" && t.startsWith(INVOICE_TAG_PREFIX));
  const key = tag ? tag.slice(INVOICE_TAG_PREFIX.length) : "";
  return /^\d{4}-\d{2}$/.test(key) ? key : null;
}

// Troca (ou põe) a etiqueta de fatura, mantendo as outras etiquetas.
export function withInvoiceTag(tags: string[] | null | undefined, cycleKey: string): string[] {
  return [...(tags || []).filter((t) => !(typeof t === "string" && t.startsWith(INVOICE_TAG_PREFIX))), invoiceTagFor(cycleKey)];
}

// Fatura (cycleKey) de um lançamento de cartão: a etiqueta, se houver; senão, pela data.
export function cycleKeyOfTransaction(
  tx: { date: string; aiTags?: string[] | null },
  card: { closingDay: number; dueDay: number }
): string {
  return cycleKeyFromTags(tx.aiTags) ?? getInvoiceCycleForDate(tx.date, card.closingDay, card.dueDay).cycleKey;
}

// Mês de vencimento ("AAAA-MM") -> cycleKey (mês em que a fatura fecha).
// Se o vencimento é num dia ANTES do fechamento (ex: fecha 31, vence 9), a
// fatura fechou no mês anterior ao do vencimento.
export function cycleKeyForDueMonth(dueMonth: string, closingDay: number, dueDay: number): string {
  const [y, m] = dueMonth.split("-").map(Number);
  if (dueDay < closingDay) {
    const prev = new Date(y, m - 2, 1);
    return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
  }
  return `${y}-${pad(m)}`;
}

// cycleKey -> mês de vencimento ("AAAA-MM"), o inverso de cycleKeyForDueMonth.
export function dueMonthForCycleKey(cycleKey: string, closingDay: number, dueDay: number): string {
  const { dueDate } = getCycleDatesForCycleKey(cycleKey, closingDay, dueDay);
  return dueDate.slice(0, 7);
}
