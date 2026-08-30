'use client'

import { useState, useEffect } from 'react'
import { X, Tag, Loader2, Plus, Pencil, Trash2, Sparkles, User } from 'lucide-react'
import { getCategoryRules, createManualCategoryRule, updateManualCategoryRule, deleteCategoryRule } from '@/app/categoryRuleActions'

export function CategoryRulesModal({ onClose, categories }: { onClose: () => void, categories: any[] }) {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function loadRules() {
    setLoading(true)
    const result = await getCategoryRules()
    setRules(result)
    setLoading(false)
  }

  useEffect(() => { loadRules() }, [])

  function resetForm() {
    setPattern(''); setCategoryId(''); setEditingId(null); setShowForm(false)
  }

  function startEdit(rule: any) {
    setEditingId(rule.id)
    setPattern(rule.pattern)
    setCategoryId(rule.categoryId)
    setShowForm(true)
  }

  async function handleSave() {
    if (!pattern.trim() || !categoryId) {
      alert('Preencha o texto da regra e escolha uma categoria.')
      return
    }
    setSaving(true)
    const res = editingId
      ? await updateManualCategoryRule(editingId, pattern, categoryId)
      : await createManualCategoryRule(pattern, categoryId)
    setSaving(false)
    if (res.success) {
      resetForm()
      loadRules()
    } else {
      alert(res.message || 'Erro ao salvar regra.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta regra de categorização?')) return
    await deleteCategoryRule(id)
    loadRules()
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name || 'Categoria removida'

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">

        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Tag className="w-5 h-5 text-purple-500" /> Regras de Categorização
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Usadas para sugerir a categoria certa nas próximas importações e lançamentos.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
        ) : (
          <div className="space-y-3">
            {rules.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-6">
                Nenhuma regra ainda. Elas aparecem sozinhas conforme você categoriza transações, ou você pode criar uma na mão abaixo.
              </p>
            )}

            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${rule.source === 'manual' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {rule.source === 'manual' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">&quot;{rule.pattern}&quot; → {categoryName(rule.categoryId)}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{rule.source === 'manual' ? 'Manual' : `Aprendida automaticamente · usada ${rule.matchCount}x`}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(rule)} className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(rule.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}

            {showForm ? (
              <div className="bg-zinc-950 border border-purple-500/30 rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Se a descrição contiver...</label>
                  <input
                    placeholder='Ex: "UBER", "NETFLIX", "POSTO"'
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-purple-600"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Categorizar automaticamente como</label>
                  <select
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-purple-600 appearance-none"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? 'Salvar Alterações' : 'Criar Regra')}
                  </button>
                  <button onClick={resetForm} className="px-4 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition-all">Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} className="w-full border border-dashed border-zinc-700 hover:border-purple-500 text-zinc-400 hover:text-purple-400 rounded-xl p-4 flex items-center justify-center gap-2 font-bold text-sm transition-all">
                <Plus className="w-4 h-4" /> Nova Regra Manual
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
