'use client'

import { useState } from 'react'
import { X, Calendar, FileText, Sparkles, Loader2, Download, TrendingUp, User, Building2, Layers, Lock, Crown } from 'lucide-react'
import { generateRangeReport } from '@/app/actions'
import ReactMarkdown from 'react-markdown'
import { generatePDF } from '@/utils/generatePDF'

export function ReportModal({ onClose, userPlan, onRequestPremium }: { onClose: () => void, userPlan: string, onRequestPremium: () => void }) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [startMonth, setStartMonth] = useState(currentMonth)
  const [endMonth, setEndMonth] = useState(currentMonth)
  const [filterType, setFilterType] = useState('all')
  
  const [loading, setLoading] = useState(false)
  const [reportResult, setReportResult] = useState<any>(null)
  const [aiAdvice, setAiAdvice] = useState('')
  const [isResultPro, setIsResultPro] = useState(false)

  async function handleGenerate() {
    if (startMonth > endMonth) {
      alert("A data inicial não pode ser maior que a final!");
      return;
    }

    setLoading(true);
    setAiAdvice('');
    setReportResult(null);

    const res = await generateRangeReport(startMonth, endMonth, filterType);
    
    setLoading(false);

    if (res.success) {
        setAiAdvice(res.message);
        setReportResult(res.stats);
        setIsResultPro(res.isPro || false); 
    } else {
        alert("Erro: " + res.message);
    }
  }

  async function handleDownloadPDF() {
    if (!reportResult) return;
    await generatePDF(reportResult, aiAdvice, { start: startMonth, end: endMonth }, filterType, isResultPro);
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      
      {/* Container Principal: PADDING REDUZIDO NO MOBILE (p-4) */}
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-2xl rounded-2xl p-4 sm:p-6 space-y-5 shadow-2xl relative max-h-[85vh] overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-2 border-b border-zinc-800/50">
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-purple-500 shrink-0" />
            <span className="truncate">Relatórios {userPlan === 'free' ? 'Básicos' : 'Avançados'}</span>
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2 -mr-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* BOTÕES DE FILTRO */}
        <div className="flex flex-col sm:flex-row gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-full">
            <button onClick={() => setFilterType('all')} className={`flex-1 py-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${filterType === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Layers className="w-3 h-3" /> Geral</button>
            <button onClick={() => setFilterType('pf')} className={`flex-1 py-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${filterType === 'pf' ? 'bg-purple-900/30 text-purple-400 border border-purple-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}><User className="w-3 h-3" /> P. Física</button>
            <button onClick={() => setFilterType('pj')} className={`flex-1 py-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${filterType === 'pj' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}><Building2 className="w-3 h-3" /> P. Jurídica</button>
        </div>

        {/* SELEÇÃO DE DATAS - VERSÃO 'CLEAN' SEM CONTAINER EXTERNO NO MOBILE */}
        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:bg-zinc-950 sm:p-4 sm:rounded-xl sm:border sm:border-zinc-800">
            <div className="w-full">
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Data Inicial</label>
                <input 
                  type="month" 
                  value={startMonth} 
                  onChange={(e) => setStartMonth(e.target.value)} 
                  className="w-full appearance-none bg-zinc-950 sm:bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                />
            </div>
            <div className="w-full">
                <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1 block">Data Final</label>
                <input 
                  type="month" 
                  value={endMonth} 
                  onChange={(e) => setEndMonth(e.target.value)} 
                  className="w-full appearance-none bg-zinc-950 sm:bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                />
            </div>
        </div>

        <button 
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 active:scale-[0.98]"
        >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? "Processando Inteligência..." : "Gerar Relatório"}
        </button>

        {reportResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full">
                
                {/* CARDS DE RESUMO */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Saldo</p>
                        <p className={`text-xl sm:text-2xl font-mono font-bold mt-1 break-words ${reportResult.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reportResult.balance)}
                        </p>
                    </div>
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Gastos</p>
                        <p className="text-lg sm:text-xl font-mono font-bold text-zinc-200 mt-1 break-words">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reportResult.avgExpense)}
                        </p>
                    </div>
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Receita</p>
                        <p className="text-lg sm:text-xl font-mono font-bold text-emerald-500 mt-1 break-words">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reportResult.income)}
                        </p>
                    </div>
                </div>

                {/* ANÁLISE IA */}
                <div className={`p-4 sm:p-6 rounded-xl border relative overflow-hidden ${isResultPro ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-950 border-zinc-800'}`}>
                    <h3 className="flex items-center gap-2 font-bold text-purple-400 mb-4 border-b border-zinc-800 pb-2 text-sm sm:text-base">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> CFO Virtual
                    </h3>
                    
                    {isResultPro ? (
                        <div className="text-zinc-300 text-sm leading-relaxed">
                            <ReactMarkdown
                                components={{
                                    h1: ({node, ...props}) => <h1 className="text-lg font-bold text-white mb-3 mt-2" {...props} />,
                                    h2: ({node, ...props}) => <h2 className="text-base font-bold text-white mb-2 mt-4 border-l-4 border-purple-500 pl-3" {...props} />,
                                    strong: ({node, ...props}) => <strong className="text-white font-bold" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 mb-3 marker:text-purple-500" {...props} />,
                                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                    p: ({node, ...props}) => <p className="mb-3 text-justify" {...props} />,
                                }}
                            >
                                {aiAdvice}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="text-zinc-600 text-sm leading-relaxed blur-[6px] select-none">
                                <p>Com base na análise dos seus dados financeiros deste período, identifiquei oportunidades claras de melhoria. Sua média de gastos está...</p>
                                <p>Recomendo fortemente que você revise as assinaturas mensais e foque em aumentar a receita passiva. O saldo atual indica...</p>
                            </div>
                            
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/60 z-10 p-4 text-center">
                                <Lock className="w-8 h-8 text-yellow-400 mb-2" />
                                <h4 className="text-white font-bold mb-1">Bloqueado</h4>
                                <p className="text-zinc-400 text-xs mb-3">O CFO Virtual analisa seus gastos.</p>
                                <button 
                                    onClick={onRequestPremium}
                                    className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-4 py-2 rounded-full text-xs hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                                >
                                    <Crown className="w-3 h-3"/> Liberar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleDownloadPDF}
                    className="w-full bg-white hover:bg-zinc-200 text-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold group shadow-lg"
                >
                    <Download className="w-4 h-4 group-hover:scale-110 transition-transform" /> 
                    {isResultPro ? "Baixar Relatório Completo" : "Baixar Básico (PDF)"}
                </button>
            </div>
        )}

      </div>
    </div>
  )
}