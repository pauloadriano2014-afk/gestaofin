'use server'

import { db } from "@/db";
import { creditCards, transactions, creditCardInvoiceOverrides } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUser } from "./actions";
import { ensureOwners, resolveOwnership } from "@/db/owners";
import { getInvoiceCycleForDate, getCycleDatesForCycleKey, todayDateStr } from "@/utils/creditCard";

// --- CADASTRAR CARTÃO ---
export async function createCreditCard(data: { name: string; closingDay: number; dueDay: number; limitAmount?: string; ownerId?: string | null }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const closingDay = Number(data.closingDay);
    const dueDay = Number(data.dueDay);
    if (!data.name?.trim()) return { success: false, message: "Dê um nome/apelido pro cartão." };
    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      return { success: false, message: "Dia de fechamento e vencimento devem ser entre 1 e 31." };
    }

    const ownership = await resolveOwnership(userId, { ownerId: data.ownerId });
    await db.insert(creditCards).values({
      userId,
      ownerId: ownership.ownerId,
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
export async function updateCreditCard(id: string, data: { name: string; closingDay: number; dueDay: number; limitAmount?: string; ownerId?: string | null }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const closingDay = Number(data.closingDay);
    const dueDay = Number(data.dueDay);
    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      return { success: false, message: "Dia de fechamento e vencimento devem ser entre 1 e 31." };
    }

    await db.update(creditCards).set({
      // só troca o dono se veio um (evita apagar o dono ao editar só o nome)
      ...(data.ownerId ? { ownerId: data.ownerId } : {}),
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
//
// 🔥 NOVO: quem não quer lançar compra por compra pode declarar o valor da
// fatura na mão (por cartão + mês). Quando existe um valor declarado pra um
// ciclo, ele SUBSTITUI o total calculado a partir das transações daquele
// ciclo (nunca soma os dois, pra não contar em dobro); e se o ciclo nem tem
// transação nenhuma lançada, o valor declarado cria a fatura sozinho.
export async function getCreditCardsOverview() {
  const userId = await getUser();
  if (!userId) return [];

  const cards = await db.select().from(creditCards).where(and(eq(creditCards.userId, userId), eq(creditCards.archived, false)));
  if (cards.length === 0) return [];

  const cardIds = cards.map((c) => c.id);
  const cardTransactions = await db.select().from(transactions).where(
    and(eq(transactions.userId, userId), inArray(transactions.creditCardId, cardIds), eq(transactions.isPaid, false))
  );
  const overrides = await db.select().from(creditCardInvoiceOverrides).where(
    and(eq(creditCardInvoiceOverrides.userId, userId), inArray(creditCardInvoiceOverrides.creditCardId, cardIds), eq(creditCardInvoiceOverrides.isPaid, false))
  );

  const today = todayDateStr();

  return cards.map((card) => {
    const purchases = cardTransactions.filter((t) => t.creditCardId === card.id);
    const cardOverrides = overrides.filter((o) => o.creditCardId === card.id);

    const cycles = new Map<string, { cycleKey: string; closingDate: string; dueDate: string; total: number; count: number; isManual: boolean; byOwner: Record<string, number> }>();
    for (const p of purchases) {
      const cycle = getInvoiceCycleForDate(p.date, card.closingDay, card.dueDay);
      const existing = cycles.get(cycle.cycleKey) || { ...cycle, total: 0, count: 0, isManual: false, byOwner: {} };
      existing.total += Math.abs(Number(p.amount));
      existing.count += 1;
      // quanto da fatura é de cada dono (a chave 'none' agrupa itens sem dono)
      const ownerKey = p.ownerId || 'none';
      existing.byOwner[ownerKey] = (existing.byOwner[ownerKey] || 0) + Math.abs(Number(p.amount));
      cycles.set(cycle.cycleKey, existing);
    }

    for (const o of cardOverrides) {
      const existing = cycles.get(o.cycleKey);
      if (existing) {
        // Já tem transações lançadas nesse ciclo: o valor digitado na mão
        // substitui o total calculado (não soma), pra evitar contar em dobro.
        existing.total = Number(o.amount);
        existing.isManual = true;
      } else {
        // Fatura sem transação nenhuma: o valor digitado cria o ciclo sozinho.
        const { closingDate, dueDate } = getCycleDatesForCycleKey(o.cycleKey, card.closingDay, card.dueDay);
        cycles.set(o.cycleKey, { cycleKey: o.cycleKey, closingDate, dueDate, total: Number(o.amount), count: 0, isManual: true, byOwner: {} });
      }
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

// --- DECLARAR/EDITAR O VALOR DA FATURA NA MÃO (por cartão + mês) ---
// cycleKey no formato "YYYY-MM" (mês em que a fatura fecha).
export async function setInvoiceOverrideAmount(cardId: string, cycleKey: string, amount: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    if (!/^\d{4}-\d{2}$/.test(cycleKey)) return { success: false, message: "Mês inválido." };
    const numericAmount = Math.abs(Number(amount));
    if (!numericAmount || Number.isNaN(numericAmount)) return { success: false, message: "Digite um valor válido." };

    const card = (await db.select().from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, userId))))[0];
    if (!card) return { success: false, message: "Cartão não encontrado." };

    const existing = await db.select().from(creditCardInvoiceOverrides).where(
      and(eq(creditCardInvoiceOverrides.creditCardId, cardId), eq(creditCardInvoiceOverrides.cycleKey, cycleKey))
    );

    if (existing.length > 0) {
      await db.update(creditCardInvoiceOverrides).set({
        amount: numericAmount.toFixed(2),
        updatedAt: new Date(),
      }).where(eq(creditCardInvoiceOverrides.id, existing[0].id));
    } else {
      await db.insert(creditCardInvoiceOverrides).values({
        userId, creditCardId: cardId, cycleKey, amount: numericAmount.toFixed(2),
      });
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao salvar o valor da fatura." };
  }
}

// --- REMOVER O VALOR DECLARADO NA MÃO (volta a usar o total das transações) ---
export async function clearInvoiceOverride(cardId: string, cycleKey: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    await db.delete(creditCardInvoiceOverrides).where(
      and(eq(creditCardInvoiceOverrides.userId, userId), eq(creditCardInvoiceOverrides.creditCardId, cardId), eq(creditCardInvoiceOverrides.cycleKey, cycleKey))
    );
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
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

    if (idsToSettle.length > 0) {
      await db.update(transactions).set({ isPaid: true, paidAt: todayDateStr() }).where(inArray(transactions.id, idsToSettle));
    }

    // 🔥 NOVO: se essa fatura (também) tem um valor declarado na mão, marca
    // ele como pago também — senão uma fatura 100% manual (sem nenhuma
    // transação) nunca sairia da lista de "fechada e não paga".
    const override = await db.select().from(creditCardInvoiceOverrides).where(
      and(eq(creditCardInvoiceOverrides.userId, userId), eq(creditCardInvoiceOverrides.creditCardId, cardId), eq(creditCardInvoiceOverrides.cycleKey, cycleKey))
    );
    if (override.length > 0) {
      await db.update(creditCardInvoiceOverrides).set({ isPaid: true, paidAt: todayDateStr() }).where(eq(creditCardInvoiceOverrides.id, override[0].id));
    }

    if (idsToSettle.length === 0 && override.length === 0) {
      return { success: false, message: "Nenhuma compra ou valor declarado encontrado nessa fatura." };
    }

    revalidatePath("/");
    return { success: true, message: idsToSettle.length > 0 ? `Fatura paga! ${idsToSettle.length} compra(s) baixada(s).` : "Fatura paga!" };
  } catch (error) {
    return { success: false, message: "Erro ao dar baixa na fatura." };
  }
}


// --- ITENS DE UMA FATURA ---
// Lista tudo o que está (ou esteve) cobrado numa fatura específica do cartão,
// pra você ver o que compõe o total e decidir o que é de quem.
export async function getInvoiceItems(cardId: string, cycleKey: string) {
  const userId = await getUser();
  if (!userId) return { success: false as const, items: [], message: "Login necessário." };

  const card = (await db.select().from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, userId))))[0];
  if (!card) return { success: false as const, items: [], message: "Cartão não encontrado." };

  const rows = await db.select().from(transactions).where(
    and(eq(transactions.userId, userId), eq(transactions.creditCardId, cardId))
  );
  const items = rows
    .filter((t) => getInvoiceCycleForDate(t.date, card.closingDay, card.dueDay).cycleKey === cycleKey)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const cycleDates = getCycleDatesForCycleKey(cycleKey, card.closingDay, card.dueDay);
  return { success: true as const, card, cycleKey, ...cycleDates, items };
}

// --- MOVER ITENS DE DONO (e, se quiser, de cartão) ---
// Caso típico: compra da empresa que caiu no cartão pessoal. Muda o dono dos
// itens (e, junto, PF/PJ) sem mexer em data, valor nem categoria. Se um cartão
// de destino for informado, o item também passa a ser cobrado na fatura dele.
export async function reassignTransactions(ids: string[], target: { ownerId?: string; creditCardId?: string }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!Array.isArray(ids) || ids.length === 0) return { success: false, message: "Selecione pelo menos um item." };
    if (!target.ownerId && !target.creditCardId) return { success: false, message: "Escolha o novo dono ou o novo cartão." };

    const changes: { ownerId?: string; entityType?: "pf" | "pj"; creditCardId?: string } = {};

    if (target.ownerId) {
      const owner = (await ensureOwners(userId)).find((o) => o.id === target.ownerId);
      if (!owner) return { success: false, message: "Dono não encontrado." };
      changes.ownerId = owner.id;
      changes.entityType = owner.kind;
    }
    if (target.creditCardId) {
      const card = (await db.select().from(creditCards).where(and(eq(creditCards.id, target.creditCardId), eq(creditCards.userId, userId))))[0];
      if (!card) return { success: false, message: "Cartão de destino não encontrado." };
      changes.creditCardId = card.id;
    }

    // O filtro por userId garante que só itens do próprio usuário são alterados.
    const updated = await db.update(transactions).set(changes)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
      .returning({ id: transactions.id });

    revalidatePath("/");
    return { success: true, updated: updated.length };
  } catch (error) {
    console.error("Erro ao mover itens:", error);
    return { success: false, message: "Erro ao mover os itens." };
  }
}
