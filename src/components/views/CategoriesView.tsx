'use client'

import { useMemo } from 'react'
import { Target, ListOrdered, Settings2 } from 'lucide-react'
import { CATEGORY_KIND_LABEL, resolveCategoryKind } from '@/utils/categoryKinds'

// Quanto foi gasto em cada categoria no período (e na visão) selecionados,
// contra a meta mensal, com o tipo de cada uma (gasto, investimento, fatura...).
export function CategoriesView({ theme, formatCurrency, categories, stats, onOpenBudget, onViewTransactions, onManage }: any) {
  const rows = useMemo(() => {
    const spent = new Map<string, number>((stats || []).map((s: any) => [s.id, Number(s.value) || 0]))
    return (categories || [])
      .filter((c: any) => c.type === 'expense')
      .map((c: any) => ({ ...c, spent: spent.get(c.id) || 0, budgetNum: Number(c.budget || 0), kind: resolveCategoryKind(c) }))
      .sort((a: any, b: any) => b.spent - a.spent || a.name.localeCompare(b.name, 'pt-BR'))
  }, [categories, stats])

  const totalSpent = rows.reduce((s: number, r: any) => s + r.spent, 0)
  const withSpend = rows.filter((r: any) => r.spent > 0 || r.budgetNum > 0)
  const empty = rows.filter((r: any) => r.spent === 0 && r.budgetNum === 0)

  const card = (r: any) => {
    const pct = r.budgetNum > 0 ? Math.min((r.spent / r.budgetNum) * 100, 100) : 0
    const over = r.budgetNum > 0 && r.spent > r.budgetNum
    const barColor = over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
    return (
      <div key={r.id} className={`${theme.card} border rounded-2xl p-4 space-y-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`font-bold truncate ${theme.text}`}>{r.name}</h3>
            {r.kind !== 'operational' && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">{CATEGORY_KIND_LABEL[r.kind as keyof typeof CATEGORY_KIND_LABEL]}</span>}
          </div>
          <div className="text-right shrink-0">
            <p className={`font-mono font-bold ${over ? 'text-red-500' : theme.text}`}>{formatCurrency(r.spent)}</p>
            {totalSpent > 0 && r.spent > 0 && <p className={`text-[10px] ${theme.textMuted}`}>{Math.round((r.spent / totalSpent) * 100)}% do total</p>}
          </div>
        </div>

        {r.budgetNum > 0 ? (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-black/5 overflow-hidden"><div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} /></div>
            <p className={`text-[11px] ${over ? 'text-red-500 font-bold' : theme.textMuted}`}>
              {over ? `Estourou a meta em ${formatCurrency(r.spent - r.budgetNum)}` : `${formatCurrency(r.budgetNum - r.spent)} restantes da meta de ${formatCurrency(r.budgetNum)}`}
            </p>
          </div>
        ) : (
          <p className={`text-[11px] ${theme.textMuted}`}>Sem meta definida.</p>
        )}

        <div className="flex gap-3">
          <button onClick={() => onViewTransactions(r.id)} className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1"><ListOrdered className="w-3.5 h-3.5" /> Ver lançamentos</button>
          <button onClick={() => onOpenBudget(r)} className="text-xs font-bold text-purple-500 hover:underline flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {r.budgetNum > 0 ? 'Editar meta' : 'Definir meta'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className={`text-2xl font-bold ${theme.text}`}>Categorias</h1>
          <p className={`text-sm ${theme.textMuted}`}>Gasto por categoria no período · total {formatCurrency(totalSpent)}</p>
        </div>
        <button onClick={onManage} className={`text-xs font-bold flex items-center gap-1.5 px-3 py-2 rounded-full border ${theme.buttonSecondary}`}><Settings2 className="w-3.5 h-3.5" /> Gerenciar categorias</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{withSpend.map(card)}</div>
      {withSpend.length === 0 && <p className={`text-sm text-center py-12 ${theme.textMuted}`}>Nenhum gasto por categoria neste período.</p>}

      {empty.length > 0 && (
        <details className="group">
          <summary className={`cursor-pointer text-sm font-bold ${theme.textMuted}`}>{empty.length} categoria(s) sem gasto neste período</summary>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3">{empty.map(card)}</div>
        </details>
      )}
    </div>
  )
}
