export function calculateDashboardData(rawData: any, viewMode: string, selectedDay: number | null) {
    let txs = (rawData.transactions || []).filter((t: any) => 
      viewMode === 'all' ? true : t.entityType === viewMode
    );
  
    if (selectedDay !== null) {
      const dayStr = String(selectedDay).padStart(2, '0');
      txs = txs.filter((t: any) => t.date.endsWith(`-${dayStr}`));
    }
  
    const catInvestimentosId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('investimento'))?.id;
    const catCartaoId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('cartão de crédito'))?.id;
    const catReembolsoId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('reembolso'))?.id;
  
    const txsInvestimentos = txs.filter((t: any) => t.categoryId === catInvestimentosId);
  
    const txsOperacionais = txs.filter((t: any) => 
      t.categoryId !== catInvestimentosId && 
      t.categoryId !== catCartaoId && 
      t.categoryId !== catReembolsoId
    );
  
    // 1. Receita e Despesa LIMPAS (Operacionais)
    const income = txsOperacionais.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const expense = txsOperacionais.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    
    // 🔥 2. Receita e Despesa BRUTAS (Para bater com o PDF) 🔥
    const grossIncome = txs.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const grossExpense = txs.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);

    const investidoOut = txsInvestimentos.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const investidoIn = txsInvestimentos.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const invested = investidoOut - investidoIn; 
  
    const fixedExpenses = txs.filter((t: any) => t.isFixed && t.type === 'expense');
    const variableTransactions = txs.filter((t: any) => !t.isFixed || t.type === 'income');
  
    const categoryStats = (rawData.allCategories || []).map((cat: any) => {
        const spent = txsOperacionais.filter((t: any) => t.categoryId === cat.id && t.type === 'expense').reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
        return { ...cat, id: cat.id, name: cat.name, value: spent, budget: Number(cat.budget || 0) };
    }).filter((c: any) => c.value > 0 || c.budget > 0).sort((a: any, b: any) => b.value - a.value);
    
    const dailyMap: Record<string, { entrada: number, saida: number }> = {};
        
    txsOperacionais.forEach((t: any) => {
        const d = t.date;
        if (!dailyMap[d]) dailyMap[d] = { entrada: 0, saida: 0 };
        if (t.type === 'income') dailyMap[d].entrada += Math.abs(Number(t.amount));
        if (t.type === 'expense') dailyMap[d].saida += Math.abs(Number(t.amount));
    });

    const dailyData = Object.keys(dailyMap).sort().map(date => {
        const [y, m, d] = date.split('-');
        return {
            day: `${d}/${m}`,
            entrada: dailyMap[date].entrada,
            saida: dailyMap[date].saida
        };
    });

    // 🔥 NOVO: agrupado por semana (segunda a domingo) em vez de por dia — o
    // gráfico diário ficava "dente de serra" demais (um gasto pontual num dia
    // criava um pico isolado, difícil de enxergar tendência). Agrupar por
    // semana suaviza isso e facilita comparar entrada x saída.
    const weeklyMap: Record<string, { entrada: number; saida: number }> = {};
    txsOperacionais.forEach((t: any) => {
        const d = new Date(`${t.date}T00:00:00`);
        const dayOfWeek = d.getDay(); // 0 = domingo ... 6 = sábado
        const diffToMonday = (dayOfWeek + 6) % 7; // dias desde a última segunda-feira
        const monday = new Date(d);
        monday.setDate(d.getDate() - diffToMonday);
        const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        if (!weeklyMap[key]) weeklyMap[key] = { entrada: 0, saida: 0 };
        if (t.type === 'income') weeklyMap[key].entrada += Math.abs(Number(t.amount));
        if (t.type === 'expense') weeklyMap[key].saida += Math.abs(Number(t.amount));
    });

    const weeklyData = Object.keys(weeklyMap).sort().map((key) => {
        const [, m, d] = key.split('-');
        return {
            week: `Sem. ${d}/${m}`,
            entrada: weeklyMap[key].entrada,
            saida: weeklyMap[key].saida,
        };
    });

    let finalBalance = rawData.summary?.globalBalance || 0;
    if (viewMode === 'pf') finalBalance = rawData.summary?.globalBalancePF || 0;
    if (viewMode === 'pj') finalBalance = rawData.summary?.globalBalancePJ || 0;

    return {
        summary: {
            balance: finalBalance,
            income,
            expense,
            invested,
            grossIncome, // Enviando pro Front
            grossExpense // Enviando pro Front
        },
        fixedExpenses,
        variableTransactions,
        categoryStats,
        dailyData,
        weeklyData,
        // 🔥 NOVO: todos os lançamentos do período/viewMode/dia selecionado, sem
        // nenhum filtro de categoria excluída nem de isFixed — usado pelo filtro
        // de categoria da tela ("Extrato Detalhado") pra mostrar TODOS os itens
        // de uma categoria (antes só filtrava a lista de Custos Fixos).
        allTxs: txs,
        // 🔥 NOVO: itens que compõem "Receita Operacional", "Despesas de Fato" e
        // "Aportes/Investido" — pra poder clicar no card e ver a lista que soma
        // até o valor mostrado (Saldo Principal é global, então tem sua própria
        // busca sob demanda no servidor — ver getBalanceBreakdown em actions.ts).
        incomeTxs: txsOperacionais.filter((t: any) => t.type === 'income'),
        expenseTxs: txsOperacionais.filter((t: any) => t.type === 'expense'),
        investedTxs: txsInvestimentos.filter((t: any) => t.type === 'income' || t.type === 'expense'),
        // 🔥 NOVO: versão "bruta" (sem excluir Investimentos/Cartão de Crédito/
        // Reembolsos) das mesmas listas — é o que soma pro "Bruto: R$X" que já
        // aparecia embaixo dos cards. Usado pelo toggle "incluir cartão,
        // investimentos e reembolsos" dentro do detalhamento, já que a lista
        // "Fluxo Variável" que mostrava isso foi removida da tela.
        grossIncomeTxs: txs.filter((t: any) => t.type === 'income'),
        grossExpenseTxs: txs.filter((t: any) => t.type === 'expense'),
    };
}
