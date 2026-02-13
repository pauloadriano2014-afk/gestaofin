'use server'

import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { desc, and, sql, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

// --- FUNÇÃO AUXILIAR ASSÍNCRONA (CORRIGIDA PARA NEXT.JS 15+) ---
async function getUser() {
  const session = await auth(); // <--- O SEGREDO ESTÁ AQUI (AWAIT)
  
  if (!session || !session.userId) {
    return null;
  }
  return session.userId;
}

// --- BUSCAR DADOS DA DASHBOARD ---
export async function getDashboardData(month: number, year: number) {
  try {
    const userId = await getUser(); // <--- AGORA USAMOS AWAIT
    
    // Se não tiver usuário, retorna tudo vazio sem quebrar a tela
    if (!userId) {
      console.log("⚠️ Dashboard: Sem usuário logado (Aguardando auth...)");
      return { allCategories: [], fixedExpenses: [], variableTransactions: [], transactions: [], summary: { balance: 0 }, categoryStats: [], pieData: [], dailyData: [] };
    }

    // Sincroniza categorias essenciais para ESTE usuário
    await syncEssentialCategories(userId);

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

    console.log(`✅ Dados carregados com sucesso para: ${userId}`);
    return { 
      allCategories, 
      fixedExpenses, 
      variableTransactions, 
      transactions: currentTransactions, 
      summary: { balance, income, expense }, 
      categoryStats, 
      pieData: categoryStats, 
      dailyData 
    };

  } catch (error) {
    console.error("Erro crítico no dashboard:", error);
    return { allCategories: [], fixedExpenses: [], variableTransactions: [], transactions: [], summary: { balance: 0 }, categoryStats: [], pieData: [], dailyData: [] };
  }
}

// --- CRIAR TRANSAÇÃO ---
export async function createTransaction(data: any) {
  try {
    const userId = await getUser(); // <--- AWAIT AQUI
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
    const userId = await getUser(); // <--- AWAIT AQUI
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
    const userId = await getUser(); // <--- AWAIT AQUI
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
    const userId = await getUser(); // <--- AWAIT AQUI
    if (!userId) return { success: false };

    await db.update(categories)
      .set({ budget: budget })
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- CFO VIRTUAL ---
export async function generateMonthlyReport(month: number, year: number) {
  try {
    const reportData = await getDashboardData(month, year);
    const txs = reportData.transactions || [];
    
    if (txs.length === 0) return { success: false, message: "Sem dados suficientes." };

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
          { role: "system", content: "Você é um CFO Virtual. Analise os dados e forneça insights corporativos concisos (max 3 parágrafos)." },
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

// --- EXCLUIR ---
export async function deleteTransaction(id: string) {
  try {
    const userId = await getUser(); // <--- AWAIT AQUI
    if (!userId) return { success: false };

    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) { return { success: false }; }
}

// --- EDITAR ---
export async function updateTransaction(id: string, data: any) {
  try {
    const userId = await getUser(); // <--- AWAIT AQUI
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

// --- SINCRONIZAR CATEGORIAS (ROBUSTO) ---
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
      { name: "Salário", type: "income" },
      { name: "Investimentos", type: "income" }
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