'use client'

import { useState, useEffect } from 'react'
import { X, CreditCard, Loader2, Plus, Pencil, Archive, CheckCircle2 } from 'lucide-react'
import {
  getCreditCardsOverview,
  createCreditCard,
  updateCreditCard,
  setCreditCardArchived,
  payCreditCardInvoice,
} from '@/app/creditCardActions'

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
const formatDate = (s: string) => s.split('-').reverse().join('/')

export function CreditCardsModal({ onClose }: { onClose: () => void }) {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function loadCards() {
    setLoading(true)
    const result = await getCreditCardsOverview()
    setCards(result)
    setLoading(false)
  }

  useEffect(() => { loadCards() }, [])

  function resetForm() {
    setName(''); setClosingDay(''); setDueDay(''); setEditingId(null); setShowForm(false)
  }

  function startEdit(card: any) {
    setEditingId(card.id)
    setName(card.name)
    setClosingDay(String(card.closingDay))
    setDueDay(String(card.dueDay))
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim() || !closingDay || !dueDay) {
      alert('Preencha nome, dia de fechamento e dia de vencimento.')
      return
    }
    setSaving(true)
    const payload = { name, closingDay: Number(closingDay), dueDay: Number(dueDay) }
    const res = editingId ? await updateCreditCard(editingId, payload) : await createCreditCard(payload)
    setSaving(false)
    if (res.success) {
      resetForm()
      loadCards()
    } else {
      alert(res.message || 'Erro ao salvar cartão.')
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Arquivar este cartão? Ele some da lista, mas o histórico de compras é mantido.')) return
    await setCreditCardArchived(id, true)
    loadCards()
  }

  async function handlePayInvoice(cardId: string, cycleKey: string, total: number) {
    if (!confirm(`Confirmar pagamento da fatura de ${formatCurrency(total)}?`)) return
    const res = await payCreditCardInvoice(cardId, cycleKey)
    if (res.success) {
      loadCards()
    } else {
      alert(res.message || 'Erro ao dar baixa na fatura.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">

        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <CreditCard className="w-5 h-5 text-blue-500" /> Meus Cartões
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : (
          <div className="space-y-4">
            {cards.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum cartão cadastrado ainda.</p>
            )}

            {cards.map((card) => (
              <div key={card.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white">{card.name}</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Fecha dia {card.closingDay} · Vence dia {card.dueDay}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(card)} className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleArchive(card.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors" title="Arquivar"><Archive className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Fatura atual (em aberto)</p>
                    <p className="font-mono font-bold text-white mt-1">{card.openCycle ? formatCurrency(card.openCycle.total) : formatCurrency(0)}</p>
                    {card.openCycle && <p className="text-[10px] text-zinc-500 mt-1">Fecha em {formatDate(card.openCycle.closingDate)}</p>}
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Faturas fechadas e não pagas</p>
                    <p className="font-mono font-bold text-red-400 mt-1">{formatCurrency(card.closedUnpaidTotal)}</p>
                  </div>
                </div>

                {card.closedUnpaidCycles.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    {card.closedUnpaidCycles.map((cycle: any) => (
                      <div key={cycle.cycleKey} className="flex items-center justify-between text-sm bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                        <span className="text-zinc-300">Venceu em {formatDate(cycle.dueDate)}: <span className="font-mono font-bold text-red-400">{formatCurrency(cycle.total)}</span></span>
                        <button
                          onClick={() => handlePayInvoice(card.id, cycle.cycleKey, cycle.total)}
                          className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Pagar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {showForm ? (
              <div className="bg-zinc-950 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <input
                  placeholder="Apelido (ex: Nubank)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Dia de fechamento</label>
                    <input type="number" min={1} max={31} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600" value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Dia de vencimento</label>
                    <input type="number" min={1} max={31} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Salvar Alterações' : 'Adicionar Cartão')}
                  </button>
                  <button onClick={resetForm} className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition-all">Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} className="w-full border border-dashed border-zinc-700 hover:border-blue-500 text-zinc-400 hover:text-blue-400 rounded-xl p-4 flex items-center justify-center gap-2 font-bold text-sm transition-all">
                <Plus className="w-4 h-4" /> Adicionar Cartão
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
