'use client'

import { useState, useEffect } from 'react'
import { X, Tags, Loader2, Plus, Pencil, Trash2, Check, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { getUserCategories, createCategory, renameCategory, deleteCategory } from '@/app/actions'
import { BudgetModal } from './BudgetModal'

const sortByName = (list: any[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

export function CategoriesModal({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'expense' | 'income'>('expense')

  const [selectedCategory, setSelectedCategory] = useState<any>(null)
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)

  async function load() {
    setLoading(true)
    const result = await getUserCategories()
    setCategories(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startRename(cat: any) {
    setEditingId(cat.id)
    setEditName(cat.name)
  }

  function cancelRename() {
    setEditingId(null)
    setEditName('')
  }

  async function saveRename(id: string) {
    if (!editName.trim()) { alert('Digite um nome pra categoria.'); return }
    setSaving(true)
    const res = await renameCategory(id, editName)
    setSaving(false)
    if (res.success) {
      cancelRename()
      load()
    } else {
      alert(res.message || 'Erro ao renomear categoria.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta categoria?')) return
    const res = await deleteCategory(id)
    if (res.success) {
      load()
    } else {
      alert(res.message || 'Erro ao excluir categoria.')
    }
  }

  async function handleAddCategory() {
    if (!newName.trim()) { alert('Digite um nome pra categoria.'); return }
    setSaving(true)
    const res = await createCategory(newName, newType)
    setSaving(false)
    if (res.success) {
      setShowAddForm(false); setNewName(''); setNewType('expense')
      load()
    } else {
      alert(res.message || 'Erro ao criar categoria.')
    }
  }

  function openBudget(cat: any) {
    setSelectedCategory(cat)
    setBudgetModalOpen(true)
  }

  const expenseCategories = sortByName(categories.filter((c: any) => c.type === 'expense'))
  const incomeCategories = sortByName(categories.filter((c: any) => c.type === 'income'))

  function renderCategoryCard(cat: any) {
    const isEditing = editingId === cat.id
    const hasBudget = Number(cat.budget || 0) > 0
    return (
      <div key={cat.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2">
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              autoFocus
              className="w-full bg-zinc-800 border border-blue-600 rounded-lg px-2 py-1.5 text-white text-sm outline-none"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(cat.id) }}
            />
            <button onClick={() => saveRename(cat.id)} disabled={saving} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white shrink-0"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={cancelRename} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{cat.name}</p>
              {hasBudget && <p className="text-[10px] text-purple-400">Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cat.budget))}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {cat.type === 'expense' && (
                <button onClick={() => openBudget(cat)} className="p-1.5 text-purple-400 hover:bg-purple-500/10 rounded transition-colors" title="Definir meta mensal">
                  <Target className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => startRename(cat)} className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors" title="Renomear"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">

        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Tags className="w-5 h-5 text-blue-500" /> Minhas Categorias
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Despesas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {expenseCategories.map(renderCategoryCard)}
              </div>
              {expenseCategories.length === 0 && <p className="text-sm text-zinc-500 py-2">Nenhuma categoria de despesa ainda.</p>}
            </div>

            <div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Receitas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {incomeCategories.map(renderCategoryCard)}
              </div>
              {incomeCategories.length === 0 && <p className="text-sm text-zinc-500 py-2">Nenhuma categoria de receita ainda.</p>}
            </div>

            {showAddForm ? (
              <div className="bg-zinc-950 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <input
                  autoFocus
                  placeholder="Nome da categoria (ex: Estudos)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  <button onClick={() => setNewType('expense')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newType === 'expense' ? 'bg-red-500/10 text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Despesa</button>
                  <button onClick={() => setNewType('income')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newType === 'income' ? 'bg-green-500/10 text-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Receita</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddCategory} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Categoria'}
                  </button>
                  <button onClick={() => { setShowAddForm(false); setNewName('') }} className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition-all">Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddForm(true)} className="w-full border border-dashed border-zinc-700 hover:border-blue-500 text-zinc-400 hover:text-blue-400 rounded-xl p-4 flex items-center justify-center gap-2 font-bold text-sm transition-all">
                <Plus className="w-4 h-4" /> Nova Categoria
              </button>
            )}
          </div>
        )}
      </div>

      {budgetModalOpen && selectedCategory && (
        <BudgetModal category={selectedCategory} onClose={() => { setBudgetModalOpen(false); setSelectedCategory(null); load() }} />
      )}
    </div>
  )
}
