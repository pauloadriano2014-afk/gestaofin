'use client'

import { useState } from 'react'
import { X, Scale } from 'lucide-react'
import { setBalanceCheckpoint } from '@/app/actions'
import { todayDateStr } from '@/utils/dates'

// "Conferir com o banco": você informa o saldo que o banco mostra (de uma pessoa ou
// empresa, numa data). O app passa a contar a partir dele: o "Saldo hoje" é esse valor +
// o que for pago depois. Não cria lançamento e o histórico antigo deixa de pesar.
export function ReconcileBalanceModal({
  owners,
  initialOwnerId,
  checkpoints = {},
  formatCurrency,
  onClose,
  onDone,
}: {
  owners: { id: string; name: string; kind: string }[]
  initialOwnerId?: string
  checkpoints?: Record<string, { date: string; amount: number }>
  formatCurrency: (v: number) => string
  onClose: () => void
  onDone: () => void
}) {
  const [ownerId, setOwnerId] = useState(initialOwnerId || owners[0]?.id || '')
  const [date, setDate] = useState(todayDateStr())
  const [realText, setRealText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // aceita "73,77", "1.234,56" e "-12,09"
  const parseMoney = (s: string) => {
    const clean = s.trim().replace(/[^\d,.-]/g, '')
    if (!clean) return NaN
    const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
    return Number(normalized)
  }
  const real = parseMoney(realText)
  const last = checkpoints[ownerId]

  const confirm = async () => {
    if (!Number.isFinite(real)) { setError('Digite o saldo que aparece no banco.'); return }
    setSaving(true)
    setError('')
    const r = await setBalanceCheckpoint(ownerId, real, date)
    setSaving(false)
    if (!r.success) { setError(r.message || 'Erro ao salvar.'); return }
    onDone()
    onClose()
  }

  const field = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-white outline-none focus:border-blue-500'

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-white"><Scale className="w-5 h-5 text-blue-500" /> Conferir com o banco</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-6 h-6" /></button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          Informe o saldo que o <b>banco</b> mostra. O app passa a contar a partir dele: o &quot;Saldo hoje&quot; vira esse valor mais o que for pago depois. Nenhum lançamento é criado e o histórico antigo deixa de pesar.
        </p>

        <label className="block text-[11px] font-bold text-zinc-400 mb-1">De quem é a conta?</label>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={`${field} mb-3`}>
          {owners.map((o) => <option key={o.id} value={o.id} className="bg-zinc-900 text-white">{o.name} ({o.kind === 'pj' ? 'empresa' : 'pessoal'})</option>)}
        </select>
        {last && <p className="text-[11px] text-zinc-500 -mt-2 mb-3">Última conferência: {formatCurrency(last.amount)} em {last.date.split('-').reverse().join('/')}. Esta substitui a anterior.</p>}

        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Saldo no banco em (data)</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mb-1`} />
        <p className="text-[11px] text-zinc-500 mb-3">O que aconteceu <b>depois</b> dessa data entra na conta; o que é dela ou anterior já está no valor do banco.</p>

        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Saldo que aparece no banco (R$)</label>
        <input inputMode="decimal" placeholder="Ex: 73,77" value={realText} onChange={(e) => setRealText(e.target.value)} className={`${field} mb-3`} />

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-semibold hover:bg-zinc-800">Cancelar</button>
          <button onClick={confirm} disabled={!Number.isFinite(real) || saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold">
            {saving ? 'Salvando...' : 'Salvar saldo'}
          </button>
        </div>
      </div>
    </div>
  )
}
