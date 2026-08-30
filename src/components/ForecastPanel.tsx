'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { getFinancialForecast } from '@/app/forecastActions'

// "Vou conseguir pagar tudo esse mês?" — soma contas fixas em aberto +
// faturas de cartão (abertas + atrasadas) e compara com a receita esperada.
export function ForecastPanel({ theme, formatCurrency, refreshKey }: any) {
  const [forecast, setForecast] = useState<any>(null)

  useEffect(() => {
    getFinancialForecast().then((res) => { if (res.success) setForecast(res) })
  }, [refreshKey])

  if (!forecast) return null

  const isPositive = forecast.projectedBalance >= 0

  return (
    <div className={`${theme.card} border rounded-2xl p-4 md:p-6`}>
      <h3 className={`font-bold flex items-center gap-2 mb-1 ${theme.text}`}>
        {isPositive ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
        Previsão do Mês
      </h3>
      <p className={`text-xs mb-4 ${theme.textMuted}`}>
        Receita esperada menos contas fixas em aberto e faturas de cartão (abertas + atrasadas).
        {forecast.incomeSource === 'media_3_meses' && ' Receita estimada pela média dos últimos 3 meses, já que nada foi lançado neste mês ainda.'}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <p className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>Receita esperada</p>
          <p className="font-mono font-bold text-emerald-500">{formatCurrency(forecast.expectedIncome)}</p>
        </div>
        <div>
          <p className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>Contas fixas</p>
          <p className="font-mono font-bold text-red-400">{formatCurrency(forecast.fixedBillsTotal)}</p>
        </div>
        <div>
          <p className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>Faturas de cartão</p>
          <p className="font-mono font-bold text-red-400">{formatCurrency(forecast.cardInvoicesTotal)}</p>
        </div>
        <div>
          <p className={`text-[10px] uppercase font-bold ${theme.textMuted}`}>{isPositive ? 'Sobra estimada' : 'Falta estimada'}</p>
          <p className={`font-mono font-bold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>{formatCurrency(Math.abs(forecast.projectedBalance))}</p>
        </div>
      </div>
    </div>
  )
}
