import { db } from "@/db";
import { creditCards, transactions, creditCardInvoiceOverrides } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { cycleKeyOfTransaction } from "@/utils/creditCard";

// Dá baixa numa fatura inteira: marca como pagos os itens dela (e o valor
// declarado na mão, se houver). Usado pelo botão "Pagar" e também quando o
// pagamento aparece num extrato importado do banco (aí paidAt é a data real
// do pagamento, não a de hoje).
export async function settleInvoice(
  userId: string,
  cardId: string,
  cycleKey: string,
  paidAt: string
): Promise<{ success: boolean; settled: number; message?: string }> {
  const card = (await db.select().from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, userId))))[0];
  if (!card) return { success: false, settled: 0, message: "Cartão não encontrado." };

  const unpaid = await db.select().from(transactions).where(
    and(eq(transactions.userId, userId), eq(transactions.creditCardId, cardId), eq(transactions.isPaid, false))
  );
  const ids = unpaid.filter((t) => cycleKeyOfTransaction(t, card) === cycleKey).map((t) => t.id);

  if (ids.length > 0) {
    await db.update(transactions).set({ isPaid: true, paidAt }).where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));
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
