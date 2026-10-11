'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, ChevronDown, ClipboardCheck } from 'lucide-react'

// "Fechamento do mês": checklist curto do que ainda precisa de atenção.
// Cada pendência leva direto para a tela onde se resolve.
export function MonthCloseChecklist({ theme, checklist, onGo, defaultOpen = false }: any) {
  const [open, setOpen] = useState(defaultOpen)
  const { items, done, total } = checklist
  const allOk = done === total

  return (
    <div className={`${theme.card} border rounded-2xl p-4`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 text-left">
        <span className={`font-bold flex items-center gap-2 flex-wrap ${theme.text}`}>
          <ClipboardCheck className={`w-4 h-4 shrink-0 ${allOk ? 'text-emerald-500' : 'text-amber-500'}`} />
          Fechamento do mês
          <span className={`text-xs font-normal ${theme.textMuted}`}>{done} de {total} conferidos</span>
          {allOk && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">tudo certo</span>}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${theme.textMuted} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {items.map((item: any) => (
            <li key={item.id} className={`flex items-start gap-3 p-3 rounded-xl border ${item.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              {item.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold ${theme.text}`}>{item.title}</p>
                <p className={`text-xs ${theme.textMuted}`}>{item.detail}</p>
              </div>
              {!item.ok && item.target && (
                <button onClick={() => onGo(item.target)} className="text-xs font-bold text-blue-500 hover:underline shrink-0">Ver</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
