'use client'

import { paidByLabel } from '@/utils/paidBy'
import { useMemo, useState } from 'react'
import { Search, X, Loader2, ArrowRightLeft, Tag, Trash2, Filter, CreditCard, ChevronDown, Check } from 'lucide-react'
import { TransactionRow } from '@/components/TransactionRow'
import { filterTransactions, summarizeTxs, hasActiveFilters, EMPTY_FILTERS, type TxFilters, type QuickFilter } from '@/utils/txFilters'
import { groupCardItems, type ListEntry } from '@/utils/cardGroups'
import { reassignTransactions } from '@/app/creditCardActions'
import { setTransactionsCategory, deleteTransactions } from '@/app/actions'

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

  const set = (patch: Partial<TxFilters>) => { onFilters({ ...filters, ...patch }); setLimit(PAGE) }
  const rows = useMemo(
    () => filterTransactions(txs, filters).sort((a: any, b: any) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [txs, filters]
  )
  const totals = useMemo(() => summarizeTxs(rows), [rows])
  // Com busca ou atalho de conferência ativos, mostra tudo solto (o usuário está procurando algo).
  const groupActive = groupCards && !filters.search.trim() && filters.quick === 'todos'
  const entries: ListEntry[] = useMemo(
    () => (groupActive ? groupCardItems(rows, cards) : rows.map((tx: any) => ({ kind: 'tx' as const, tx, sortDate: tx.date }))),
    [groupActive, rows, cards]
  )
  const visible = entries.slice(0, limit)
  const visibleIds: string[] = visible.flatMap((e) => (e.kind === 'tx' ? [e.tx.id] : e.items.map((i: any) => i.id)))
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

      <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer w-fit ${theme.textMuted}`}>
        <input type="checkbox" checked={groupCards} onChange={(e) => setGroupCards(e.target.checked)} className="accent-purple-600" />
        Agrupar compras do cartão por fatura
      </label>

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
              {sortedCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button disabled={!bulkCategory || busy} onClick={() => run(() => setTransactionsCategory(selectedIds, bulkCategory))} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${theme.button} disabled:opacity-40`}>
              <Tag className="w-3.5 h-3.5" /> Aplicar
            </button>
            <button disabled={busy} onClick={() => { if (confirm(`Excluir ${selectedIds.length} lançamento(s)? Isso não pode ser desfeito.`)) run(() => deleteTransactions(selectedIds)) }} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-40 ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {rows.length > 0 && (
        <button onClick={toggleAll} className={`text-xs font-bold ${theme.textMuted} hover:underline`}>{allVisibleSelected ? 'Desmarcar todos' : 'Marcar todos os exibidos'}</button>
      )}
      <div className="space-y-2">
        {visible.map((entry) => {
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
      {entries.length > limit && (
        <button onClick={() => setLimit(limit + PAGE)} className={`w-full py-3 text-sm font-bold rounded-xl border ${theme.buttonSecondary}`}>Mostrar mais ({entries.length - limit} restantes)</button>
      )}
    </div>
  )
}
