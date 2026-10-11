'use server'

import { db } from "@/db";
import { categories, transactions, userSettings, categoryRules, fixedBills, accounts, creditCards } from "@/db/schema";
import { getOwners, resolveOwnership, ownerSetupNeeded } from "@/db/owners";
import { matchesView } from "@/utils/owners";
import { inferKindFromName, buildKindSets, type CategoryKind } from "@/utils/categoryKinds";
import { balanceForPeriod, classifyForPeriod, adjustmentFor, FOREVER_START } from "@/utils/balance";
import { cycleKeyForDueMonth, withInvoiceTag } from "@/utils/creditCard";
import { settleInvoice } from "@/db/invoices";
import { dedupeAgainstExisting } from "@/utils/invoiceLines";
import { bestExistingMatch, daysApart } from "@/utils/transfers";
import { desc, asc, and, or, sql, eq, lte, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { resolveIsPro } from "@/db/planAccess";
import { addMonthsClamped, splitAmountIntoInstallments, addDays } from "@/utils/dates";
import { findMatchingRuleCategoryId } from "@/utils/categoryRules";
import { learnCategoryRule } from "./categoryRuleActions";
import { todayDateStr } from "@/utils/dates";


// --- FUNÇÃO AUXILIAR ASSÍNCRONA ---
// Exportada para ser reaproveitada pelos outros arquivos de actions (cartões, regras de categoria).
export async function getUser() {
  const session = await auth();
  if (!session || !session.userId) {
    return null;
  }
  return session.userId;
}

// --- BUSCAR DADOS DA DASHBOARD ---
export async function getDashboardData(startMonth: number, startYear: number, endMonth: number, endYear: number, isolatePeriod: boolean = false) {
  try {
    const userId = await getUser();
    
    if (!userId) {
      console.log("⚠️ Dashboard: Sem usuário logado.");
      return { 
        allCategories: [], fixedExpenses: [], variableTransactions: [], transactions: [], 
        summary: { balance: 0, globalBalance: 0, globalBalancePF: 0, globalBalancePJ: 0, income: 0, expense: 0 }, categoryStats: [], pieData: [], dailyData: [],
        planType: 'free'
      };
    }

    // Datas do período (usadas pelas consultas abaixo).
    const startDateStr = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
    const lastDayOfEndMonth = new Date(endYear, endMonth, 0).getDate();
    const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDayOfEndMonth).padStart(2, '0')}`;

    // Donos da conta (pessoas e empresas que a própria pessoa escolheu).
    // Nada é criado aqui: quem ainda não escolheu a organização vê a tela de
    // escolha (needsOwnerSetup) na primeira vez.
    const ownerList = await getOwners(userId);

    // DESEMPENHO: antes estas etapas rodavam uma depois da outra (cada uma é
    // uma ida e volta ao banco). Elas não dependem entre si, então rodam juntas:
    //  - categorias essenciais;
    //  - contas fixas do(s) mês(es) olhado(s): gera a cobrança dos moldes sem
    //    precisar clicar em "Virar Mês" (só mês atual/futuro, nunca passado);
    //  - contas cadastradas;
    //  - plano: regra única em db/planAccess (contas master nunca perdem o PRO).
    const [accountList, isPro, needsOwnerSetup] = await Promise.all([
      db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.archived, false))),
      resolveIsPro(userId),
      ownerSetupNeeded(userId),
      syncEssentialCategories(userId),
      ensureFixedBillOccurrencesForRange(userId, startMonth, startYear, endMonth, endYear),
    ]);
    const planType = isPro ? 'pro' : 'free';

    // Com as etapas acima prontas, as leituras também são independentes:
    // categorias, transações do período e (no modo acumulado) o saldo da vida toda.
    type BalanceRow = { type: string; amount: string; entityType: string | null; ownerId: string | null; categoryId: string | null; isPaid: boolean | null; date: string; paidAt: string | null };
    const balanceStart = isolatePeriod ? startDateStr : FOREVER_START;
    const [allCategories, currentTransactions, balanceRows] = await Promise.all([
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(transactions)
        .where(and(eq(transactions.userId, userId), gte(transactions.date, startDateStr), lte(transactions.date, endDateStr)))
        .orderBy(desc(transactions.date)),
      // Linhas que mexem no saldo: a vida toda até o fim do período (data ou
      // pagamento até lá). Delas saem o saldo do período (mês isolado ou
      // acumulado) E o "dinheiro acumulado", usado para conferir com o banco.
      db.select({ type: transactions.type, amount: transactions.amount, entityType: transactions.entityType, ownerId: transactions.ownerId, categoryId: transactions.categoryId, isPaid: transactions.isPaid, date: transactions.date, paidAt: transactions.paidAt })
        .from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          or(lte(transactions.date, endDateStr), lte(transactions.paidAt, endDateStr))
        )),
    ]);

    // Saldo = entradas - saídas (transferência e pagamento de fatura ficam de
    // fora, ver utils/balance.ts). Com "isolatePeriod" só conta a janela
    // selecionada; senão, a vida toda até o fim do período.

    const kindSets = buildKindSets(allCategories);
    // Saldo = só o que já foi pago; o que ainda falta pagar/receber vem à parte
    // (pending) e o previsto é a soma dos dois. Ver utils/balance.ts.
    const split = (rows: BalanceRow[]) => balanceForPeriod(rows, kindSets, balanceStart, endDateStr);
    const accum = (rows: BalanceRow[]) => balanceForPeriod(rows, kindSets, FOREVER_START, endDateStr).paid;
    const pfRows = balanceRows.filter(t => t.entityType === 'pf');
    const pjRows = balanceRows.filter(t => t.entityType === 'pj');
    const gAll = split(balanceRows);
    const gPF = split(pfRows);
    const gPJ = split(pjRows);
    const globalBalance = gAll.paid;
    const globalBalancePF = gPF.paid;
    const globalBalancePJ = gPJ.paid;
    const globalPending = gAll.pending;
    const globalPendingPF = gPF.pending;
    const globalPendingPJ = gPJ.pending;
    // Dinheiro acumulado (desde sempre, só o pago): é o que deve bater com o banco.
    const accumulated = accum(balanceRows);
    const accumulatedPF = accum(pfRows);
    const accumulatedPJ = accum(pjRows);
    const balanceByOwner: Record<string, number> = {};
    const pendingByOwner: Record<string, number> = {};
    const accumulatedByOwner: Record<string, number> = {};
    for (const o of ownerList) {
      const rows = balanceRows.filter(t => t.ownerId === o.id);
      const g = split(rows);
      balanceByOwner[o.id] = g.paid;
      pendingByOwner[o.id] = g.pending;
      accumulatedByOwner[o.id] = accum(rows);
    }

    const fixedExpenses = currentTransactions.filter(t => t.isFixed === true && t.type === 'expense');
    const variableTransactions = currentTransactions.filter(t => t.isFixed === false || t.type === 'income');

    const income = currentTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const expense = currentTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const balance = income - expense;

    const categoryStats = allCategories.map(cat => {
      const spent = currentTransactions
        .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
      
      return { id: cat.id, name: cat.name, value: spent, budget: Number(cat.budget || 0), color: '#3b82f6' };
    })
    .filter(i => i.value > 0 || i.budget > 0)
    .sort((a, b) => b.value - a.value);

    return { 
      allCategories, 
      fixedExpenses, 
      variableTransactions, 
      transactions: currentTransactions, 
      owners: ownerList,
      needsOwnerSetup,
      accounts: accountList,
      summary: { cashBasis: true, balance, income, expense, globalBalance, globalBalancePF, globalBalancePJ, balanceByOwner, globalPending, globalPendingPF, globalPendingPJ, pendingByOwner, accumulated, accumulatedPF, accumulatedPJ, accumulatedByOwner },
      categoryStats, 
      pieData: categoryStats, 
      dailyData: [], 
      planType: planType 
    };

  } catch (error) {
    console.error("Erro crítico no dashboard:", error);
    return {
        allCategories: [], fixedExpenses: [], variableTransactions: [], transactions: [],
        summary: { balance: 0, globalBalance: 0, globalBalancePF: 0, globalBalancePJ: 0, income: 0, expense: 0 }, categoryStats: [], pieData: [], dailyData: [],
        planType: 'free'
    };
  }
}

// --- DETALHAMENTO DO "SALDO PRINCIPAL" ---
// O card de Saldo Principal mostra um número GLOBAL (todas as transações até
// o fim do período selecionado, ou só o período quando "Isolar Saldo" está
// ligado) — diferente de Receita/Despesa Operacional, que já vêm filtradas
// no próprio rawData.transactions do período. Por isso o saldo precisa da
// sua própria busca, replicando exatamente a mesma regra usada em
// getDashboardData pra bater com o valor mostrado.
export async function getBalanceBreakdown(startMonth: number, startYear: number, endMonth: number, endYear: number, isolatePeriod: boolean, viewMode: string) {
  try {
    const userId = await getUser();
    if (!userId) return [];

    const lastDayOfEndMonth = new Date(endYear, endMonth, 0).getDate();
    const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDayOfEndMonth).padStart(2, '0')}`;

    const startDateStr = isolatePeriod ? `${startYear}-${String(startMonth).padStart(2, '0')}-01` : FOREVER_START;
    // Mesmas linhas do saldo: as de data no período e as pagas no período.
    const rows = await db.select().from(transactions).where(and(
      eq(transactions.userId, userId),
      or(
        and(gte(transactions.date, startDateStr), lte(transactions.date, endDateStr)),
        and(gte(transactions.paidAt, startDateStr), lte(transactions.paidAt, endDateStr))
      )
    ));

    // Mesma regra do saldo (ver utils/balance.ts): transferência e pagamento de
    // fatura ficam de fora, pra a lista somar exatamente o valor do card.
    const kindSets = buildKindSets(await db.select().from(categories).where(eq(categories.userId, userId)));
    const filtered = rows.filter((t) => matchesView(t, viewMode))
      .filter((t) => t.type === 'income' || t.type === 'expense')
      .filter((t) => !(t.categoryId && kindSets.card_payment.has(t.categoryId)))
      .filter((t) => classifyForPeriod(t, startDateStr, endDateStr) === 'paid') // só o que foi pago no período
      .sort((a, b) => { const da = a.paidAt || a.date; const db2 = b.paidAt || b.date; return da < db2 ? 1 : da > db2 ? -1 : 0; });

    return filtered;
  } catch (error) {
    console.error("Erro ao detalhar saldo:", error);
    return [];
  }
}

// --- CONCILIAÇÃO COM O BANCO ---
// Ajustes de conciliação anteriores (tag) ficam de fora da conta: cada nova
// conciliação SUBSTITUI a anterior em vez de somar por cima.
const ADJUST_TAG = "ajuste_saldo";
const notAdjustment = sql`NOT (coalesce(${transactions.aiTags}, ARRAY[]::text[]) @> ARRAY[${ADJUST_TAG}::text])`;

// Dinheiro acumulado de um dono (só o que já foi pago, desde sempre, até a data),
// sem contar ajustes de conciliação antigos. É o número que deve ser igual ao
// saldo que aparece no app do banco.
async function accumulatedForOwner(userId: string, ownerId: string, untilDate: string) {
  const [cats, rows] = await Promise.all([
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select({ type: transactions.type, amount: transactions.amount, categoryId: transactions.categoryId, isPaid: transactions.isPaid, date: transactions.date, paidAt: transactions.paidAt })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.ownerId, ownerId),
        notAdjustment,
        or(lte(transactions.date, untilDate), lte(transactions.paidAt, untilDate))
      )),
  ]);
  return balanceForPeriod(rows, buildKindSets(cats), FOREVER_START, untilDate).paid;
}

export async function getOwnerAccumulated(ownerId: string, untilDate: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false as const, message: "Login necessário." };
    const owner = (await getOwners(userId)).find((o) => o.id === ownerId);
    if (!owner) return { success: false as const, message: "Dono não encontrado." };
    return { success: true as const, accumulated: await accumulatedForOwner(userId, ownerId, untilDate) };
  } catch (error) {
    console.error("Erro ao calcular saldo acumulado:", error);
    return { success: false as const, message: "Erro ao calcular." };
  }
}

// Lança UM ajuste com a diferença entre o saldo do app e o do banco. É um SALDO
// INICIAL: fica datado no dia anterior ao primeiro lançamento do dono, então
// entra no "dinheiro acumulado" mas NÃO suja o movimento de nenhum mês (o Mês
// isolado continua mostrando só o que aconteceu naquele mês). Fica na categoria
// "Ajuste de saldo" (tipo reembolso: não vira receita nem despesa). Conciliar de
// novo substitui o ajuste anterior.
export async function reconcileOwnerBalance(ownerId: string, realBalance: number, untilDate: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!Number.isFinite(realBalance)) return { success: false, message: "Informe o saldo do banco." };
    const owner = (await getOwners(userId)).find((o) => o.id === ownerId);
    if (!owner) return { success: false, message: "Dono não encontrado." };

    const current = await accumulatedForOwner(userId, ownerId, untilDate);
    const adj = adjustmentFor(current, realBalance);

    const oldAdjustments = and(eq(transactions.userId, userId), eq(transactions.ownerId, ownerId), sql`coalesce(${transactions.aiTags}, ARRAY[]::text[]) @> ARRAY[${ADJUST_TAG}::text]`);
    if (!adj) {
      await db.delete(transactions).where(oldAdjustments);
      revalidatePath("/");
      return { success: true, adjusted: false, message: "Já está batendo com o banco." };
    }

    const cats = await db.select().from(categories).where(eq(categories.userId, userId));
    let cat = cats.find((c) => c.name.trim().toLowerCase() === "ajuste de saldo");
    if (!cat) {
      cat = (await db.insert(categories).values({ userId, name: "Ajuste de saldo", type: "expense", kind: "refund" }).returning())[0];
    } else if (cat.kind !== "refund") {
      await db.update(categories).set({ kind: "refund" }).where(eq(categories.id, cat.id));
    }

    // dia anterior ao primeiro lançamento do dono (sem contar ajustes antigos)
    const [first] = await db.select({ d: sql<string | null>`min(least(${transactions.date}, coalesce(${transactions.paidAt}, ${transactions.date})))` })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.ownerId, ownerId), notAdjustment));
    const adjDate = first?.d && first.d <= untilDate ? addDays(first.d, -1) : addDays(untilDate, -1);

    const ownership = await resolveOwnership(userId, { ownerId });
    const [created] = await db.insert(transactions).values({
      userId,
      description: `Saldo inicial / ajuste (conciliação com o banco em ${untilDate.split("-").reverse().join("/")})`,
      amount: adj.amount.toFixed(2),
      categoryId: cat.id,
      type: adj.type,
      date: adjDate,
      isFixed: false,
      isPaid: true,
      paidAt: adjDate,
      entityType: ownership.entityType,
      ownerId: ownership.ownerId,
      aiTags: [ADJUST_TAG],
    }).returning({ id: transactions.id });

    // só depois de gravar o novo, remove os ajustes antigos
    await db.delete(transactions).where(and(oldAdjustments, sql`${transactions.id} <> ${created.id}`));
    revalidatePath("/");
    return { success: true, adjusted: true, type: adj.type, amount: adj.amount };
  } catch (error) {
    console.error("Erro ao conciliar saldo:", error);
    return { success: false, message: "Erro ao salvar o ajuste." };
  }
}

// --- CFO VIRTUAL ---
export async function generateMonthlyReport(month: number, year: number) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Não autorizado." };

    const isPro = await resolveIsPro(userId);

    if (!isPro) {
      return { success: false, message: "⚠️ RECURSO PREMIUM: A análise inteligente do CFO Virtual está disponível apenas para assinantes PRO." };
    }

    const reportData = await getDashboardData(month, year, month, year, false); 
    const txs = reportData.transactions || [];
    
    if (txs.length === 0) return { success: false, message: "Sem dados suficientes para análise." };

    const income = txs.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const expense = txs.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    
    const topExpenses = txs
        .filter((t: any) => t.type === 'expense')
        .sort((a: any, b: any) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
        .slice(0, 5)
        .map((t: any) => `${t.description} (R$${Math.abs(Number(t.amount))})`)
        .join(', ');

    const summaryText = `Período: ${month}/${year}\nReceita: R$ ${income}\nDespesas: R$ ${expense}\nResultado: R$ ${income - expense}\nTop Gastos: ${topExpenses}`;

    const API_KEY = process.env.OPENAI_API_KEY; 
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um CFO Virtual. Analise os dados e forneça insights corporativos concisos (max 3 parágrafos). Seja direto e estratégico." },
          { role: "user", content: summaryText }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    // 🔥 CORRIGIDO: antes lia data.choices[0] direto; se a OpenAI respondesse
    // com erro (chave inválida, sem créditos, etc.) isso quebrava com um
    // TypeError genérico, escondido pelo catch, sem log nenhum do motivo real.
    if (!response.ok || data.error) {
      console.error("Erro da OpenAI em generateMonthlyReport:", data.error || response.statusText);
      return { success: false, message: "O serviço de análise executiva está indisponível momentaneamente." };
    }

    return { success: true, message: data.choices[0].message.content };
  } catch (error: any) {
    console.error("Erro em generateMonthlyReport:", error.message);
    return { success: false, message: "O serviço de análise executiva está indisponível momentaneamente." };
  }
}

// --- CRIAR TRANSAÇÃO ---
export async function createTransaction(data: any) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, error: "Faça login para salvar." };

    const installments = data.installments ? Number(data.installments) : 1;
    // 🔥 CORRIGIDO: antes cada parcela usava o mesmo valor arredondado
    // (ex: R$100 / 3 = 33.33 x3 = R$99,99, sumindo com 1 centavo). Agora
    // distribuímos os centavos restantes nas primeiras parcelas, então a
    // soma das parcelas sempre bate exatamente com o valor total lançado.
    const installmentAmounts = splitAmountIntoInstallments(Number(data.amount), installments);

    let baseDate: string = data.date;
    if (!baseDate) {
      const now = new Date();
      const brDateParts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const day = brDateParts.find(p => p.type === 'day')?.value;
      const month = brDateParts.find(p => p.type === 'month')?.value;
      const year = brDateParts.find(p => p.type === 'year')?.value;
      baseDate = `${year}-${month}-${day}`;
    }

    // 🔥 NOVO: se esse lançamento novo já nasce vinculado a uma conta fixa
    // cadastrada, remove antes qualquer ocorrência automática duplicada do
    // mesmo molde no mesmo mês — evita contar a despesa duas vezes.
    if (data.fixedBillId) {
      await absorbFixedBillOccurrence(userId, data.fixedBillId, baseDate);
    }

    const ownership = await resolveOwnership(userId, { ownerId: data.ownerId, entityType: data.entityType });

    // Pagamento que quita uma fatura de cartão: o lançamento é salvo como
    // "pagamento de fatura" (fora de Despesas e do Saldo, porque as compras já
    // contam) e a fatura recebe baixa na data informada.
    const linkedInvoices: string[][] = typeof data.linkedInvoice === "string" && data.linkedInvoice
      ? data.linkedInvoice.split(",").map((x: string) => x.split("|")).filter((x: string[]) => x.length === 2 && x[0] && x[1])
      : [];
    const linkedInvoice = linkedInvoices.length > 0 ? linkedInvoices[0] : null;
    const paymentCategoryId = linkedInvoice
      ? buildKindSetsFirst(await db.select().from(categories).where(eq(categories.userId, userId)))
      : null;

    for (let i = 0; i < installments; i++) {
      // 🔥 CORRIGIDO: somar meses direto no dia (ex: dia 31 + 1 mês) podia
      // gerar datas de calendário inválidas como "2026-02-31". Agora a data
      // é "grudada" no último dia válido do mês de destino (ex: 28/29 de fev).
      const finalDateStr = addMonthsClamped(baseDate, i);
      const description = installments > 1 ? `${data.description} (${i + 1}/${installments})` : data.description;

      // 🔥 NOVO: compra feita num cartão de crédito nunca nasce "paga" — quem
      // dá baixa é a fatura inteira (payCreditCardInvoice), não a compra avulsa.
      const isCardPurchase = !!data.creditCardId;
      const isPaidValue = isCardPurchase ? false : ((installments > 1 && i > 0) ? false : (data.isPaid ?? true));

      await db.insert(transactions).values({
        userId: userId,
        description: description,
        amount: installmentAmounts[i],
        categoryId: (linkedInvoice && paymentCategoryId) ? paymentCategoryId : (data.categoryId || null),
        type: data.type,
        date: finalDateStr,
        isFixed: data.isFixed || false,
        isPaid: isPaidValue,
        entityType: ownership.entityType,
        ownerId: ownership.ownerId,
        accountId: data.accountId || null,
        creditCardId: data.creditCardId || null,
        // 🔥 NOVO: vínculo com o molde de conta fixa + valor original esperado
        // (pra poder comparar com o valor efetivamente pago e saber se teve
        // juro ou desconto).
        fixedBillId: data.fixedBillId || null,
        originalAmount: data.originalAmount ? Math.abs(Number(data.originalAmount)).toString() : null,
        aiTags: [],
      });
    }

    let settledInvoice = false;
    // um pagamento pode quitar mais de uma fatura (ex: uma fatura dividida em duas)
    for (const [cardId, cycleKey] of linkedInvoices) {
      const res = await settleInvoice(userId, cardId, cycleKey, baseDate);
      if (res.success) settledInvoice = true;
    }

    // 🔥 NOVO: aprende com a categoria escolhida, pra próxima importação/lançamento
    // com descrição parecida já vir sugerido sozinho.
    const categoryToLearn = (linkedInvoice && paymentCategoryId) ? paymentCategoryId : data.categoryId;
    if (categoryToLearn) {
      await learnCategoryRule(userId, data.description, categoryToLearn);
    }

    revalidatePath("/");
    return { success: true, settledInvoice };
  } catch (error) { return { success: false, error: "Erro ao salvar no banco." }; }
}

// --- ATUALIZAR STATUS ---
export async function toggleTransactionStatus(id: string, currentStatus: boolean) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    const newStatus = !currentStatus;
    // 🔥 NOVO: antes só existia o sim/não (isPaid). Agora também guardamos a
    // data/hora exata em que a baixa foi dada (paidAt), e limpamos se desmarcar.
    await db.update(transactions).set({
      isPaid: newStatus,
      paidAt: newStatus ? todayDateStr() : null,
    }).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- CONTAS FIXAS EM ABERTO (painel independente do período/mês selecionado) ---
// Antes, "vencido"/"vence hoje" só aparecia se a conta estivesse dentro do
// filtro de mês selecionado no topo do dashboard — então, olhando outro mês,
// uma conta atrasada passava despercebida. Isso busca TODAS as contas fixas
// não pagas (vencidas, de qualquer época, + as que vencem nos próximos 15
// dias), sem depender do período escolhido na tela.
// 🔥 CORRIGIDO: antes esse painel ignorava de propósito o filtro de mês do
// topo (mostrava vencidas + o que vencia nos próximos 15 dias, não importa o
// período escolhido) — o usuário achou confuso ver contas de um mês que nem
// estava selecionado. Agora recebe o mesmo range de mês/ano do filtro
// principal e só mostra o que cai dentro dele.
export async function getOpenFixedBills(startMonth?: number, startYear?: number, endMonth?: number, endYear?: number, viewMode: string = 'all') {
  try {
    const userId = await getUser();
    if (!userId) return [];

    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.isFixed, true),
      eq(transactions.type, 'expense'),
      eq(transactions.isPaid, false),
    ];

    // Respeita a visão da tela (Tudo / Casal / Paulo / Adri / Empresa).
    if (viewMode === 'pf' || viewMode === 'pj') conditions.push(eq(transactions.entityType, viewMode));
    else if (viewMode !== 'all') conditions.push(eq(transactions.ownerId, viewMode));

    if (startMonth && startYear) {
      conditions.push(gte(transactions.date, `${startYear}-${String(startMonth).padStart(2, '0')}-01`));
    }
    if (endMonth && endYear) {
      const lastDayOfEndMonth = new Date(endYear, endMonth, 0).getDate();
      conditions.push(lte(transactions.date, `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDayOfEndMonth).padStart(2, '0')}`));
    }

    const bills = await db.select().from(transactions).where(and(...conditions)).orderBy(asc(transactions.date));

    return bills;
  } catch (error) {
    console.error("Erro ao buscar contas em aberto:", error);
    return [];
  }
}

// --- VIRAR O MÊS ---
// 🔥 ATUALIZADO: agora tem duas fontes de contas fixas. As antigas (lançadas
// direto marcando "fixa", sem molde cadastrado) continuam copiando do jeito
// que sempre funcionou, pra não quebrar nada que já existia. As novas, vindas
// de um molde em "Minhas Contas Fixas", geram a cobrança do mês seguinte
// direto a partir do molde (nome, categoria, dia de vencimento e valor
// original), o que permite ter um valor "de referência" fixo mesmo que o
// valor pago varie de mês a mês (juro/desconto).
export async function copyFixedExpenses(currentMonth: number, currentYear: number) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    let count = 0;

    // PARTE 1 (legado): contas fixas avulsas, sem molde vinculado.
    const legacyFixedExpenses = await db.select().from(transactions).where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.isFixed, true),
        eq(transactions.type, 'expense'),
        sql`${transactions.fixedBillId} IS NULL`,
        sql`EXTRACT(MONTH FROM ${transactions.date}) = ${currentMonth}`,
        sql`EXTRACT(YEAR FROM ${transactions.date}) = ${currentYear}`
      )
    );

    for (const expense of legacyFixedExpenses) {
      // 🔥 CORRIGIDO: mesmo problema do parcelamento — uma conta fixa no dia 31
      // (ex: aluguel) virava uma data inválida como "2026-02-31" ao copiar
      // para fevereiro. Agora gruda no último dia válido do mês seguinte.
      const nextDateStr = addMonthsClamped(expense.date, 1);
      const existing = await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.description, expense.description), eq(transactions.date, nextDateStr), eq(transactions.amount, expense.amount)));

      if (existing.length === 0) {
        await db.insert(transactions).values({
          userId: userId, description: expense.description, amount: Math.abs(Number(expense.amount)).toString(),
          originalAmount: expense.originalAmount ?? expense.amount,
          categoryId: expense.categoryId, type: expense.type, date: nextDateStr, isFixed: true, isPaid: false,
          entityType: expense.entityType, ownerId: expense.ownerId, accountId: expense.accountId, aiTags: expense.aiTags,
        });
        count++;
      }
    }

    // PARTE 2 (novo): moldes cadastrados em "Minhas Contas Fixas".
    const templates = await db.select().from(fixedBills).where(and(eq(fixedBills.userId, userId), eq(fixedBills.archived, false)));

    if (templates.length > 0) {
      const refDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const nextRefDateStr = addMonthsClamped(refDateStr, 1);
      const [nextYearStr, nextMonthStr] = nextRefDateStr.split('-');
      const nextMonth = Number(nextMonthStr);
      const nextYear = Number(nextYearStr);
      const lastDayNextMonth = new Date(nextYear, nextMonth, 0).getDate();

      for (const tpl of templates) {
        const dueDay = Math.min(tpl.dueDay, lastDayNextMonth);
        const dueDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
        const existingTpl = await db.select().from(transactions).where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.fixedBillId, tpl.id),
            sql`EXTRACT(MONTH FROM ${transactions.date}) = ${nextMonth}`,
            sql`EXTRACT(YEAR FROM ${transactions.date}) = ${nextYear}`
          )
        );
        if (existingTpl.length === 0) {
          await db.insert(transactions).values({
            userId: userId, description: tpl.name, amount: tpl.originalAmount, originalAmount: tpl.originalAmount,
            categoryId: tpl.categoryId, type: 'expense', date: dueDateStr, isFixed: true, isPaid: false,
            entityType: tpl.entityType || 'pf', ownerId: tpl.ownerId, creditCardId: tpl.creditCardId, fixedBillId: tpl.id, aiTags: [],
          });
          count++;
        }
      }
    }

    if (count === 0) return { success: false, message: "Nenhuma conta fixa nova pra copiar (ou o mês seguinte já foi virado)." };
    revalidatePath("/");
    return { success: true, message: `${count} contas copiadas!` };
  } catch (error) {
    console.error("Erro ao virar o mês:", error);
    return { success: false, message: "Erro ao processar." };
  }
}

// --- AUTOCURA: garante a cobrança do molde no(s) mês(es) que você está vendo ---
// Sem isso, cadastrar uma conta fixa nova em "Minhas Contas Fixas" não gerava
// nenhuma transação sozinho — só apareceria no "Custos Fixos" depois de
// clicar em "Virar Mês" (que, além disso, sempre mira o mês SEGUINTE, nunca
// o mês atual). Essas funções (não exportadas, só uso interno) rodam junto
// com getDashboardData e criam a ocorrência que falta pro mês que você está
// olhando — nunca pra um mês que já passou, pra não inventar pendência em
// período fechado.
async function ensureFixedBillOccurrences(userId: string, month: number, year: number) {
  const templates = await db.select().from(fixedBills).where(and(eq(fixedBills.userId, userId), eq(fixedBills.archived, false)));
  if (templates.length === 0) return;

  const lastDay = new Date(year, month, 0).getDate();
  for (const tpl of templates) {
    const dueDay = Math.min(tpl.dueDay, lastDay);
    const dueDateStr = `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    const existing = await db.select().from(transactions).where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.fixedBillId, tpl.id),
        sql`EXTRACT(MONTH FROM ${transactions.date}) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactions.date}) = ${year}`
      )
    );
    if (existing.length === 0) {
      await db.insert(transactions).values({
        userId, description: tpl.name, amount: tpl.originalAmount, originalAmount: tpl.originalAmount,
        categoryId: tpl.categoryId, type: 'expense', date: dueDateStr, isFixed: true, isPaid: false,
        entityType: tpl.entityType || 'pf', ownerId: tpl.ownerId, creditCardId: tpl.creditCardId, fixedBillId: tpl.id, aiTags: [],
      });
    }
  }
}

async function ensureFixedBillOccurrencesForRange(userId: string, startMonth: number, startYear: number, endMonth: number, endYear: number) {
  const today = todayDateStr();
  const [todayYear, todayMonth] = today.split('-').map(Number);

  let m = startMonth;
  let y = startYear;
  let guard = 0; // proteção contra range absurdo/invertido
  while ((y < endYear || (y === endYear && m <= endMonth)) && guard < 36) {
    if (y > todayYear || (y === todayYear && m >= todayMonth)) {
      await ensureFixedBillOccurrences(userId, m, y);
    }
    m++;
    if (m > 12) { m = 1; y++; }
    guard++;
  }
}

// 🔥 CORRIGIDO: bug de duplicidade. Quando o usuário vinculava um lançamento
// JÁ EXISTENTE (ex: o pagamento importado do extrato do banco) a uma conta
// fixa cadastrada, isso só marcava aquele lançamento com o fixedBillId — a
// ocorrência que o ensureFixedBillOccurrences já tinha criado automaticamente
// pro mesmo molde no mesmo mês continuava lá, intacta, contando a despesa
// duas vezes ("Carro" + "Pagamento de boleto..." separados, cada um com o
// valor cheio). Essa função remove qualquer OUTRA transação do mesmo molde
// no mesmo mês/ano assim que uma passa a apontar pra ele — o lançamento
// editado/criado vira o único registro daquela conta fixa naquele mês.
async function absorbFixedBillOccurrence(userId: string, fixedBillId: string, referenceDate: string, excludeId?: string) {
  try {
    const [yearStr, monthStr] = (referenceDate || "").split('-');
    const month = Number(monthStr);
    const year = Number(yearStr);
    if (!month || !year) return;

    const candidates = await db.select().from(transactions).where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.fixedBillId, fixedBillId),
        sql`EXTRACT(MONTH FROM ${transactions.date}) = ${month}`,
        sql`EXTRACT(YEAR FROM ${transactions.date}) = ${year}`
      )
    );

    for (const dup of candidates) {
      if (excludeId && dup.id === excludeId) continue;
      await db.delete(transactions).where(eq(transactions.id, dup.id));
    }
  } catch (error) {
    console.error("Erro ao absorver ocorrência duplicada de conta fixa:", error);
  }
}

// --- CONTAS FIXAS: MOLDES ("Minhas Contas Fixas") ---
// O molde guarda o "de referência" de cada conta fixa (nome, categoria, dia
// de vencimento, valor original) separado das transações que ele gera mês a
// mês — assim dá pra comparar valor original x valor pago em cada ocorrência.
export async function getFixedBills() {
  try {
    const userId = await getUser();
    if (!userId) return [];
    return await db.select().from(fixedBills).where(eq(fixedBills.userId, userId));
  } catch (error) {
    console.error("Erro ao buscar contas fixas:", error);
    return [];
  }
}

export async function createFixedBill(data: { name: string; categoryId?: string | null; originalAmount: string | number; dueDay: number; entityType?: string; ownerId?: string | null; creditCardId?: string | null }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!data.name?.trim()) return { success: false, message: "Digite um nome pra conta fixa." };
    if (!data.originalAmount || Number(data.originalAmount) <= 0) return { success: false, message: "Informe o valor original." };
    if (!data.dueDay || data.dueDay < 1 || data.dueDay > 31) return { success: false, message: "Dia de vencimento inválido (1 a 31)." };

    const ownership = await resolveOwnership(userId, data);
    await db.insert(fixedBills).values({
      userId,
      name: data.name.trim(),
      categoryId: data.categoryId || null,
      originalAmount: Math.abs(Number(data.originalAmount)).toString(),
      dueDay: data.dueDay,
      entityType: ownership.entityType,
      ownerId: ownership.ownerId,
      creditCardId: data.creditCardId || null,
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar conta fixa:", error);
    return { success: false, message: "Erro ao criar conta fixa." };
  }
}

export async function updateFixedBill(id: string, data: { name: string; categoryId?: string | null; originalAmount: string | number; dueDay: number; entityType?: string; ownerId?: string | null; creditCardId?: string | null }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!data.name?.trim()) return { success: false, message: "Digite um nome pra conta fixa." };
    if (!data.originalAmount || Number(data.originalAmount) <= 0) return { success: false, message: "Informe o valor original." };
    if (!data.dueDay || data.dueDay < 1 || data.dueDay > 31) return { success: false, message: "Dia de vencimento inválido (1 a 31)." };

    const ownership = await resolveOwnership(userId, data);
    await db.update(fixedBills).set({
      name: data.name.trim(),
      categoryId: data.categoryId || null,
      originalAmount: Math.abs(Number(data.originalAmount)).toString(),
      dueDay: data.dueDay,
      entityType: ownership.entityType,
      ownerId: ownership.ownerId,
      creditCardId: data.creditCardId || null,
    }).where(and(eq(fixedBills.id, id), eq(fixedBills.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Erro ao editar conta fixa:", error);
    return { success: false, message: "Erro ao editar conta fixa." };
  }
}

// "Excluir" só arquiva — as transações já geradas continuam apontando pro
// molde, então apagar de verdade quebraria o histórico.
export async function setFixedBillArchived(id: string, archived: boolean) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    await db.update(fixedBills).set({ archived }).where(and(eq(fixedBills.id, id), eq(fixedBills.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Erro ao arquivar conta fixa:", error);
    return { success: false };
  }
}

// --- CONTAS FIXAS PENDENTES (pra vincular na importação) ---
// 🔥 NOVO: lista as ocorrências de conta fixa já geradas (por
// ensureFixedBillOccurrences) mas ainda não pagas. Usado na tela de revisão
// de importação (extrato bancário ou fatura de cartão) pra deixar o usuário
// vincular um item importado a uma delas — em vez de criar um lançamento
// novo e duplicar a despesa.
export async function getPendingFixedBillOccurrences() {
  try {
    const userId = await getUser();
    if (!userId) return [];
    return await db.select().from(transactions).where(
      and(eq(transactions.userId, userId), sql`${transactions.fixedBillId} IS NOT NULL`, eq(transactions.isPaid, false))
    );
  } catch (error) {
    console.error("Erro ao buscar contas fixas pendentes:", error);
    return [];
  }
}

// --- ATUALIZAR ORÇAMENTO ---
export async function updateCategoryBudget(categoryId: string, budget: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    await db.update(categories).set({ budget: budget }).where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- EXCLUIR ---
export async function deleteTransaction(id: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- AÇÕES EM MASSA (tela de Lançamentos) ---
// Sempre restritas aos itens do próprio usuário (filtro por userId no WHERE).

export async function deleteTransactions(ids: string[]) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!Array.isArray(ids) || ids.length === 0) return { success: false, message: "Selecione pelo menos um item." };
    const removed = await db.delete(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
      .returning({ id: transactions.id });
    revalidatePath("/");
    return { success: true, removed: removed.length };
  } catch (error) {
    console.error("Erro ao excluir em massa:", error);
    return { success: false, message: "Erro ao excluir os itens." };
  }
}

export async function setTransactionsCategory(ids: string[], categoryId: string | null) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!Array.isArray(ids) || ids.length === 0) return { success: false, message: "Selecione pelo menos um item." };

    if (categoryId) {
      const cat = (await db.select().from(categories).where(and(eq(categories.id, categoryId), eq(categories.userId, userId))))[0];
      if (!cat) return { success: false, message: "Categoria não encontrada." };
    }

    const updated = await db.update(transactions).set({ categoryId: categoryId || null })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
      .returning({ description: transactions.description });

    // Aprende com a escolha (uma vez por descrição), igual ao lançamento manual.
    if (categoryId) {
      const unique = Array.from(new Set(updated.map((t) => t.description))).slice(0, 50);
      for (const description of unique) await learnCategoryRule(userId, description, categoryId);
    }

    revalidatePath("/");
    return { success: true, updated: updated.length };
  } catch (error) {
    console.error("Erro ao trocar categoria em massa:", error);
    return { success: false, message: "Erro ao trocar a categoria." };
  }
}

// --- EDITAR ---
export async function updateTransaction(id: string, data: any) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };

    // 🔥 NOVO: mesma proteção contra duplicidade do createTransaction — se
    // essa edição está vinculando (ou já mantendo vinculado) o lançamento a
    // uma conta fixa cadastrada, remove qualquer OUTRA ocorrência do mesmo
    // molde no mesmo mês (ex: a que foi gerada automaticamente e ficou
    // esquecida quando você linkou um lançamento diferente, como o pagamento
    // importado do banco, à mesma conta fixa).
    if (data.fixedBillId) {
      await absorbFixedBillOccurrence(userId, data.fixedBillId, data.date, id);
    }

    const ownership = await resolveOwnership(userId, { ownerId: data.ownerId, entityType: data.entityType });
    await db.update(transactions).set({
        // 🔥 CORRIGIDO: categoryId é uma coluna uuid — mandar "" (categoria
        // vazia, ex: ao editar uma Transferência) quebrava com erro de UUID
        // inválido. Agora vira null igual já acontecia ao criar um lançamento.
        description: data.description, amount: Math.abs(Number(data.amount)).toString(), date: data.date, categoryId: data.categoryId || null, type: data.type, isFixed: data.isFixed, entityType: ownership.entityType,
        ownerId: ownership.ownerId,
        accountId: data.accountId || null,
        creditCardId: data.creditCardId || null,
        // 🔥 NOVO: mesmo vínculo/valor original de createTransaction, agora também editável.
        fixedBillId: data.fixedBillId || null,
        originalAmount: data.originalAmount ? Math.abs(Number(data.originalAmount)).toString() : null,
      }).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

    if (data.categoryId) {
      await learnCategoryRule(userId, data.description, data.categoryId);
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- SINCRONIZAR CATEGORIAS ---
async function syncEssentialCategories(userId: string) {
  try {
    // 🔥 NOVO: "Cartão de Crédito" continua na lista de propósito — cobre o
    // pagamento de fatura importado direto do extrato do banco (ex: "Pagamento
    // de boleto efetuado - BANCO BRADESCO FINANCIAMENTOS SA"), quando a compra
    // não foi lançada compra a compra dentro do KORE. "Compras Variadas" saiu
    // da lista (ver migração de unificação logo abaixo) e "Moradia" entrou.
    const essential = [
      { name: "Viagens", type: "expense" }, { name: "Assinaturas & Apps", type: "expense" }, { name: "Mercado", type: "expense" },
      { name: "Refeição Livre / Lazer", type: "expense" }, { name: "Suplementos", type: "expense" }, { name: "Vestuário / Academia", type: "expense" },
      { name: "Financiamentos", type: "expense" }, { name: "Reembolsos / Empréstimos", type: "expense" }, { name: "Transporte", type: "expense" },
      { name: "Saúde e Beleza", type: "expense" }, { name: "Estudos", type: "expense" }, { name: "Moradia", type: "expense" }, { name: "Despesas Variadas", type: "expense" },
      { name: "Impostos e Taxas", type: "expense" }, { name: "Cartão de Crédito", type: "expense" }, { name: "Salário", type: "income" },
      { name: "Investimentos", type: "income" }, { name: "Consultoria", type: "income" }
    ];

    const existingCategories = await db.select().from(categories).where(eq(categories.userId, userId));

    // 🔥 NOVO: quem já tinha a categoria "Saúde" migra pro nome novo "Saúde e
    // Beleza" (agora cobre farmácia, cosméticos, corte de cabelo etc também)
    // — só troca o nome, mantém o id e todo o histórico já lançado nela.
    const oldSaude = existingCategories.find((c) => c.name.trim().toLowerCase() === "saúde");
    if (oldSaude) {
      await db.update(categories).set({ name: "Saúde e Beleza" }).where(eq(categories.id, oldSaude.id));
      oldSaude.name = "Saúde e Beleza"; // mantém a lista em memória coerente pro loop abaixo, evitando criar duplicata
    }

    for (const cat of essential) {
      const exists = existingCategories.find((c) => c.name.trim().toLowerCase() === cat.name.trim().toLowerCase());
      if (!exists) { await db.insert(categories).values({ userId: userId, name: cat.name, type: cat.type as "income" | "expense", kind: inferKindFromName(cat.name) }); }
    }

    // 🔥 NOVO: unifica "Compras Variadas" dentro de "Despesas Variadas" (eram
    // duas categorias genéricas fazendo a mesma coisa) — move os lançamentos e
    // regras de categorização já existentes pra "Despesas Variadas" antes de
    // apagar a duplicada, pra não perder nada do histórico.
    const afterSync = await db.select().from(categories).where(eq(categories.userId, userId));
    const comprasVariadas = afterSync.find((c) => c.name.trim().toLowerCase() === "compras variadas");
    const despesasVariadas = afterSync.find((c) => c.name.trim().toLowerCase() === "despesas variadas");
    if (comprasVariadas && despesasVariadas) {
      await db.update(transactions).set({ categoryId: despesasVariadas.id }).where(eq(transactions.categoryId, comprasVariadas.id));
      await db.update(categoryRules).set({ categoryId: despesasVariadas.id }).where(eq(categoryRules.categoryId, comprasVariadas.id));
      await db.delete(categories).where(eq(categories.id, comprasVariadas.id));
    }
  } catch (error) { console.error("Erro ao sincronizar categorias:", error); }
}

// --- GERENCIAR CATEGORIAS (tela "Minhas Categorias") ---
export async function getUserCategories() {
  const userId = await getUser();
  if (!userId) return [];
  await syncEssentialCategories(userId);
  return db.select().from(categories).where(eq(categories.userId, userId));
}

export async function createCategory(name: string, type: "income" | "expense", kind?: CategoryKind) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!name?.trim()) return { success: false, message: "Dê um nome pra categoria." };

    const existing = await db.select().from(categories).where(eq(categories.userId, userId));
    if (existing.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      return { success: false, message: "Já existe uma categoria com esse nome." };
    }

    await db.insert(categories).values({ userId, name: name.trim(), type, kind: kind ?? inferKindFromName(name) });
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false, message: "Erro ao criar categoria." }; }
}

// Muda o tipo contábil da categoria (investimento, reembolso, pagamento de fatura...).
// Afeta como os lançamentos dela entram em Despesas/Receita e na previsão.
export async function setCategoryKind(id: string, kind: CategoryKind) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!["operational", "investment", "refund", "card_payment"].includes(kind)) return { success: false, message: "Tipo inválido." };
    await db.update(categories).set({ kind }).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false, message: "Erro ao salvar o tipo." }; }
}

export async function renameCategory(id: string, name: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!name?.trim()) return { success: false, message: "Dê um nome pra categoria." };

    await db.update(categories).set({ name: name.trim() }).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false, message: "Erro ao renomear categoria." }; }
}

// Excluir só é permitido se ninguém estiver usando a categoria — senão o
// lançamento antigo ficaria "órfão" (categoryId apontando pra nada).
export async function deleteCategory(id: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const inUse = await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.categoryId, id)));
    if (inUse.length > 0) {
      return { success: false, message: `Essa categoria tem ${inUse.length} lançamento(s) vinculado(s). Troque a categoria deles antes de excluir.` };
    }

    // Regras de categorização automática que apontam pra essa categoria não
    // têm mais serventia sem ela — remove junto.
    await db.delete(categoryRules).where(and(eq(categoryRules.userId, userId), eq(categoryRules.categoryId, id)));
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false, message: "Erro ao excluir categoria." }; }
}

// --- RELATÓRIOS AVANÇADOS ---
export async function getReportData(startMonth: string, endMonth: string, filterType: string = 'all') {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    // 🔥 CORRIGIDO: as datas eram montadas com `new Date(...).toISOString()`,
    // que depende do fuso horário do servidor. Rodando em America/Sao_Paulo
    // (UTC-3), "23:59:59 do último dia" virava UTC do dia SEGUINTE, então o
    // relatório incluía por engano transações do primeiro dia do mês seguinte.
    // Agora montamos as strings de data diretamente, igual ao getDashboardData.
    const [startY, startM] = startMonth.split('-').map(Number);
    const [endY, endM] = endMonth.split('-').map(Number);

    const startDateStr = `${startY}-${String(startM).padStart(2, '0')}-01`;
    const lastDayOfEndMonth = new Date(endY, endM, 0).getDate();
    const endDateStr = `${endY}-${String(endM).padStart(2, '0')}-${String(lastDayOfEndMonth).padStart(2, '0')}`;

    const filters = [
      eq(transactions.userId, userId),
      gte(transactions.date, startDateStr),
      lte(transactions.date, endDateStr),
    ];
    if (filterType === 'pf' || filterType === 'pj') { filters.push(eq(transactions.entityType, filterType)); }
    else if (filterType !== 'all') { filters.push(eq(transactions.ownerId, filterType)); }

    const periodTransactions = await db.select().from(transactions).where(and(...filters)).orderBy(desc(transactions.date));
    const income = periodTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const expense = periodTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const balance = income - expense;

    // Nº de meses contado pelo calendário (antes era estimado por dias/30,
    // impreciso em meses com 28, 29 ou 31 dias).
    const monthsCount = Math.max(1, (endY - startY) * 12 + (endM - startM) + 1);

    return { success: true, data: { income, expense, balance, monthsCount, avgIncome: income / monthsCount, avgExpense: expense / monthsCount, transactions: periodTransactions } };
  } catch (error) { return { success: false, message: "Erro ao gerar dados." }; }
}

// --- IA ANALYTICS PARA PERÍODO ---
export async function generateRangeReport(startMonth: string, endMonth: string, filterType: string = 'all') {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Não autorizado." };
    const isPro = await resolveIsPro(userId);

    if (!isPro) { return { success: true, message: "LOCKED_CONTENT", stats: null, isPro: false }; }

    const result = await getReportData(startMonth, endMonth, filterType);
    if (!result.success || !result.data) return { success: false, message: "Erro ao buscar dados." };

    const { income, expense, balance, avgExpense, monthsCount } = result.data;
    const contextMap: any = { 'all': 'Geral', 'pf': 'Pessoa Física', 'pj': 'Pessoa Jurídica' };
    const summaryText = `Análise (${monthsCount} meses) - ${contextMap[filterType] || 'Geral'}. De ${startMonth} até ${endMonth}. Receita: R$${income.toFixed(2)}, Despesa: R$${expense.toFixed(2)}, Saldo: R$${balance.toFixed(2)}, Média Mensal: R$${avgExpense.toFixed(2)}. Seja direto. Máximo 150 palavras.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Você é um Consultor Financeiro." }, { role: "user", content: summaryText }], temperature: 0.7 })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Erro da OpenAI em generateRangeReport:", data.error || response.statusText);
      return { success: false, message: "Erro na IA." };
    }

    return { success: true, message: data.choices[0].message.content, stats: result.data, isPro: true };
  } catch (error: any) {
    console.error("Erro em generateRangeReport:", error.message);
    return { success: false, message: "Erro na IA." };
  }
}

// --- 1. IA PROCESSA E DEVOLVE ---
export async function processCSVWithAI(batch: { date: string, amount: number, description: string }[]) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
    const categoriesList = userCategories.filter(c => c.name.trim().toLowerCase() !== 'ajuste de saldo').map(c => `{ id: '${c.id}', name: '${c.name}' }`).join(', ');

    // 🔥 NOVO: busca o que o usuário já categorizou/corrigiu antes, pra usar
    // como fonte mais confiável do que um chute novo da IA.
    const userRules = await db.select().from(categoryRules).where(eq(categoryRules.userId, userId));

    const promptText = `Categorize as seguintes transações. Categorias: ${categoriesList}\nREGRAS: Mantenha date, amount, description originais. Adicione 'type' ('income' p/ positivo, 'expense' p/ negativo) e 'categoryId'. Devolva SÓ o JSON.\nTransações: ${JSON.stringify(batch)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Responda APENAS com um Array JSON." }, { role: "user", content: promptText }], temperature: 0.1 })
    });

    if (!response.ok) throw new Error("Falha na API");
    const data = await response.json();
    
    let enrichedTransactions = [];
    try {
        let content = data.choices[0].message.content;
        enrichedTransactions = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) { return { success: false }; }

    const processedBatch = [];

    for (let i = 0; i < batch.length; i++) {
      const originalTx = batch[i];
      const aiTx = enrichedTransactions[i] || {};
      const dateToUse = aiTx.date || originalTx.date || "";
      let formattedDate = new Date().toISOString().split('T')[0];
      if (dateToUse.includes('/')) {
         const [day, month, year] = dateToUse.split('/');
         formattedDate = `${year}-${month}-${day}`;
      } else if (dateToUse.includes('-')) { formattedDate = dateToUse; }

      const amountValue = Math.abs(Number(aiTx.amount !== undefined ? aiTx.amount : originalTx.amount)).toFixed(2);
      const isIncome = Number(aiTx.amount !== undefined ? aiTx.amount : originalTx.amount) >= 0;

      // 🔥 NOVO: se o histórico do usuário já tem uma regra pra uma descrição
      // parecida, ela vence o chute da IA (mais confiável, veio de uma escolha real sua).
      const learnedCategoryId = findMatchingRuleCategoryId(originalTx.description, userRules);

      processedBatch.push({
        description: String(aiTx.description || originalTx.description || "Importado").substring(0, 100),
        amount: amountValue,
        categoryId: learnedCategoryId || aiTx.categoryId || null,
        type: aiTx.type || (isIncome ? 'income' : 'expense'),
        date: formattedDate, 
        isFixed: false, 
        isPaid: true, 
        entityType: "pf",
        aiTags: ["importado_csv"],
      });
    }
    
    return { success: true, data: processedBatch };
  } catch (error) { return { success: false }; }
}

// --- 2. SALVAR LOTE REVISADO ---
// Para cada linha de um extrato em revisão, procura entre os lançamentos JÁ SALVOS
// a "outra ponta" da mesma movimentação (tipo oposto, mesmo valor, até 3 dias,
// e que pareça transferência). Serve para o app perguntar: "isso é a mesma
// movimentação entre suas contas?". Só lê; nada é alterado aqui.
export async function findTransferMatches(rows: { date: string; amount: string | number; type: string; description: string }[]) {
  try {
    const userId = await getUser();
    if (!userId || !Array.isArray(rows) || rows.length === 0) return {};
    const dates = rows.map((r) => r.date).filter(Boolean).sort();
    if (dates.length === 0) return {};
    const lo = new Date(new Date(dates[0] + "T00:00:00Z").getTime() - 3 * 86400000).toISOString().slice(0, 10);
    const hi = new Date(new Date(dates[dates.length - 1] + "T00:00:00Z").getTime() + 3 * 86400000).toISOString().slice(0, 10);

    const [cats, existing] = await Promise.all([
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.date, lo), lte(transactions.date, hi))),
    ]);
    const kinds = buildKindSets(cats);
    // Já tratadas como neutras (reembolso/empréstimo, pagamento de fatura, investimento) não precisam de pergunta.
    const open = existing.filter((t) => !(t.categoryId && (kinds.refund.has(t.categoryId) || kinds.card_payment.has(t.categoryId) || kinds.investment.has(t.categoryId))));

    const out: Record<number, { id: string; description: string; date: string; amount: string; type: string; ownerId: string | null }> = {};
    rows.forEach((r, i) => {
      const m = bestExistingMatch(r, open);
      if (m && daysApart(m.date, r.date) <= 3) out[i] = { id: m.id, description: m.description, date: m.date, amount: m.amount, type: m.type, ownerId: m.ownerId };
    });
    return out;
  } catch (error) {
    console.error("Erro ao procurar a outra ponta das transferências:", error);
    return {};
  }
}

// id da primeira categoria do tipo "pagamento de fatura" (ou null).
function buildKindSetsFirst(cats: { id: string; name: string; kind: string | null }[]): string | null {
    const sets = buildKindSets(cats);
    return Array.from(sets.card_payment)[0] ?? null;
}

export async function saveBulkTransactions(transactionsList: any[]) {
    try {
        const userId = await getUser();
        if (!userId) return { success: false, message: "Login necessário." };

        // Linhas do extrato que são pagamento de fatura de cartão e foram vinculadas
        // a uma fatura na revisão: a linha é salva como "pagamento de fatura" (fora
        // de Despesas e do Saldo, porque as compras já contam) e a fatura recebe baixa
        // na data real do pagamento.
        const anyInvoiceLink = transactionsList.some((t) => t.linkedInvoice);
        // A outra ponta de uma movimentação entre contas já estava salva (de outro
        // extrato): ao confirmar, ela passa a ser "Reembolsos / Empréstimos" também.
        const anyPaired = transactionsList.some((t) => t.pairedExistingId);
        const refundCategoryId = anyPaired
            ? (Array.from(buildKindSets(await db.select().from(categories).where(eq(categories.userId, userId))).refund)[0] ?? null)
            : null;
        const cardPaymentCategoryId = anyInvoiceLink
            ? buildKindSetsFirst(await db.select().from(categories).where(eq(categories.userId, userId)))
            : null;
        let settledInvoices = 0;

        for (const tx of transactionsList) {
            const ownership = await resolveOwnership(userId, { ownerId: tx.ownerId, entityType: tx.entityType });
            if (tx.pairedExistingId && refundCategoryId) {
                await db.update(transactions).set({ categoryId: refundCategoryId })
                    .where(and(eq(transactions.id, tx.pairedExistingId), eq(transactions.userId, userId)));
            }
            const linked = typeof tx.linkedInvoice === "string" ? tx.linkedInvoice.split("|") : null;
            const categoryForRow = linked && cardPaymentCategoryId ? cardPaymentCategoryId : tx.categoryId;
            // 🔥 NOVO: se na revisão o usuário vinculou esse item importado a uma
            // ocorrência de conta fixa pendente, dá baixa nela (usando o valor
            // real importado, o que já calcula juros/desconto automaticamente)
            // em vez de criar um lançamento novo — evita duplicar a despesa.
            if (tx.linkedFixedBillTxId) {
                const existing = (await db.select().from(transactions).where(
                    and(eq(transactions.id, tx.linkedFixedBillTxId), eq(transactions.userId, userId))
                ))[0];
                if (existing) {
                    await db.update(transactions).set({
                        amount: tx.amount,
                        isPaid: true,
                        paidAt: tx.date,
                    }).where(eq(transactions.id, tx.linkedFixedBillTxId));
                    continue;
                }
            }

            await db.insert(transactions).values({
                userId: userId,
                description: tx.description,
                amount: tx.amount,
                categoryId: categoryForRow,
                type: tx.type,
                date: tx.date,
                isFixed: tx.isFixed,
                isPaid: tx.isPaid,
                entityType: ownership.entityType,
                ownerId: ownership.ownerId,
                accountId: tx.accountId || null,
                aiTags: tx.aiTags
            });

            if (linked && linked.length === 2) {
                const res = await settleInvoice(userId, linked[0], linked[1], tx.date);
                if (res.success) settledInvoices += 1;
            }

            // 🔥 NOVO: essa é a categoria que o usuário efetivamente CONFIRMOU na
            // tela de revisão (já pode ter corrigido o chute da IA) — o melhor
            // momento para aprender de verdade.
            if (categoryForRow) {
                await learnCategoryRule(userId, tx.description, categoryForRow);
            }
        }
        revalidatePath("/");
        return { success: true, settledInvoices };
    } catch (error) {
        console.error("Erro no saveBulk:", error);
        return { success: false };
    }
}

// --- IMPORTAÇÃO DE FATURA DE CARTÃO (CSV / OFX / PDF) ---
// 🔥 NOVO: pra registrar as compras do cartão item a item sem digitar uma
// por uma. A convenção de sinal é o OPOSTO do extrato bancário: numa
// fatura, positivo = compra normal (despesa) e negativo = estorno ou
// pagamento recebido (não conta como receita de verdade, só reduz a
// fatura — por isso "income" aqui é só pra não quebrar a soma, mas essas
// linhas não entram em "Receita Operacional" por não terem uma categoria
// de receita real). Todo item nasce vinculado ao cartão escolhido e com
// isPaid=false, igual já acontece com compra avulsa no cartão — quem dá
// baixa é a fatura inteira, na tela de Cartões.
export async function processCardInvoiceWithAI(batch: { date: string; amount: number; description: string }[]) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
    const categoriesList = userCategories.filter(c => c.name.trim().toLowerCase() !== 'ajuste de saldo').map(c => `{ id: '${c.id}', name: '${c.name}' }`).join(', ');
    const userRules = await db.select().from(categoryRules).where(eq(categoryRules.userId, userId));

    const promptText = `Categorize os itens da fatura de um cartão de crédito abaixo. Categorias disponíveis: ${categoriesList}\nREGRAS: Mantenha date, amount, description originais. Adicione 'type' ('expense' p/ valores positivos — compra normal — e 'income' p/ valores negativos — estorno ou pagamento) e 'categoryId'. Devolva SÓ o JSON (array).\nItens: ${JSON.stringify(batch)}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Responda APENAS com um Array JSON." }, { role: "user", content: promptText }], temperature: 0.1 })
    });

    if (!response.ok) throw new Error("Falha na API");
    const data = await response.json();

    let enrichedTransactions = [];
    try {
      const content = data.choices[0].message.content;
      enrichedTransactions = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) { console.error("Erro ao interpretar resposta da IA (fatura):", e); return { success: false }; }

    const processedBatch = [];
    for (let i = 0; i < batch.length; i++) {
      const originalTx = batch[i];
      const aiTx: any = enrichedTransactions[i] || {};
      const dateToUse = aiTx.date || originalTx.date || "";
      let formattedDate = new Date().toISOString().split('T')[0];
      if (dateToUse.includes('/')) {
        const [day, month, year] = dateToUse.split('/');
        formattedDate = `${year}-${month}-${day}`;
      } else if (dateToUse.includes('-')) { formattedDate = dateToUse; }

      const rawAmount = Number(aiTx.amount !== undefined ? aiTx.amount : originalTx.amount);
      const amountValue = Math.abs(rawAmount).toFixed(2);
      // 🔥 Sinal invertido em relação ao extrato bancário: positivo = despesa.
      const isExpense = rawAmount >= 0;

      const learnedCategoryId = findMatchingRuleCategoryId(originalTx.description, userRules);

      processedBatch.push({
        description: String(aiTx.description || originalTx.description || "Item da fatura").substring(0, 100),
        amount: amountValue,
        categoryId: learnedCategoryId || aiTx.categoryId || null,
        type: aiTx.type || (isExpense ? 'expense' : 'income'),
        date: formattedDate,
        isFixed: false,
        isPaid: false,
        entityType: "pf",
        aiTags: ["importado_fatura_cartao"],
      });
    }

    return { success: true, data: processedBatch };
  } catch (error) {
    console.error("Erro em processCardInvoiceWithAI:", error);
    return { success: false };
  }
}

export async function saveBulkCardInvoiceTransactions(transactionsList: any[], creditCardId: string, dueMonth?: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!creditCardId) return { success: false, message: "Selecione o cartão." };

    // Dono padrão das compras = dono do cartão (a fatura do cartão da Adri é da Adri).
    const card = (await db.select().from(creditCards).where(and(eq(creditCards.id, creditCardId), eq(creditCards.userId, userId))))[0];

    // Fatura que o arquivo importado representa (mês de vencimento escolhido na
    // tela). Fica gravada em cada item, então a compra internacional lançada
    // dias depois, por exemplo, não cai na fatura vizinha por causa da data.
    const invoiceCycleKey = card && dueMonth && /^\d{4}-\d{2}$/.test(dueMonth)
      ? cycleKeyForDueMonth(dueMonth, card.closingDay, card.dueDay)
      : null;

    // Importar a mesma fatura de novo (ou depois de ter importado só uma parte)
    // não duplica: itens que o cartão já tem (mesma data, valor e descrição)
    // são ignorados, contando repetições legítimas. Itens ligados a conta fixa
    // não passam por aqui: eles só dão baixa, não criam lançamento.
    const candidates = transactionsList.filter((t) => !t.linkedFixedBillTxId && t.date);
    let skippedDuplicates = 0;
    let toImport = transactionsList;
    if (candidates.length > 0) {
      const dates = candidates.map((t) => t.date).sort();
      const existingItems = await db.select().from(transactions).where(
        and(eq(transactions.userId, userId), eq(transactions.creditCardId, creditCardId), gte(transactions.date, dates[0]), lte(transactions.date, dates[dates.length - 1]))
      );
      const { skipped } = dedupeAgainstExisting(existingItems, candidates);
      if (skipped.length > 0) {
        const skipSet = new Set(skipped);
        skippedDuplicates = skipped.length;
        toImport = transactionsList.filter((t) => !skipSet.has(t));
      }
    }

    for (const tx of toImport) {
      const ownership = await resolveOwnership(userId, { ownerId: tx.ownerId || card?.ownerId, entityType: tx.entityType });
      // 🔥 NOVO: mesmo tratamento do extrato bancário — se o item foi
      // vinculado a uma conta fixa pendente, dá baixa nela em vez de criar
      // um lançamento novo (evita duplicar).
      if (tx.linkedFixedBillTxId) {
        const existing = (await db.select().from(transactions).where(
          and(eq(transactions.id, tx.linkedFixedBillTxId), eq(transactions.userId, userId))
        ))[0];
        if (existing) {
          await db.update(transactions).set({
            amount: tx.amount,
            isPaid: true,
            paidAt: tx.date,
          }).where(eq(transactions.id, tx.linkedFixedBillTxId));
          continue;
        }
      }

      await db.insert(transactions).values({
        userId: userId,
        description: tx.description,
        amount: tx.amount,
        categoryId: tx.categoryId || null,
        type: tx.type,
        date: tx.date,
        isFixed: false,
        isPaid: false,
        entityType: ownership.entityType,
        ownerId: ownership.ownerId,
        creditCardId: creditCardId,
        aiTags: invoiceCycleKey ? withInvoiceTag(tx.aiTags, invoiceCycleKey) : tx.aiTags,
      });

      if (tx.categoryId) {
        await learnCategoryRule(userId, tx.description, tx.categoryId);
      }
    }
    revalidatePath("/");
    return { success: true, skippedDuplicates, imported: toImport.length };
  } catch (error) {
    console.error("Erro no saveBulkCardInvoiceTransactions:", error);
    return { success: false };
  }
}

// --- PDF DA FATURA ---
// O layout de PDF de fatura varia demais de banco pra banco pra usar um
// parser de posição fixa — em vez disso, extrai o texto do PDF e pede pra
// IA estruturar em {date, amount, description}[], que depois passa pelo
// MESMO processCardInvoiceWithAI usado pro CSV/OFX (um pipeline só pros 3 formatos).
export async function parsePdfInvoiceText(base64: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    let pdfParse: any;
    try {
      // 🔥 Import dinâmico: só quebra em runtime se o usuário tentar importar
      // um PDF sem ter rodado "npm install" depois do pdf-parse entrar no
      // package.json — CSV e OFX continuam funcionando normalmente.
      pdfParse = (await import("pdf-parse")).default;
    } catch {
      return { success: false, message: "Faltou instalar uma dependência pra ler PDF. Rode 'npm install' na pasta do projeto e tente de novo." };
    }

    const buffer = Buffer.from(base64, "base64");
    const parsed = await pdfParse(buffer);
    const rawText = (parsed.text || "").substring(0, 12000); // limite de segurança pro prompt

    if (!rawText.trim()) return { success: false, message: "Não consegui ler texto desse PDF (pode ser uma fatura escaneada como imagem)." };

    const promptText = `Extraia os itens de compra de uma fatura de cartão de crédito a partir do texto abaixo (extraído de um PDF, pode ter ruído de layout). Devolva SÓ um Array JSON, cada item com: date (formato YYYY-MM-DD, deduza o ano pelo contexto da fatura se não estiver explícito no item), amount (número positivo pra compra normal, negativo pra estorno/pagamento), description. Ignore linhas de resumo, total da fatura, limite disponível, cabeçalho/rodapé.\n\nTexto da fatura:\n${rawText}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Responda APENAS com um Array JSON." }, { role: "user", content: promptText }], temperature: 0.1 })
    });

    if (!response.ok) return { success: false, message: "Falha ao consultar a IA." };
    const data = await response.json();

    let items: any[] = [];
    try {
      const content = data.choices[0].message.content;
      items = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      console.error("Erro ao interpretar itens extraídos do PDF:", e);
      return { success: false, message: "Não consegui interpretar os itens dessa fatura." };
    }

    const rows = items
      .filter((it) => it && it.date && it.amount !== undefined && it.description)
      .map((it) => ({ date: String(it.date), amount: Number(it.amount), description: String(it.description).substring(0, 200) }))
      .filter((it) => !Number.isNaN(it.amount));

    return { success: true, data: rows };
  } catch (error) {
    console.error("Erro em parsePdfInvoiceText:", error);
    return { success: false, message: "Erro ao processar o PDF." };
  }
}
