'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Circle } from 'lucide-react'
import { getOpenFixedBills, toggleTransactionStatus } from '@/app/actions'
import { todayDateStr } from '@/utils/dates'

// 🔥 CORRIGIDO: antes esse painel ignorava de propósito o filtro de mês do
// topo (mostrava vencidas + o que vencia nos próximos 15 dias, não importava
// o período escolhido) — o usuário achou confuso ver contas de um mês nem
// selecionado. Agora respeita o mesmo range de mês/ano do filtro principal.
export function OpenBillsPanel({ theme, formatCurrency, onChanged, refreshKey, startMonth, startYear, endMonth, endYear }: any) {
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const result = await getOpenFixedBills(startMonth, startYear, endMonth, endYear)
    setBills(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey, startMonth, startYear, endMonth, endYear])

  async function handleTogglePay(id: string, currentStatus: boolean) {
    await toggleTransactionStatus(id, currentStatus)
    load()
    onChanged?.()
  }

  if (loading || bills.length === 0) return null

  const today = todayDateStr()

  return (
    <div className={`${theme.card} border rounded-2xl p-4`}>
      <h3 className={`font-bold flex items-center gap-2 mb-3 ${theme.text}`}>
        <AlertCircle className="w-4 h-4 text-red-500" /> Contas em Aberto
        <span className={`text-[10px] font-normal normal-case ${theme.textMuted}`}>(do período selecionado acima)</span>
      </h3>
      <div className="space-y-2">
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
    </div>
  )
}
