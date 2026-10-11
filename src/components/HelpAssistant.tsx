'use client'

import { useMemo, useState } from 'react'
import { HelpCircle, X, Search, ChevronDown, Calculator, MessageCircleQuestion } from 'lucide-react'
import { HELP_ENTRIES, searchHelp, explainNumbers, type ExcludedLine } from '@/utils/help'

// Botão flutuante "?" com duas abas:
//  - Perguntas: respostas prontas sobre como o app calcula as coisas (com busca);
//  - Meus números: explica, com os dados da tela atual, de onde vem cada valor
//    e aponta as causas mais comuns de "não bate". Sem IA.
export function HelpAssistant({ theme, rawData, viewMode, isolatePeriod, formatCurrency, viewLabel, open, onOpenChange, focusId }: any) {
  const setOpen = (v: boolean) => onOpenChange(v)
  const [tab, setTab] = useState<'faq' | 'numbers'>('faq')
  const [query, setQuery] = useState('')
  const [openIdState, setOpenIdState] = useState<string | null>(null)
  // Quando alguém abre a ajuda por um "?" de card, já vem com aquela resposta aberta.
  const [lastFocus, setLastFocus] = useState<string | null>(null)
  if (focusId !== lastFocus) { setLastFocus(focusId ?? null); if (focusId) { setOpenIdState(focusId); setTab('faq'); setQuery('') } }
  const openId = openIdState
  const setOpenId = setOpenIdState

  const results = useMemo(() => (query.trim().length > 0 ? searchHelp(query) : HELP_ENTRIES), [query])
  const explanation = useMemo(
    () => (open && tab === 'numbers' ? explainNumbers(rawData, viewMode, isolatePeriod) : null),
    [open, tab, rawData, viewMode, isolatePeriod]
  )

  const row = (label: string, value: number, strong = false) => (
    <div className={`flex justify-between gap-3 text-sm ${strong ? 'font-bold' : ''}`}>
      <span>{label}</span><span className="font-mono">{formatCurrency(value)}</span>
    </div>
  )
  const excluded = (list: ExcludedLine[]) => list.map((l) => (
    <div key={l.label} className={`flex justify-between gap-3 text-xs pl-3 ${theme.textMuted}`}>
      <span>− {l.label} ({l.count})</span><span className="font-mono">{formatCurrency(l.amount)}</span>
    </div>
  ))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-20 md:bottom-5 right-4 md:right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-xl font-bold text-sm transition-all hover:scale-105 ${theme.button}`}
        title="Tira-dúvidas"
      >
        <HelpCircle className="w-5 h-5" /> Ajuda
      </button>

      {open && (
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-end justify-center sm:justify-end sm:pr-5 sm:pb-20 pointer-events-none">
          <div className="fixed inset-0 bg-black/30 pointer-events-auto sm:hidden" onClick={() => setOpen(false)} />
          <div className={`pointer-events-auto relative w-full sm:w-[26rem] max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl border shadow-2xl ${theme.card} ${theme.text}`}>
            <div className="flex items-center justify-between p-4 border-b border-black/5">
              <h2 className="font-bold flex items-center gap-2"><HelpCircle className="w-5 h-5" /> Tira-dúvidas</h2>
              <button onClick={() => setOpen(false)} className={theme.textMuted}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-1 p-2">
              {([['faq', 'Perguntas', MessageCircleQuestion], ['numbers', 'Meus números', Calculator]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-all ${tab === id ? theme.navActive : theme.navInactive}`}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-4 pt-2 space-y-3">
              {tab === 'faq' ? (
                <>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${theme.card}`}>
                    <Search className={`w-4 h-4 shrink-0 ${theme.textMuted}`} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: por que o saldo não bate?" className="w-full bg-transparent text-sm outline-none" />
                  </div>
                  {results.length === 0 && <p className={`text-sm ${theme.textMuted}`}>Não achei nada com essas palavras. Tente outras, ou veja a aba &quot;Meus números&quot;.</p>}
                  {results.map((e) => (
                    <div key={e.id} className={`rounded-xl border ${theme.card}`}>
                      <button onClick={() => setOpenId(openId === e.id ? null : e.id)} className="w-full flex items-center justify-between gap-2 text-left p-3 text-sm font-bold">
                        <span>{e.question}</span>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${openId === e.id ? 'rotate-180' : ''}`} />
                      </button>
                      {openId === e.id && <p className={`px-3 pb-3 text-sm leading-relaxed ${theme.textMuted}`}>{e.answer}</p>}
                    </div>
                  ))}
                </>
              ) : explanation && (
                <>
                  <p className={`text-xs ${theme.textMuted}`}>
                    Conta feita com o que está na tela agora: <b>{viewLabel}</b>, modo <b>{explanation.mode === 'isolado' ? 'mês isolado' : 'período acumulado'}</b>.
                  </p>

                  <div className={`rounded-xl border p-3 space-y-1 ${theme.card}`}>
                    <p className="text-xs font-bold uppercase tracking-wider">Despesas</p>
                    {row('Todas as saídas (bruto)', explanation.despesas.bruto)}
                    {excluded(explanation.despesas.excluidos)}
                    {row('= Despesas de fato', explanation.despesas.operacional, true)}
                  </div>

                  <div className={`rounded-xl border p-3 space-y-1 ${theme.card}`}>
                    <p className="text-xs font-bold uppercase tracking-wider">Receita</p>
                    {row('Todas as entradas (bruto)', explanation.receita.bruto)}
                    {excluded(explanation.receita.excluidos)}
                    {row('= Receita operacional', explanation.receita.operacional, true)}
                  </div>

                  <div className={`rounded-xl border p-3 space-y-1 ${theme.card}`}>
                    <p className="text-xs font-bold uppercase tracking-wider">Saldo do período</p>
                    {row('Entradas − saídas', explanation.saldoDoPeriodo, true)}
                    {explanation.ignoradosNoSaldo.length > 0 && <p className={`text-[11px] ${theme.textMuted}`}>Ficaram de fora do saldo:</p>}
                    {excluded(explanation.ignoradosNoSaldo)}
                  </div>

                  {explanation.alertas.length > 0 ? (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider">O que pode estar fazendo não bater</p>
                      {explanation.alertas.map((a, i) => <p key={i} className="text-sm leading-relaxed">• {a}</p>)}
                    </div>
                  ) : (
                    <p className={`text-sm ${theme.textMuted}`}>Nada suspeito encontrado nos lançamentos desta tela.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
