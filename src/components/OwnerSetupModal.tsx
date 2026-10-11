'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, Plus, Trash2, User, Building2, Check, Users, ArrowLeft } from 'lucide-react'
import { getOwnerSetup, saveOwnerSetup, confirmCurrentOwners } from '@/app/ownerActions'
import { SETUP_TEMPLATES, planOwnerSetup, MAX_OWNERS, type OwnerSpec } from '@/utils/ownerSetup'
import { buildViewOptions } from '@/utils/owners'

// Escolha de como organizar a conta: só eu, casal, família, empresa ou nomes
// livres. Aparece sozinha na primeira vez (sem botão de fechar, porque o app
// precisa disso para funcionar) e pode ser reaberta em Cadastros > Pessoas e Contas.
export function OwnerSetupModal({ onDone, onClose }: { onDone: () => void; onClose?: () => void }) {
  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState<any[]>([])
  const [legacy, setLegacy] = useState({ pf: 0, pj: 0 })

  useEffect(() => {
    getOwnerSetup().then((r) => { setExisting(r.owners); setLegacy(r.legacy); setLoading(false) })
  }, [])

  return <OwnerSetupForm loading={loading} existing={existing} legacy={legacy} onDone={onDone} onClose={onClose} />
}

// Parte que só desenha e valida (os dados chegam prontos), separada pra poder
// ser exibida/testada sem buscar nada no servidor.
export function OwnerSetupForm({
  loading = false, existing, legacy, onDone, onClose, initialStep = 'template', initialRows = [],
}: {
  loading?: boolean; existing: any[]; legacy: { pf: number; pj: number }; onDone: () => void; onClose?: () => void;
  initialStep?: 'template' | 'names'; initialRows?: OwnerSpec[]
}) {
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'template' | 'names'>(initialStep)
  const [rows, setRows] = useState<OwnerSpec[]>(initialRows)
  const [serverError, setServerError] = useState('')

  const hasExisting = existing.length > 0
  const plan = useMemo(() => planOwnerSetup(existing, rows), [existing, rows])
  const preview = useMemo(
    () => buildViewOptions(rows.filter((r) => r.name.trim()).map((r, i) => ({ id: String(i), name: r.name.trim(), kind: r.kind }))),
    [rows]
  )
  // Avisos que impedem salvar, vindos das mesmas regras do servidor.
  const legacyError =
    legacy.pf > 0 && !rows.some((r) => r.kind === 'pf') ? 'Você tem lançamentos de pessoa física: inclua pelo menos um nome de pessoa (PF).'
    : legacy.pj > 0 && !rows.some((r) => r.kind === 'pj') ? 'Você tem lançamentos de empresa: inclua pelo menos um nome de empresa (PJ).'
    : ''
  const problem = (!plan.ok && plan.error) || legacyError

  function pickTemplate(id: string) {
    const t = SETUP_TEMPLATES.find((x) => x.id === id)!
    // "Personalizado" com conta que já tem donos começa pelos nomes atuais
    setRows(id === 'custom' && hasExisting ? existing.map((o) => ({ name: o.name, kind: o.kind })) : t.owners.map((o) => ({ ...o })))
    setServerError('')
    setStep('names')
  }

  const update = (i: number, patch: Partial<OwnerSpec>) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  async function save() {
    if (problem) return
    setSaving(true); setServerError('')
    const res: any = await saveOwnerSetup(rows)
    setSaving(false)
    if (res.success) onDone(); else setServerError(res.message || 'Não foi possível salvar.')
  }

  async function keep() {
    setSaving(true)
    const res: any = await confirmCurrentOwners()
    setSaving(false)
    if (res.success) onDone(); else setServerError(res.message || 'Não foi possível salvar.')
  }

  const input = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-600'

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[10001]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl text-white">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /> Como você quer organizar suas finanças?</h2>
            <p className="text-sm text-zinc-400 mt-1">Isso define quem aparece na barra do topo para você ver cada um separado e também o conjunto. Dá para mudar depois em Cadastros.</p>
          </div>
          {onClose && <button onClick={onClose} className="text-zinc-500 hover:text-white shrink-0"><X className="w-6 h-6" /></button>}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : step === 'template' ? (
          <div className="space-y-4">
            {hasExisting && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm space-y-2">
                <p>Hoje a sua conta tem: <b>{existing.map((o) => o.name).join(', ')}</b>. Escolher um modelo novo <b>não apaga nenhum lançamento</b>: tudo é preservado e reorganizado.</p>
                <button onClick={keep} disabled={saving} className="text-xs font-bold px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Manter como está
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SETUP_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => pickTemplate(t.id)} className="text-left rounded-xl border border-zinc-800 bg-zinc-950 hover:border-blue-500/60 p-4 transition-all">
                  <p className="font-bold">{t.title}</p>
                  <p className="text-xs text-zinc-400 mt-1">{t.description}</p>
                </button>
              ))}
            </div>
            {serverError && <p className="text-sm text-red-400">{serverError}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => setStep('template')} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Escolher outro modelo</button>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Como chamar cada um?</p>
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={input} value={r.name} placeholder={r.kind === 'pj' ? 'Nome da empresa' : 'Nome da pessoa'} maxLength={40} onChange={(e) => update(i, { name: e.target.value })} />
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 shrink-0">
                    <button onClick={() => update(i, { kind: 'pf' })} className={`px-2.5 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 ${r.kind === 'pf' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}><User className="w-3 h-3" /> Pessoa</button>
                    <button onClick={() => update(i, { kind: 'pj' })} className={`px-2.5 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 ${r.kind === 'pj' ? 'bg-cyan-700 text-white' : 'text-zinc-500'}`}><Building2 className="w-3 h-3" /> Empresa</button>
                  </div>
                  <button onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} disabled={rows.length <= 1} className="p-2 text-zinc-500 hover:text-red-500 disabled:opacity-30" title="Remover"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {rows.length < MAX_OWNERS && (
                <button onClick={() => setRows((prev) => [...prev, { name: '', kind: 'pf' }])} className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar nome</button>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">A barra do topo vai ficar assim</p>
              <div className="flex flex-wrap gap-2">
                {preview.map((v) => <span key={v.id} className="text-xs font-bold px-3 py-1.5 rounded-full bg-zinc-800">{v.label}</span>)}
              </div>
            </div>

            {hasExisting && <p className="text-xs text-zinc-400">Seus lançamentos, cartões e contas atuais são preservados e passam para os nomes acima.</p>}
            {(problem || serverError) && <p className="text-sm text-red-400">{serverError || problem}</p>}

            <button onClick={save} disabled={saving || !!problem} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 font-bold flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar e continuar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
