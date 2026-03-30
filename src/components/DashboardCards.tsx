import { Wallet } from "lucide-react";

export function DashboardCards({ theme, summary, selectedDay, formatCurrency }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1. Saldo Histórico Global (O valor real do banco) */}
      <div className={`${theme.card} p-6 rounded-2xl border relative overflow-hidden group transition-all`}>
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wallet className="w-16 h-16" />
        </div>
        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.textMuted}`}>
            Saldo do Banco {selectedDay && `(Dia ${selectedDay})`}
        </p>
        <h2 className={`text-2xl xl:text-3xl font-mono font-bold ${summary.balance >= 0 ? theme.text : 'text-red-500'}`}>
          {formatCurrency(summary.balance)}
        </h2>
      </div>

      {/* 2. Receita do Mês (Sem contar Resgates de Investimentos ou Pix de esposa) */}
      <div className={`${theme.card} p-6 rounded-2xl border transition-all`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.textMuted}`}>Receita Operacional</p>
        <h2 className="text-2xl font-mono font-bold text-emerald-500">{formatCurrency(summary.income)}</h2>
      </div>

      {/* 3. Despesas do Mês (Sem contar o Cartão de Crédito repetido) */}
      <div className={`${theme.card} p-6 rounded-2xl border transition-all`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.textMuted}`}>Despesas de Fato</p>
        <h2 className="text-2xl font-mono font-bold text-red-500">{formatCurrency(summary.expense)}</h2>
      </div>

      {/* 4. Aportes do Mês (O dinheiro que virou Patrimônio) */}
      <div className={`${theme.card} p-6 rounded-2xl border transition-all bg-gradient-to-br from-blue-500/5 to-transparent`}>
        <p className={`text-xs font-bold uppercase tracking-wider mb-1 text-blue-500`}>Aportes (Investido)</p>
        <h2 className="text-2xl font-mono font-bold text-blue-500">{formatCurrency(summary.invested)}</h2>
      </div>
    </div>
  );
}