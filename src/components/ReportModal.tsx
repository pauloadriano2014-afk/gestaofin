'use client'

import { useState } from 'react'
import { X, Calendar, FileText, Sparkles, Loader2, Download, TrendingUp, User, Building2, Layers, Lock, Crown } from 'lucide-react'
import { generateRangeReport } from '@/app/actions'
import ReactMarkdown from 'react-markdown'
import { generatePDF } from '@/utils/generatePDF'

// Adicionei props: onRequestPremium
export function ReportModal({ onClose, userPlan, onRequestPremium }: { onClose: () => void, userPlan: string, onRequestPremium: () => void }) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [startMonth, setStartMonth] = useState(currentMonth)
  const [endMonth, setEndMonth] = useState(currentMonth)
  const [filterType, setFilterType] = useState('all')
  
  const [loading, setLoading] = useState(false)
  const [reportResult, setReportResult] = useState<any>(null)
  const [aiAdvice, setAiAdvice] = useState('')
  const [isResultPro, setIsResultPro] = useState(false) // Novo estado

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
        // CORREÇÃO PARA O DEPLOY: Garante que o valor seja booleano (true/false) e nunca undefined
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
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-2">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-purple-500" />
            Relatórios {userPlan === 'free' ? 'Básicos' : 'Avançados'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* SELEÇÃO DE TIPO (ABAS) */}
        <div className="flex flex-col sm:flex-row gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button onClick={() => setFilterType('all')} className={`flex-1 py-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${filterType === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}><Layers className="w-3 h-3" /> Geral</button>
            <button onClick={() => setFilterType('pf')} className={`flex-1 py-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${filterType === 'pf' ? 'bg-purple-900/30 text-purple-400 border border-purple-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}><User className="w-3 h-3" /> Pessoa Física</button>
            <button onClick={() => setFilterType('pj')} className={`flex-1 py-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${filterType === 'pj' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}><Building2 className="w-3 h-3" /> Pessoa Jurídica</button>
        </div>

        {/* SELEÇÃO DE DATAS - CORREÇÃO DE LAYOUT MOBILE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
            <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">De:</label>
                <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white outline-none focus:border-purple-500 transition-colors"/>
            </div>
            <div>
                <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Até:</label>
                <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white outline-none focus:border-purple-500 transition-colors"/>
            </div>
        </div>

        <button 
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 active:scale-[0.98]"
        >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? "Processando Inteligência..." : "Gerar Relatório"}
        </button>

        {reportResult && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* CARDS DE RESUMO (VISÍVEL PARA TODOS) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Saldo do Período</p>
                        <p className={`text-2xl font-mono font-bold mt-1 ${reportResult.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reportResult.balance)}
                        </p>
                    </div>
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Média Gastos/Mês</p>
                        <p className="text-xl font-mono font-bold text-zinc-200 mt-1">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reportResult.avgExpense)}
                        </p>
                    </div>
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Total Receita</p>
                        <p className="text-xl font-mono font-bold text-emerald-500 mt-1">
                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reportResult.income)}
                        </p>
                    </div>
                </div>

                {/* ANÁLISE IA (TRAVADA SE FOR FREE) */}
                <div className={`p-6 rounded-xl border relative overflow-hidden ${isResultPro ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-950 border-zinc-800'}`}>
                    <h3 className="flex items-center gap-2 font-bold text-purple-400 mb-6 border-b border-zinc-800 pb-2">
                        <TrendingUp className="w-5 h-5" /> Parecer do CFO Virtual
                    </h3>
                    
                    {isResultPro ? (
                        // CONTEÚDO PRO (LIBERADO)
                        <div className="text-zinc-300 text-sm leading-relaxed">
                            <ReactMarkdown
                                components={{
                                    h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mb-4 mt-2" {...props} />,
                                    h2: ({node, ...props}) => <h2 className="text-lg font-bold text-white mb-3 mt-6 border-l-4 border-purple-500 pl-3" {...props} />,
                                    h3: ({node, ...props}) => <h3 className="text-md font-bold text-purple-300 mb-2 mt-4" {...props} />,
                                    strong: ({node, ...props}) => <strong className="text-white font-bold" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4 marker:text-purple-500" {...props} />,
                                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                    p: ({node, ...props}) => <p className="mb-4 text-justify" {...props} />,
                                }}
                            >
                                {aiAdvice}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        // CONTEÚDO FREE (TRAVADO COM BLUR)
                        <div className="relative">
                            <div className="text-zinc-600 text-sm leading-relaxed blur-[6px] select-none">
                                <p>Com base na análise dos seus dados financeiros deste período, identifiquei oportunidades claras de melhoria. Sua média de gastos está...</p>
                                <p>Recomendo fortemente que você revise as assinaturas mensais e foque em aumentar a receita passiva. O saldo atual indica...</p>
                                <p>Atenção especial para os gastos com transporte e alimentação que subiram 15%.</p>
                            </div>
                            
                            {/* OVERLAY DE VENDA */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/60 z-10 p-4 text-center">
                                <Lock className="w-8 h-8 text-yellow-400 mb-2" />
                                <h4 className="text-white font-bold mb-1">Análise de IA Bloqueada</h4>
                                <p className="text-zinc-400 text-xs mb-3">O CFO Virtual analisa seus gastos e te dá o caminho das pedras.</p>
                                <button 
                                    onClick={onRequestPremium}
                                    className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-4 py-2 rounded-full text-xs hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                                >
                                    <Crown className="w-3 h-3"/> Liberar Inteligência
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
                    {isResultPro ? "Baixar Relatório Executivo Completo" : "Baixar Relatório Básico (PDF)"}
                </button>
            </div>
        )}

      </div>
    </div>
  )
}
