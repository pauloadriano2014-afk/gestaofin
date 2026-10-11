'use client'

import { useEffect, useState } from 'react'
import { X, Scale, Loader2 } from 'lucide-react'
import { getOwnerAccumulated, reconcileOwnerBalance } from '@/app/actions'
import { adjustmentFor } from '@/utils/balance'
import { todayDateStr } from '@/utils/dates'

// "Conciliar com o banco": o app só conhece o que foi lançado ou importado, então
// o dinheiro acumulado dele quase nunca é igual ao saldo do banco (falta o saldo
// de antes do primeiro lançamento, por exemplo). Aqui você informa o saldo real
// de um dono e o app lança UM ajuste com a diferença, para os dois baterem.
export function ReconcileBalanceModal({
  owners,
  initialOwnerId,
  formatCurrency,
  onClose,
  onDone,
}: {
  owners: { id: string; name: string; kind: string }[]
  initialOwnerId?: string
  formatCurrency: (v: number) => string
  onClose: () => void
  onDone: () => void
}) {
  const [ownerId, setOwnerId] = useState(initialOwnerId || owners[0]?.id || '')
  const [date, setDate] = useState(todayDateStr())
  const [realText, setRealText] = useState('')
  const [current, setCurrent] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ownerId || !date) return
    let alive = true
    setCurrent(null)
    getOwnerAccumulated(ownerId, date).then((r) => {
      if (!alive) return
      if (r.success) setCurrent(r.accumulated)
      else setError(r.message)
    })
    return () => { alive = false }
  }, [ownerId, date])

  // aceita "73,77", "1.234,56" e "-12,09"
  const parseMoney = (s: string) => {
    const clean = s.trim().replace(/[^\d,.-]/g, '')
    if (!clean) return NaN
    const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
    return Number(normalized)
  }
  const real = parseMoney(realText)
  const adj = current !== null && Number.isFinite(real) ? adjustmentFor(current, real) : null
  const ready = current !== null && Number.isFinite(real)

  const confirm = async () => {
    if (!ready) return
    setSaving(true)
    setError('')
    const r = await reconcileOwnerBalance(ownerId, real, date)
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
          <h2 className="text-lg font-bold flex items-center gap-2 text-white"><Scale className="w-5 h-5 text-blue-500" /> Conciliar com o banco</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-6 h-6" /></button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          O app só sabe do que foi lançado ou importado, então o dinheiro dele pode diferir do banco (ex: o saldo que você já tinha antes do primeiro lançamento).
          Informe o saldo que aparece no banco e o app cria um único saldo inicial com a diferença, datado antes do seu primeiro lançamento. Assim ele não mexe no movimento de nenhum mês. Não conta como receita nem despesa, e conciliar de novo substitui o anterior.
        </p>

        <label className="block text-[11px] font-bold text-zinc-400 mb-1">De quem é a conta?</label>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={`${field} mb-3`}>
          {owners.map((o) => <option key={o.id} value={o.id} className="bg-zinc-900 text-white">{o.name} ({o.kind === 'pj' ? 'empresa' : 'pessoal'})</option>)}
        </select>

        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Saldo em que dia?</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mb-3`} />

        <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl p-3 mb-3">
          <span className="text-xs text-zinc-400">Dinheiro no app até esse dia (sem ajuste anterior)</span>
          {current === null ? <Loader2 className="w-4 h-4 animate-spin text-zinc-500" /> : <b className="font-mono text-white">{formatCurrency(current)}</b>}
        </div>

        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Saldo que aparece no banco (R$)</label>
        <input inputMode="decimal" placeholder="Ex: 73,77" value={realText} onChange={(e) => setRealText(e.target.value)} className={`${field} mb-3`} />

        {ready && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 mb-3 text-xs text-zinc-300">
            {adj
              ? <>Vou lançar um saldo inicial de <b className={adj.type === 'income' ? 'text-emerald-400' : 'text-red-400'}>{adj.type === 'income' ? '+' : '−'} {formatCurrency(adj.amount)}</b> para o app ficar em <b className="text-white">{formatCurrency(real)}</b>.</>
              : <>Já está batendo com o banco. Nada a ajustar.</>}
          </div>
        )}
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-semibold hover:bg-zinc-800">Cancelar</button>
          <button onClick={confirm} disabled={!ready || !adj || saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold">
            {saving ? 'Salvando...' : 'Lançar ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}
