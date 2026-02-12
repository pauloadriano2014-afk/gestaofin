'use server'

import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { desc, and, sql, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getDashboardData(month: number, year: number) {
  try {
    const allCategories = await db.select().from(categories);
    
    // Busca transações do mês selecionado
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

    // Separação de Dados para a Dashboard
    const fixedExpenses = currentTransactions.filter(t => t.isFixed === true && t.type === 'expense');
    const variableTransactions = currentTransactions.filter(t => t.isFixed === false || t.type === 'income');

    // Cálculos de Totais
    const income = currentTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = currentTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = income - expense;

    // Dados para Gráficos
    const pieData = allCategories.map(cat => ({
      name: cat.name,
      value: currentTransactions
        .filter(tx => tx.categoryId === cat.id && tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
      color: '#3b82f6' 
    })).filter(i => i.value > 0).sort((a, b) => b.value - a.value);

    // Gráfico de fluxo diário
    const dailyData: any[] = [];
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
      summary: { balance, income, expense }, 
      pieData, 
      dailyData 
    };

  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    return { allCategories: [], fixedExpenses: [], variableTransactions: [], summary: { balance: 0 }, pieData: [], dailyData: [] };
  }
}

// --- FUNÇÃO ATUALIZADA COM PARCELAMENTO ---
export async function createTransaction(data: any) {
  try {
    // Verifica se tem parcelas (padrão 1)
    const installments = data.installments ? Number(data.installments) : 1;
    
    // Divide o valor total pelo número de parcelas
    // Ex: Compra de 300 em 3x = 100 por parcela
    const amountPerInstallment = (Number(data.amount) / installments).toFixed(2);

    // Loop para criar cada parcela
    for (let i = 0; i < installments; i++) {
      // 1. Calcular a data correta para cada mês
      const [y, m, d] = data.date.split('-').map(Number);
      
      // O mês no objeto Date começa em 0 (Jan=0), por isso subtraímos 1.
      // Somamos 'i' para avançar os meses. O JS corrige o ano automaticamente (Ex: Dez -> Jan).
      const newDate = new Date(y, (m - 1) + i, d); 
      const isoDate = newDate.toISOString().split('T')[0];

      // 2. Ajustar descrição se for parcelado
      const description = installments > 1 
        ? `${data.description} (${i + 1}/${installments})` 
        : data.description;

      // 3. Definir status de pagamento
      // Se for parcelado, só a primeira parcela (i=0) respeita o que o usuário marcou.
      // As parcelas futuras (i > 0) nascem sempre como PENDENTE (false).
      const isPaidStatus = (installments > 1 && i > 0) 
        ? false 
        : (data.isPaid === undefined ? true : data.isPaid);

      // 4. Inserir no banco
      await db.insert(transactions).values({
        userId: "paulo-admin",
        description: description,
        amount: installments > 1 ? amountPerInstallment : data.amount, // Usa valor parcelado ou cheio
        categoryId: data.categoryId || null,
        type: data.type,
        date: isoDate,
        isFixed: data.isFixed || false,
        isPaid: isPaidStatus,
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

export async function generateMonthlyReport(month: number, year: number) {
  try {
    // 1. Busca os dados do mês
    const reportData = await getDashboardData(month, year);
    
    // Se não tiver gastos, nem gasta crédito da IA
    if (reportData.variableTransactions.length === 0 && reportData.fixedExpenses.length === 0) {
      return { success: false, message: "Sem dados suficientes para treinar este mês, campeão!" };
    }

    // 2. Prepara o resumo para a IA ler
    const summaryText = `
      Mês: ${month}/${year}
      Saldo: R$ ${reportData.summary.balance}
      Entradas: R$ ${reportData.summary.income}
      Saídas Totais: R$ ${reportData.summary.expense}
      
      Top Gastos Variáveis:
      ${reportData.variableTransactions.slice(0, 5).map((t: any) => `- ${t.description}: R$ ${t.amount}`).join('\n')}
      
      Contas Fixas Totais: R$ ${reportData.fixedExpenses.reduce((acc: number, t: any) => acc + Number(t.amount), 0)}
    `;

    // 3. Chama a OpenAI (Configuração Direta)
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
            content: `Você é um 'Personal Trainer Financeiro' linha dura, focado em alta performance.
            O usuário é um fisiculturista e empresário (Paulo Adriano TEAM).
            
            Sua missão: Analisar o mês financeiro dele usando analogias de musculação/treino.
            - Se o saldo for positivo: Elogie o "superávit", diga que está crescendo seco.
            - Se o saldo for negativo: Dê uma bronca, fale que ele está "catabolizando" patrimônio.
            - Aponte onde ele "roubou na dieta" (gastos variáveis altos).
            
            Seja curto, direto e motivador. Use emojis. Máximo de 3 parágrafos.`
          },
          { role: "user", content: `Analise meu desempenho financeiro deste mês:\n${summaryText}` }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);
    
    return { success: true, message: data.choices[0].message.content };

  } catch (error: any) {
    console.error("Erro no Personal:", error);
    return { success: false, message: "O Personal está descansando entre séries. Tente de novo." };
  }
}