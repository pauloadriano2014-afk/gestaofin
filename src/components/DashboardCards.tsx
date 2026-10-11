'use client'

import { useState } from "react";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, HelpCircle, Scale } from "lucide-react";
import { BreakdownModal } from "@/components/BreakdownModal";
import { ReconcileBalanceModal } from "@/components/ReconcileBalanceModal";
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
  owners = [],
  onReconciled,
}: any) {
  const [openModal, setOpenModal] = useState<null | 'income' | 'expense' | 'balance' | 'invested'>(null);
  const [balanceTxs, setBalanceTxs] = useState<any[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

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
            {onHelp && <button type="button" onClick={(e) => { e.stopPropagation(); onHelp('card-saldo'); }} className={`p-1 rounded-full hover:bg-black/5 ${theme.textMuted}`} title="Como esse número é calculado?" aria-label="Ajuda sobre este card"><HelpCircle className="w-4 h-4" /></button>}
          </div>
          <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight ${theme.text}`}>{formatCurrency(summary.balance)}</p>
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>{selectedDay ? `Em ${selectedDay}` : 'Disponível na conta (só o que já foi pago)'}</p>
          {isolatePeriod && !selectedDay && (
            <p className={`text-[10px] md:text-xs mt-1 ${theme.textMuted}`}>
              Dinheiro acumulado até aqui <b className={`whitespace-nowrap ${summary.accumulated < 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(summary.accumulated || 0)}</b>
            </p>
          )}
          {Math.abs(summary.pending || 0) >= 0.005 && (
            <p className={`text-[10px] md:text-xs mt-1 ${theme.textMuted}`}>
              {summary.pending < 0 ? 'Falta pagar' : 'Falta receber'} <b className={`whitespace-nowrap ${summary.pending < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{formatCurrency(Math.abs(summary.pending))}</b>
              {' · '}previsto <b className={`whitespace-nowrap ${summary.projected < 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(summary.projected)}</b>
            </p>
          )}
          {owners.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setReconcileOpen(true); }}
              className="mt-2 self-start inline-flex items-center gap-1 text-[10px] md:text-xs font-semibold text-blue-500 hover:text-blue-400"
              title="Ajustar o saldo do app para bater com o do banco"
            ><Scale className="w-3.5 h-3.5" /> Conciliar com o banco</button>
          )}
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
            {onHelp && <button type="button" onClick={(e) => { e.stopPropagation(); onHelp('card-receita'); }} className={`p-1 rounded-full hover:bg-black/5 ${theme.textMuted}`} title="Como esse número é calculado?" aria-label="Ajuda sobre este card"><HelpCircle className="w-4 h-4" /></button>}
          </div>
          <p className={`text-lg md:text-3xl font-bold font-mono tracking-tight text-emerald-500`}>{formatCurrency(summary.income)}</p>
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>Excl. cartão e investimentos</p>
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
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>Excl. cartão e investimentos</p>
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
          <p className={`text-[10px] md:text-xs mt-2 ${theme.textMuted}`}>Patrimônio alocado</p>
        </div>

      </div>

      {reconcileOpen && (
        <ReconcileBalanceModal
          owners={owners}
          initialOwnerId={owners.some((o: any) => o.id === viewMode) ? viewMode : undefined}
          formatCurrency={formatCurrency}
          onClose={() => setReconcileOpen(false)}
          onDone={() => onReconciled?.()}
        />
      )}

      {openModal === 'balance' && (
        <BreakdownModal
          title="Saldo Principal"
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
