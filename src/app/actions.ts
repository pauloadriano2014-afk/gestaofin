'use server'

import { db } from "@/db";
import { categories, transactions, userSettings } from "@/db/schema";
import { desc, and, sql, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

// --- LISTA VIP (AGORA COM O ID EXATO DO LOG - BLOQUEIO SAAS ATIVADO) ---
const VIP_USERS = [
  "user_39lFK9Lr5j7Y5lg1e4ZPwb6ZTx8", // Paulo e Gestão Kore (P maiúsculo)
  "user_39obnDo2iFblIK7qxNyKkL0H8Hn"  // Adrielle
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
        summary: { balance: 0 }, categoryStats: [], pieData: [], dailyData: [],
        planType: 'free'
      };
    }

    await syncEssentialCategories(userId);

    // --- LÓGICA DE PRODUÇÃO (SAAS MODE) ---
    // 1. É um dos fundadores na lista VIP?
    const isVip = VIP_USERS.includes(userId);
    
    // 2. Se não for VIP, ele pagou no banco de dados?
    const userConfig = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    const rawPlan = userConfig[0]?.planType || (userConfig[0] as any)?.plan_type || 'free';
    const isDbPro = String(rawPlan).toLowerCase() === 'pro';

    // 3. Define o plano final
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

    const fixedExpenses = currentTransactions.filter(t => t.isFixed === true && t.type === 'expense');
    const variableTransactions = currentTransactions.filter(t => t.isFixed === false || t.type === 'income');

    const income = currentTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = currentTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = income - expense;

    const categoryStats = allCategories.map(cat => {
      const spent = currentTransactions
        .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
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
      
      const dayInc = dayTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
      const dayExp = dayTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
      
      if(dayInc > 0 || dayExp > 0) {
        dailyData.push({ day: i, entrada: dayInc, saida: dayExp });
      }
    }

    return { 
      allCategories, 
      fixedExpenses, 
      variableTransactions, 
      transactions: currentTransactions, 
      summary: { balance, income, expense }, 
      categoryStats, 
      pieData: categoryStats, 
      dailyData,
      planType: planType 
    };

  } catch (error) {
    console.error("Erro crítico no dashboard:", error);
    return { 
        allCategories: [], fixedExpenses: [], variableTransactions: [], transactions: [], 
        summary: { balance: 0 }, categoryStats: [], pieData: [], dailyData: [], 
        planType: 'free' 
    };
  }
}

// --- CFO VIRTUAL (BLOQUEADO PARA FREE) ---
export async function generateMonthlyReport(month: number, year: number) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Não autorizado." };

    // --- VALIDAÇÃO DE ACESSO ---
    const isVip = VIP_USERS.includes(userId);
    let isPro = isVip;
    
    if (!isPro) {
        const userConfig = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
        const dbPlanRaw = userConfig[0]?.planType || (userConfig[0] as any)?.plan_type || 'free';
        isPro = String(dbPlanRaw).toLowerCase() === 'pro';
    }

    if (!isPro) {
      return { 
        success: false, 
        message: "⚠️ RECURSO PREMIUM: A análise inteligente do CFO Virtual está disponível apenas para assinantes PRO." 
      };
    }
    // ---------------------------

    const reportData = await getDashboardData(month, year);
    const txs = reportData.transactions || [];
    
    if (txs.length === 0) return { success: false, message: "Sem dados suficientes para análise." };

    const income = txs.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    const expense = txs.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    
    const topExpenses = txs
        .filter((t: any) => t.type === 'expense')
        .sort((a: any, b: any) => Number(b.amount) - Number(a.amount))
        .slice(0, 5)
        .map((t: any) => `${t.description} (R$${t.amount})`)
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
      const brDateParts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(now);
      const day = brDateParts.find(p => p.type === 'day')?.value;
      const month = brDateParts.find(p => p.type === 'month')?.value;
      const year = brDateParts.find(p => p.type === 'year')?.value;
      baseDate = `${year}-${month}-${day}`;
    }

    for (let i = 0; i < installments; i++) {
      const [y, m, d] = baseDate.split('-').map(Number);
      let nextMonth = m + i;
      let nextYear = y;
      
      while (nextMonth > 12) {
        nextMonth -= 12;
        nextYear += 1;
      }

      const finalDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const description = installments > 1 
        ? `${data.description} (${i + 1}/${installments})` 
        : data.description;

      await db.insert(transactions).values({
        userId: userId,
        description: description,
        amount: installments > 1 ? amountPerInstallment : data.amount,
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
  } catch (error) {
    console.error("Erro ao criar:", error);
    return { success: false, error: "Erro ao salvar no banco." };
  }
}

// --- ATUALIZAR STATUS ---
export async function toggleTransactionStatus(id: string, currentStatus: boolean) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    
    await db.update(transactions)
      .set({ isPaid: !currentStatus })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
      
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- VIRAR O MÊS ---
export async function copyFixedExpenses(currentMonth: number, currentYear: number) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const fixedExpenses = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.isFixed, true),
          eq(transactions.type, 'expense'),
          sql`EXTRACT(MONTH FROM ${transactions.date}) = ${currentMonth}`,
          sql`EXTRACT(YEAR FROM ${transactions.date}) = ${currentYear}`
        )
      );

    if (fixedExpenses.length === 0) return { success: false, message: "Nenhuma conta fixa." };

    let count = 0;
    for (const expense of fixedExpenses) {
      const [y, m, d] = expense.date.split('-').map(Number);
      let nextMonth = m + 1;
      let nextYear = y;
      if (nextMonth > 12) { nextMonth = 1; nextYear = y + 1; }

      const nextDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const existing = await db.select().from(transactions).where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.description, expense.description),
          eq(transactions.date, nextDateStr),
          eq(transactions.amount, expense.amount)
        )
      );

      if (existing.length === 0) {
        await db.insert(transactions).values({
          userId: userId,
          description: expense.description,
          amount: expense.amount,
          categoryId: expense.categoryId,
          type: expense.type,
          date: nextDateStr,
          isFixed: true,
          isPaid: false, 
          entityType: expense.entityType,
          aiTags: expense.aiTags
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

    await db.update(categories)
      .set({ budget: budget })
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
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

    await db.update(transactions)
      .set({
        description: data.description,
        amount: data.amount,
        date: data.date, 
        categoryId: data.categoryId,
        type: data.type,
        isFixed: data.isFixed,
        entityType: data.entityType,
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- SINCRONIZAR CATEGORIAS (COM AS NOVAS CATEGORIAS) ---
async function syncEssentialCategories(userId: string) {
  try {
    const essential = [
      { name: "Viagens", type: "expense" },
      { name: "Assinaturas & Apps", type: "expense" },
      { name: "Mercado", type: "expense" },
      { name: "Refeição Livre / Lazer", type: "expense" },
      { name: "Suplementos", type: "expense" },
      { name: "Vestuário / Academia", type: "expense" },
      { name: "Financiamentos", type: "expense" },
      { name: "Reembolsos / Empréstimos", type: "expense" },
      { name: "Transporte", type: "expense" },
      { name: "Saúde", type: "expense" },
      { name: "Compras Variadas", type: "expense" },
      { name: "Despesas Variadas", type: "expense" },
      { name: "Impostos e Taxas", type: "expense" }, // O NOME NOVO E LIMPO
      { name: "Cartão de Crédito", type: "expense" }, // O NOVO CARTÃO QUE VOCÊ PEDIU
      { name: "Salário", type: "income" },
      { name: "Investimentos", type: "income" },
      { name: "Consultoria", type: "income" }
    ];

    const existingCategories = await db.select().from(categories).where(eq(categories.userId, userId));

    for (const cat of essential) {
      const exists = existingCategories.find(
        (c) => c.name.trim().toLowerCase() === cat.name.trim().toLowerCase()
      );

      if (!exists) {
        await db.insert(categories).values({
          userId: userId,
          name: cat.name,
          type: cat.type as "income" | "expense",
        });
        console.log(`✅ Categoria ${cat.name} criada para ${userId}`);
      }
    }
  } catch (error) {
    console.error("Erro ao sincronizar categorias:", error);
  }
}

// --- RELATÓRIOS AVANÇADOS (RANGE + FILTRO) ---
export async function getReportData(startMonth: string, endMonth: string, filterType: string = 'all') {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const startDate = new Date(`${startMonth}-01T00:00:00`);
    const [endY, endM] = endMonth.split('-').map(Number);
    const endDate = new Date(endY, endM, 0, 23, 59, 59);

    const filters = [
      eq(transactions.userId, userId),
      sql`${transactions.date} >= ${startDate.toISOString().split('T')[0]}`,
      sql`${transactions.date} <= ${endDate.toISOString().split('T')[0]}`
    ];

    if (filterType !== 'all') {
      filters.push(eq(transactions.entityType, filterType as 'pf' | 'pj'));
    }

    const periodTransactions = await db
      .select()
      .from(transactions)
      .where(and(...filters))
      .orderBy(desc(transactions.date));

    const income = periodTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = periodTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = income - expense;

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const monthsCount = Math.max(1, Math.round(diffDays / 30));

    const avgExpense = expense / monthsCount;
    const avgIncome = income / monthsCount;

    return {
      success: true,
      data: {
        income,
        expense,
        balance,
        monthsCount,
        avgIncome,
        avgExpense,
        transactions: periodTransactions
      }
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: "Erro ao gerar dados do relatório." };
  }
}

// --- IA ANALYTICS PARA PERÍODO (BLOQUEADO PARA FREE) ---
export async function generateRangeReport(startMonth: string, endMonth: string, filterType: string = 'all') {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Não autorizado." };

    // --- VALIDAÇÃO DE ACESSO ---
    const isVip = VIP_USERS.includes(userId);
    let isPro = isVip;
    
    if (!isPro) {
        const userConfig = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
        const dbPlanRaw = userConfig[0]?.planType || (userConfig[0] as any)?.plan_type || 'free';
        isPro = String(dbPlanRaw).toLowerCase() === 'pro';
    }

    if (!isPro) {
      return { 
        success: true, 
        message: "LOCKED_CONTENT", 
        stats: null,
        isPro: false 
      };
    }
    // ---------------------------

    const result = await getReportData(startMonth, endMonth, filterType);
    if (!result.success || !result.data) return { success: false, message: "Erro ao buscar dados." };

    const { income, expense, balance, avgExpense, monthsCount } = result.data;
    const contextMap: any = { 'all': 'Geral (Pessoal + Empresa)', 'pf': 'Pessoa Física (Pessoal)', 'pj': 'Pessoa Jurídica (Empresa)' };
    const contextName = contextMap[filterType] || 'Geral';

    const summaryText = `
      Análise de Período (${monthsCount} meses) - Foco: ${contextName}.
      De ${startMonth} até ${endMonth}.
      - Receita Total: R$ ${income.toFixed(2)}
      - Despesa Total: R$ ${expense.toFixed(2)}
      - Saldo do Período: R$ ${balance.toFixed(2)}
      - Média de Gastos Mensal: R$ ${avgExpense.toFixed(2)}
      
      Aja como um CFO Virtual. Analise esses números para o contexto ${contextName}.
      Se o saldo for negativo, dê um alerta.
      Seja direto, use emojis e tópicos. Máximo 150 palavras.
    `;

    const API_KEY = process.env.OPENAI_API_KEY; 
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um Consultor Financeiro Pessoal experiente e direto." },
          { role: "user", content: summaryText }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    return { 
      success: true, 
      message: data.choices[0].message.content, 
      stats: result.data,
      isPro: true
    };

  } catch (error: any) {
    return { success: false, message: "Erro na IA." };
  }
}

// --- IMPORTAÇÃO INTELIGENTE DE CSV (BLINDADA CONTRA ERROS DA IA) ---
export async function processAndImportCSV(batch: { date: string, amount: number, description: string }[]) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
    const categoriesList = userCategories.map(c => `{ id: '${c.id}', name: '${c.name}' }`).join(', ');

    const API_KEY = process.env.OPENAI_API_KEY;

    // Prompt muito mais rígido para a IA não "engolir" dados
    const promptText = `
      Categorize as seguintes transações bancárias.
      Categorias disponíveis: ${categoriesList}

      REGRAS OBRIGATÓRIAS:
      1. Devolva um array JSON contendo TODOS os objetos originais.
      2. MANTENHA os campos originais de cada objeto: 'date', 'amount', e 'description'. NÃO APAGUE NADA.
      3. Adicione o campo 'type': 'income' para valores positivos, 'expense' para negativos.
      4. Adicione o campo 'categoryId': o id da categoria que melhor corresponde à descrição (Ex: Impostos vão para Impostos).
      5. Apenas retorne o JSON puro, sem crases ou marcações.

      Transações:
      ${JSON.stringify(batch)}
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um classificador financeiro estrito. Responda APENAS com um Array JSON estruturado e mantenha os dados originais." },
          { role: "user", content: promptText }
        ],
        temperature: 0.1, 
      })
    });

    if (!response.ok) throw new Error("Falha na API da OpenAI");

    const data = await response.json();
    
    let enrichedTransactions = [];
    try {
        let content = data.choices[0].message.content;
        const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
        enrichedTransactions = JSON.parse(jsonStr);
    } catch (e) {
        console.error("OpenAI não devolveu um JSON válido para este lote.");
        return { success: false }; // Pula esse lote e não trava o app
    }

    // Salva no banco de dados com FALLBACK (Garante que nunca vai quebrar por falta de campo)
    for (let i = 0; i < batch.length; i++) {
      const originalTx = batch[i]; // Os dados 100% seguros que vieram do arquivo CSV
      const aiTx = enrichedTransactions[i] || {}; // Os dados que a IA tentou adivinhar

      // PLANO B: Se a IA engoliu algum dado, pegamos o original na marra!
      const dateToUse = aiTx.date || originalTx.date || "";
      const descToUse = aiTx.description || originalTx.description || "Transação Importada";
      const amountToUse = aiTx.amount !== undefined ? aiTx.amount : originalTx.amount;

      // Formatação de data blindada
      let formattedDate = new Date().toISOString().split('T')[0];
      if (dateToUse.includes('/')) {
         const [day, month, year] = dateToUse.split('/');
         formattedDate = `${year}-${month}-${day}`;
      } else if (dateToUse.includes('-')) {
         formattedDate = dateToUse; // Caso a IA já tenha convertido para YYYY-MM-DD
      }

      const amountValue = Math.abs(Number(amountToUse)).toFixed(2);
      const isIncome = Number(amountToUse) >= 0;

      await db.insert(transactions).values({
        userId: userId,
        description: String(descToUse).substring(0, 100),
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

    revalidatePath("/");
    return { success: true };

  } catch (error) {
    console.error("Erro ao importar lote:", error);
    return { success: false };
  }
}