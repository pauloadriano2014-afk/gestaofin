'use client'

import { paidByLabel } from '@/utils/paidBy'
import { useEffect, useMemo, useState } from 'react'
import { Search, X, Loader2, ArrowRightLeft, Tag, Trash2, Filter, CreditCard, ChevronDown, Check } from 'lucide-react'
import { TransactionRow } from '@/components/TransactionRow'
import { filterTransactions, summarizeTxs, hasActiveFilters, EMPTY_FILTERS, type TxFilters, type QuickFilter } from '@/utils/txFilters'
import { groupCardItems, type ListEntry } from '@/utils/cardGroups'
import { reassignTransactions } from '@/app/creditCardActions'
import { setTransactionsCategory, deleteTransactions, suggestCategoriesForTransactions } from '@/app/actions'

const PAGE = 150

const QUICK: { id: QuickFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendentes', label: 'Pendentes' },
  { id: 'sem-categoria', label: 'Sem categoria' },
  { id: 'sem-dono', label: 'Sem dono' },
  { id: 'duplicados', label: 'Possíveis duplicados' },
]

// Extrato completo do período, com busca, filtros e seleção em massa
// (mover de dono, trocar categoria, excluir).
export function TransactionsView({
  theme, currentTheme, formatCurrency, txs, categories, owners, accounts, cards, todayStr,
  filters, onFilters, onTogglePay, onEdit, onDelete, onChanged,
}: any) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(PAGE)
  const [busy, setBusy] = useState(false)
  const [bulkOwner, setBulkOwner] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  // Compras do cartão agrupadas numa linha por fatura (menos poluição); abre quando quiser.
  const [groupCards, setGroupCards] = useState(true)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  // 🔥 NOVO: com "Todas as categorias", em vez de uma lista enorme aparecem cartões compactos,
  // um por categoria (quantidade e total). Clicar abre uma janela com os lançamentos dela.
  const [groupByCategory, setGroupByCategory] = useState(true)
  const [openCat, setOpenCat] = useState<string | null>(null)

  const set = (patch: Partial<TxFilters>) => { onFilters({ ...filters, ...patch }); setLimit(PAGE) }
  const rows = useMemo(
    () => filterTransactions(txs, filters).sort((a: any, b: any) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [txs, filters]
  )
  const totals = useMemo(() => summarizeTxs(rows), [rows])
  // Com busca ou atalho de conferência ativos, mostra tudo solto (o usuário está procurando algo).
  // Separar por categoria só faz sentido quando nenhuma categoria específica foi escolhida.
  // Nesse modo as compras do cartão aparecem soltas, cada uma na sua categoria (a fatura mistura categorias).
  const categoryMode = groupByCategory && filters.categoryId === 'all'
  const groupActive = !categoryMode && groupCards && !filters.search.trim() && filters.quick === 'todos'
  const entries: ListEntry[] = useMemo(
    () => (groupActive ? groupCardItems(rows, cards) : rows.map((tx: any) => ({ kind: 'tx' as const, tx, sortDate: tx.date }))),
    [groupActive, rows, cards]
  )

  // Seções por categoria: maiores movimentações primeiro, "Sem categoria" por último.
  const sections: any[] = useMemo(() => {
    if (!categoryMode) return []
    const round2 = (n: number) => Math.round(n * 100) / 100
    const byKey = new Map<string, { key: string; name: string; rows: any[]; income: number; expense: number }>()
    for (const tx of rows) {
      const key = tx.categoryId || '__none__'
      let s = byKey.get(key)
      if (!s) {
        const name = tx.categoryId ? (categories.find((c: any) => c.id === tx.categoryId)?.name || 'Categoria removida') : 'Sem categoria'
        s = { key, name, rows: [], income: 0, expense: 0 }
        byKey.set(key, s)
      }
      const amount = Math.abs(Number(tx.amount))
      if (tx.type === 'income') s.income += amount
      else if (tx.type === 'expense') s.expense += amount
      s.rows.push(tx)
    }
    return Array.from(byKey.values())
      .map((s) => ({ ...s, income: round2(s.income), expense: round2(s.expense), net: round2(s.income - s.expense), weight: s.income + s.expense }))
      .sort((a, b) => (a.key === '__none__' ? 1 : b.key === '__none__' ? -1 : b.weight - a.weight || a.name.localeCompare(b.name, 'pt-BR')))
  }, [categoryMode, rows, categories])

  const maxWeight = sections.reduce((m: number, s: any) => Math.max(m, Number(s.weight)), 0)
  // A categoria aberta é sempre lida da lista atual: baixa/exclusão feitas na janela já aparecem nela.
  const openSection: any = categoryMode && openCat ? sections.find((s: any) => s.key === openCat) || null : null

  useEffect(() => {
    if (!openSection) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenCat(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSection])

  const visible = entries.slice(0, limit)
  const visibleIds: string[] = categoryMode ? [] : visible.flatMap((e) => (e.kind === 'tx' ? [e.tx.id] : e.items.map((i: any) => i.id)))
  const ownerName = (id: string) => owners.find((o: any) => o.id === id)?.name || ''
  const cardName = (id: string) => cards.find((c: any) => c.id === id)?.name || ''
  const selectedIds = Array.from(selected).filter((id) => rows.some((r: any) => r.id === id))

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))
  const toggleGroupSelect = (ids: string[]) => setSelected((prev) => {
    const n = new Set(prev); const all = ids.every((id) => n.has(id)); ids.forEach((id) => (all ? n.delete(id) : n.add(id))); return n
  })
  const toggleGroupOpen = (key: string) => setOpenGroups((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  // Do cartão da categoria para a lista completa (onde dá para marcar vários e agir em massa).
  const openFullList = (s: any) => {
    setOpenCat(null)
    if (s.key === '__none__') set({ quick: 'sem-categoria' })
    else set({ categoryId: s.key })
  }
  // Editar fecha a janela antes: a tela de edição abre por cima da página.
  const editFromModal = (tx: any) => { setOpenCat(null); onEdit?.(tx) }

  async function run(action: () => Promise<any>, okMessage?: string) {
    setBusy(true)
    const res = await action()
    setBusy(false)
    if (res?.success) { setSelected(new Set()); setBulkOwner(''); setBulkCategory(''); onChanged?.(); if (okMessage) alert(okMessage) }
    else alert(res?.message || 'Não foi possível concluir a ação.')
  }

  const input = `${theme.card} ${theme.text} border rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500`
  const sortedCategories = [...categories].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className={`text-2xl font-bold ${theme.text}`}>Lançamentos</h1>
          <p className={`text-sm ${theme.textMuted}`}>
            {totals.count} lançamento(s) · entradas {formatCurrency(totals.income)} · saídas {formatCurrency(totals.expense)}
          </p>
        </div>
        {hasActiveFilters(filters) && (
          <button onClick={() => { onFilters(EMPTY_FILTERS); setLimit(PAGE) }} className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-full border ${theme.buttonSecondary}`}>
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* ATALHOS DE CONFERÊNCIA */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {QUICK.map((q) => (
          <button key={q.id} onClick={() => set({ quick: q.id })} className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${filters.quick === q.id ? theme.navActive + ' border-transparent' : `${theme.card} ${theme.navInactive}`}`}>{q.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer w-fit ${theme.textMuted}`}>
          <input type="checkbox" checked={groupByCategory} onChange={(e) => setGroupByCategory(e.target.checked)} className="accent-purple-600" />
          Separar por categoria
        </label>
        <label className={`flex items-center gap-2 text-xs font-bold w-fit ${categoryMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${theme.textMuted}`} title={categoryMode ? 'Desligado enquanto a lista está separada por categoria' : undefined}>
          <input type="checkbox" checked={groupCards} disabled={categoryMode} onChange={(e) => setGroupCards(e.target.checked)} className="accent-purple-600" />
          Agrupar compras do cartão por fatura
        </label>
      </div>

      {/* BUSCA E FILTROS */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-[12rem] ${theme.card}`}>
          <Search className={`w-4 h-4 shrink-0 ${theme.textMuted}`} />
          <input value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder="Buscar por descrição ou valor" className={`w-full bg-transparent text-sm outline-none ${theme.text}`} />
        </div>
        <Filter className={`w-4 h-4 hidden sm:block ${theme.textMuted}`} />
        <select value={filters.type} onChange={(e) => set({ type: e.target.value as any })} className={input}>
          <option value="all">Entradas e saídas</option><option value="income">Só entradas</option><option value="expense">Só saídas</option><option value="transfer">Transferências</option>
        </select>
        <select value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={input}>
          <option value="all">Todas as categorias</option>
          {sortedCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => set({ status: e.target.value as any })} className={input}>
          <option value="all">Pagas e pendentes</option><option value="paid">Só pagas</option><option value="pending">Só pendentes</option>
        </select>
        <select value={filters.origin} onChange={(e) => set({ origin: e.target.value as any })} className={input}>
          <option value="all">Cartão e conta</option><option value="card">Só cartão</option><option value="no-card">Sem cartão</option>
        </select>
        {accounts.length > 0 && (
          <select value={filters.accountId} onChange={(e) => set({ accountId: e.target.value })} className={input}>
            <option value="all">Todas as contas</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {/* SELEÇÃO EM MASSA */}
      {selectedIds.length > 0 && (
        <div className={`sticky top-[8.5rem] z-20 rounded-xl border p-3 shadow-lg space-y-2 ${theme.card}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className={`text-sm font-bold ${theme.text}`}>{selectedIds.length} selecionado(s)</p>
            <button onClick={() => setSelected(new Set())} className={`text-xs ${theme.textMuted} underline`}>Desmarcar</button>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)} className={input}>
              <option value="">Mudar dono para…</option>
              {owners.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button disabled={!bulkOwner || busy} onClick={() => run(() => reassignTransactions(selectedIds, { ownerId: bulkOwner }))} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${theme.button} disabled:opacity-40`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />} Mover
            </button>
            <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className={input}>
              <option value="">Mudar categoria para…</option>
              {sortedCategories.filter((c: any) => c.name.trim().toLowerCase() !== 'ajuste de saldo').map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button disabled={!bulkCategory || busy} onClick={() => run(() => setTransactionsCategory(selectedIds, bulkCategory))} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${theme.button} disabled:opacity-40`}>
              <Tag className="w-3.5 h-3.5" /> Aplicar
            </button>
            <button disabled={busy} onClick={() => { if (confirm(`Sugerir a categoria de ${selectedIds.length} lançamento(s)? O app usa suas regras e a IA; transferências com o nome de vocês viram Reembolso/Empréstimo. Pagamentos de fatura de cartão devem ficar de fora da seleção.`)) run(async () => { const r: any = await suggestCategoriesForTransactions(selectedIds); if (r?.success) alert(`${r.updated} categorizado(s)${r.skipped ? `, ${r.skipped} ficaram como estavam` : ''}.`); return r }) }} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border ${theme.buttonSecondary} disabled:opacity-40`}>
              <Tag className="w-3.5 h-3.5" /> Sugerir categorias
            </button>
            <button disabled={busy} onClick={() => { if (confirm(`Excluir ${selectedIds.length} lançamento(s)? Isso não pode ser desfeito.`)) run(() => deleteTransactions(selectedIds)) }} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-40 ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {rows.length > 0 && !categoryMode && (
        <button onClick={toggleAll} className={`text-xs font-bold ${theme.textMuted} hover:underline`}>{allVisibleSelected ? 'Desmarcar todos' : 'Marcar todos os exibidos'}</button>
      )}
      <div className="space-y-2">
        {categoryMode && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {sections.map((s: any) => {
              const onlyIncome = s.income > 0 && s.expense === 0
              const onlyExpense = s.expense > 0 && s.income === 0
              const total = onlyIncome ? s.income : onlyExpense ? -s.expense : s.net
              const totalTone = total < 0 ? 'text-red-500' : total > 0 ? 'text-emerald-500' : theme.text
              const barTone = total < 0 ? 'bg-red-500' : total > 0 ? 'bg-emerald-500' : 'bg-slate-400'
              const pct = maxWeight > 0 ? Math.max(4, Math.round((s.weight / maxWeight) * 100)) : 0
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setOpenCat(s.key)}
                  className={`${theme.card} border rounded-2xl p-3.5 text-left flex flex-col gap-2 min-w-0 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  title="Ver os lançamentos desta categoria"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`p-1.5 rounded-lg shrink-0 ${theme.iconBg}`}><Tag className="w-3.5 h-3.5" /></span>
                    <span className={`font-bold text-sm truncate ${theme.text}`}>{s.name}</span>
                  </span>
                  <span className={`font-bold font-mono text-lg leading-tight truncate ${totalTone}`}>{formatCurrency(total)}</span>
                  <span className="h-1 w-full rounded-full bg-slate-500/10 overflow-hidden"><span className={`block h-full rounded-full ${barTone}`} style={{ width: `${pct}%` }} /></span>
                  <span className={`text-[11px] font-semibold ${theme.textMuted}`}>{s.rows.length} {s.rows.length === 1 ? 'lançamento' : 'lançamentos'}</span>
                </button>
              )
            })}
          </div>
        )}
        {!categoryMode && visible.map((entry) => {
          if (entry.kind === 'tx') {
            const tx = entry.tx
            return (
              <TransactionRow
                key={tx.id} tx={tx} theme={theme} currentTheme={currentTheme} formatCurrency={formatCurrency} todayStr={todayStr}
                ownerName={ownerName(tx.ownerId)} paidByName={paidByLabel(tx, ownerName)} cardName={tx.creditCardId ? cardName(tx.creditCardId) : ''}
                onTogglePay={onTogglePay} onEdit={onEdit} onDelete={onDelete}
                selectable selected={selected.has(tx.id)} onSelect={toggle} signedAmount
              />
            )
          }
          const g = entry
          const ids = g.items.map((i: any) => i.id)
          const isOpen = openGroups.has(g.key)
          const allSel = ids.every((id: string) => selected.has(id))
          return (
            <div key={g.key} className={`${theme.card} border rounded-xl ${allSel ? 'ring-1 ring-blue-500/30' : ''}`}>
              <div className="flex items-center gap-3 p-3">
                <button onClick={() => toggleGroupSelect(ids)} aria-label="Selecionar a fatura inteira" className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${allSel ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-transparent hover:border-blue-400'}`}><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => toggleGroupOpen(g.key)} aria-expanded={isOpen} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                  <span className={`p-2 rounded-full shrink-0 ${theme.iconBg}`}><CreditCard className="w-4 h-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold text-sm truncate ${theme.text}`}>Fatura {g.cardName}</span>
                    <span className={`block text-[10px] font-bold uppercase ${theme.textMuted}`}>
                      vence {g.dueDate.split('-').reverse().slice(0, 2).join('/')} · {g.count} {g.count === 1 ? 'item' : 'itens'} · <span className={g.allPaid ? 'text-emerald-600' : 'text-orange-500'}>{g.allPaid ? 'paga' : 'pendente'}</span>
                    </span>
                  </span>
                  <span className={`font-bold font-mono text-sm shrink-0 ${theme.text}`}>{formatCurrency(Math.abs(g.total))}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${theme.textMuted} ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {g.items.map((tx: any) => (
                    <TransactionRow
                      key={tx.id} tx={tx} theme={theme} currentTheme={currentTheme} formatCurrency={formatCurrency} todayStr={todayStr}
                      ownerName={ownerName(tx.ownerId)} paidByName={paidByLabel(tx, ownerName)} onTogglePay={onTogglePay} onEdit={onEdit} onDelete={onDelete}
                      selectable selected={selected.has(tx.id)} onSelect={toggle} signedAmount
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {rows.length === 0 && <p className={`text-sm text-center py-12 ${theme.textMuted}`}>Nenhum lançamento encontrado com esses filtros.</p>}
      </div>
      {!categoryMode && entries.length > limit && (
        <button onClick={() => setLimit(limit + PAGE)} className={`w-full py-3 text-sm font-bold rounded-xl border ${theme.buttonSecondary}`}>Mostrar mais ({entries.length - limit} restantes)</button>
      )}

      {/* JANELA COM OS LANÇAMENTOS DA CATEGORIA ESCOLHIDA */}
      {openSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm" onClick={() => setOpenCat(null)} role="dialog" aria-modal="true" aria-label={`Lançamentos de ${openSection.name}`}>
          <div className={`${theme.card} border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-black/5 dark:border-white/10">
              <div className="min-w-0">
                <h2 className={`text-lg font-bold truncate flex items-center gap-2 ${theme.text}`}><Tag className="w-4 h-4 shrink-0 text-purple-500" /> {openSection.name}</h2>
                <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                  {openSection.rows.length} {openSection.rows.length === 1 ? 'lançamento' : 'lançamentos'}
                  {openSection.income > 0 && <> · entradas <b className="text-emerald-500 font-mono">{formatCurrency(openSection.income)}</b></>}
                  {openSection.expense > 0 && <> · saídas <b className="text-red-500 font-mono">{formatCurrency(openSection.expense)}</b></>}
                </p>
              </div>
              <button onClick={() => setOpenCat(null)} aria-label="Fechar" className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 ${theme.textMuted}`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              {openSection.rows.map((tx: any) => (
                <TransactionRow
                  key={tx.id} tx={tx} theme={theme} currentTheme={currentTheme} formatCurrency={formatCurrency} todayStr={todayStr}
                  ownerName={ownerName(tx.ownerId)} paidByName={paidByLabel(tx, ownerName)} cardName={tx.creditCardId ? cardName(tx.creditCardId) : ''}
                  onTogglePay={onTogglePay} onEdit={editFromModal} onDelete={onDelete} signedAmount
                />
              ))}
            </div>
            <div className="p-3 border-t border-black/5 dark:border-white/10 flex justify-end">
              <button onClick={() => openFullList(openSection)} className={`text-xs font-bold px-3 py-2 rounded-lg border ${theme.buttonSecondary}`} title="Mostra só esta categoria na lista, onde dá para marcar vários e agir em massa">
                Abrir na lista completa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
