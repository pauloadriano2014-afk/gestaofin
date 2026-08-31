'use client'

import { useState, useEffect } from 'react'
import { X, CreditCard, Loader2, Plus, Pencil, Archive, CheckCircle2, Check } from 'lucide-react'
import {
  getCreditCardsOverview,
  createCreditCard,
  updateCreditCard,
  setCreditCardArchived,
  payCreditCardInvoice,
  setInvoiceOverrideAmount,
  clearInvoiceOverride,
} from '@/app/creditCardActions'

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
const formatDate = (s: string) => s.split('-').reverse().join('/')

// Aceita tanto "1234,56" quanto "1234.56" digitado pelo usuário.
const normalizeAmountInput = (v: string) => v.trim().replace(/\./g, '').replace(',', '.')

export function CreditCardsModal({ onClose }: { onClose: () => void }) {
  const [cards, setCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [showForm, setShowForm] = useState(false)

  // 🔥 NOVO: edição do valor da fatura na mão (por cartão + ciclo).
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)

  // 🔥 NOVO: lançar uma fatura manual pra um mês que ainda nem existe (sem
  // nenhuma compra lançada nesse cartão naquele ciclo).
  const [manualCardId, setManualCardId] = useState<string | null>(null)
  const [manualMonth, setManualMonth] = useState('')
  const [manualAmount, setManualAmount] = useState('')

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

  // --- Edição do valor da fatura na mão ---
  function editKeyFor(cardId: string, cycleKey: string) {
    return `${cardId}::${cycleKey}`
  }

  function startEditOverride(cardId: string, cycleKey: string, currentTotal: number) {
    setEditingKey(editKeyFor(cardId, cycleKey))
    setEditAmount(currentTotal ? currentTotal.toFixed(2).replace('.', ',') : '')
  }

  function cancelEditOverride() {
    setEditingKey(null)
    setEditAmount('')
  }

  async function saveEditOverride(cardId: string, cycleKey: string) {
    const normalized = normalizeAmountInput(editAmount)
    if (!normalized || Number.isNaN(Number(normalized)) || Number(normalized) <= 0) {
      alert('Digite um valor válido.')
      return
    }
    setSavingOverride(true)
    const res = await setInvoiceOverrideAmount(cardId, cycleKey, normalized)
    setSavingOverride(false)
    if (res.success) {
      cancelEditOverride()
      loadCards()
    } else {
      alert(res.message || 'Erro ao salvar o valor da fatura.')
    }
  }

  async function handleClearOverride(cardId: string, cycleKey: string) {
    if (!confirm('Remover o valor digitado na mão e voltar a usar o total calculado pelas compras lançadas?')) return
    await clearInvoiceOverride(cardId, cycleKey)
    loadCards()
  }

  // --- Lançar fatura manual num mês novo (sem ciclo existente) ---
  function startManualInvoice(cardId: string) {
    setManualCardId(cardId)
    const now = new Date()
    setManualMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    setManualAmount('')
  }

  function cancelManualInvoice() {
    setManualCardId(null)
    setManualMonth('')
    setManualAmount('')
  }

  async function saveManualInvoice(cardId: string) {
    if (!manualMonth) {
      alert('Escolha o mês da fatura.')
      return
    }
    const normalized = normalizeAmountInput(manualAmount)
    if (!normalized || Number.isNaN(Number(normalized)) || Number(normalized) <= 0) {
      alert('Digite um valor válido.')
      return
    }
    setSavingOverride(true)
    const res = await setInvoiceOverrideAmount(cardId, manualMonth, normalized)
    setSavingOverride(false)
    if (res.success) {
      cancelManualInvoice()
      loadCards()
    } else {
      alert(res.message || 'Erro ao salvar a fatura.')
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold">Fatura atual (em aberto)</p>
                      {card.openCycle && editingKey !== editKeyFor(card.id, card.openCycle.cycleKey) && (
                        <button
                          onClick={() => startEditOverride(card.id, card.openCycle.cycleKey, card.openCycle.total)}
                          className="text-zinc-500 hover:text-blue-400 transition-colors shrink-0"
                          title="Editar valor da fatura"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {card.openCycle && editingKey === editKeyFor(card.id, card.openCycle.cycleKey) ? (
                      <div className="mt-1.5 flex items-center gap-1">
                        <input
                          autoFocus
                          inputMode="decimal"
                          placeholder="0,00"
                          className="w-full bg-zinc-800 border border-blue-600 rounded-lg px-2 py-1.5 text-white text-sm font-mono outline-none"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditOverride(card.id, card.openCycle.cycleKey) }}
                        />
                        <button onClick={() => saveEditOverride(card.id, card.openCycle.cycleKey)} disabled={savingOverride} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white shrink-0"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={cancelEditOverride} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <p className="font-mono font-bold text-white mt-1 flex items-center gap-1.5 flex-wrap">
                          {card.openCycle ? formatCurrency(card.openCycle.total) : formatCurrency(0)}
                          {card.openCycle?.isManual && (
                            <span className="text-[9px] font-sans font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase">Manual</span>
                          )}
                        </p>
                        {card.openCycle && <p className="text-[10px] text-zinc-500 mt-1">Fecha em {formatDate(card.openCycle.closingDate)}</p>}
                        {card.openCycle?.isManual && (
                          <button onClick={() => handleClearOverride(card.id, card.openCycle.cycleKey)} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline mt-1">
                            usar valor calculado
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Faturas fechadas e não pagas</p>
                    <p className="font-mono font-bold text-red-400 mt-1">{formatCurrency(card.closedUnpaidTotal)}</p>
                  </div>
                </div>

                {card.closedUnpaidCycles.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    {card.closedUnpaidCycles.map((cycle: any) => {
                      const key = editKeyFor(card.id, cycle.cycleKey)
                      const isEditing = editingKey === key
                      return (
                        <div key={cycle.cycleKey} className="bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                inputMode="decimal"
                                placeholder="0,00"
                                className="w-full bg-zinc-800 border border-blue-600 rounded-lg px-2 py-1.5 text-white text-sm font-mono outline-none"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEditOverride(card.id, cycle.cycleKey) }}
                              />
                              <button onClick={() => saveEditOverride(card.id, cycle.cycleKey)} disabled={savingOverride} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white shrink-0"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={cancelEditOverride} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 shrink-0"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-sm gap-2">
                              <span className="text-zinc-300 flex items-center gap-1.5 flex-wrap">
                                Venceu em {formatDate(cycle.dueDate)}: <span className="font-mono font-bold text-red-400">{formatCurrency(cycle.total)}</span>
                                {cycle.isManual && (
                                  <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase">Manual</span>
                                )}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => startEditOverride(card.id, cycle.cycleKey, cycle.total)} className="p-1.5 text-zinc-500 hover:text-blue-400 transition-colors" title="Editar valor">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handlePayInvoice(card.id, cycle.cycleKey, cycle.total)}
                                  className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Pagar
                                </button>
                              </div>
                            </div>
                          )}
                          {cycle.isManual && !isEditing && (
                            <button onClick={() => handleClearOverride(card.id, cycle.cycleKey)} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline mt-1">
                              usar valor calculado pelas compras lançadas
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {manualCardId === card.id ? (
                  <div className="pt-2 border-t border-zinc-800 space-y-2">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">Lançar fatura manualmente</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="month"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-blue-600"
                        value={manualMonth}
                        onChange={(e) => setManualMonth(e.target.value)}
                      />
                      <input
                        inputMode="decimal"
                        placeholder="Valor (ex: 1234,56)"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-white text-sm font-mono outline-none focus:border-blue-600"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveManualInvoice(card.id)} disabled={savingOverride} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-all">
                        {savingOverride ? 'Salvando...' : 'Salvar fatura'}
                      </button>
                      <button onClick={cancelManualInvoice} className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition-all">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startManualInvoice(card.id)} className="text-xs text-zinc-500 hover:text-blue-400 flex items-center gap-1 pt-1 transition-colors">
                    <Plus className="w-3 h-3" /> Lançar fatura manualmente
                  </button>
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
