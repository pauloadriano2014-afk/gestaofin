'use client'

import { Clock, Copy, Loader2, Upload, Settings2 } from 'lucide-react'
import { TransactionRow } from '@/components/TransactionRow'
import { CardsOverview } from '@/components/CardsOverview'

// Tudo que é "dívida a pagar" em um lugar só: contas em aberto, custos fixos
// do mês e os cartões com suas faturas.
export function AccountsView({
  theme, currentTheme, formatCurrency, todayStr, openBillsPanel,
  fixedExpenses, ownerName, cards, owners, copying,
  onCopyMonth, onTogglePay, onEdit, onDelete,
  onViewInvoiceItems, onPayInvoice, onManageCards, onImportInvoice,
}: any) {
  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className={`text-2xl font-bold ${theme.text}`}>Contas e Cartões</h1>
        <p className={`text-sm ${theme.textMuted}`}>O que falta pagar, as contas fixas do mês e as faturas dos cartões.</p>
      </div>

      {openBillsPanel}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className={`font-bold flex items-center gap-2 ${theme.text}`}><Clock className="w-4 h-4 text-orange-500" /> Custos fixos do período</h2>
          {fixedExpenses.length > 0 && (
            <button onClick={onCopyMonth} disabled={copying} className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all border ${theme.buttonSecondary}`} title="Copia as contas fixas deste mês para o próximo">
              {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />} Virar Mês
            </button>
          )}
        </div>
        <div className="space-y-2 max-w-3xl">
          {fixedExpenses.map((tx: any) => (
            <TransactionRow key={tx.id} tx={tx} theme={theme} currentTheme={currentTheme} formatCurrency={formatCurrency} todayStr={todayStr}
              ownerName={ownerName(tx.ownerId)} onTogglePay={onTogglePay} onEdit={onEdit} onDelete={onDelete} />
          ))}
          {fixedExpenses.length === 0 && <p className={`text-sm text-center py-8 ${theme.textMuted}`}>Nenhuma conta fixa neste período.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className={`font-bold ${theme.text}`}>Cartões de crédito</h2>
          <div className="flex gap-2">
            <button onClick={onImportInvoice} className={`text-xs font-bold flex items-center gap-1.5 px-3 py-2 rounded-full border ${theme.buttonSecondary}`}><Upload className="w-3.5 h-3.5" /> Importar fatura</button>
            <button onClick={onManageCards} className={`text-xs font-bold flex items-center gap-1.5 px-3 py-2 rounded-full border ${theme.buttonSecondary}`}><Settings2 className="w-3.5 h-3.5" /> Gerenciar cartões</button>
          </div>
        </div>
        <CardsOverview theme={theme} formatCurrency={formatCurrency} cards={cards} owners={owners} todayStr={todayStr}
          onViewItems={onViewInvoiceItems} onPay={onPayInvoice} onManage={onManageCards} />
      </section>
    </div>
  )
}
