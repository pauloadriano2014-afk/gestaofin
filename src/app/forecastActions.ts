'use server'

import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { getUser } from "./actions";
import { getCreditCardsOverview } from "./creditCardActions";
import { todayDateStr, addDays, addMonthsClamped } from "@/utils/dates";

// --- PREVISÃO FINANCEIRA DO MÊS ---
// Junta o que ainda falta pagar (contas fixas em aberto + faturas de cartão
// abertas/atrasadas) e compara com a receita esperada, pra responder
// "vou conseguir pagar tudo esse mês?".
export async function getFinancialForecast() {
  try {
    const userId = await getUser();
    if (!userId) return { success: false as const };

    const today = todayDateStr();
    const [y, m] = today.split("-").map(Number);
    const startOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDayOfMonth = new Date(y, m, 0).getDate();
    const endOfMonth = `${y}-${String(m).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

    // 1. Contas fixas ainda não pagas com vencimento até o fim do mês corrente
    // (isso já inclui qualquer coisa atrasada de meses anteriores).
    const unpaidFixed = await db.select().from(transactions).where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.isFixed, true),
        eq(transactions.type, "expense"),
        eq(transactions.isPaid, false),
        lte(transactions.date, endOfMonth)
      )
    );
    const fixedBillsTotal = unpaidFixed.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    // 2. Faturas de cartão em aberto (ciclo atual ainda não fechado) + fechadas
    // e ainda não pagas (atrasadas).
    const cardsOverview = await getCreditCardsOverview();
    const cardInvoicesTotal = cardsOverview.reduce(
      (sum, c) => sum + (c.openCycle?.total || 0) + c.closedUnpaidTotal,
      0
    );

    // 3. Receita esperada: usa a receita já lançada neste mês; se ainda não
    // tiver nada lançado (comum no início do mês, antes do salário cair),
    // cai para a média dos últimos 3 meses fechados como estimativa.
    const currentMonthIncomeTx = await db.select().from(transactions).where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "income"),
        gte(transactions.date, startOfMonth),
        lte(transactions.date, endOfMonth)
      )
    );
    let expectedIncome = currentMonthIncomeTx.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    let incomeSource: "mes_atual" | "media_3_meses" = "mes_atual";

    if (expectedIncome === 0) {
      const threeMonthsAgoStart = addMonthsClamped(startOfMonth, -3);
      const dayBeforeThisMonth = addDays(startOfMonth, -1);
      const pastIncomeTx = await db.select().from(transactions).where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "income"),
          gte(transactions.date, threeMonthsAgoStart),
          lte(transactions.date, dayBeforeThisMonth)
        )
      );
      const pastTotal = pastIncomeTx.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      expectedIncome = pastTotal / 3;
      incomeSource = "media_3_meses";
    }

    const totalOwed = fixedBillsTotal + cardInvoicesTotal;
    const projectedBalance = expectedIncome - totalOwed;

    return {
      success: true as const,
      fixedBillsTotal,
      cardInvoicesTotal,
      totalOwed,
      expectedIncome,
      incomeSource,
      projectedBalance,
    };
  } catch (error) {
    console.error("Erro ao calcular previsão financeira:", error);
    return { success: false as const };
  }
}
