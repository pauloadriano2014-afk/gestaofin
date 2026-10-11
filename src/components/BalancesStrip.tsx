'use client'

import { useState } from 'react'
import { Wallet, Scale, User, Building2 } from 'lucide-react'
import { ReconcileBalanceModal } from '@/components/ReconcileBalanceModal'
import { StatementAlignModal } from '@/components/StatementAlignModal'

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// Uma coluna por pessoa/empresa com o MÊS escolhido:
//   Saldo no início do mês  +  Entrou  −  Saiu  =  Saldo no fim do mês (ou hoje)
// Entrou e Saiu são só do mês: outros meses não interferem. O saldo (início e fim) vem do saldo
// que você conferiu uma vez com o banco; sem conferência, mostramos só o que entrou e saiu.
export function BalancesStrip({ theme, owners = [], monthByOwner = {}, checkpoints = {}, periodLabel = '', todayStr = '', formatCurrency, onChanged }: any) {
  const [reconcileOwner, setReconcileOwner] = useState<string | null>(null)
  const [alignOwner, setAlignOwner] = useState<string | null>(null)
  if (owners.length === 0) return null
  const fmtDate = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
  return (
    <>
      <div className={`${theme.card} rounded-2xl border p-4`}>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${theme.text}`}><Wallet className="w-4 h-4 text-blue-500" /> Contas em {periodLabel || 'o período'}</h3>
          <span className={`text-[11px] ${theme.textMuted}`}>só o que foi pago · o que entrou e saiu é só do mês</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {owners.map((o: any) => {
            const m = monthByOwner[o.id]
            const cp = checkpoints[o.id]
            if (!m) return null
            const hasBalance = m.opening !== null && m.closing !== null
            const closingIsToday = m.closingDate === todayStr
            const row = (label: string, value: number, tone: string) => (
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className={theme.textMuted}>{label}</span>
                <b className={`font-mono ${tone}`}>{formatCurrency(value)}</b>
              </div>
            )
            return (
              <div key={o.id} className="rounded-xl border border-black/5 dark:border-white/10 p-3 flex flex-col gap-1.5">
                <p className={`text-xs font-bold flex items-center gap-1.5 ${theme.textMuted}`}>
                  {o.kind === 'pj' ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />} {o.name}
                </p>
                {hasBalance && row('Saldo no início do mês', m.opening, m.opening < 0 ? 'text-red-500' : theme.text)}
                {row('Entrou', m.inflow, 'text-emerald-500')}
                {row('Saiu', -m.outflow, 'text-red-500')}
                {hasBalance ? (
                  <div className="border-t border-black/5 dark:border-white/10 pt-1.5 mt-0.5">
                    <p className={`text-[10px] ${theme.textMuted}`}>{closingIsToday ? 'Saldo hoje' : `Saldo em ${fmtDate(m.closingDate)}`}</p>
                    <p className={`text-xl font-bold font-mono ${m.closing < 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(m.closing)}</p>
                  </div>
                ) : (
                  <div className="border-t border-black/5 dark:border-white/10 pt-1.5 mt-0.5">
                    <p className={`text-[10px] ${theme.textMuted}`}>Resultado do mês (entrou − saiu)</p>
                    <p className={`text-xl font-bold font-mono ${m.net < 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(m.net)}</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>Informe o saldo do banco uma vez para ver o saldo de cada mês.</p>
                  </div>
                )}
                {cp && <p className={`text-[10px] ${theme.textMuted}`}>saldo do banco conferido em {fmtDate(cp.date)}: {formatCurrency(cp.amount)}</p>}
                <button
                  type="button"
                  onClick={() => setReconcileOwner(o.id)}
                  className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-400"
                ><Scale className="w-3.5 h-3.5" /> {cp ? 'Conferir de novo' : 'Informar saldo do banco'}</button>
                <button
                  type="button"
                  onClick={() => setAlignOwner(o.id)}
                  className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-400"
                  title="Casa o extrato do banco com os lançamentos e acerta de qual conta cada um saiu"
                >Alinhar com o extrato</button>
              </div>
            )
          })}
        </div>
      </div>
      {alignOwner && (
        <StatementAlignModal
          owners={owners}
          initialOwnerId={alignOwner}
          formatCurrency={formatCurrency}
          onClose={() => setAlignOwner(null)}
          onDone={() => onChanged?.()}
        />
      )}
      {reconcileOwner && (
        <ReconcileBalanceModal
          owners={owners}
          initialOwnerId={reconcileOwner}
          checkpoints={checkpoints}
          formatCurrency={formatCurrency}
          onClose={() => setReconcileOwner(null)}
          onDone={() => onChanged?.()}
        />
      )}
    </>
  )
}
