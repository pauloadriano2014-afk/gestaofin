'use client'

import { useState, useEffect } from 'react'
import { X, Repeat, Loader2, Plus, Pencil, Archive, ArchiveRestore, User, Building2 } from 'lucide-react'
import { getFixedBills, createFixedBill, updateFixedBill, setFixedBillArchived } from '@/app/actions'
import { getUserCreditCards } from '@/app/creditCardActions'

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const emptyForm = { name: '', categoryId: '', originalAmount: '', dueDay: '', entityType: 'pf' as 'pf' | 'pj', creditCardId: '' }

// 🔥 NOVO: "Minhas Contas Fixas" — o molde de cada conta fixa (Aluguel,
// Internet, Financiamento etc), separado das transações que ele gera todo
// mês. Cadastrando aqui, o "Virar Mês" passa a gerar a cobrança automática
// pelo valor original, e ao dar baixa dá pra comparar com o valor pago de
// fato (juro/desconto).
export function FixedBillsModal({ categories, onClose }: { categories: any[]; onClose: () => void }) {
  const [bills, setBills] = useState<any[]>([])
  const [creditCards, setCreditCards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showArchived, setShowArchived] = useState(false)

  const expenseCategories = [...categories.filter((c: any) => c.type === 'expense')].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'))

  async function load() {
    setLoading(true)
    const [billsRes, cardsRes] = await Promise.all([getFixedBills(), getUserCreditCards().catch(() => [])])
    setBills(billsRes)
    setCreditCards(cardsRes)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function startEdit(bill: any) {
    setEditingId(bill.id)
    setForm({
      name: bill.name,
      categoryId: bill.categoryId || '',
      originalAmount: Math.abs(Number(bill.originalAmount)).toString(),
      dueDay: String(bill.dueDay),
      entityType: bill.entityType || 'pf',
      creditCardId: bill.creditCardId || '',
    })
    setShowForm(true)
  }

  async function handleSubmit() {
    if (!form.name.trim()) { alert('Digite um nome pra conta fixa.'); return }
    if (!form.originalAmount || Number(form.originalAmount) <= 0) { alert('Informe o valor original.'); return }
    const dueDayNum = Number(form.dueDay)
    if (!dueDayNum || dueDayNum < 1 || dueDayNum > 31) { alert('Dia de vencimento inválido (1 a 31).'); return }

    setSaving(true)
    const payload = {
      name: form.name,
      categoryId: form.categoryId || null,
      originalAmount: form.originalAmount,
      dueDay: dueDayNum,
      entityType: form.entityType,
      creditCardId: form.creditCardId || null,
    }
    const res = editingId ? await updateFixedBill(editingId, payload) : await createFixedBill(payload)
    setSaving(false)

    if (res.success) {
      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      load()
    } else {
      alert(res.message || 'Erro ao salvar conta fixa.')
    }
  }

  async function handleToggleArchive(bill: any) {
    const action = bill.archived ? 'reativar' : 'arquivar'
    if (!confirm(`Deseja ${action} "${bill.name}"?`)) return
    await setFixedBillArchived(bill.id, !bill.archived)
    load()
  }

  const categoryName = (id: string | null) => categories.find((c: any) => c.id === id)?.name || 'Sem categoria'
  const cardName = (id: string | null) => creditCards.find((c: any) => c.id === id)?.name

  const visibleBills = bills
    .filter((b: any) => showArchived || !b.archived)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">

        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Repeat className="w-5 h-5 text-blue-500" /> Minhas Contas Fixas
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 mb-4">
          Cadastre aqui o &quot;molde&quot; de cada conta fixa (nome, categoria, dia de vencimento e valor original). O &quot;Virar Mês&quot; passa a gerar a cobrança do mês seguinte sozinho, e ao lançar o pagamento dá pra ver se pagou a mais (juro) ou a menos (desconto).
        </p>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{visibleBills.length} conta{visibleBills.length === 1 ? '' : 's'}</h3>
              <button onClick={() => setShowArchived(!showArchived)} className="text-[11px] font-medium text-zinc-500 hover:text-zinc-300">
                {showArchived ? 'Ocultar arquivadas' : 'Mostrar arquivadas'}
              </button>
            </div>

            <div className="space-y-2">
              {visibleBills.map((bill: any) => (
                <div key={bill.id} className={`bg-zinc-950 border rounded-xl p-3 flex items-center justify-between gap-3 ${bill.archived ? 'border-zinc-800/50 opacity-60' : 'border-zinc-800'}`}>
                  <div className="min-w-0 flex items-center gap-2">
                    {bill.entityType === 'pj' ? <Building2 className="w-4 h-4 text-blue-500 shrink-0" /> : <User className="w-4 h-4 text-zinc-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{bill.name} {bill.archived && <span className="text-[10px] text-zinc-600">(arquivada)</span>}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {categoryName(bill.categoryId)} • vence dia {bill.dueDay} • {formatCurrency(Math.abs(Number(bill.originalAmount)))}
                        {cardName(bill.creditCardId) && ` • Cartão: ${cardName(bill.creditCardId)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(bill)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToggleArchive(bill)} className="p-1.5 text-zinc-400 hover:bg-zinc-500/10 rounded transition-colors" title={bill.archived ? 'Reativar' : 'Arquivar'}>
                      {bill.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
              {visibleBills.length === 0 && <p className="text-sm text-zinc-500 py-2 text-center">Nenhuma conta fixa cadastrada ainda.</p>}
            </div>

            {showForm ? (
              <div className="bg-zinc-950 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <input
                  autoFocus
                  placeholder="Nome (ex: Aluguel, Internet, Financiamento faculdade)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600 text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Valor original</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-zinc-500 text-xs font-bold">R$</span>
                      <input
                        type="number"
                        placeholder="0,00"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 pl-9 text-white outline-none focus:border-blue-600 font-mono text-sm"
                        value={form.originalAmount}
                        onChange={(e) => setForm({ ...form, originalAmount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Dia do vencimento</label>
                    <input
                      type="number" min={1} max={31}
                      placeholder="Ex: 10"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-600 font-mono text-sm"
                      value={form.dueDay}
                      onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Categoria</label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-600 text-sm"
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {expenseCategories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  <button onClick={() => setForm({ ...form, entityType: 'pf' })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.entityType === 'pf' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Pessoa Física</button>
                  <button onClick={() => setForm({ ...form, entityType: 'pj' })} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.entityType === 'pj' ? 'bg-blue-900/30 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}>Pessoa Jurídica</button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Salvar Alterações' : 'Adicionar Conta Fixa')}
                  </button>
                  <button onClick={() => { setShowForm(false); setForm(emptyForm); setEditingId(null) }} className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition-all">Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={startCreate} className="w-full border border-dashed border-zinc-700 hover:border-blue-500 text-zinc-400 hover:text-blue-400 rounded-xl p-4 flex items-center justify-center gap-2 font-bold text-sm transition-all">
                <Plus className="w-4 h-4" /> Nova Conta Fixa
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
