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
