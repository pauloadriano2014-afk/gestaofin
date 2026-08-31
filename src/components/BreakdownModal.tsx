'use client'

import { X, Loader2, ArrowDownRight, ArrowUpRight, Briefcase, User, Calculator } from 'lucide-react'

// 🔥 NOVO: modal genérico que "prova" um dos 4 cards do topo do dashboard —
// mostra a lista de lançamentos que somados chegam no valor exibido no card,
// pra você poder clicar e conferir de onde veio aquele número.
export function BreakdownModal({
  title,
  description,
  mode,
  transactions,
  categories,
  formatCurrency,
  loading,
  onClose,
}: {
  title: string
  description: string
  mode: 'income' | 'expense' | 'balance' | 'invested'
  transactions: any[]
  categories: any[]
  formatCurrency: (v: number) => string
  loading?: boolean
  onClose: () => void
}) {
  const incomeSum = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const expenseSum = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

  const categoryName = (id: string | null) => categories.find((c: any) => c.id === id)?.name || 'Sem categoria'

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

        <p className="text-xs text-zinc-500 mb-4">{description}</p>

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
              <p className="text-[10px] text-zinc-600 pt-0.5">{transactions.length} lançamento{transactions.length === 1 ? '' : 's'}</p>
            </div>

            {/* LISTA DE LANÇAMENTOS */}
            <div className="space-y-2">
              {transactions.map((tx: any) => {
                const isIncome = tx.type === 'income'
                const label = mode === 'invested' ? (isIncome ? 'Resgate' : 'Aporte') : categoryName(tx.categoryId)
                return (
                  <div key={tx.id} className="flex items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
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
              {transactions.length === 0 && <p className="text-sm text-zinc-500 text-center py-8">Nenhum lançamento nesse total.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
