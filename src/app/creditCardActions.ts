'use server'

import { db } from "@/db";
import { creditCards, transactions } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUser } from "./actions";
import { getInvoiceCycleForDate, todayDateStr } from "@/utils/creditCard";

// --- CADASTRAR CARTÃO ---
export async function createCreditCard(data: { name: string; closingDay: number; dueDay: number; limitAmount?: string }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const closingDay = Number(data.closingDay);
    const dueDay = Number(data.dueDay);
    if (!data.name?.trim()) return { success: false, message: "Dê um nome/apelido pro cartão." };
    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      return { success: false, message: "Dia de fechamento e vencimento devem ser entre 1 e 31." };
    }

    await db.insert(creditCards).values({
      userId,
      name: data.name.trim(),
      closingDay,
      dueDay,
      limitAmount: data.limitAmount || null,
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao criar cartão." };
  }
}

// --- EDITAR CARTÃO ---
export async function updateCreditCard(id: string, data: { name: string; closingDay: number; dueDay: number; limitAmount?: string }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const closingDay = Number(data.closingDay);
    const dueDay = Number(data.dueDay);
    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      return { success: false, message: "Dia de fechamento e vencimento devem ser entre 1 e 31." };
    }

    await db.update(creditCards).set({
      name: data.name.trim(),
      closingDay,
      dueDay,
      limitAmount: data.limitAmount || null,
    }).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao atualizar cartão." };
  }
}

// --- ARQUIVAR/REATIVAR CARTÃO ---
// Optamos por "arquivar" em vez de excluir de verdade: apagar um cartão que já
// tem compras vinculadas quebraria o histórico dessas transações.
export async function setCreditCardArchived(id: string, archived: boolean) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    await db.update(creditCards).set({ archived }).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// --- LISTAR CARTÕES (simples, sem cálculo de fatura — usado nos formulários) ---
export async function getUserCreditCards() {
  const userId = await getUser();
  if (!userId) return [];
  return db.select().from(creditCards).where(and(eq(creditCards.userId, userId), eq(creditCards.archived, false)));
}

// --- VISÃO GERAL DOS CARTÕES COM FATURAS CALCULADAS ---
// Para cada cartão, agrupa as compras ainda não baixadas por ciclo de fatura
// (mês em que fecham) e separa a fatura "aberta" (ainda não fechou) das
// faturas "fechadas" que já venceram (ou estão prestes a vencer) e ainda não
// foram pagas.
export async function getCreditCardsOverview() {
  const userId = await getUser();
  if (!userId) return [];

  const cards = await db.select().from(creditCards).where(and(eq(creditCards.userId, userId), eq(creditCards.archived, false)));
  if (cards.length === 0) return [];

  const cardIds = cards.map((c) => c.id);
  const cardTransactions = await db.select().from(transactions).where(
    and(eq(transactions.userId, userId), inArray(transactions.creditCardId, cardIds), eq(transactions.isPaid, false))
  );

  const today = todayDateStr();

  return cards.map((card) => {
    const purchases = cardTransactions.filter((t) => t.creditCardId === card.id);

    const cycles = new Map<string, { cycleKey: string; closingDate: string; dueDate: string; total: number; count: number }>();
    for (const p of purchases) {
      const cycle = getInvoiceCycleForDate(p.date, card.closingDay, card.dueDay);
      const existing = cycles.get(cycle.cycleKey) || { ...cycle, total: 0, count: 0 };
      existing.total += Math.abs(Number(p.amount));
      existing.count += 1;
      cycles.set(cycle.cycleKey, existing);
    }

    const allCycles = Array.from(cycles.values()).sort((a, b) => a.cycleKey.localeCompare(b.cycleKey));
    const openCycle = allCycles.find((c) => c.closingDate >= today) || null;
    const closedUnpaidCycles = allCycles.filter((c) => c.closingDate < today);
    const closedUnpaidTotal = closedUnpaidCycles.reduce((sum, c) => sum + c.total, 0);

    return {
      ...card,
      openCycle,
      closedUnpaidCycles,
      closedUnpaidTotal,
    };
  });
}

// --- DAR BAIXA NA FATURA (marca as compras daquele ciclo como pagas) ---
// Importante: isso NÃO cria uma nova transação de despesa. As compras já
// contam no saldo/gastos desde quando foram lançadas (mesma lógica já usada
// pelas contas fixas, que reduzem o saldo mesmo antes de serem pagas). Pagar
// a fatura é só reconciliação: marca o que já foi contabilizado como quitado.
export async function payCreditCardInvoice(cardId: string, cycleKey: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const cardResult = await db.select().from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, userId)));
    const card = cardResult[0];
    if (!card) return { success: false, message: "Cartão não encontrado." };

    const unpaid = await db.select().from(transactions).where(
      and(eq(transactions.userId, userId), eq(transactions.creditCardId, cardId), eq(transactions.isPaid, false))
    );

    const idsToSettle = unpaid
      .filter((t) => getInvoiceCycleForDate(t.date, card.closingDay, card.dueDay).cycleKey === cycleKey)
      .map((t) => t.id);

    if (idsToSettle.length === 0) return { success: false, message: "Nenhuma compra encontrada nessa fatura." };

    await db.update(transactions).set({ isPaid: true, paidAt: todayDateStr() }).where(inArray(transactions.id, idsToSettle));

    revalidatePath("/");
    return { success: true, message: `Fatura paga! ${idsToSettle.length} compra(s) baixada(s).` };
  } catch (error) {
    return { success: false, message: "Erro ao dar baixa na fatura." };
  }
}
