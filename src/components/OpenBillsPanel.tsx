'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Check, ChevronDown, Clock } from 'lucide-react'
import { getOpenFixedBills, toggleTransactionStatus } from '@/app/actions'
import { todayDateStr } from '@/utils/dates'

// 🔥 CORRIGIDO: antes esse painel ignorava de propósito o filtro de mês do
// topo (mostrava vencidas + o que vencia nos próximos 15 dias, não importava
// o período escolhido) — o usuário achou confuso ver contas de um mês nem
// selecionado. Agora respeita o mesmo range de mês/ano do filtro principal.
//
// 🔥 NOVO: visual refeito e as contas separadas em dois grupos — "Vencidas"
// (data antes de hoje, da mais antiga pra mais nova) e "A vencer" (hoje em
// diante) —, cada um com a própria soma.
const STORAGE_KEY = 'kore:openBillsExpanded'

// Dias entre duas datas 'AAAA-MM-DD' (to - from), sem se perder com fuso/horário de verão.
function daysBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}

export function OpenBillsPanel({ theme, formatCurrency, onChanged, refreshKey, startMonth, startYear, endMonth, endYear, viewMode = 'all', startExpanded = false }: any) {
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Começa recolhido (o painel ocupava muito espaço); a escolha fica salva no navegador.
  const [expanded, setExpanded] = useState(!!startExpanded)

  useEffect(() => {
    if (startExpanded) return
    try { setExpanded(localStorage.getItem(STORAGE_KEY) === '1') } catch { /* sem localStorage: segue recolhido */ }
  }, [startExpanded])

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev
      if (!startExpanded) { try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* ignora */ } }
      return next
    })
  }

  async function load() {
    setLoading(true)
    const result = await getOpenFixedBills(startMonth, startYear, endMonth, endYear, viewMode)
    setBills(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey, startMonth, startYear, endMonth, endYear, viewMode])

  async function handleTogglePay(id: string, currentStatus: boolean) {
    await toggleTransactionStatus(id, currentStatus)
    load()
    onChanged?.()
  }

  if (loading || bills.length === 0) return null

  const today = todayDateStr()
  const sumOf = (list: any[]) => list.reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0)
  const byDate = (a: any, b: any) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  const overdue = bills.filter((tx: any) => tx.date < today).sort(byDate)
  const upcoming = bills.filter((tx: any) => tx.date >= today).sort(byDate)
  const overdueTotal = sumOf(overdue)
  const upcomingTotal = sumOf(upcoming)
  const totalOpen = overdueTotal + upcomingTotal

  const renderRow = (tx: any, late: boolean) => {
    const dateLabel = tx.date.split('-').reverse().slice(0, 2).join('/')
    const diff = daysBetween(tx.date, today) // >0 atrasada, 0 hoje, <0 falta
    const isToday = diff === 0
    const when = late
      ? `Venceu em ${dateLabel} · há ${diff} ${diff === 1 ? 'dia' : 'dias'}`
      : isToday
        ? 'Vence hoje'
        : `Vence em ${dateLabel} · em ${-diff} ${-diff === 1 ? 'dia' : 'dias'}`
    return (
      <div
        key={tx.id}
        className={`flex items-center gap-3 rounded-xl border p-2.5 pr-3.5 transition-colors border-black/5 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5 ${late ? 'border-l-[3px] border-l-red-500' : isToday ? 'border-l-[3px] border-l-amber-500' : ''}`}
      >
        <button
          type="button"
          onClick={() => handleTogglePay(tx.id, tx.isPaid)}
          className="group w-7 h-7 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center text-transparent hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all"
          title="Dar baixa (marcar como paga)"
          aria-label={`Dar baixa em ${tx.description}`}
        >
          <Check className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-sm truncate ${theme.text}`}>{tx.description}</p>
          <p className={`text-[11px] font-medium ${late ? 'text-red-500' : isToday ? 'text-amber-500' : theme.textMuted}`}>{when}</p>
        </div>
        <span className={`font-bold font-mono text-sm shrink-0 ${late ? 'text-red-500' : theme.text}`}>{formatCurrency(Math.abs(Number(tx.amount)))}</span>
      </div>
    )
  }

  const renderGroup = (title: string, list: any[], total: number, late: boolean) => {
    if (list.length === 0) return null
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className={`text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${late ? 'text-red-500' : theme.textMuted}`}>
            {late ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {title}
            <span className="font-medium normal-case tracking-normal opacity-80">· {list.length} {list.length === 1 ? 'conta' : 'contas'}</span>
          </p>
          <p className={`text-xs font-bold font-mono ${late ? 'text-red-500' : theme.text}`}>{formatCurrency(total)}</p>
        </div>
        <div className="space-y-1.5">{list.map((tx: any) => renderRow(tx, late))}</div>
      </div>
    )
  }

  return (
    <div className={`${theme.card} border rounded-2xl p-4`}>
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${overdue.length > 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
            <AlertCircle className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className={`block font-bold leading-tight ${theme.text}`}>Contas em Aberto</span>
            <span className={`block text-xs ${theme.textMuted}`}>
              {bills.length} {bills.length === 1 ? 'conta' : 'contas'} · {formatCurrency(totalOpen)} no período selecionado
            </span>
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${theme.textMuted} ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Resumo sempre visível: quanto está vencido e quanto ainda vai vencer */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className={`rounded-xl px-3 py-2 ${overdue.length > 0 ? 'bg-red-500/10' : 'bg-black/[0.03] dark:bg-white/5'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wide ${overdue.length > 0 ? 'text-red-500' : theme.textMuted}`}>Vencidas · {overdue.length}</p>
          <p className={`font-bold font-mono text-base ${overdue.length > 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(overdueTotal)}</p>
        </div>
        <div className="rounded-xl px-3 py-2 bg-black/[0.03] dark:bg-white/5">
          <p className={`text-[10px] font-bold uppercase tracking-wide ${theme.textMuted}`}>A vencer · {upcoming.length}</p>
          <p className={`font-bold font-mono text-base ${theme.text}`}>{formatCurrency(upcomingTotal)}</p>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 mt-4 max-h-[28rem] overflow-y-auto pr-1">
          {renderGroup('Vencidas', overdue, overdueTotal, true)}
          {renderGroup('A vencer', upcoming, upcomingTotal, false)}
        </div>
      )}
    </div>
  )
}
