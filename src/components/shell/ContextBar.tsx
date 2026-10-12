'use client'

import { useRef, useState } from 'react'
import {
  Layers, User, Briefcase, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
  Upload, Plus, FileText, CreditCard, Repeat, Loader2,
} from 'lucide-react'

// Linha de contexto, sempre visível no topo da área de conteúdo:
//   QUEM estou olhando (Tudo / Casal / Paulo / Adri / Empresa) +
//   QUANDO (mês isolado ou período) + as duas ações principais (Importar, Lançar).
export function ContextBar({
  theme, currentTheme,
  viewOptions, viewMode, onViewMode, accentOf,
  periodMode, onPeriodMode,
  startYear, startMonth, endYear, endMonth,
  onSelectMonth, onShiftMonth, onRangeStart, onRangeEnd,
  isolatePeriod, onToggleIsolate,
  uploadStatus, onImportCsv, onImportCard, onSyncAsaas, onNewTransaction,
}: any) {
  const [importOpen, setImportOpen] = useState(false)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const openPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    try { ref.current?.showPicker?.() } catch { /* sem suporte a showPicker(): o clique no campo já funciona */ }
  }
  const fieldBox = `flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors hover:border-blue-400 ${currentTheme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-gray-50 border-gray-200'}`
  const label = `text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 ${theme.textMuted}`
  const inputCls = `w-full bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:hidden ${theme.text}`
  const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

  const menuItem = (icon: any, title: string, hint: string, run: () => void) => {
    const Icon = icon
    return (
      <button onClick={() => { setImportOpen(false); run() }} className={`w-full text-left flex items-start gap-3 px-3 py-2 rounded-xl transition-all ${theme.cardHover}`}>
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <span><span className="block text-sm font-bold">{title}</span><span className={`block text-[11px] ${theme.textMuted}`}>{hint}</span></span>
      </button>
    )
  }

  return (
    <div className="md:sticky md:top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 flex flex-col gap-3 backdrop-blur" style={{ backgroundColor: `${theme.hex}f2` }}>
      {/* QUEM */}
      <div className="flex gap-2 overflow-x-auto py-1 px-1 -mx-1">
        {viewOptions.map((opt: any) => {
          const active = viewMode === opt.id
          const accent = accentOf(opt.id)
          return (
            <button
              key={opt.id}
              onClick={() => onViewMode(opt.id)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full border transition-all ${active ? (accent.chipActive || theme.navActive) + ' border-transparent' : `${theme.card} ${theme.navInactive}`}`}
            >
              <span className={`w-2 h-2 rounded-full ${active ? 'bg-white/90' : accent.dot}`} />
              {opt.kind === 'all' ? <Layers className="w-3.5 h-3.5" /> : opt.kind === 'pj' ? <Briefcase className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* QUANDO + AÇÕES */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl border ${theme.card}`}>
          <div className={`flex p-1 rounded-xl shrink-0 ${currentTheme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100'}`}>
            {([['month', 'Mês isolado'], ['range', 'Período']] as const).map(([mode, text]) => (
              <button key={mode} onClick={() => onPeriodMode(mode)} className={`flex-1 whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${periodMode === mode ? theme.navActive : theme.navInactive}`}>{text}</button>
            ))}
          </div>

          {periodMode === 'month' ? (
            <div className="flex items-center gap-1 flex-1">
              <button onClick={() => onShiftMonth(-1)} className={`p-2 rounded-xl border transition-colors hover:border-blue-400 ${theme.card}`} title="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
              <div onClick={() => openPicker(startRef)} className={fieldBox}>
                <CalendarIcon className={`w-4 h-4 shrink-0 ${theme.textMuted}`} />
                <div className="min-w-0">
                  <p className={label}>Mês</p>
                  <input ref={startRef} type="month" value={ym(startYear, startMonth)} onChange={(e) => { if (!e.target.value) return; const [y, m] = e.target.value.split('-'); onSelectMonth(Number(y), Number(m)) }} className={inputCls} />
                </div>
              </div>
              <button onClick={() => onShiftMonth(1)} className={`p-2 rounded-xl border transition-colors hover:border-blue-400 ${theme.card}`} title="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-1">
                <div onClick={() => openPicker(startRef)} className={fieldBox}>
                  <CalendarIcon className={`w-4 h-4 shrink-0 ${theme.textMuted}`} />
                  <div className="min-w-0"><p className={label}>De</p>
                    <input ref={startRef} type="month" value={ym(startYear, startMonth)} onChange={(e) => { if (!e.target.value) return; const [y, m] = e.target.value.split('-'); onRangeStart(Number(y), Number(m)) }} className={inputCls} /></div>
                </div>
                <div onClick={() => openPicker(endRef)} className={fieldBox}>
                  <CalendarIcon className={`w-4 h-4 shrink-0 ${theme.textMuted}`} />
                  <div className="min-w-0"><p className={label}>Até</p>
                    <input ref={endRef} type="month" value={ym(endYear, endMonth)} onChange={(e) => { if (!e.target.value) return; const [y, m] = e.target.value.split('-'); onRangeEnd(Number(y), Number(m)) }} className={inputCls} /></div>
                </div>
              </div>
              <button
                onClick={onToggleIsolate}
                className={`flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all shrink-0 ${isolatePeriod ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : theme.navInactive}`}
                title="Ligado: o Saldo Principal ignora tudo que veio antes e conta só este período. Desligado: soma tudo desde o começo até o fim do período."
              >
                {isolatePeriod ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                Começar do zero neste período
              </button>
            </>
          )}
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:flex-none">
            <button onClick={() => setImportOpen(!importOpen)} disabled={!!uploadStatus} className={`w-full ${theme.buttonSecondary} active:scale-95 px-5 py-3 rounded-full font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all border ${uploadStatus ? 'bg-purple-100 text-purple-600 border-purple-300' : ''}`}>
              {uploadStatus ? <Loader2 className="w-5 h-5 animate-spin text-purple-600" /> : <Upload className="w-5 h-5" />}
              {uploadStatus ? uploadStatus : 'Importar'}
            </button>
            {importOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setImportOpen(false)} />
                <div className={`absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border shadow-xl p-2 ${theme.card}`}>
                  {menuItem(FileText, 'Extrato do banco (.csv)', 'Conta corrente, Asaas etc.', onImportCsv)}
                  {menuItem(Repeat, 'Sincronizar vendas do Asaas', 'Direto da API, no período selecionado', onSyncAsaas)}
                  {menuItem(CreditCard, 'Fatura do cartão', '.csv, .ofx ou .pdf — vai para o dono do cartão', onImportCard)}
                </div>
              </>
            )}
          </div>
          <button onClick={onNewTransaction} className={`flex-1 lg:flex-none ${theme.button} active:scale-95 px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all`}>
            <Plus className="w-5 h-5" /> Lançar
          </button>
        </div>
      </div>
    </div>
  )
}
