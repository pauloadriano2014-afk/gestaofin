'use client'

import { Clock, CheckCircle2, Circle, Pencil, Trash2, AlertCircle, Briefcase, User, CreditCard, Check } from 'lucide-react'

// Uma linha de lançamento, usada em Lançamentos, Contas e Categorias.
// Sem regra de negócio: só mostra e dispara os callbacks recebidos.
export function TransactionRow({
  tx, theme, currentTheme, formatCurrency, ownerName, cardName, todayStr,
  onTogglePay, onEdit, onDelete, selectable, selected, onSelect, signedAmount,
}: any) {
  const isLate = !tx.isPaid && tx.date < todayStr
  const isToday = !tx.isPaid && tx.date === todayStr
  const hasOriginal = tx.originalAmount !== null && tx.originalAmount !== undefined
  const diff = hasOriginal ? Number(tx.amount) - Number(tx.originalAmount) : 0
  const isExpense = tx.type === 'expense'
  const isTransfer = tx.type === 'transfer'
  const amount = Math.abs(Number(tx.amount))
  const [, mm, dd] = tx.date.split('-')

  const amountColor = !signedAmount ? theme.text : isTransfer ? theme.textMuted : isExpense ? 'text-red-500' : 'text-emerald-500'
  const sign = !signedAmount ? '' : isTransfer ? '' : isExpense ? '-' : '+'

  return (
    <div className={`flex justify-between items-center gap-2 p-3 rounded-xl border transition-colors ${selected ? 'border-blue-500/60 ring-1 ring-blue-500/30' : ''} ${currentTheme === 'dark' ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-100 hover:border-blue-200 shadow-sm'}`}>
      <div className="flex items-center gap-3 min-w-0">
        {selectable && (
          <button onClick={() => onSelect?.(tx.id)} aria-label="Selecionar" className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-transparent hover:border-blue-400'}`}>
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onTogglePay?.(tx.id, tx.isPaid)} className={`p-2 rounded-full transition-all shrink-0 ${tx.isPaid ? 'text-emerald-600 bg-emerald-500/10' : 'text-slate-400 bg-slate-100/50 hover:text-orange-500'}`} title={tx.isPaid ? 'Paga' : 'Dar baixa'}>
          {tx.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>
        <div className="min-w-0">
          <p className={`font-semibold text-sm truncate ${tx.isPaid ? 'text-zinc-500 line-through' : theme.text}`}>{tx.description}</p>
          <p className={`text-[10px] font-bold uppercase flex items-center gap-1.5 flex-wrap ${theme.textMuted}`}>
            {tx.entityType === 'pj' ? <Briefcase className="w-3 h-3 text-blue-500 shrink-0" /> : <User className="w-3 h-3 opacity-50 shrink-0" />}
            {ownerName && <span className="normal-case">{ownerName}</span>}
            {cardName && <span className="normal-case flex items-center gap-0.5"><CreditCard className="w-3 h-3" />{cardName}</span>}
            {isLate ? (
              <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3 h-3" /> VENCIDO (Dia {dd})</span>
            ) : isToday ? (
              <span className="flex items-center gap-1 text-amber-500 font-bold"><Clock className="w-3 h-3" /> VENCE HOJE</span>
            ) : (
              <span>Dia {dd}/{mm}</span>
            )}
            {tx.isFixed && <span className="opacity-60">• Fixo</span>}
          </p>
          {hasOriginal && Math.abs(diff) > 0.009 && (
            <p className={`text-[9px] font-bold pt-0.5 ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              Original: {formatCurrency(Number(tx.originalAmount))} • {diff > 0 ? 'Juros' : 'Desconto'} de {formatCurrency(Math.abs(diff))}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className={`font-bold font-mono text-sm ${amountColor}`}>{sign}{formatCurrency(amount)}</p>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${tx.isPaid ? 'text-emerald-600' : isLate ? 'text-red-500' : 'text-orange-500'}`}>{tx.isPaid ? 'PAGO' : 'PENDENTE'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => onEdit?.(tx)} className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete?.(tx.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  )
}
