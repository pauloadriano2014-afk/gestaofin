// --- HELPERS DE DATA (strings "YYYY-MM-DD", sem objetos Date) ---
// Usamos strings puras de propósito: qualquer conversão via `new Date(...)`
// fica sujeita ao fuso horário do processo (ver bug corrigido em getReportData).
// Todas as datas de transação no banco são strings "date" simples, então
// fazemos a aritmética de calendário manualmente.

// Soma `monthsToAdd` meses a uma data "YYYY-MM-DD", "grudando" no último dia
// válido do mês de destino quando o dia original não existir nele.
// Ex: 2026-01-31 + 1 mês -> 2026-02-28 (e não "2026-02-31", que é uma data inválida).
export function addMonthsClamped(dateStr: string, monthsToAdd: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);

  const totalMonths = (m - 1) + monthsToAdd;
  const year = y + Math.floor(totalMonths / 12);
  const month = (((totalMonths % 12) + 12) % 12) + 1; // 1-12, robusto p/ negativos

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const day = Math.min(d, lastDayOfMonth);

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Divide um valor total em N parcelas cujo somatório bate exatamente com o
// total (distribui os centavos restantes entre as primeiras parcelas), em
// vez de arredondar cada parcela isoladamente e perder centavos no total.
// Retorna strings formatadas com 2 casas decimais, prontas para salvar.
export function splitAmountIntoInstallments(totalAmount: number, installments: number): string[] {
  const totalCents = Math.round(Math.abs(totalAmount) * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainder = totalCents - baseCents * installments;

  const result: string[] = [];
  for (let i = 0; i < installments; i++) {
    const cents = baseCents + (i < remainder ? 1 : 0);
    result.push((cents / 100).toFixed(2));
  }
  return result;
}

// "YYYY-MM-DD" de hoje, no fuso do processo. Usado para status ("vencido",
// "vence hoje") — não precisa de precisão de fuso, só do dia corrente.
export function todayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Soma (ou subtrai, com número negativo) dias a uma data "YYYY-MM-DD".
// Usa aritmética em UTC de propósito (constrói e lê de volta em UTC) para
// não depender do fuso horário do processo, diferente do bug já corrigido
// em getReportData (que misturava construção local com serialização UTC).
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(utcMs);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
