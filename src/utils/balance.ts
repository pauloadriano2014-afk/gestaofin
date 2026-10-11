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
