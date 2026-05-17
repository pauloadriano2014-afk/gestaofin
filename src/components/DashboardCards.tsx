import { Wallet, TrendingUp, TrendingDown, PiggyBank, Info } from "lucide-react";

export function DashboardCards({ theme, summary, selectedDay, formatCurrency }: any) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* Card 1: Saldo */}
      <div className={`${theme.card} p-4 md:p-6 rounded-2xl border flex flex-col justify-between transition-colors ${theme.cardHover}`}>
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h3 className={`text-xs md:text-sm font-bold flex items-center gap-2 ${theme.textMuted}`}><Wallet className="w-4 h-4 text-blue-500" /> Saldo Principal</h3>
        </div>
        <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight ${theme.text}`}>{formatCurrency(summary.balance)}</p>
        <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>{selectedDay ? `Em ${selectedDay}` : 'Disponível na Conta'}</p>
      </div>

      {/* Card 2: Receita Operacional */}
      <div className={`${theme.card} p-4 md:p-6 rounded-2xl border flex flex-col justify-between transition-colors ${theme.cardHover}`}>
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h3 className={`text-xs md:text-sm font-bold flex items-center gap-2 ${theme.textMuted}`}><TrendingUp className="w-4 h-4 text-emerald-500" /> Receita Operacional</h3>
        </div>
        <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight text-emerald-500`}>{formatCurrency(summary.income)}</p>
        
        {/* SUBTÍTULO NOVO: Receita Bruta */}
        <div className={`mt-2 flex items-center gap-1 ${theme.textMuted}`} title="Total bruto movimentado (inclui resgates e reembolsos)">
            <Info className="w-3 h-3 shrink-0" />
            <p className="text-[9px] md:text-[10px] truncate">Bruto: {summary.grossIncome !== undefined ? formatCurrency(summary.grossIncome) : formatCurrency(summary.income)}</p>
        </div>
      </div>

      {/* Card 3: Despesas de Fato */}
      <div className={`${theme.card} p-4 md:p-6 rounded-2xl border flex flex-col justify-between transition-colors ${theme.cardHover}`}>
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h3 className={`text-xs md:text-sm font-bold flex items-center gap-2 ${theme.textMuted}`}><TrendingDown className="w-4 h-4 text-red-500" /> Despesas de Fato</h3>
        </div>
        <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight text-red-500`}>{formatCurrency(summary.expense)}</p>
        
        {/* SUBTÍTULO NOVO: Despesa Bruta (A que bate com o PDF) */}
        <div className={`mt-2 flex items-center gap-1 ${theme.textMuted}`} title="Total bruto debitado (inclui cartões e aportes)">
            <Info className="w-3 h-3 shrink-0" />
            <p className="text-[9px] md:text-[10px] truncate">Bruto: {summary.grossExpense !== undefined ? formatCurrency(summary.grossExpense) : formatCurrency(summary.expense)}</p>
        </div>
      </div>

      {/* Card 4: Aportes / Investido */}
      <div className={`${theme.card} p-4 md:p-6 rounded-2xl border flex flex-col justify-between transition-colors ${theme.cardHover}`}>
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h3 className={`text-xs md:text-sm font-bold flex items-center gap-2 ${theme.textMuted}`}><PiggyBank className="w-4 h-4 text-purple-500" /> Aportes / Investido</h3>
        </div>
        <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight text-purple-500`}>{formatCurrency(summary.invested)}</p>
        <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>Patrimônio alocado</p>
      </div>

    </div>
  );
}
