'use server'

import { db } from "@/db";
import { categories, transactions, userSettings } from "@/db/schema";
import { desc, and, sql, eq, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

// --- LISTA VIP (BLOQUEIO SAAS ATIVADO) ---
const VIP_USERS = [
  "user_39lFK9Lr5j7Y5lg1e4ZPwb6ZTx8", // Paulo e Gestão Kore (Antigo)
  "user_39obnDo2iFblIK7qxNyKkL0H8Hn", // Adrielle
  "user_39ocZfmiOfwA0Q3mXpJ158M3Nkw"  // 🔥 SEU ID NOVO
];

// --- FUNÇÃO AUXILIAR ASSÍNCRONA ---
async function getUser() {
  const session = await auth();
  if (!session || !session.userId) {
    return null;
  }
  return session.userId;
}

// --- BUSCAR DADOS DA DASHBOARD ---
export async function getDashboardData(month: number, year: number) {
  try {
    const userId = await getUser();
    
    if (!userId) {
      console.log("⚠️ Dashboard: Sem usuário logado.");
      return { 
        allCategories: [], fixedExpenses: [], variableTransactions: [], transactions: [], 
        summary: { balance: 0, globalBalance: 0, income: 0, expense: 0 }, categoryStats: [], pieData: [], dailyData: [],
        planType: 'free'
      };
    }

    await syncEssentialCategories(userId);

    // --- LÓGICA DE PRODUÇÃO (SAAS MODE) ---
    const isVip = VIP_USERS.includes(userId);
    const userConfig = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    const rawPlan = userConfig[0]?.planType || (userConfig[0] as any)?.plan_type || 'free';
    const isDbPro = String(rawPlan).toLowerCase() === 'pro';
    const planType = (isVip || isDbPro) ? 'pro' : 'free';
    // --------------------------------------

    const allCategories = await db.select().from(categories).where(eq(categories.userId, userId));
    
    const currentTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`EXTRACT(MONTH FROM ${transactions.date}) = ${month}`,
          sql`EXTRACT(YEAR FROM ${transactions.date}) = ${year}`
        )
      )
      .orderBy(desc(transactions.date));

    // 🔥 LÓGICA DO SALDO GLOBAL (COM TRAVA DE TEMPO) 🔥
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const cutoffDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const allTx = await db
        .select({ type: transactions.type, amount: transactions.amount })
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, userId),
                lte(transactions.date, cutoffDateStr)
            )
        );

    const globalIncome = allTx.filter(t => t.type === 'income').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const globalExpense = allTx.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const globalBalance = globalIncome - globalExpense;

    const fixedExpenses = currentTransactions.filter(t => t.isFixed === true && t.type === 'expense');
    const variableTransactions = currentTransactions.filter(t => t.isFixed === false || t.type === 'income');

    const income = currentTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const expense = currentTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const balance = income - expense;

    const categoryStats = allCategories.map(cat => {
      const spent = currentTransactions
        .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
      
      return {
        id: cat.id,
        name: cat.name,
        value: spent,
        budget: Number(cat.budget || 0),
        color: '#3b82f6'
      };
    })
    .filter(i => i.value > 0 || i.budget > 0)
    .sort((a, b) => b.value - a.value);

    const dailyData = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayTxs = currentTransactions.filter(t => t.date === dayStr);
      
      const dayInc = dayTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
      const dayExp = dayTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
      
      if(dayInc > 0 || dayExp > 0) {
        dailyData.push({ day: i, entrada: dayInc, saida: dayExp });
      }
    }

    return { 
      allCategories, 
      fixedExpenses, 
      variableTransactions, 
      transactions: currentTransactions, 
      summary: { balance, income, expense, globalBalance },
      categoryStats, 
      pieData: categoryStats, 
      dailyData,
      planType: planType 
    };

  } catch (error) {
    console.error("Erro crítico no dashboard:", error);
    return { 
        allCategories: [], fixedExpenses: [], variableTransactions: [], transactions: [], 
        summary: { balance: 0, globalBalance: 0, income: 0, expense: 0 }, categoryStats: [], pieData: [], dailyData: [], 
        planType: 'free' 
    };
  }
}

// --- CFO VIRTUAL ---
export async function generateMonthlyReport(month: number, year: number) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Não autorizado." };

    const isVip = VIP_USERS.includes(userId);
    let isPro = isVip;
    
    if (!isPro) {
        const userConfig = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
        const dbPlanRaw = userConfig[0]?.planType || (userConfig[0] as any)?.plan_type || 'free';
        isPro = String(dbPlanRaw).toLowerCase() === 'pro';
    }

    if (!isPro) {
      return { success: false, message: "⚠️ RECURSO PREMIUM: A análise inteligente do CFO Virtual está disponível apenas para assinantes PRO." };
    }

    const reportData = await getDashboardData(month, year);
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
    return { success: true, message: data.choices[0].message.content };
  } catch (error: any) {
    return { success: false, message: "O serviço de análise executiva está indisponível momentaneamente." };
  }
}

// --- CRIAR TRANSAÇÃO ---
export async function createTransaction(data: any) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, error: "Faça login para salvar." };

    const installments = data.installments ? Number(data.installments) : 1;
    const amountPerInstallment = (Number(data.amount) / installments).toFixed(2);

    let baseDate: string = data.date;
    if (!baseDate) {
      const now = new Date();
      const brDateParts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const day = brDateParts.find(p => p.type === 'day')?.value;
      const month = brDateParts.find(p => p.type === 'month')?.value;
      const year = brDateParts.find(p => p.type === 'year')?.value;
      baseDate = `${year}-${month}-${day}`;
    }

    for (let i = 0; i < installments; i++) {
      const [y, m, d] = baseDate.split('-').map(Number);
      let nextMonth = m + i;
      let nextYear = y;
      
      while (nextMonth > 12) { nextMonth -= 12; nextYear += 1; }

      const finalDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const description = installments > 1 ? `${data.description} (${i + 1}/${installments})` : data.description;

      await db.insert(transactions).values({
        userId: userId,
        description: description,
        amount: Math.abs(Number(installments > 1 ? amountPerInstallment : data.amount)).toString(),
        categoryId: data.categoryId || null,
        type: data.type,
        date: finalDateStr, 
        isFixed: data.isFixed || false,
        isPaid: (installments > 1 && i > 0) ? false : (data.isPaid ?? true),
        entityType: data.entityType || "pf",
        aiTags: [],
      });
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false, error: "Erro ao salvar no banco." }; }
}

// --- ATUALIZAR STATUS ---
export async function toggleTransactionStatus(id: string, currentStatus: boolean) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    await db.update(transactions).set({ isPaid: !currentStatus }).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- VIRAR O MÊS ---
export async function copyFixedExpenses(currentMonth: number, currentYear: number) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const fixedExpenses = await db.select().from(transactions).where(
        and(eq(transactions.userId, userId), eq(transactions.isFixed, true), eq(transactions.type, 'expense'), sql`EXTRACT(MONTH FROM ${transactions.date}) = ${currentMonth}`, sql`EXTRACT(YEAR FROM ${transactions.date}) = ${currentYear}`)
      );

    if (fixedExpenses.length === 0) return { success: false, message: "Nenhuma conta fixa." };

    let count = 0;
    for (const expense of fixedExpenses) {
      const [y, m, d] = expense.date.split('-').map(Number);
      let nextMonth = m + 1;
      let nextYear = y;
      if (nextMonth > 12) { nextMonth = 1; nextYear = y + 1; }

      const nextDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const existing = await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.description, expense.description), eq(transactions.date, nextDateStr), eq(transactions.amount, expense.amount)));

      if (existing.length === 0) {
        await db.insert(transactions).values({
          userId: userId, description: expense.description, amount: Math.abs(Number(expense.amount)).toString(), categoryId: expense.categoryId, type: expense.type, date: nextDateStr, isFixed: true, isPaid: false, entityType: expense.entityType, aiTags: expense.aiTags
        });
        count++;
      }
    }
    revalidatePath("/");
    return { success: true, message: `${count} contas copiadas!` };
  } catch (error) { return { success: false, message: "Erro ao processar." }; }
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

// --- EDITAR ---
export async function updateTransaction(id: string, data: any) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    await db.update(transactions).set({
        description: data.description, amount: Math.abs(Number(data.amount)).toString(), date: data.date, categoryId: data.categoryId, type: data.type, isFixed: data.isFixed, entityType: data.entityType,
      }).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- SINCRONIZAR CATEGORIAS ---
async function syncEssentialCategories(userId: string) {
  try {
    const essential = [
      { name: "Viagens", type: "expense" }, { name: "Assinaturas & Apps", type: "expense" }, { name: "Mercado", type: "expense" },
      { name: "Refeição Livre / Lazer", type: "expense" }, { name: "Suplementos", type: "expense" }, { name: "Vestuário / Academia", type: "expense" },
      { name: "Financiamentos", type: "expense" }, { name: "Reembolsos / Empréstimos", type: "expense" }, { name: "Transporte", type: "expense" },
      { name: "Saúde", type: "expense" }, { name: "Compras Variadas", type: "expense" }, { name: "Despesas Variadas", type: "expense" },
      { name: "Impostos e Taxas", type: "expense" }, { name: "Cartão de Crédito", type: "expense" }, { name: "Salário", type: "income" },
      { name: "Investimentos", type: "income" }, { name: "Consultoria", type: "income" }
    ];

    const existingCategories = await db.select().from(categories).where(eq(categories.userId, userId));
    for (const cat of essential) {
      const exists = existingCategories.find((c) => c.name.trim().toLowerCase() === cat.name.trim().toLowerCase());
      if (!exists) { await db.insert(categories).values({ userId: userId, name: cat.name, type: cat.type as "income" | "expense" }); }
    }
  } catch (error) { console.error("Erro ao sincronizar categorias:", error); }
}

// --- RELATÓRIOS AVANÇADOS ---
export async function getReportData(startMonth: string, endMonth: string, filterType: string = 'all') {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    const startDate = new Date(`${startMonth}-01T00:00:00`);
    const [endY, endM] = endMonth.split('-').map(Number);
    const endDate = new Date(endY, endM, 0, 23, 59, 59);

    const filters = [ eq(transactions.userId, userId), sql`${transactions.date} >= ${startDate.toISOString().split('T')[0]}`, sql`${transactions.date} <= ${endDate.toISOString().split('T')[0]}` ];
    if (filterType !== 'all') { filters.push(eq(transactions.entityType, filterType as 'pf' | 'pj')); }

    const periodTransactions = await db.select().from(transactions).where(and(...filters)).orderBy(desc(transactions.date));
    const income = periodTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const expense = periodTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(Number(t.amount)), 0);
    const balance = income - expense;

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const monthsCount = Math.max(1, Math.round(diffDays / 30));

    return { success: true, data: { income, expense, balance, monthsCount, avgIncome: income / monthsCount, avgExpense: expense / monthsCount, transactions: periodTransactions } };
  } catch (error) { return { success: false, message: "Erro ao gerar dados." }; }
}

// --- IA ANALYTICS PARA PERÍODO ---
export async function generateRangeReport(startMonth: string, endMonth: string, filterType: string = 'all') {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Não autorizado." };
    const isVip = VIP_USERS.includes(userId);
    let isPro = isVip;
    
    if (!isPro) {
        const userConfig = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
        isPro = String(userConfig[0]?.planType || (userConfig[0] as any)?.plan_type || 'free').toLowerCase() === 'pro';
    }

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
    return { success: true, message: data.choices[0].message.content, stats: result.data, isPro: true };
  } catch (error: any) { return { success: false, message: "Erro na IA." }; }
}

// --- 1. IA PROCESSA E DEVOLVE ---
export async function processCSVWithAI(batch: { date: string, amount: number, description: string }[]) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
    const categoriesList = userCategories.map(c => `{ id: '${c.id}', name: '${c.name}' }`).join(', ');

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

      processedBatch.push({
        description: String(aiTx.description || originalTx.description || "Importado").substring(0, 100),
        amount: amountValue, 
        categoryId: aiTx.categoryId || null, 
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
export async function saveBulkTransactions(transactionsList: any[]) {
    try {
        const userId = await getUser();
        if (!userId) return { success: false, message: "Login necessário." };

        for (const tx of transactionsList) {
            await db.insert(transactions).values({
                userId: userId,
                description: tx.description,
                amount: tx.amount,
                categoryId: tx.categoryId,
                type: tx.type,
                date: tx.date,
                isFixed: tx.isFixed,
                isPaid: tx.isPaid,
                entityType: tx.entityType,
                aiTags: tx.aiTags
            });
        }
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Erro no saveBulk:", error);
        return { success: false };
    }
}