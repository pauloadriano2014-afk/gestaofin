'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Circle, ChevronDown } from 'lucide-react'
import { getOpenFixedBills, toggleTransactionStatus } from '@/app/actions'
import { todayDateStr } from '@/utils/dates'

// 🔥 CORRIGIDO: antes esse painel ignorava de propósito o filtro de mês do
// topo (mostrava vencidas + o que vencia nos próximos 15 dias, não importava
// o período escolhido) — o usuário achou confuso ver contas de um mês nem
// selecionado. Agora respeita o mesmo range de mês/ano do filtro principal.
const STORAGE_KEY = 'kore:openBillsExpanded'

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
  const lateCount = bills.filter((tx: any) => tx.date < today).length
  const totalOpen = bills.reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount)), 0)

  return (
    <div className={`${theme.card} border rounded-2xl p-4`}>
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className={`font-bold flex items-center gap-2 flex-wrap ${theme.text}`}>
          <AlertCircle className={`w-4 h-4 shrink-0 ${lateCount > 0 ? 'text-red-500' : 'text-amber-500'}`} />
          Contas em Aberto
          <span className={`text-xs font-normal ${theme.textMuted}`}>
            {bills.length} {bills.length === 1 ? 'conta' : 'contas'} · {formatCurrency(totalOpen)}
          </span>
          {lateCount > 0 && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
              {lateCount} {lateCount === 1 ? 'vencida' : 'vencidas'}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${theme.textMuted} ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <>
          <p className={`text-[10px] mt-2 ${theme.textMuted}`}>do período selecionado acima</p>
      <div className="space-y-2 mt-3 max-h-80 overflow-y-auto pr-1">
        {bills.map((tx: any) => {
          const isLate = tx.date < today
          const isToday = tx.date === today
          const dateLabel = tx.date.split('-').reverse().join('/')
          return (
            <div key={tx.id} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${isLate ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-800/50'}`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTogglePay(tx.id, tx.isPaid)}
                  className="p-1.5 rounded-full text-slate-400 bg-slate-100/50 hover:text-orange-500 transition-all"
                  title="Dar baixa"
                >
                  <Circle className="w-5 h-5" />
                </button>
                <div>
                  <p className={`font-semibold text-sm ${theme.text}`}>{tx.description}</p>
                  <p className={`text-[10px] font-bold uppercase ${isLate ? 'text-red-500' : isToday ? 'text-amber-500' : theme.textMuted}`}>
                    {isLate ? `Venceu em ${dateLabel}` : isToday ? 'Vence hoje' : `Vence em ${dateLabel}`}
                  </p>
                </div>
              </div>
              <span className={`font-bold font-mono text-sm ${isLate ? 'text-red-500' : theme.text}`}>{formatCurrency(Number(tx.amount))}</span>
            </div>
          )
        })}
      </div>
        </>
      )}
    </div>
  )
}
