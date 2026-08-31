'use client'

import { useMemo, useState } from 'react'
import { X, Loader2, ArrowDownRight, ArrowUpRight, Briefcase, User, Calculator, Tag, ToggleLeft, ToggleRight } from 'lucide-react'

// 🔥 NOVO: modal genérico que "prova" um dos 4 cards do topo do dashboard —
// mostra a lista de lançamentos que somados chegam no valor exibido no card,
// pra você poder clicar e conferir de onde veio aquele número. Agora também
// mostra o valor por categoria (antes da lista item a item), e dá pra clicar
// numa categoria pra filtrar só os lançamentos dela na lista de baixo.
export function BreakdownModal({
  title,
  description,
  mode,
  transactions,
  grossTransactions,
  categories,
  formatCurrency,
  loading,
  onClose,
  onEditTransaction,
}: {
  title: string
  description: string
  mode: 'income' | 'expense' | 'balance' | 'invested'
  transactions: any[]
  // 🔥 NOVO: versão "bruta" opcional (inclui Cartão de Crédito, Investimentos
  // e Reembolsos) — só faz sentido pros modos income/expense, já que balance
  // e invested já não excluem essas categorias. Quando presente, mostra um
  // toggle "incluir cartão/investimentos/reembolsos" no topo do modal.
  grossTransactions?: any[]
  categories: any[]
  formatCurrency: (v: number) => string
  loading?: boolean
  onClose: () => void
  onEditTransaction?: (tx: any) => void
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [includeGross, setIncludeGross] = useState(false)

  const hasGrossToggle = !!grossTransactions && (mode === 'income' || mode === 'expense') && grossTransactions.length !== transactions.length
  const transactionsToShow = includeGross && grossTransactions ? grossTransactions : transactions

  const incomeSum = transactionsToShow.filter((t) => t.type === 'income').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const expenseSum = transactionsToShow.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const categoryName = (id: string | null) => categories.find((c: any) => c.id === id)?.name || 'Sem categoria'

  // 🔥 NOVO: agrupa os lançamentos por categoria pra mostrar o total de cada
  // uma antes da lista detalhada (não faz sentido no modo "invested", que é
  // sempre uma única categoria — Investimentos).
  const categoryBreakdown = useMemo(() => {
    if (mode === 'invested') return []
    const map = new Map<string, { id: string; income: number; expense: number; count: number }>()
    transactionsToShow.forEach((t: any) => {
      const id = t.categoryId || 'none'
      if (!map.has(id)) map.set(id, { id, income: 0, expense: 0, count: 0 })
      const entry = map.get(id)!
      if (t.type === 'income') entry.income += Math.abs(Number(t.amount))
      else entry.expense += Math.abs(Number(t.amount))
      entry.count += 1
    })
    const totalForPercent = mode === 'income' ? incomeSum : mode === 'expense' ? expenseSum : incomeSum + expenseSum
    return Array.from(map.values())
      .map((e) => {
        const net = e.income - e.expense
        const value = mode === 'income' ? e.income : mode === 'expense' ? e.expense : Math.abs(net)
        return {
          ...e,
          name: e.id === 'none' ? 'Sem categoria' : categoryName(e.id),
          net,
          value,
          percent: totalForPercent > 0 ? (value / totalForPercent) * 100 : 0,
        }
      })
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionsToShow, categories, mode])

  const visibleTransactions = activeCategory
    ? transactionsToShow.filter((t: any) => (t.categoryId || 'none') === activeCategory)
    : transactionsToShow

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">

        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Calculator className="w-5 h-5 text-blue-500" /> {title}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-2">{description}</p>

        {hasGrossToggle && (
          <button
            type="button"
            onClick={() => setIncludeGross(!includeGross)}
            className="w-full flex items-center justify-between gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 mb-4 text-left hover:border-zinc-700 transition-colors"
          >
            <span className="text-[11px] font-medium text-zinc-400">Incluir cartão de crédito, investimentos e reembolsos</span>
            {includeGross ? <ToggleRight className="w-5 h-5 text-blue-500 shrink-0" /> : <ToggleLeft className="w-5 h-5 text-zinc-600 shrink-0" />}
          </button>
        )}

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : (
          <>
            {/* RESUMO DA CONTA */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-4 space-y-1.5">
              {mode === 'balance' && (
                <>
                  <div className="flex justify-between text-sm"><span className="text-zinc-400">Entradas</span><span className="font-mono font-bold text-emerald-500">{formatCurrency(incomeSum)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-400">Saídas</span><span className="font-mono font-bold text-red-500">- {formatCurrency(expenseSum)}</span></div>
                  <div className="flex justify-between text-sm pt-1.5 border-t border-zinc-800"><span className="text-zinc-300 font-bold">Saldo</span><span className="font-mono font-bold text-white">{formatCurrency(incomeSum - expenseSum)}</span></div>
                </>
              )}
              {mode === 'invested' && (
                <>
                  <div className="flex justify-between text-sm"><span className="text-zinc-400">Aportes (saíram pra investir)</span><span className="font-mono font-bold text-purple-400">{formatCurrency(expenseSum)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-400">Resgates (voltaram da conta de investimento)</span><span className="font-mono font-bold text-emerald-500">- {formatCurrency(incomeSum)}</span></div>
                  <div className="flex justify-between text-sm pt-1.5 border-t border-zinc-800"><span className="text-zinc-300 font-bold">Total investido</span><span className="font-mono font-bold text-white">{formatCurrency(expenseSum - incomeSum)}</span></div>
                </>
              )}
              {mode === 'income' && (
                <div className="flex justify-between text-sm"><span className="text-zinc-300 font-bold">Total</span><span className="font-mono font-bold text-emerald-500">{formatCurrency(incomeSum)}</span></div>
              )}
              {mode === 'expense' && (
                <div className="flex justify-between text-sm"><span className="text-zinc-300 font-bold">Total</span><span className="font-mono font-bold text-red-500">{formatCurrency(expenseSum)}</span></div>
              )}
              <p className="text-[10px] text-zinc-600 pt-0.5">{transactionsToShow.length} lançamento{transactionsToShow.length === 1 ? '' : 's'}</p>
            </div>

            {/* 🔥 NOVO: POR CATEGORIA (antes da lista detalhada) */}
            {categoryBreakdown.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase flex items-center gap-1.5 mb-2">
                  <Tag className="w-3.5 h-3.5" /> Por categoria
                  {activeCategory && (
                    <button onClick={() => setActiveCategory(null)} className="ml-auto normal-case font-medium text-blue-400 hover:text-blue-300 text-[11px]">
                      limpar filtro
                    </button>
                  )}
                </h3>
                <div className="space-y-1.5">
                  {categoryBreakdown.map((c) => {
                    const isActive = activeCategory === c.id
                    const barColor = mode === 'balance' ? (c.net >= 0 ? 'bg-emerald-500' : 'bg-red-500') : mode === 'income' ? 'bg-emerald-500' : 'bg-red-500'
                    const valueColor = mode === 'balance' ? (c.net >= 0 ? 'text-emerald-500' : 'text-red-500') : mode === 'income' ? 'text-emerald-500' : 'text-red-500'
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveCategory(isActive ? null : c.id)}
                        className={`w-full text-left rounded-lg p-2.5 border transition-colors ${isActive ? 'bg-blue-500/10 border-blue-500/40' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-zinc-200 truncate">{c.name} <span className="text-zinc-600 font-normal">({c.count})</span></span>
                          <span className={`font-mono text-xs font-bold whitespace-nowrap ${valueColor}`}>{mode === 'balance' && c.net < 0 ? '- ' : ''}{formatCurrency(Math.abs(mode === 'balance' ? c.net : c.value))}</span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, c.percent)}%` }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* LISTA DE LANÇAMENTOS */}
            <div className="space-y-2">
              {visibleTransactions.map((tx: any) => {
                const isIncome = tx.type === 'income'
                const label = mode === 'invested' ? (isIncome ? 'Resgate' : 'Aporte') : categoryName(tx.categoryId)
                return (
                  <div
                    key={tx.id}
                    onClick={onEditTransaction ? () => onEditTransaction(tx) : undefined}
                    className={`flex items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3 ${onEditTransaction ? 'cursor-pointer hover:border-blue-500/40 transition-colors' : ''}`}
                    title={onEditTransaction ? 'Clique para editar este lançamento' : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                        {isIncome ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{tx.description}</p>
                        <p className="text-[10px] font-bold uppercase flex items-center gap-1 text-zinc-500">
                          {tx.entityType === 'pj' ? <Briefcase className="w-3 h-3 text-blue-500" /> : <User className="w-3 h-3 opacity-50" />}
                          {tx.date.split('-').reverse().join('/')} • {label}
                        </p>
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-bold whitespace-nowrap shrink-0 ${isIncome ? 'text-emerald-500' : 'text-red-500'}`}>{isIncome ? '' : '- '}{formatCurrency(Math.abs(Number(tx.amount)))}</span>
                  </div>
                )
              })}
              {visibleTransactions.length === 0 && <p className="text-sm text-zinc-500 text-center py-8">Nenhum lançamento nesse total.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
