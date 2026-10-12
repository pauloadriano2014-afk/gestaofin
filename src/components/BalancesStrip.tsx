'use client'

import { useState } from 'react'
import { Wallet, Scale, User, Building2, Sigma, ArrowDownLeft, ArrowUpRight, CheckCircle2, AlertCircle, FileCheck2 } from 'lucide-react'
import { ReconcileBalanceModal } from '@/components/ReconcileBalanceModal'
import { StatementAlignModal } from '@/components/StatementAlignModal'

// Um cartão por pessoa/empresa com o MÊS escolhido:
//   Saldo no início do mês  +  Entrou  −  Saiu  =  Saldo no fim do mês (ou hoje)
// Entrou e Saiu são só do mês: outros meses não interferem. O saldo (início e fim) vem do saldo
// que você conferiu uma vez com o banco; sem conferência, mostramos só o que entrou e saiu.
// O bloco do topo soma o saldo de todas as contas que já têm saldo conferido.
export function BalancesStrip({ theme, owners = [], monthByOwner = {}, checkpoints = {}, periodLabel = '', todayStr = '', formatCurrency, onChanged }: any) {
  const [reconcileOwner, setReconcileOwner] = useState<string | null>(null)
  const [alignOwner, setAlignOwner] = useState<string | null>(null)
  if (owners.length === 0) return null
  const fmtDate = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

  // SALDO TOTAL = soma do saldo de todas as contas (Paulo + Adri + Empresa...) que já têm saldo
  // conferido com o banco. Cada conta é ancorada no próprio saldo do banco, então a soma também é.
  // (Transferências entre as suas próprias contas não mudam o total.)
  const hasBal = (o: any) => { const m = monthByOwner[o.id]; return !!m && m.opening !== null && m.closing !== null }
  const counted = owners.filter(hasBal)
  const pending = owners.filter((o: any) => { const m = monthByOwner[o.id]; return !!m && !hasBal(o) && (m.inflow > 0 || m.outflow > 0) })
  const round2 = (n: number) => Math.round(n * 100) / 100
  const totalOpening = round2(counted.reduce((a: number, o: any) => a + monthByOwner[o.id].opening, 0))
  const totalClosing = round2(counted.reduce((a: number, o: any) => a + monthByOwner[o.id].closing, 0))
  const totalNet = round2(totalClosing - totalOpening)
  const totalClosingDate = counted.length > 0 ? monthByOwner[counted[0].id].closingDate : ''
  const totalIsToday = totalClosingDate === todayStr

  const pillBtn = 'flex-1 min-w-[9.5rem] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors'

  return (
    <>
      <div className={`${theme.card} rounded-2xl border p-4 md:p-5 space-y-4`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${theme.text}`}><Wallet className="w-4 h-4 text-blue-500" /> Contas em {periodLabel || 'o período'}</h3>
          <span className={`text-[11px] ${theme.textMuted}`}>Só o que foi pago</span>
        </div>

        {counted.length > 0 && (
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-4 md:p-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${theme.textMuted}`}>
                  <Sigma className="w-3.5 h-3.5 text-blue-500" /> Saldo total das contas
                </p>
                <p className={`text-3xl md:text-4xl font-bold font-mono tracking-tight mt-1 ${totalClosing < 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(totalClosing)}</p>
                <p className={`text-[11px] mt-1 ${theme.textMuted}`}>
                  {totalIsToday ? 'Hoje' : `Em ${fmtDate(totalClosingDate)}`} · {counted.map((o: any) => o.name).join(' + ')}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl bg-slate-500/10 px-3 py-2">
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${theme.textMuted}`}>Início do mês</p>
                  <p className={`text-sm font-bold font-mono ${totalOpening < 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(totalOpening)}</p>
                </div>
                <div className={`rounded-xl px-3 py-2 ${totalNet < 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${totalNet < 0 ? 'text-red-500' : 'text-emerald-500'}`}>Resultado do mês</p>
                  <p className={`text-sm font-bold font-mono ${totalNet < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{totalNet > 0 ? '+' : ''}{formatCurrency(totalNet)}</p>
                </div>
              </div>
            </div>
            {pending.length > 0 && (
              <p className="mt-3 inline-flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>Falta o saldo do banco de {pending.map((o: any) => o.name).join(', ')} para entrar na soma.</span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {owners.map((o: any) => {
            const m = monthByOwner[o.id]
            const cp = checkpoints[o.id]
            if (!m) return null
            const hasBalance = m.opening !== null && m.closing !== null
            const closingIsToday = m.closingDate === todayStr
            const moved = m.inflow + m.outflow
            const pctIn = moved > 0 ? Math.round((m.inflow / moved) * 100) : 0
            const isPj = o.kind === 'pj'
            const heroValue = hasBalance ? m.closing : m.net
            const stat = (label: string, value: string, tone: string, icon?: any) => (
              <div className="rounded-xl bg-slate-500/10 px-3 py-2 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${theme.textMuted}`}>{icon}{label}</p>
                <p className={`text-xs font-bold font-mono truncate ${tone}`}>{value}</p>
              </div>
            )
            return (
              <div key={o.id} className="rounded-2xl border border-black/5 dark:border-white/10 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${isPj ? 'bg-violet-500/10 text-violet-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {isPj ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </span>
                    <span className={`text-sm font-bold truncate ${theme.text}`}>{o.name}</span>
                  </span>
                  {cp && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 shrink-0"
                      title={`Saldo do banco conferido em ${fmtDate(cp.date)}: ${formatCurrency(cp.amount)}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Conferido {fmtDate(cp.date)}
                    </span>
                  )}
                </div>

                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wide ${theme.textMuted}`}>
                    {hasBalance ? (closingIsToday ? 'Saldo hoje' : `Saldo em ${fmtDate(m.closingDate)}`) : 'Resultado do mês'}
                  </p>
                  <p className={`text-2xl font-bold font-mono tracking-tight ${heroValue < 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(heroValue)}</p>
                </div>

                {moved > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-red-500/30 overflow-hidden" title={`Entrou ${pctIn}% · Saiu ${100 - pctIn}% do que se movimentou no mês`}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pctIn}%` }} />
                  </div>
                )}

                <div className={`grid gap-2 ${hasBalance ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {hasBalance && stat('Início', formatCurrency(m.opening), m.opening < 0 ? 'text-red-500' : theme.text)}
                  {stat('Entrou', formatCurrency(m.inflow), 'text-emerald-500', <ArrowDownLeft className="w-3 h-3" />)}
                  {stat('Saiu', formatCurrency(m.outflow), 'text-red-500', <ArrowUpRight className="w-3 h-3" />)}
                </div>

                {!hasBalance && (
                  <p className={`text-[11px] rounded-lg border border-dashed border-black/10 dark:border-white/15 px-2.5 py-1.5 ${theme.textMuted}`}>
                    Informe o saldo do banco uma vez para ver o saldo desta conta mês a mês.
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-auto">
                  <button type="button" onClick={() => setReconcileOwner(o.id)} className={pillBtn}>
                    <Scale className="w-3.5 h-3.5" /> {cp ? 'Conferir de novo' : 'Informar saldo do banco'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlignOwner(o.id)}
                    className={pillBtn}
                    title="Casa o extrato do banco com os lançamentos e acerta de qual conta cada um saiu"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" /> Alinhar com o extrato
                  </button>
                </div>
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
