export function calculateDashboardData(rawData: any, viewMode: string, currentDate: Date, selectedDay: number | null, daysInMonthArray: number[]) {
    let txs = (rawData.transactions || []).filter((t: any) => 
      viewMode === 'all' ? true : t.entityType === viewMode
    );
  
    if (selectedDay !== null) {
      const targetDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
      txs = txs.filter((t: any) => t.date === targetDate);
    }
  
    // 1. Identificando Categorias Especiais
    const catInvestimentosId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('investimento'))?.id;
    const catCartaoId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('cartão de crédito'))?.id;
    const catReembolsoId = rawData.allCategories.find((c: any) => c.name.toLowerCase().includes('reembolso'))?.id;
  
    // 2. Separando as transações de Investimento (Aportes)
    const txsInvestimentos = txs.filter((t: any) => t.categoryId === catInvestimentosId);
  
    // 3. O Fluxo Operacional Limpo (Sem Investimentos, Cartão de Crédito e Reembolsos)
    const txsOperacionais = txs.filter((t: any) => 
      t.categoryId !== catInvestimentosId && 
      t.categoryId !== catCartaoId && 
      t.categoryId !== catReembolsoId
    );
  
    // 4. Cálculos dos Cards usando Math.abs() para blindagem total
    const income = txsOperacionais.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const expense = txsOperacionais.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    
    // 5. Cálculo do 4º Card (Aportes/Investido)
    const investidoOut = txsInvestimentos.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const investidoIn = txsInvestimentos.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0);
    const invested = investidoOut - investidoIn; 
  
    const fixedExpenses = txs.filter((t: any) => t.isFixed && t.type === 'expense');
    const variableTransactions = txs.filter((t: any) => !t.isFixed || t.type === 'income');
  
    // 🔥 CORREÇÃO AQUI: Agora usamos txsOperacionais para desenhar a pizza e as metas!
    const categoryStats = (rawData.allCategories || []).map((cat: any) => {
        const spent = txsOperacionais.filter((t: any) => t.categoryId === cat.id && t.type === 'expense').reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
        return { ...cat, id: cat.id, name: cat.name, value: spent, budget: Number(cat.budget || 0) };
    }).filter((c: any) => c.value > 0 || c.budget > 0).sort((a: any, b: any) => b.value - a.value);
    
    const dailyData = [];
    for (let i = 1; i <= daysInMonthArray.length; i++) {
        const d = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const dayTxs = txsOperacionais.filter((t: any) => t.date === d);
        if(dayTxs.length > 0) {
            dailyData.push({
                day: i,
                entrada: dayTxs.filter((t: any) => t.type === 'income').reduce((a: number, b: any) => a + Math.abs(Number(b.amount)), 0),
                saida: dayTxs.filter((t: any) => t.type === 'expense').reduce((a: number, b: any) => a + Math.abs(Number(b.amount)), 0)
            });
        }
    }
  
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