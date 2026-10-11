'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Receipt, ArrowRightLeft, CheckCircle2, Circle } from 'lucide-react'
import { getInvoiceItems, reassignTransactions, getUserCreditCards, moveItemsToInvoice } from '@/app/creditCardActions'
import { getOwnersAndAccounts } from '@/app/ownerActions'
import { summarizeByOwner } from '@/utils/invoice'

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const formatDate = (s: string) => s.split('-').reverse().join('/')

export function InvoiceItemsModal({ cardId, cycleKey, onClose, onChanged }: {
  cardId: string; cycleKey: string; onClose: () => void; onChanged: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<any>(null)
  const [owners, setOwners] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [targetOwner, setTargetOwner] = useState('')
  const [targetCard, setTargetCard] = useState('')
  const [targetInvoice, setTargetInvoice] = useState('')

  async function load() {
    setLoading(true)
    const [inv, own, crd] = await Promise.all([getInvoiceItems(cardId, cycleKey), getOwnersAndAccounts(), getUserCreditCards()])
    setData(inv)
    setOwners(own.owners)
    setCards(crd)
    setSelected(new Set())
    setLoading(false)
  }
  useEffect(() => { load() }, [cardId, cycleKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const items: any[] = data?.items || []
  const total = items.reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const byOwner = useMemo(() => summarizeByOwner(items, owners), [items, owners])
  const selectedTotal = items.filter((t) => selected.has(t.id)).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const ownerName = (id: string | null) => owners.find((o) => o.id === id)?.name || '—'

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((t) => t.id))))
  }

  async function move() {
    if (!targetOwner && !targetCard) { alert('Escolha pra quem mover (e/ou o cartão de destino).'); return }
    setSaving(true)
    const res = await reassignTransactions(Array.from(selected), { ownerId: targetOwner || undefined, creditCardId: targetCard || undefined })
    setSaving(false)
    if (res.success) { setTargetOwner(''); setTargetCard(''); await load(); onChanged() }
    else alert(res.message || 'Erro ao mover.')
  }

  async function moveInvoice() {
    if (!targetInvoice) { alert('Escolha para qual fatura mover.'); return }
    setSaving(true)
    const res = await moveItemsToInvoice(Array.from(selected), cardId, targetInvoice)
    setSaving(false)
    if (res.success) { setTargetInvoice(''); await load(); onChanged() }
    else alert(res.message || 'Erro ao mover.')
  }

  const invoices: any[] = (data?.invoices || []).filter((i: any) => i.cycleKey !== cycleKey)

  const select = 'bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-blue-600'

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">
        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Receipt className="w-5 h-5 text-blue-500" /> {data?.card?.name || 'Fatura'}</h2>
            {data?.closingDate && <p className="text-xs text-zinc-500">Fecha em {formatDate(data.closingDate)} · vence em {formatDate(data.dueDate)}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : !data?.success ? (
          <p className="text-sm text-zinc-400 py-6">{data?.message || 'Não foi possível carregar a fatura.'}</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total da fatura</p>
                <p className="font-mono font-bold text-white">{formatCurrency(total)}</p>
                <p className="text-[10px] text-zinc-500">{items.length} item(ns)</p>
              </div>
              {byOwner.map((o) => (
                <div key={o.ownerId ?? 'none'} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">{o.name}</p>
                  <p className="font-mono font-bold text-white">{formatCurrency(o.total)}</p>
                  <p className="text-[10px] text-zinc-500">{o.count} item(ns)</p>
                </div>
              ))}
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum item lançado nessa fatura (o valor pode ter sido digitado na mão).</p>
            ) : (
              <div className="space-y-1">
                <button onClick={toggleAll} className="text-xs text-blue-400 hover:text-blue-300 mb-1">{selected.size === items.length ? 'Desmarcar todos' : 'Marcar todos'}</button>
                {items.map((t) => (
                  <button key={t.id} onClick={() => toggle(t.id)} className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all ${selected.has(t.id) ? 'bg-blue-500/10 border-blue-500/40' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}>
                    <span className="shrink-0 text-blue-400">{selected.has(t.id) ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4 text-zinc-600" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-white truncate">{t.description}</span>
                      <span className="block text-[10px] text-zinc-500">{formatDate(t.date)} · {ownerName(t.ownerId)}{t.isPaid ? ' · paga' : ''}</span>
                    </span>
                    <span className="font-mono text-sm text-white shrink-0">{formatCurrency(Math.abs(Number(t.amount)))}</span>
                  </button>
                ))}
              </div>
            )}

            {selected.size > 0 && (
              <div className="sticky bottom-0 bg-zinc-900 border border-blue-500/30 rounded-xl p-3 space-y-2">
                <p className="text-xs text-zinc-300">{selected.size} selecionado(s) · {formatCurrency(selectedTotal)}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <select className={select} value={targetOwner} onChange={(e) => setTargetOwner(e.target.value)}>
                    <option value="">Mudar dono para…</option>
                    {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <select className={select} value={targetCard} onChange={(e) => setTargetCard(e.target.value)}>
                    <option value="">Manter no mesmo cartão</option>
                    {cards.filter((c) => c.id !== cardId).map((c) => <option key={c.id} value={c.id}>Passar para: {c.name}</option>)}
                  </select>
                  <select className={select} value={targetInvoice} onChange={(e) => setTargetInvoice(e.target.value)} title="Para quando o banco cobrou o item em outra fatura">
                    <option value="">Mover para outra fatura…</option>
                    {invoices.map((i: any) => (
                      <option key={i.cycleKey} value={i.cycleKey}>Vence {formatDate(i.dueDate)}{i.count > 0 ? ` · ${i.count} item(ns) · ${formatCurrency(i.total)}` : ' · vazia'}</option>
                    ))}
                  </select>
                  <button onClick={moveInvoice} disabled={saving || !targetInvoice} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-bold px-4 py-2 rounded-lg">Mover de fatura</button>
                  <button onClick={move} disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />} Mover
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500">Mudar o dono não altera valor, data nem categoria. "Mover de fatura" serve para quando o banco cobrou o item numa fatura diferente da que a data sugere (ex: compra internacional lançada dias depois).</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
