'use client'

import { useState } from 'react'
import { X, Target, Save, Loader2 } from 'lucide-react'
import { updateCategoryBudget } from '@/app/actions'

export function BudgetModal({ category, onClose }: { category: any, onClose: () => void }) {
  // Se o budget for 0 ou null, mostra vazio no input
  const [budget, setBudget] = useState(category.budget && Number(category.budget) > 0 ? category.budget : '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    // Se deixar vazio, manda "0" para limpar a meta
    await updateCategoryBudget(category.id, budget === '' ? '0' : budget)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-2xl p-6 space-y-6 shadow-2xl">
        
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="text-purple-500 w-6 h-6" />
            Meta: {category.name}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Limite Mensal (R$)</label>
          <div className="relative">
            <span className="absolute left-4 top-4 text-zinc-500 font-bold">R$</span>
            <input 
              type="number" 
              autoFocus
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 pl-10 text-white outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all text-xl font-mono"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <p className="text-[10px] text-zinc-600">
            Defina 0 ou deixe vazio para remover a meta.
          </p>
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 p-4 rounded-xl font-bold text-white flex justify-center items-center gap-2 transition-all active:scale-95"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
          Salvar Meta
        </button>
      </div>
    </div>
  )
}