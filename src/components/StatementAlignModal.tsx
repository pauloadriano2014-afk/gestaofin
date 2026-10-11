'use client'

import { useState } from 'react'
import { X, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { alignStatementWithOwner } from '@/app/actions'
import { parseStatementCsv, type StatementRow } from '@/utils/statementMatch'
import { parseOfx } from '@/utils/importParsers'

// "Alinhar com o extrato": escolha de quem é a conta, mande o extrato do mês (CSV ou OFX). O app casa
// cada linha com um lançamento (mesma data e valor) e marca a conta de onde o dinheiro realmente
// entrou/saiu. Mostra antes o que vai mudar; só altera quando você confirma.
export function StatementAlignModal({ owners, initialOwnerId, formatCurrency, onClose, onDone }: {
  owners: { id: string; name: string; kind: string }[]
  initialOwnerId?: string
  formatCurrency: (v: number) => string
  onClose: () => void
  onDone: () => void
}) {
  const [ownerId, setOwnerId] = useState(initialOwnerId || owners[0]?.id || '')
  const [rows, setRows] = useState<StatementRow[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const fmt = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

  async function preview(r: StatementRow[], owner: string) {
    setBusy(true); setError('')
    const res: any = await alignStatementWithOwner(owner, r, false)
    setBusy(false)
    if (!res.success) { setError(res.message || 'Erro.'); setResult(null); return }
    setResult(res)
  }

  function onFile(e: any) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = String(ev.target?.result || '')
      const parsed: StatementRow[] = file.name.toLowerCase().endsWith('.ofx')
        ? parseOfx(text).map((r) => ({ date: r.date, amount: r.amount, description: r.description }))
        : parseStatementCsv(text)
      if (parsed.length === 0) { setError('Não consegui ler linhas desse arquivo. Use o CSV ou OFX do extrato da conta.'); setRows([]); setResult(null); return }
      setRows(parsed)
      await preview(parsed, ownerId)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function apply() {
    setBusy(true)
    const res: any = await alignStatementWithOwner(ownerId, rows, true)
    setBusy(false)
    if (!res.success) { setError(res.message || 'Erro.'); return }
    onDone()
    onClose()
  }

  const field = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-sm text-white outline-none focus:border-blue-500'
  const list = (items: any[], tone: string) => (
    <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800">
      {items.map((m, i) => (
        <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]">
          <span className="text-zinc-400 shrink-0">{fmt(m.date)}</span>
          <span className="flex-1 min-w-0 truncate text-zinc-300">{m.description}</span>
          <span className={`font-mono shrink-0 ${tone}`}>{formatCurrency(m.amount)}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2 text-white"><FileText className="w-5 h-5 text-blue-500" /> Alinhar com o extrato</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white" aria-label="Fechar"><X className="w-6 h-6" /></button>
        </div>
        <p className="text-xs text-zinc-400">
          Mande o extrato do mês de <b>uma conta</b>. O app casa cada linha com um lançamento (mesma data e valor) e marca de qual conta o dinheiro realmente entrou ou saiu. O gasto continua sendo de quem você definiu; só o saldo de cada conta passa a refletir o banco.
        </p>

        <label className="block text-[11px] font-bold text-zinc-400">De quem é a conta deste extrato?</label>
        <select value={ownerId} onChange={(e) => { setOwnerId(e.target.value); if (rows.length) preview(rows, e.target.value) }} className={field}>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.kind === 'pj' ? 'empresa' : 'pessoal'})</option>)}
        </select>

        <label className="block border border-dashed border-zinc-700 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer text-zinc-400 hover:text-blue-400">
          <p className="text-sm font-bold">{fileName || 'Escolher o extrato (.csv ou .ofx)'}</p>
          <input type="file" accept=".csv,.ofx" className="hidden" onChange={onFile} />
        </label>

        {busy && <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {result && (
          <div className="space-y-3 text-xs text-zinc-300">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-1">
              <p>Extrato: <b>{result.statement.count}</b> linhas, de {fmt(result.statement.from)} a {fmt(result.statement.to)}, resultado <b className={result.statement.net < 0 ? 'text-red-400' : 'text-emerald-400'}>{formatCurrency(result.statement.net)}</b>.</p>
              <p>Casadas com lançamentos: <b>{result.matched}</b>. A conta muda em <b className="text-amber-400">{result.changed}</b> delas para <b>{result.ownerName}</b>.</p>
            </div>
            {result.missingCount > 0 && (
              <div>
                <p className="font-bold text-amber-400 mb-1">{result.missingCount} linha(s) do extrato NÃO estão no app (faltam lançar):</p>
                {list(result.missing, 'text-zinc-200')}
                <p className="text-[10px] text-zinc-500 mt-1">Importe este extrato em Importar para lançá-las (as repetidas são ignoradas).</p>
              </div>
            )}
            {result.extrasCount > 0 && (
              <div>
                <p className="font-bold text-amber-400 mb-1">{result.extrasCount} lançamento(s) em nome desta conta que NÃO estão no extrato:</p>
                {list(result.extras, 'text-zinc-200')}
                <p className="text-[10px] text-zinc-500 mt-1">Provavelmente são de outra conta (mande o extrato dela) ou estão duplicados.</p>
              </div>
            )}
            {result.missingCount === 0 && result.extrasCount === 0 && (
              <p className="flex items-center gap-1.5 text-emerald-400 font-bold"><CheckCircle2 className="w-4 h-4" /> O app e o extrato têm exatamente os mesmos lançamentos.</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-sm font-semibold hover:bg-zinc-800">Fechar</button>
          <button onClick={apply} disabled={!result || busy || result.changed === 0} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold">
            {result && result.changed > 0 ? `Aplicar (${result.changed})` : 'Nada a mudar'}
          </button>
        </div>
      </div>
    </div>
  )
}
