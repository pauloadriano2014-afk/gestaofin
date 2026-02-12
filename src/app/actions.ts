'use server'

import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { desc, and, sql, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// --- BUSCAR DADOS DA DASHBOARD ---
export async function getDashboardData(month: number, year: number) {
  try {
    const allCategories = await db.select().from(categories);
    
    // Busca transações do mês selecionado
    // O Drizzle traz todos os campos do schema automaticamente, incluindo 'entityType'
    const currentTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          sql`EXTRACT(MONTH FROM ${transactions.date}) = ${month}`,
          sql`EXTRACT(YEAR FROM ${transactions.date}) = ${year}`
        )
      )
      .orderBy(desc(transactions.date));

    // Separação de Dados (Listas)
    const fixedExpenses = currentTransactions.filter(t => t.isFixed === true && t.type === 'expense');
    const variableTransactions = currentTransactions.filter(t => t.isFixed === false || t.type === 'income');

    // Totais Gerais
    const income = currentTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = currentTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = income - expense;

    // --- LÓGICA DE METAS E CATEGORIAS (CUTTING FINANCEIRO) ---
    const categoryStats = allCategories.map(cat => {
      const spent = currentTransactions
        .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
      return {
        id: cat.id,
        name: cat.name,
        value: spent,
        budget: Number(cat.budget || 0), // Traz a meta do banco
        color: '#3b82f6'
      };
    })
    .filter(i => i.value > 0 || i.budget > 0)
    .sort((a, b) => b.value - a.value);

    // Gráfico Diário
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
      transactions: currentTransactions, // Retornamos a lista bruta também para filtragem PF/PJ no front
      summary: { balance, income, expense }, 
      categoryStats, 
      pieData: categoryStats, 
      dailyData 
    };

  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    return { allCategories: [], fixedExpenses: [], variableTransactions: [], transactions: [], summary: { balance: 0 }, categoryStats: [], pieData: [], dailyData: [] };
  }
}

// --- CRIAR TRANSAÇÃO (COM PARCELAMENTO E PF/PJ) ---
export async function createTransaction(data: any) {
  try {
    // Verifica parcelas (padrão 1)
    const installments = data.installments ? Number(data.installments) : 1;
    
    // Divide o valor total pelo número de parcelas
    const amountPerInstallment = (Number(data.amount) / installments).toFixed(2);

    for (let i = 0; i < installments; i++) {
      // 1. Calcular a data correta para cada mês
      const [y, m, d] = data.date.split('-').map(Number);
      const newDate = new Date(y, (m - 1) + i, d); 
      const isoDate = newDate.toISOString().split('T')[0];

      // 2. Ajustar descrição se for parcelado
      const description = installments > 1 
        ? `${data.description} (${i + 1}/${installments})` 
        : data.description;

      // 3. Status de Pagamento
      // Parcelas futuras (i > 0) nascem como PENDENTE.
      const isPaidStatus = (installments > 1 && i > 0) 
        ? false 
        : (data.isPaid === undefined ? true : data.isPaid);

      // 4. Inserir no banco
      await db.insert(transactions).values({
        userId: "paulo-admin",
        description: description,
        amount: installments > 1 ? amountPerInstallment : data.amount,
        categoryId: data.categoryId || null,
        type: data.type,
        date: isoDate,
        isFixed: data.isFixed || false,
        isPaid: isPaidStatus,
        entityType: data.entityType || "pf", // <--- SALVA SE É PF OU PJ
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

// --- ATUALIZAR STATUS (PAGO/PENDENTE) ---
export async function toggleTransactionStatus(id: string, currentStatus: boolean) {
  try {
    await db.update(transactions)
      .set({ isPaid: !currentStatus })
      .where(eq(transactions.id, id));
      
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    return { success: false };
  }
}

// --- VIRAR O MÊS (COPIAR FIXAS) ---
export async function copyFixedExpenses(currentMonth: number, currentYear: number) {
  try {
    const fixedExpenses = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.isFixed, true),
          eq(transactions.type, 'expense'),
          sql`EXTRACT(MONTH FROM ${transactions.date}) = ${currentMonth}`,
          sql`EXTRACT(YEAR FROM ${transactions.date}) = ${currentYear}`
        )
      );

    if (fixedExpenses.length === 0) {
      return { success: false, message: "Nenhuma conta fixa encontrada neste mês." };
    }

    let count = 0;

    for (const expense of fixedExpenses) {
      const [y, m, d] = expense.date.split('-').map(Number);
      
      let nextMonth = m + 1;
      let nextYear = y;
      
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear = y + 1;
      }

      const nextDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const existing = await db.select().from(transactions).where(
        and(
          eq(transactions.description, expense.description),
          eq(transactions.date, nextDateStr),
          eq(transactions.amount, expense.amount)
        )
      );

      if (existing.length === 0) {
        await db.insert(transactions).values({
          userId: expense.userId,
          description: expense.description,
          amount: expense.amount,
          categoryId: expense.categoryId,
          type: expense.type,
          date: nextDateStr,
          isFixed: true,
          isPaid: false, 
          entityType: expense.entityType, // <--- COPIA SE É PF OU PJ
          aiTags: expense.aiTags
        });
        count++;
      }
    }

    revalidatePath("/");
    return { success: true, message: `${count} contas copiadas para o próximo mês com sucesso!` };

  } catch (error) {
    console.error("Erro ao copiar despesas:", error);
    return { success: false, message: "Erro ao processar cópia." };
  }
}

// --- ATUALIZAR ORÇAMENTO (METAS) ---
export async function updateCategoryBudget(categoryId: string, budget: string) {
  try {
    await db.update(categories)
      .set({ budget: budget })
      .where(eq(categories.id, categoryId));
    
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar meta:", error);
    return { success: false };
  }
}

// --- CONSULTOR FINANCEIRO EXECUTIVO (IA) ---
export async function generateMonthlyReport(month: number, year: number) {
  try {
    const reportData = await getDashboardData(month, year);
    const txs = reportData.transactions || [];
    
    if (txs.length === 0) {
      return { success: false, message: "Sem dados suficientes para análise executiva." };
    }

    // Calcula dados separados para o prompt
    const income = txs.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    const expense = txs.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    
    // Top gastos para contexto
    const topExpenses = txs
        .filter((t: any) => t.type === 'expense')
        .sort((a: any, b: any) => Number(b.amount) - Number(a.amount))
        .slice(0, 5)
        .map((t: any) => `${t.description} (${t.entityType === 'pj' ? 'PJ' : 'PF'}: R$${t.amount})`)
        .join(', ');

    const summaryText = `
      Período: ${month}/${year}
      Receita Operacional Total: R$ ${income}
      Despesas Totais: R$ ${expense}
      Resultado Líquido (Bottom Line): R$ ${income - expense}
      
      Principais saídas de caixa:
      ${topExpenses}
    `;

    const API_KEY = process.env.OPENAI_API_KEY; 

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um Consultor Financeiro Executivo Sênior (CFO Virtual).
            
            Seu objetivo: Analisar o fluxo de caixa consolidado (PF e PJ) e fornecer insights estratégicos.
            
            Diretrizes:
            1. Use linguagem corporativa e profissional (ex: "Fluxo de Caixa", "Opex", "Liquidez", "Margem", "Alocação de Recursos").
            2. Seja direto e analítico. Sem metáforas esportivas ou de academia.
            3. Se o saldo for negativo, sugira cortes de custos operacionais ou renegociação de passivos.
            4. Se o saldo for positivo, sugira constituição de reservas ou investimentos estratégicos.
            5. Identifique se os maiores gastos são PF ou PJ e comente sobre a mistura de patrimônios se necessário.
            
            Mantenha a resposta concisa (máximo 3 parágrafos).`
          },
          { role: "user", content: `Por favor, analise os seguintes indicadores financeiros:\n${summaryText}` }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);
    
    return { success: true, message: data.choices[0].message.content };

  } catch (error: any) {
    console.error("Erro no Personal:", error);
    return { success: false, message: "O serviço de análise executiva está indisponível momentaneamente." };
  }
}