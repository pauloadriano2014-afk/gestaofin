'use client'

import { useState } from "react";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, HelpCircle } from "lucide-react";
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
  grossIncomeTxs = [],
  grossExpenseTxs = [],
  categories = [],
  startMonth,
  startYear,
  endMonth,
  endYear,
  isolatePeriod,
  viewMode,
  onEditTransaction,
  onHelp,
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

  // 🔥 NOVO: clicar num lançamento dentro do modal de detalhamento fecha o
  // modal e abre a edição dele (mesmo fluxo de editar usado no resto da tela).
  const handleEditFromBreakdown = (tx: any) => {
    setOpenModal(null);
    onEditTransaction?.(tx);
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

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
            {onHelp && <button type="button" onClick={(e) => { e.stopPropagation(); onHelp('card-receita'); }} className={`p-1 rounded-full hover:bg-black/5 ${theme.textMuted}`} title="Como esse número é calculado?" aria-label="Ajuda sobre este card"><HelpCircle className="w-4 h-4" /></button>}
          </div>
          <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight text-emerald-500`}>{formatCurrency(summary.income)}</p>
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>Tudo que entra no período, pago ou não · sem investimentos, reembolsos e transferências</p>
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
            {onHelp && <button type="button" onClick={(e) => { e.stopPropagation(); onHelp('card-despesas'); }} className={`p-1 rounded-full hover:bg-black/5 ${theme.textMuted}`} title="Como esse número é calculado?" aria-label="Ajuda sobre este card"><HelpCircle className="w-4 h-4" /></button>}
          </div>
          <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight text-red-500`}>{formatCurrency(summary.expense)}</p>
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>Tudo que sai no período, pago ou não · sem aportes, reembolsos, transferências e pagamento de fatura</p>
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
            {onHelp && <button type="button" onClick={(e) => { e.stopPropagation(); onHelp('card-investido'); }} className={`p-1 rounded-full hover:bg-black/5 ${theme.textMuted}`} title="Como esse número é calculado?" aria-label="Ajuda sobre este card"><HelpCircle className="w-4 h-4" /></button>}
          </div>
          <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight text-purple-500`}>{formatCurrency(summary.invested)}</p>
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>Dinheiro guardado no período (aportes − resgates)</p>
        </div>

      </div>

      {openModal === 'balance' && (
        <BreakdownModal
          title={isolatePeriod ? "Resultado do mês (caixa)" : "Resultado do período (caixa)"}
          description={selectedDay ? `Todos os lançamentos já pagos até o dia ${selectedDay} que formam o saldo disponível.` : "Todos os lançamentos já pagos (histórico completo até o fim do período) que formam o saldo disponível. O que ainda falta pagar não entra."}
          mode="balance"
          transactions={balanceTxs}
          categories={categories}
          formatCurrency={formatCurrency}
          loading={loadingBalance}
          onClose={() => setOpenModal(null)}
          onEditTransaction={onEditTransaction ? handleEditFromBreakdown : undefined}
        />
      )}

      {openModal === 'income' && (
        <BreakdownModal
          title="Receita Operacional"
          description="Lançamentos de entrada do período (exclui investimentos, cartão de crédito e reembolsos)."
          mode="income"
          transactions={incomeTxs}
          grossTransactions={grossIncomeTxs}
          categories={categories}
          formatCurrency={formatCurrency}
          onClose={() => setOpenModal(null)}
          onEditTransaction={onEditTransaction ? handleEditFromBreakdown : undefined}
        />
      )}

      {openModal === 'expense' && (
        <BreakdownModal
          title="Despesas de Fato"
          description="Lançamentos de saída do período (exclui investimentos, cartão de crédito e reembolsos)."
          mode="expense"
          transactions={expenseTxs}
          grossTransactions={grossExpenseTxs}
          categories={categories}
          formatCurrency={formatCurrency}
          onClose={() => setOpenModal(null)}
          onEditTransaction={onEditTransaction ? handleEditFromBreakdown : undefined}
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
          onEditTransaction={onEditTransaction ? handleEditFromBreakdown : undefined}
        />
      )}
    </>
  );
}
