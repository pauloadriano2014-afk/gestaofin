import { buildKindSets } from "./categoryKinds";

// SALDO = o dinheiro de verdade: só conta o que JÁ FOI PAGO (ou recebido).
//
// Conta pendente (conta fixa que ainda não teve baixa, parcela futura, item de
// cartão cuja fatura não foi paga) NÃO diminui o saldo, mesmo atrasada: o
// dinheiro continua na conta até a baixa. O que falta pagar aparece à parte
// ("a pagar") e o saldo previsto = saldo + o que está pendente.
//
// Fica sempre de fora:
//  - transferência (o dinheiro só trocou de conta);
//  - pagamento de fatura vindo do extrato (categoria do tipo "card_payment"):
//    o dinheiro do cartão já sai quando a fatura recebe baixa (os itens viram
//    "pagos"), então contar também a linha do banco duplicaria o gasto.
//
// Se um pagamento de fatura precisar contar (ex: você nunca lançou as compras
// daquele cartão), troque a categoria dele para uma de "gasto normal".

export interface BalanceRowLike {
  type: string;
  amount: string | number;
  categoryId?: string | null;
  isPaid?: boolean | null;
}

// Sem a informação (undefined/null) considera pago: é o padrão dos lançamentos.
export const isSettled = (t: BalanceRowLike) => t.isPaid !== false;

type Mode = "paid" | "pending" | "all";

export function sumBalance(rows: BalanceRowLike[], kindSets: ReturnType<typeof buildKindSets>, mode: Mode = "paid"): number {
  return rows.reduce((acc, t) => {
    if (t.categoryId && kindSets.card_payment.has(t.categoryId)) return acc;
    if (mode === "paid" && !isSettled(t)) return acc;
    if (mode === "pending" && isSettled(t)) return acc;
    const v = Math.abs(Number(t.amount));
    if (t.type === "income") return acc + v;
    if (t.type === "expense") return acc - v;
    return acc;
  }, 0);
}

// paid = dinheiro disponível; pending = efeito líquido do que ainda não teve baixa
// (negativo quando há mais a pagar do que a receber). projected = paid + pending.
export function balanceSplit(rows: BalanceRowLike[], kindSets: ReturnType<typeof buildKindSets>) {
  const paid = sumBalance(rows, kindSets, "paid");
  const pending = sumBalance(rows, kindSets, "pending");
  return { paid, pending, projected: Math.round((paid + pending) * 100) / 100 };
}

// ---------------------------------------------------------------------------
// SALDO POR PERÍODO: o que vale é a data em que o dinheiro MEXEU
// ---------------------------------------------------------------------------
// Uma compra de setembro paga em outubro tira o dinheiro da conta em OUTUBRO.
// Então, para o saldo:
//   - "pago" entra no período em que foi PAGO (paidAt; sem paidAt, a data do
//     lançamento), seja a conta fixa paga com atraso, a parcela ou os itens de
//     uma fatura que recebeu baixa;
//   - "pendente" é o que tem data dentro do período e ainda não foi pago até o
//     fim dele (inclui o que só foi pago depois do período).
// Receita e Despesas continuam por data da compra/competência, de propósito.

export interface PeriodRowLike extends BalanceRowLike {
  date: string;
  paidAt?: string | null;
}

export type PeriodClass = "paid" | "pending" | null;

export function classifyForPeriod(t: PeriodRowLike, start: string, end: string): PeriodClass {
  const settled = isSettled(t);
  const cashDate = t.paidAt || t.date;
  if (settled && cashDate >= start && cashDate <= end) return "paid";
  const inRange = t.date >= start && t.date <= end;
  if (inRange && (!settled || (t.paidAt && t.paidAt > end))) return "pending";
  return null;
}

// Mesmas exclusões de sempre (transferência e pagamento de fatura), por período.
export function balanceForPeriod(
  rows: PeriodRowLike[],
  kindSets: ReturnType<typeof buildKindSets>,
  start: string,
  end: string
) {
  let paid = 0;
  let pending = 0;
  for (const t of rows) {
    if (t.categoryId && kindSets.card_payment.has(t.categoryId)) continue;
    const v = Math.abs(Number(t.amount));
    const signed = t.type === "income" ? v : t.type === "expense" ? -v : 0;
    if (signed === 0) continue;
    const c = classifyForPeriod(t, start, end);
    if (c === "paid") paid += signed;
    else if (c === "pending") pending += signed;
  }
  paid = Math.round(paid * 100) / 100;
  pending = Math.round(pending * 100) / 100;
  return { paid, pending, projected: Math.round((paid + pending) * 100) / 100 };
}

// "Desde o começo": início do período = o menor valor possível.
export const FOREVER_START = "0001-01-01";

// ---------------------------------------------------------------------------
// CONCILIAÇÃO COM O BANCO
// ---------------------------------------------------------------------------
// O app só conhece o que foi lançado/importado. Para o saldo bater com o do
// banco, lançamos UM ajuste com a diferença (entrada se faltava dinheiro no app,
// saída se sobrava). Devolve null quando já está batendo (diferença < 1 centavo).
export function adjustmentFor(current: number, real: number): { type: "income" | "expense"; amount: number } | null {
  const delta = Math.round((real - current) * 100) / 100;
  if (Math.abs(delta) < 0.005) return null;
  return { type: delta > 0 ? "income" : "expense", amount: Math.abs(delta) };
}
