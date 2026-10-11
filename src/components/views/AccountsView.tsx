'use client'

import { paidByLabel } from '@/utils/paidBy'
import { useMemo, useState } from 'react'
import { Clock, Copy, Loader2, Upload, Settings2, ChevronDown, ChevronRight } from 'lucide-react'
import { groupFixedByCategory } from '@/utils/fixedGroups'
import { TransactionRow } from '@/components/TransactionRow'
import { CardsOverview } from '@/components/CardsOverview'

// Tudo que é "dívida a pagar" em um lugar só: contas em aberto, custos fixos
// do mês e os cartões com suas faturas.
export function AccountsView({
  theme, currentTheme, formatCurrency, todayStr, openBillsPanel,
  fixedExpenses, categories = [], ownerName, cards, owners, copying,
  onCopyMonth, onTogglePay, onEdit, onDelete,
  onViewInvoiceItems, onPayInvoice, onManageCards, onImportInvoice,
}: any) {
  // Custos fixos por categoria (Estudos, Financiamento...), cada grupo abre e fecha.
  const groups = useMemo(() => groupFixedByCategory(fixedExpenses, categories, todayStr), [fixedExpenses, categories, todayStr])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.id))
  const fixedTotal = groups.reduce((acc, g) => acc + g.total, 0)
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
          {groups.length > 1 && (
            <div className="flex items-center justify-between">
              <p className={`text-xs ${theme.textMuted}`}>{fixedExpenses.length} contas · {formatCurrency(fixedTotal)}</p>
              <button onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.id)))} className="text-xs font-semibold text-blue-500 hover:text-blue-400">{allOpen ? 'Recolher tudo' : 'Expandir tudo'}</button>
            </div>
          )}
          {groups.map((g) => {
            const isOpen = open.has(g.id)
            return (
              <div key={g.id} className={`rounded-xl border ${currentTheme === 'dark' ? 'border-zinc-800 bg-zinc-900/40' : 'border-gray-200 bg-white'}`}>
                <button onClick={() => toggle(g.id)} className="w-full flex items-center justify-between gap-3 p-3 text-left" aria-expanded={isOpen}>
                  <span className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-zinc-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-zinc-400" />}
                    <span className={`font-bold text-sm truncate ${theme.text}`}>{g.name}</span>
                    <span className={`text-[11px] shrink-0 ${theme.textMuted}`}>{g.items.length} {g.items.length === 1 ? 'conta' : 'contas'}</span>
                    {g.lateCount > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 shrink-0">{g.lateCount} vencida{g.lateCount > 1 ? 's' : ''}</span>}
                    {g.pendingCount > 0 && g.lateCount === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 shrink-0">{g.pendingCount} pendente{g.pendingCount > 1 ? 's' : ''}</span>}
                  </span>
                  <span className={`font-mono text-sm font-bold shrink-0 ${theme.text}`}>{formatCurrency(g.total)}</span>
                </button>
                {isOpen && (
                  <div className="space-y-2 p-3 pt-0">
                    {g.items.map((tx: any) => (
                      <TransactionRow key={tx.id} tx={tx} theme={theme} currentTheme={currentTheme} formatCurrency={formatCurrency} todayStr={todayStr}
                        ownerName={ownerName(tx.ownerId)} paidByName={paidByLabel(tx, ownerName)} onTogglePay={onTogglePay} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
