export function calculateDashboardData(rawData: any, viewMode: string, selectedDay: number | null) {
    // 1. Filtra as transações pela entidade (PF, PJ ou Todos)
    let txs = (rawData.transactions || []).filter((t: any) => 
      viewMode === 'all' ? true : t.entityType === viewMode
    );
  
    // 2. Se o usuário clicar em um dia específico no calendário, isola aquele dia (ex: Dia 15)
    if (selectedDay !== null) {
      const dayStr = String(selectedDay).padStart(2, '0');
      txs = txs.filter((t: any) => t.date.endsWith(`-${dayStr}`));
    }
  
    // 3. Identificando Categorias Especiais
    const catInvestimentosId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('investimento'))?.id;
    const catCartaoId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('cartão de crédito'))?.id;
    const catReembolsoId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('reembolso'))?.id;
  
    // 4. Separando as transações de Investimento (Aportes)
    const txsInvestimentos = txs.filter((t: any) => t.categoryId === catInvestimentosId);
  
    // 5. O Fluxo Operacional Limpo (Sem Investimentos, Cartão de Crédito e Reembolsos)
    const txsOperacionais = txs.filter((t: any) => 
      t.categoryId !== catInvestimentosId && 
      t.categoryId !== catCartaoId && 
      t.categoryId !== catReembolsoId
    );
  
    // 6. Cálculos dos Cards usando Math.abs() para blindagem total
    const income = txsOperacionais.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const expense = txsOperacionais.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    
    // 7. Cálculo do 4º Card (Aportes/Investido)
    const investidoOut = txsInvestimentos.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const investidoIn = txsInvestimentos.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const invested = investidoOut - investidoIn; 
  
    const fixedExpenses = txs.filter((t: any) => t.isFixed && t.type === 'expense');
    const variableTransactions = txs.filter((t: any) => !t.isFixed || t.type === 'income');
  
    // 8. Stats de Categorias usando o fluxo limpo
    const categoryStats = (rawData.allCategories || []).map((cat: any) => {
        const spent = txsOperacionais.filter((t: any) => t.categoryId === cat.id && t.type === 'expense').reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
        return { ...cat, id: cat.id, name: cat.name, value: spent, budget: Number(cat.budget || 0) };
    }).filter((c: any) => c.value > 0 || c.budget > 0).sort((a: any, b: any) => b.value - a.value);
    
    // 🔥 9. NOVA LÓGICA DE GRÁFICO DINÂMICO (AGRUPADO POR DATA REAL) 🔥
    const dailyMap: Record<string, { entrada: number, saida: number }> = {};
        
    txsOperacionais.forEach((t: any) => {
        const d = t.date; // Ex: 2026-03-15
        if (!dailyMap[d]) dailyMap[d] = { entrada: 0, saida: 0 };
        if (t.type === 'income') dailyMap[d].entrada += Math.abs(Number(t.amount));
        if (t.type === 'expense') dailyMap[d].saida += Math.abs(Number(t.amount));
    });

    // Converte o objeto em array, ordena pela data, e formata o dia pro eixo X (DD/MM)
    const dailyData = Object.keys(dailyMap).sort().map(date => {
        const [y, m, d] = date.split('-');
        return {
            day: `${d}/${m}`, // Fica bonito no gráfico: "15/03"
            entrada: dailyMap[date].entrada,
            saida: dailyMap[date].saida
        };
    });
  
    return { 
        summary: { 
            balance: rawData.summary?.globalBalance || 0, 
            income, 
            expense, 
            invested 
        }, 
        fixedExpenses, 
        variableTransactions, 
        categoryStats, 
        dailyData 
    };
}
