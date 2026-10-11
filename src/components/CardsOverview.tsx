'use client'

import { CreditCard, CheckCircle2, ListChecks, Settings2 } from 'lucide-react'
import { accentFor } from '@/utils/ownerAccent'

const diffDays = (fromStr: string, toStr: string) => {
  const [fy, fm, fd] = fromStr.split('-').map(Number)
  const [ty, tm, td] = toStr.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}
const fmtDate = (s: string) => s.split('-').reverse().slice(0, 2).join('/')

// Cartões como painel: fatura aberta, quando fecha/vence, o que já fechou e
// não foi pago, e quanto de cada fatura é de cada dono.
// Recebe os dados prontos (overview); quem busca é a tela que o usa.
export function CardsOverview({ theme, formatCurrency, cards, owners, todayStr, onViewItems, onPay, onManage }: any) {
  // mesma cor do dono em toda a tela (Paulo, Adri, Empresa...)
  const ownerDot = (id: string) => (id === 'none' ? 'bg-slate-400' : accentFor(id, owners).dot)
  const ownerName = (id: string) => (id === 'none' ? 'Sem dono' : owners.find((o: any) => o.id === id)?.name || '—')

  const ownerShare = (cycle: any) => {
    const entries = Object.entries(cycle.byOwner || {}) as [string, number][]
    if (cycle.isManual || entries.length === 0) return null
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1
    return (
      <div className="space-y-1">
        <div className="flex h-2 rounded-full overflow-hidden bg-black/5">
          {entries.map(([id, v]) => <div key={id} className={ownerDot(id)} style={{ width: `${(v / total) * 100}%` }} title={`${ownerName(id)}: ${formatCurrency(v)}`} />)}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {entries.sort((a, b) => b[1] - a[1]).map(([id, v]) => (
            <span key={id} className={`text-[10px] flex items-center gap-1 ${theme.textMuted}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ownerDot(id)}`} />
              {ownerName(id)} {formatCurrency(v)}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (!cards || cards.length === 0) {
    return (
      <div className={`${theme.card} border rounded-2xl p-6 text-center space-y-3`}>
        <CreditCard className={`w-8 h-8 mx-auto ${theme.textMuted}`} />
        <p className={`text-sm ${theme.textMuted}`}>Nenhum cartão cadastrado ainda.</p>
        <button onClick={onManage} className={`text-sm font-bold px-4 py-2 rounded-full ${theme.button}`}>Cadastrar cartão</button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {cards.map((card: any) => {
        const open = card.openCycle
        const closesIn = open ? diffDays(todayStr, open.closingDate) : null
        return (
          <div key={card.id} className={`${theme.card} border rounded-2xl p-4 space-y-3`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className={`font-bold flex items-center gap-2 ${theme.text}`}><CreditCard className="w-4 h-4 text-blue-500 shrink-0" /><span className="truncate">{card.name}</span></h3>
                <p className={`text-[10px] uppercase tracking-wider ${theme.textMuted}`}>
                  {owners.find((o: any) => o.id === card.ownerId)?.name || 'Sem dono'} · fecha dia {card.closingDay} · vence dia {card.dueDay}
                </p>
              </div>
              <button onClick={onManage} className={`p-1.5 rounded-lg ${theme.textMuted} hover:bg-black/5`} title="Gerenciar cartões"><Settings2 className="w-4 h-4" /></button>
            </div>

            <div className={`rounded-xl p-3 space-y-2 ${theme.iconBg}`}>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className={`text-[10px] font-bold uppercase ${theme.textMuted}`}>Fatura aberta</p>
                  <p className={`font-mono font-bold text-xl ${theme.text}`}>{formatCurrency(open ? open.total : 0)}</p>
                </div>
                {open && (
                  <div className="text-right">
                    <p className={`text-[11px] font-bold ${theme.text}`}>{closesIn === 0 ? 'Fecha hoje' : closesIn === 1 ? 'Fecha amanhã' : `Fecha em ${closesIn} dias`}</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>fecha {fmtDate(open.closingDate)} · vence {fmtDate(open.dueDate)}</p>
                  </div>
                )}
              </div>
              {open && ownerShare(open)}
              {open && (
                <button onClick={() => onViewItems(card.id, open.cycleKey)} className="text-xs font-bold text-blue-500 hover:underline flex items-center gap-1">
                  <ListChecks className="w-3.5 h-3.5" /> Ver os {open.count > 0 ? `${open.count} ` : ''}itens cobrados
                </button>
              )}
            </div>

            {card.closedUnpaidCycles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-red-500">Fechadas e não pagas · {formatCurrency(card.closedUnpaidTotal)}</p>
                {card.closedUnpaidCycles.map((cycle: any) => (
                  <div key={cycle.cycleKey} className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-red-500">{formatCurrency(cycle.total)}</p>
                        <p className={`text-[10px] ${theme.textMuted}`}>{cycle.dueDate < todayStr ? 'Venceu' : 'Vence'} em {fmtDate(cycle.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onViewItems(card.id, cycle.cycleKey)} className="text-xs font-bold text-blue-500 hover:underline">ver itens</button>
                        <button onClick={() => onPay(card.id, cycle.cycleKey, cycle.total)} className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all"><CheckCircle2 className="w-3 h-3" /> Pagar</button>
                      </div>
                    </div>
                    {ownerShare(cycle)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
