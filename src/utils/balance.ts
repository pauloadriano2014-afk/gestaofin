import { buildKindSets } from "./categoryKinds";

// Saldo = entradas - saídas. Fica de fora:
//  - transferência (o dinheiro só trocou de conta);
//  - pagamento de fatura vindo do extrato (categoria do tipo "card_payment"):
//    as compras do cartão já entram no saldo na data em que foram feitas,
//    então contar o pagamento da fatura de novo duplicaria o gasto — e ainda
//    jogaria no mês seguinte um gasto do mês anterior, que é exatamente a
//    interferência entre meses que o "mês isolado" quer evitar.
//
// Se um pagamento de fatura precisar contar (ex: você nunca lançou as compras
// daquele cartão), troque a categoria dele para uma de "gasto normal".

export interface BalanceRowLike {
  type: string;
  amount: string | number;
  categoryId?: string | null;
}

export function sumBalance(rows: BalanceRowLike[], kindSets: ReturnType<typeof buildKindSets>): number {
  return rows.reduce((acc, t) => {
    if (t.categoryId && kindSets.card_payment.has(t.categoryId)) return acc;
    const v = Math.abs(Number(t.amount));
    if (t.type === "income") return acc + v;
    if (t.type === "expense") return acc - v;
    return acc;
  }, 0);
}
