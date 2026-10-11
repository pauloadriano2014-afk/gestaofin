import { db } from "@/db";
import { creditCards, transactions, creditCardInvoiceOverrides } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { cycleKeyOfTransaction } from "@/utils/creditCard";
import { withPaidBy } from "@/utils/paidBy";

// Dá baixa numa fatura inteira: marca como pagos os itens dela (e o valor
// declarado na mão, se houver). Usado pelo botão "Pagar" e também quando o
// pagamento aparece num extrato importado do banco (aí paidAt é a data real
// do pagamento, não a de hoje).
//
// payerOwnerId: quem pagou de verdade (dono da conta de onde saiu o dinheiro, ex: o Paulo
// pagando a fatura do cartão da Adri). Os itens de outros donos passam a ter essa conta como
// "conta usada": o gasto continua deles, mas o saldo que cai é o de quem pagou.
export async function settleInvoice(
  userId: string,
  cardId: string,
  cycleKey: string,
  paidAt: string,
  payerOwnerId?: string | null
): Promise<{ success: boolean; settled: number; message?: string }> {
  const card = (await db.select().from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, userId))))[0];
  if (!card) return { success: false, settled: 0, message: "Cartão não encontrado." };

  const unpaid = await db.select().from(transactions).where(
    and(eq(transactions.userId, userId), eq(transactions.creditCardId, cardId), eq(transactions.isPaid, false))
  );
  const ids = unpaid.filter((t) => cycleKeyOfTransaction(t, card) === cycleKey).map((t) => t.id);

  if (ids.length > 0) {
    const items = unpaid.filter((t) => ids.includes(t.id));
    // itens cuja conta usada muda (pagos por outro dono): atualiza um a um; os demais, em lote
    const retag = payerOwnerId
      ? items.filter((t) => {
          const want = t.ownerId && t.ownerId !== payerOwnerId ? payerOwnerId : null;
          return JSON.stringify(withPaidBy(t.aiTags, want)) !== JSON.stringify(t.aiTags || []);
        })
      : [];
    const retagIds = new Set(retag.map((t) => t.id));
    for (const t of retag) {
      const want = t.ownerId && t.ownerId !== payerOwnerId ? payerOwnerId! : null;
      await db.update(transactions).set({ isPaid: true, paidAt, aiTags: withPaidBy(t.aiTags, want) }).where(and(eq(transactions.userId, userId), eq(transactions.id, t.id)));
    }
    const rest = ids.filter((id) => !retagIds.has(id));
    if (rest.length > 0) {
      await db.update(transactions).set({ isPaid: true, paidAt }).where(and(eq(transactions.userId, userId), inArray(transactions.id, rest)));
    }
  }

  // Fatura declarada na mão (sem compras lançadas) também precisa sair da lista de "fechada e não paga".
  const override = (await db.select().from(creditCardInvoiceOverrides).where(
    and(eq(creditCardInvoiceOverrides.userId, userId), eq(creditCardInvoiceOverrides.creditCardId, cardId), eq(creditCardInvoiceOverrides.cycleKey, cycleKey))
  ))[0];
  if (override) {
    await db.update(creditCardInvoiceOverrides).set({ isPaid: true, paidAt }).where(eq(creditCardInvoiceOverrides.id, override.id));
  }

  if (ids.length === 0 && !override) return { success: false, settled: 0, message: "Nenhuma compra ou valor declarado encontrado nessa fatura." };
  return { success: true, settled: ids.length };
}
