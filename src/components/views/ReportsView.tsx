'use client'

import { Download, MessageSquare, Loader2, X, Briefcase } from 'lucide-react'

export function ReportsView({ theme, currentTheme, isPro, analyzing, advice, onPDF, onAnalyze, onClearAdvice, viewLabel, periodLabel }: any) {
  const proTag = !isPro && <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 rounded font-bold">PRO</span>
  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className={`text-2xl font-bold ${theme.text}`}>Relatórios</h1>
        <p className={`text-sm ${theme.textMuted}`}>Visão atual: {viewLabel} · {periodLabel}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={onPDF} className={`${theme.card} border rounded-2xl p-5 text-left space-y-2 transition-all ${theme.cardHover}`}>
          <div className="flex items-center gap-2"><Download className="w-5 h-5 text-blue-500" /><h3 className={`font-bold ${theme.text}`}>Relatório em PDF</h3>{proTag}</div>
          <p className={`text-sm ${theme.textMuted}`}>Gera o relatório do período com receitas, despesas e categorias, pronto para baixar.</p>
        </button>

        <button onClick={onAnalyze} disabled={analyzing} className={`${theme.card} border rounded-2xl p-5 text-left space-y-2 transition-all ${theme.cardHover} disabled:opacity-60`}>
          <div className="flex items-center gap-2">
            {analyzing ? <Loader2 className="w-5 h-5 animate-spin text-purple-500" /> : <MessageSquare className="w-5 h-5 text-purple-500" />}
            <h3 className={`font-bold ${theme.text}`}>{analyzing ? 'Analisando…' : 'Análise por IA (CFO Virtual)'}</h3>{proTag}
          </div>
          <p className={`text-sm ${theme.textMuted}`}>Um parecer sobre o mês: onde está gastando mais, o que fugiu do padrão e o que pode melhorar.</p>
        </button>
      </div>

      {advice && (
        <div className={`${theme.card} border p-6 rounded-2xl relative`}>
          <button onClick={onClearAdvice} className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-colors"><X className="w-5 h-5" /></button>
          <div className="flex flex-col md:flex-row gap-4">
            <div className={`p-3 rounded-xl h-fit w-fit ${theme.iconBg}`}><Briefcase className="w-8 h-8" /></div>
            <div className="space-y-2">
              <h3 className="font-bold text-lg flex items-center gap-2">Parecer Técnico <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold ${currentTheme === 'dark' ? 'bg-blue-600 text-white' : 'bg-black text-white'}`}>CFO Virtual</span></h3>
              <div className={`text-sm leading-relaxed whitespace-pre-line ${theme.textMuted}`}>{advice}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
