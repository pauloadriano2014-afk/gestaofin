'use client'

import { useState } from "react";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Info } from "lucide-react";
import { BreakdownModal } from "@/components/BreakdownModal";
import { getBalanceBreakdown } from "@/app/actions";

// 🔥 NOVO: os 4 cards agora são clicáveis. Cada clique abre um modal que
// "prova" o número mostrado, listando os lançamentos que somados chegam
// naquele valor. Receita/Despesa/Aportes já vêm prontos do processedData
// (props incomeTxs/expenseTxs/investedTxs); Saldo Principal é um número
// GLOBAL, então busca sob demanda via getBalanceBreakdown.
export function DashboardCards({
  theme,
  summary,
  selectedDay,
  formatCurrency,
  incomeTxs = [],
  expenseTxs = [],
  investedTxs = [],
  categories = [],
  startMonth,
  startYear,
  endMonth,
  endYear,
  isolatePeriod,
  viewMode,
}: any) {
  const [openModal, setOpenModal] = useState<null | 'income' | 'expense' | 'balance' | 'invested'>(null);
  const [balanceTxs, setBalanceTxs] = useState<any[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const handleOpenBalance = async () => {
    setOpenModal('balance');
    setLoadingBalance(true);
    const rows = await getBalanceBreakdown(startMonth, startYear, endMonth, endYear, isolatePeriod, viewMode);
    setBalanceTxs(rows);
    setLoadingBalance(false);
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1: Saldo */}
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpenBalance}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenBalance(); }}
          className={`${theme.card} p-4 md:p-6 rounded-2xl border flex flex-col justify-between transition-colors cursor-pointer ${theme.cardHover}`}
        >
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <h3 className={`text-xs md:text-sm font-bold flex items-center gap-2 ${theme.textMuted}`}><Wallet className="w-4 h-4 text-blue-500" /> Saldo Principal</h3>
          </div>
          <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight ${theme.text}`}>{formatCurrency(summary.balance)}</p>
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>{selectedDay ? `Em ${selectedDay}` : 'Disponível na Conta'}</p>
        </div>

        {/* Card 2: Receita Operacional */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenModal('income')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenModal('income'); }}
          className={`${theme.card} p-4 md:p-6 rounded-2xl border flex flex-col justify-between transition-colors cursor-pointer ${theme.cardHover}`}
        >
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
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenModal('expense')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenModal('expense'); }}
          className={`${theme.card} p-4 md:p-6 rounded-2xl border flex flex-col justify-between transition-colors cursor-pointer ${theme.cardHover}`}
        >
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
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenModal('invested')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenModal('invested'); }}
          className={`${theme.card} p-4 md:p-6 rounded-2xl border flex flex-col justify-between transition-colors cursor-pointer ${theme.cardHover}`}
        >
          <div className="flex items-center justify-between mb-2 md:mb-4">
            <h3 className={`text-xs md:text-sm font-bold flex items-center gap-2 ${theme.textMuted}`}><PiggyBank className="w-4 h-4 text-purple-500" /> Aportes / Investido</h3>
          </div>
          <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight text-purple-500`}>{formatCurrency(summary.invested)}</p>
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>Patrimônio alocado</p>
        </div>

      </div>

      {openModal === 'balance' && (
        <BreakdownModal
          title="Saldo Principal"
          description={selectedDay ? `Todos os lançamentos até o dia ${selectedDay} que formam o saldo disponível.` : "Todos os lançamentos (histórico completo até o fim do período) que formam o saldo disponível."}
          mode="balance"
          transactions={balanceTxs}
          categories={categories}
          formatCurrency={formatCurrency}
          loading={loadingBalance}
          onClose={() => setOpenModal(null)}
        />
      )}

      {openModal === 'income' && (
        <BreakdownModal
          title="Receita Operacional"
          description="Lançamentos de entrada do período (exclui investimentos, cartão de crédito e reembolsos)."
          mode="income"
          transactions={incomeTxs}
          categories={categories}
          formatCurrency={formatCurrency}
          onClose={() => setOpenModal(null)}
        />
      )}

      {openModal === 'expense' && (
        <BreakdownModal
          title="Despesas de Fato"
          description="Lançamentos de saída do período (exclui investimentos, cartão de crédito e reembolsos)."
          mode="expense"
          transactions={expenseTxs}
          categories={categories}
          formatCurrency={formatCurrency}
          onClose={() => setOpenModal(null)}
        />
      )}

      {openModal === 'invested' && (
        <BreakdownModal
          title="Aportes / Investido"
          description="Lançamentos da categoria Investimentos no período: aportes (saídas) e resgates (entradas)."
          mode="invested"
          transactions={investedTxs}
          categories={categories}
          formatCurrency={formatCurrency}
          onClose={() => setOpenModal(null)}
        />
      )}
    </>
  );
}
