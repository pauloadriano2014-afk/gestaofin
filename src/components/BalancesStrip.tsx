'use client'

import { useState } from 'react'
import { Wallet, Scale, User, Building2 } from 'lucide-react'
import { ReconcileBalanceModal } from '@/components/ReconcileBalanceModal'

// "Saldo hoje": quanto cada pessoa/empresa tem na conta AGORA. É o saldo que você conferiu
// com o banco + o que foi pago depois. Sem conferência não mostramos número nenhum (somar
// um histórico incompleto enganaria). Não depende do mês escolhido.
export function BalancesStrip({ theme, owners = [], todayByOwner = {}, checkpoints = {}, formatCurrency, onChanged }: any) {
  const [reconcileOwner, setReconcileOwner] = useState<string | null>(null)
  if (owners.length === 0) return null
  return (
    <>
      <div className={`${theme.card} rounded-2xl border p-4`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${theme.text}`}><Wallet className="w-4 h-4 text-blue-500" /> Saldo hoje</h3>
          <span className={`text-[11px] ${theme.textMuted}`}>saldo do banco + o que foi pago depois · não depende do mês</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {owners.map((o: any) => {
            const cp = checkpoints[o.id]
            const has = cp !== undefined && todayByOwner[o.id] !== undefined
            const v = Number(todayByOwner[o.id] || 0)
            return (
              <div key={o.id} className="rounded-xl border border-black/5 dark:border-white/10 p-3 flex flex-col gap-1">
                <p className={`text-xs font-bold flex items-center gap-1.5 ${theme.textMuted}`}>
                  {o.kind === 'pj' ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />} {o.name}
                </p>
                {has ? (
                  <>
                    <p className={`text-xl font-bold font-mono ${v < 0 ? 'text-red-500' : theme.text}`}>{formatCurrency(v)}</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>conferido em {cp.date.split('-').reverse().join('/')} com {formatCurrency(cp.amount)}</p>
                  </>
                ) : (
                  <>
                    <p className={`text-sm font-semibold ${theme.textMuted}`}>Ainda não conferido</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>Informe o saldo do banco para ver o valor real.</p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setReconcileOwner(o.id)}
                  className="self-start inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-400"
                ><Scale className="w-3.5 h-3.5" /> {has ? 'Conferir de novo' : 'Informar saldo do banco'}</button>
              </div>
            )
          })}
        </div>
      </div>
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
