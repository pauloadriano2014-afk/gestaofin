'use client'

import { useState, useEffect } from 'react'
import { X, Users, Loader2, Plus, Pencil, Check, Archive, Landmark, Building2, User } from 'lucide-react'
import { getOwnersAndAccounts, createOwner, renameOwner, createAccount, setAccountArchived } from '@/app/ownerActions'

const KIND_LABEL: Record<string, string> = { checking: 'Conta corrente', gateway: 'Vendas (Asaas etc.)', cash: 'Caixa / dinheiro' }

export function OwnersAccountsModal({ onClose }: { onClose: () => void }) {
  const [owners, setOwners] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newOwnerName, setNewOwnerName] = useState('')
  const [newOwnerKind, setNewOwnerKind] = useState<'pf' | 'pj'>('pf')

  const [acc, setAcc] = useState({ name: '', ownerId: '', institution: '', kind: 'checking' as 'checking' | 'gateway' | 'cash' })

  async function load() {
    setLoading(true)
    const res = await getOwnersAndAccounts()
    setOwners(res.owners)
    setAccounts(res.accounts)
    setAcc((a) => ({ ...a, ownerId: a.ownerId || res.owners[0]?.id || '' }))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveRename(id: string) {
    setSaving(true)
    const res = await renameOwner(id, editName)
    setSaving(false)
    if (res.success) { setEditingOwnerId(null); load() } else alert(res.message || 'Erro ao renomear.')
  }

  async function addOwner() {
    if (!newOwnerName.trim()) { alert('Digite um nome.'); return }
    setSaving(true)
    const res = await createOwner({ name: newOwnerName, kind: newOwnerKind })
    setSaving(false)
    if (res.success) { setNewOwnerName(''); load() } else alert(res.message || 'Erro ao criar.')
  }

  async function addAccount() {
    if (!acc.name.trim()) { alert('Dê um nome pra conta (ex: Itaú PJ).'); return }
    setSaving(true)
    const res = await createAccount(acc)
    setSaving(false)
    if (res.success) { setAcc({ ...acc, name: '', institution: '' }); load() } else alert(res.message || 'Erro ao criar conta.')
  }

  async function archive(id: string) {
    if (!confirm('Arquivar esta conta? Os lançamentos já feitos nela continuam no histórico.')) return
    const res = await setAccountArchived(id, true)
    if (res.success) load(); else alert(res.message || 'Erro ao arquivar.')
  }

  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name || '—'
  const input = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-600'

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">
        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Users className="w-5 h-5 text-blue-500" /> Pessoas e Contas</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : (
          <div className="space-y-8">
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Quem tem gastos</h3>
              <p className="text-xs text-zinc-500 mb-3">Cada lançamento, cartão e conta pertence a um dono. A tela principal mostra cada um separado e também o conjunto.</p>
              <div className="space-y-2">
                {owners.map((o) => (
                  <div key={o.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    {editingOwnerId === o.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <input autoFocus className="w-full bg-zinc-800 border border-blue-600 rounded-lg px-2 py-1.5 text-white text-sm outline-none" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveRename(o.id) }} />
                        <button onClick={() => saveRename(o.id)} disabled={saving} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white shrink-0"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingOwnerId(null)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          {o.kind === 'pj' ? <Building2 className="w-4 h-4 text-blue-500 shrink-0" /> : <User className="w-4 h-4 text-zinc-500 shrink-0" />}
                          <p className="text-sm font-medium text-white truncate">{o.name}</p>
                          <span className="text-[10px] text-zinc-500">{o.kind === 'pj' ? 'Pessoa jurídica' : 'Pessoa física'}</span>
                        </div>
                        <button onClick={() => { setEditingOwnerId(o.id); setEditName(o.name) }} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors" title="Renomear"><Pencil className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input className={input} placeholder="Novo (ex: outra empresa)" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} />
                <select className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-white text-sm" value={newOwnerKind} onChange={(e) => setNewOwnerKind(e.target.value as 'pf' | 'pj')}>
                  <option value="pf">PF</option>
                  <option value="pj">PJ</option>
                </select>
                <button onClick={addOwner} disabled={saving} className="px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white shrink-0"><Plus className="w-4 h-4" /></button>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Contas</h3>
              <p className="text-xs text-zinc-500 mb-3">Onde o dinheiro entra e sai (Itaú, Caixa, Asaas...). Cartões de crédito continuam em &quot;Meus Cartões&quot;.</p>
              <div className="space-y-2">
                {accounts.length === 0 && <p className="text-sm text-zinc-500">Nenhuma conta ainda.</p>}
                {accounts.map((a) => (
                  <div key={a.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Landmark className="w-4 h-4 text-zinc-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{a.name}</p>
                        <p className="text-[10px] text-zinc-500">{ownerName(a.ownerId)} · {KIND_LABEL[a.kind] || a.kind}{a.institution ? ` · ${a.institution}` : ''}</p>
                      </div>
                    </div>
                    <button onClick={() => archive(a.id)} className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Arquivar"><Archive className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <input className={`${input} col-span-2`} placeholder="Nome (ex: Itaú PJ)" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
                <select className={input} value={acc.ownerId} onChange={(e) => setAcc({ ...acc, ownerId: e.target.value })}>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <select className={input} value={acc.kind} onChange={(e) => setAcc({ ...acc, kind: e.target.value as any })}>
                  {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <input className={`${input} col-span-2`} placeholder="Banco (opcional: itau, caixa, asaas...)" value={acc.institution} onChange={(e) => setAcc({ ...acc, institution: e.target.value })} />
                <button onClick={addAccount} disabled={saving} className="col-span-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar conta
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
