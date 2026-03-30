'use client'

import { useState, useEffect, useMemo } from "react";
import { ReportModal } from "@/components/ReportModal"; 
import { getDashboardData, toggleTransactionStatus, copyFixedExpenses, generateMonthlyReport, deleteTransaction, processCSVWithAI, saveBulkTransactions } from "./actions"; 
import { TransactionModal } from "@/components/TransactionModal";
import { BudgetModal } from "@/components/BudgetModal";
import { ImportReviewModal } from "@/components/ImportReviewModal"; // NOVO MODAL
import { UserButton } from "@clerk/nextjs"; 
import { DashboardCards } from "@/components/DashboardCards";
import { DashboardCharts } from "@/components/DashboardCharts"; 
import { calculateDashboardData } from "@/utils/dashboardCalculations"; 
import { 
  Calendar as CalendarIcon, Plus, ArrowUpRight, ArrowDownRight, 
  Clock, CheckCircle2, Circle, Copy, Loader2,
  Briefcase, User, Layers, MessageSquare, X, ChevronLeft, ChevronRight, Palette, Pencil, Trash2, AlertCircle, Crown, FileText, Download, Filter
} from "lucide-react";
import { PremiumModal } from "@/components/PremiumModal";

// --- CONFIGURAÇÃO DE TEMAS ---
const THEMES = {
  dark: { id: 'dark', hex: '#09090b', bg: 'bg-zinc-950', text: 'text-zinc-50', textMuted: 'text-zinc-400', card: 'bg-zinc-900 border-zinc-800', cardHover: 'hover:bg-zinc-800/50', button: 'bg-blue-600 hover:bg-blue-700 text-white', buttonSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300', iconBg: 'bg-zinc-800', navActive: 'bg-zinc-800 text-white', navInactive: 'text-zinc-500 hover:text-zinc-300', logoFilter: 'invert brightness-0 invert' },
  nubank: { id: 'nubank', hex: '#f5f5f5', bg: 'bg-[#f5f5f5]', text: 'text-gray-900', textMuted: 'text-gray-500', card: 'bg-white border-gray-200 shadow-sm', cardHover: 'hover:bg-gray-50', button: 'bg-purple-600 hover:bg-purple-700 text-white', buttonSecondary: 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200', iconBg: 'bg-purple-50 text-purple-600', navActive: 'bg-purple-600 text-white shadow-md', navInactive: 'text-gray-500 hover:bg-gray-200', logoFilter: '' },
  green: { id: 'green', hex: '#ecfdf5', bg: 'bg-[#ecfdf5]', text: 'text-emerald-950', textMuted: 'text-emerald-600/70', card: 'bg-white border-emerald-100 shadow-sm', cardHover: 'hover:bg-emerald-50', button: 'bg-emerald-600 hover:bg-emerald-700 text-white', buttonSecondary: 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-100', iconBg: 'bg-emerald-100 text-emerald-700', navActive: 'bg-emerald-600 text-white shadow-md', navInactive: 'text-emerald-600/60 hover:bg-emerald-100', logoFilter: '' },
  blue: { id: 'blue', hex: '#f8fafc', bg: 'bg-[#f8fafc]', text: 'text-slate-900', textMuted: 'text-slate-500', card: 'bg-white border-slate-200 shadow-sm', cardHover: 'hover:bg-slate-50', button: 'bg-blue-700 hover:bg-blue-800 text-white', buttonSecondary: 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200', iconBg: 'bg-blue-50 text-blue-700', navActive: 'bg-slate-900 text-white shadow-md', navInactive: 'text-slate-500 hover:bg-slate-200', logoFilter: '' },
  red: { id: 'red', hex: '#fff1f2', bg: 'bg-[#fff1f2]', text: 'text-rose-950', textMuted: 'text-rose-600/70', card: 'bg-white border-rose-100 shadow-sm', cardHover: 'hover:bg-rose-50', button: 'bg-rose-600 hover:bg-rose-700 text-white', buttonSecondary: 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-100', iconBg: 'bg-rose-100 text-rose-700', navActive: 'bg-rose-600 text-white shadow-md', navInactive: 'text-rose-600/60 hover:bg-rose-100', logoFilter: '' }
};

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);
  const [advice, setAdvice] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [viewMode, setViewMode] = useState<'all' | 'pf' | 'pj'>('all');
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'nubank' | 'green' | 'blue' | 'red'>('nubank');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false); 
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // 🔥 NOVOS ESTADOS PARA O MODAL DE REVISÃO DA IA 🔥
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTransactions, setReviewTransactions] = useState<any[]>([]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const theme = THEMES[currentTheme];
  const [rawData, setRawData] = useState<any>({ allCategories: [], transactions: [], summary: { globalBalance: 0 }, planType: 'free' });

  useEffect(() => { document.body.style.backgroundColor = theme.hex; }, [currentTheme, theme.hex]);

  async function loadData() {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const result = await getDashboardData(month, year);
    setRawData(result);
  }

  // --- NOVA FUNÇÃO DE UPLOAD (ACUMULA TUDO E ABRE O MODAL) ---
  const handleFileUpload = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const transactionsRaw = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const [data, valor, identificador, ...descricaoArr] = lines[i].split(',');
          const descricao = descricaoArr.join(','); 
          if (data && valor) {
            transactionsRaw.push({ date: data, amount: parseFloat(valor), description: descricao.replace(/"/g, '').trim() });
          }
        }

        const BATCH_SIZE = 15;
        const totalBatches = Math.ceil(transactionsRaw.length / BATCH_SIZE);
        let allProcessed: any[] = []; // Acumulador

        for (let i = 0; i < transactionsRaw.length; i += BATCH_SIZE) {
          const loteAtual = Math.floor(i / BATCH_SIZE) + 1;
          const batch = transactionsRaw.slice(i, i + BATCH_SIZE);
          setUploadStatus(`IA Lote ${loteAtual} de ${totalBatches}...`);

          const result = await processCSVWithAI(batch);
          if (result.success && result.data) {
            allProcessed = [...allProcessed, ...result.data]; // Junta tudo
          }
        }

        setUploadStatus(""); 
        
        if (allProcessed.length > 0) {
            setReviewTransactions(allProcessed);
            setIsReviewModalOpen(true); // Abre a Sala de Espera!
        } else {
            alert("Nenhuma transação válida foi encontrada pelo robô.");
        }

      } catch (error) {
        alert("Ocorreu um erro ao processar o arquivo.");
        setUploadStatus("");
      }
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  // --- CONFIRMAÇÃO DO SALVAMENTO FINAL DO MODAL ---
  async function handleConfirmImport(finalTransactions: any[]) {
      setIsSavingBulk(true);
      const res = await saveBulkTransactions(finalTransactions);
      setIsSavingBulk(false);
      
      if (res.success) {
          alert(`Sucesso! ${finalTransactions.length} transações salvas perfeitamente!`);
          setIsReviewModalOpen(false);
          setReviewTransactions([]);
          loadData();
      } else {
          alert("Ops! Houve um erro ao salvar no banco. Tente novamente.");
      }
  }

  const daysInMonthArray = useMemo(() => {
    const days = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  }, [currentDate]);

  const processedData = useMemo(() => {
    return calculateDashboardData(rawData, viewMode, currentDate, selectedDay, daysInMonthArray);
  }, [rawData, viewMode, currentDate, selectedDay, daysInMonthArray]);

  useEffect(() => { loadData(); setSelectedDay(null); }, [currentDate]);

  async function handleTogglePay(id: string, currentStatus: boolean) { await toggleTransactionStatus(id, currentStatus); loadData(); }
  async function handleCopyMonth() { if(confirm("Deseja copiar todas as contas fixas deste mês para o próximo?")) { setCopying(true); const res = await copyFixedExpenses(currentDate.getMonth()+1, currentDate.getFullYear()); alert(res.message); setCopying(false); if(res.success) changeMonth(1); } }
  
  async function handleAnalyze() { 
    setAnalyzing(true); setAdvice(''); 
    const res = await generateMonthlyReport(currentDate.getMonth()+1, currentDate.getFullYear()); 
    if (res.message && res.message.includes("RECURSO PREMIUM")) { setAnalyzing(false); setShowPremium(true); return; }
    setAdvice(res.message || "Erro ao analisar."); setAnalyzing(false); 
  }

  function handleExportPDF() { setIsReportModalOpen(true); }
  async function handleDelete(id: string) { if(confirm("Deseja realmente excluir este lançamento?")) { await deleteTransaction(id); loadData(); } }
  function handleEdit(tx: any) { setEditingTransaction(tx); setIsModalOpen(true); }

  const changeMonth = (offset: number) => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1)); setAdvice(''); };
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const isPro = rawData.planType !== 'free';

  const displayedFixedExpenses = processedData.fixedExpenses.filter((tx: any) => filterCategory === 'all' || tx.categoryId === filterCategory);
  const displayedVariableTransactions = processedData.variableTransactions.filter((tx: any) => filterCategory === 'all' || tx.categoryId === filterCategory);

  return (
    <main className={`min-h-screen w-full ${theme.bg} ${theme.text} pt-4 md:pt-8 font-sans transition-colors duration-500 overflow-x-hidden`}>
      <div className="max-w-7xl mx-auto space-y-6 px-4 md:px-0">
        
        {/* HEADER RESPONSIVO */}
        <header className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
            <div className="w-full md:w-auto flex justify-center md:justify-start">
              <img src="/logo.png" alt="KORE" className={`h-24 md:h-40 w-auto object-contain transition-all duration-500 ${theme.logoFilter}`} />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center gap-3 w-full justify-center md:justify-end">
                    {!isPro && (<button onClick={() => setShowPremium(true)} className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-3 py-2 rounded-full text-xs hover:scale-105 transition-all shadow-lg flex items-center gap-2 animate-pulse whitespace-nowrap"><Crown className="w-4 h-4"/> Seja PRO</button>)}
                    {isPro && (<span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider shadow-lg flex items-center gap-1 whitespace-nowrap"><Crown className="w-3 h-3"/> PRO</span>)}
                    <div className="flex items-center justify-center bg-white/10 rounded-full p-1 shrink-0" title="Minha Conta"><UserButton afterSignOutUrl="/sign-in" /></div>
                    <div className="relative shrink-0">
                        <button onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} className={`p-2 rounded-full border transition-all ${isThemeMenuOpen ? theme.navActive : theme.card}`}><Palette className="w-5 h-5" /></button>
                        {isThemeMenuOpen && (
                            <div className={`absolute top-full right-0 mt-2 p-2 rounded-xl border shadow-xl flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-top-2 ${theme.card}`}>
                            <div className="flex gap-2">
                                <button onClick={() => { setCurrentTheme('dark'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-700 hover:scale-110" title="Dark" />
                                <button onClick={() => { setCurrentTheme('nubank'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-full bg-purple-600 hover:scale-110" title="Nubank" />
                                <button onClick={() => { setCurrentTheme('green'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-full bg-emerald-500 hover:scale-110" title="Eco" />
                                <button onClick={() => { setCurrentTheme('blue'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-full bg-blue-600 hover:scale-110" title="Executivo" />
                                <button onClick={() => { setCurrentTheme('red'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-full bg-rose-600 hover:scale-110" title="Red" />
                            </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`flex p-1 rounded-full border w-full md:w-auto justify-between ${theme.card}`}>
                    <button onClick={() => setViewMode('all')} className={`flex-1 md:flex-none px-4 md:px-8 py-2 md:py-3 text-xs md:text-sm font-bold rounded-full flex items-center justify-center gap-2 transition-all ${viewMode === 'all' ? theme.navActive : theme.navInactive}`}><Layers className="w-3 h-3"/> Tudo</button>
                    <button onClick={() => setViewMode('pf')} className={`flex-1 md:flex-none px-4 md:px-8 py-2 md:py-3 text-xs md:text-sm font-bold rounded-full flex items-center justify-center gap-2 transition-all ${viewMode === 'pf' ? theme.navActive : theme.navInactive}`}><User className="w-3 h-3"/> PF</button>
                    <button onClick={() => setViewMode('pj')} className={`flex-1 md:flex-none px-4 md:px-8 py-2 md:py-3 text-xs md:text-sm font-bold rounded-full flex items-center justify-center gap-2 transition-all ${viewMode === 'pj' ? theme.navActive : theme.navInactive}`}><Briefcase className="w-3 h-3"/> PJ</button>
                </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-4 w-full md:w-auto justify-center">
                <button onClick={() => changeMonth(-1)} className={`p-2 rounded-full transition-colors ${theme.navInactive}`}><ChevronLeft className="w-6 h-6" /></button>
                <div className="flex flex-col items-center min-w-[120px]">
                    <span className={`text-2xl font-bold capitalize leading-none tracking-tight ${theme.text}`}>{currentDate.toLocaleString('pt-BR', { month: 'long' })}</span>
                    <span className={`text-xs font-bold tracking-widest uppercase opacity-50 ${theme.text}`}>{currentDate.getFullYear()}</span>
                </div>
                <button onClick={() => changeMonth(1)} className={`p-2 rounded-full transition-colors ${theme.navInactive}`}><ChevronRight className="w-6 h-6" /></button>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
                <label className={`flex-1 md:flex-none ${theme.buttonSecondary} cursor-pointer active:scale-95 px-6 py-4 md:py-3 rounded-full font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all border ${uploadStatus ? 'bg-purple-100 text-purple-600 border-purple-300' : ''}`}>
                  {uploadStatus ? <Loader2 className="w-5 h-5 animate-spin text-purple-600" /> : <FileText className="w-5 h-5" />} 
                  {uploadStatus ? uploadStatus : "Importar CSV"}
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={!!uploadStatus} />
                </label>
                <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className={`flex-1 md:flex-none ${theme.button} active:scale-95 px-6 py-4 md:py-3 rounded-full font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all`}><Plus className="w-5 h-5" /> Lançar Nova Transação</button>
            </div>
          </div>
        </header>

        {/* CALENDÁRIO */}
        <div className={`w-full overflow-x-auto pb-4 custom-scrollbar`}>
           <div className="flex gap-2 min-w-max px-1">
              <button onClick={() => setSelectedDay(null)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedDay === null ? theme.navActive : theme.card + ' ' + theme.navInactive}`}>Mês Todo</button>
              {daysInMonthArray.map(day => {
                 const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                 const isSelected = selectedDay === day;
                 return (
                   <button key={day} onClick={() => setSelectedDay(isSelected ? null : day)} className={`w-10 h-10 flex flex-col items-center justify-center rounded-xl border transition-all text-xs font-bold ${isSelected ? theme.navActive : isToday ? `border-blue-400 border-2 ${theme.text}` : `${theme.card} ${theme.navInactive}`}`}>
                     {day}
                     {isToday && <span className="w-1 h-1 rounded-full bg-blue-500 mt-0.5"></span>}
                   </button>
                 )
              })}
           </div>
        </div>

        {/* ÁREA DE IA E RELATÓRIOS */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap justify-end gap-2">
             {!advice && (<button onClick={handleExportPDF} className={`flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-full border shadow-sm transition-all hover:scale-105 ${theme.buttonSecondary}`} title="Relatórios Executivos"><Download className={`w-4 h-4 ${!isPro && 'text-zinc-400'}`} /><span className="inline">Relatório PDF</span>{!isPro && <span className="text-[10px] bg-yellow-400 text-black px-1 rounded font-bold">PRO</span>}</button>)}
             {!advice && (<button onClick={handleAnalyze} disabled={analyzing} className={`flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full border shadow-sm transition-all hover:bg-blue-500 hover:text-white ${theme.buttonSecondary}`}>{analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}{analyzing ? "Analisando..." : "Análise IA"}</button>)}
          </div>
          {advice && (
            <div className={`${theme.card} p-6 rounded-2xl relative animate-in slide-in-from-top-4 fade-in duration-500`}>
              <button onClick={() => setAdvice('')} className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-colors"><X className="w-5 h-5" /></button>
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

        {/* COMPONENTES ISOLADOS */}
        <DashboardCards theme={theme} summary={processedData.summary} selectedDay={selectedDay} formatCurrency={formatCurrency} />
        <DashboardCharts theme={theme} processedData={processedData} currentTheme={currentTheme} formatCurrency={formatCurrency} setSelectedCategory={setSelectedCategory} setBudgetModalOpen={setBudgetModalOpen} />

        {/* BARRA DE FILTRO DE CATEGORIAS */}
        <div className="flex items-center justify-between mt-4">
            <h2 className={`font-bold text-lg flex items-center gap-2 ${theme.text}`}>Extrato Detalhado</h2>
            <div className="flex items-center gap-2">
                <Filter className={`w-4 h-4 ${theme.textMuted}`} />
                <select 
                    value={filterCategory} 
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className={`${theme.card} ${theme.text} border rounded-lg px-3 py-2 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer`}
                >
                    <option value="all">Todas as Categorias</option>
                    {rawData.allCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* LISTAS COM EDIÇÃO E EXCLUSÃO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
          <div className={`${theme.card} border rounded-2xl overflow-hidden flex flex-col`}>
            <div className={`p-4 border-b flex justify-between items-center ${currentTheme === 'dark' ? 'bg-zinc-950/30 border-zinc-800' : 'bg-gray-50/50 border-gray-100'}`}>
              <h3 className={`font-bold flex items-center gap-2 ${theme.text}`}><Clock className="w-4 h-4 text-orange-500" /> Custos Fixos {filterCategory !== 'all' && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full ml-2">Filtrado</span>}</h3>
              {processedData.fixedExpenses.length > 0 && (<button onClick={handleCopyMonth} disabled={copying} className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all border ${theme.buttonSecondary}`}>{copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />} Virar Mês</button>)}
            </div>
            <div className="p-4 space-y-3">
              {displayedFixedExpenses.map((tx: any) => {
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                const isLate = !tx.isPaid && tx.date < todayStr;
                const isToday = !tx.isPaid && tx.date === todayStr;
                return (
                  <div key={tx.id} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${currentTheme === 'dark' ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-100 hover:border-blue-200 shadow-sm'}`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleTogglePay(tx.id, tx.isPaid)} className={`p-2 rounded-full transition-all ${tx.isPaid ? 'text-emerald-600 bg-emerald-500/10' : 'text-slate-400 bg-slate-100/50 hover:text-orange-500'}`}>{tx.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button>
                      <div>
                        <p className={`font-semibold text-sm ${tx.isPaid ? 'text-zinc-500 line-through' : theme.text}`}>{tx.description}</p>
                        <p className={`text-[10px] font-bold uppercase flex items-center gap-1 ${theme.textMuted}`}>{tx.entityType === 'pj' ? <Briefcase className="w-3 h-3 text-blue-500"/> : <User className="w-3 h-3 opacity-50"/>}{isLate ? (<span className="flex items-center gap-1 text-red-500 animate-pulse"><AlertCircle className="w-3 h-3"/> VENCIDO (Dia {tx.date.split('-')[2]})</span>) : isToday ? (<span className="flex items-center gap-1 text-amber-500 font-bold"><Clock className="w-3 h-3"/> VENCE HOJE</span>) : (<span>Dia {tx.date.split('-')[2]}</span>)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right"><p className={`font-bold font-mono text-sm ${theme.text}`}>{formatCurrency(Number(tx.amount))}</p><span className={`text-[9px] font-bold uppercase tracking-wider ${tx.isPaid ? 'text-emerald-600' : isLate ? 'text-red-500' : 'text-orange-500'}`}>{tx.isPaid ? 'PAGO' : 'PENDENTE'}</span></div>
                      <div className="flex flex-col gap-1"><button onClick={() => handleEdit(tx)} className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded transition-colors"><Pencil className="w-3.5 h-3.5"/></button><button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div>
                    </div>
                  </div>
                )
              })}
              {displayedFixedExpenses.length === 0 && ( <p className={`text-sm text-center py-8 ${theme.textMuted}`}>Nenhuma conta encontrada.</p> )}
            </div>
          </div>

          <div className={`${theme.card} border rounded-2xl overflow-hidden flex flex-col`}>
            <div className={`p-4 border-b ${currentTheme === 'dark' ? 'bg-zinc-950/30 border-zinc-800' : 'bg-gray-50/50 border-gray-100'}`}>
                <h3 className={`font-bold flex items-center gap-2 ${theme.text}`}>
                    <ArrowDownRight className="w-4 h-4 text-blue-500" /> Fluxo Variável
                    {filterCategory !== 'all' && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full ml-2">Filtrado</span>}
                </h3>
            </div>
            <div className={`divide-y ${currentTheme === 'dark' ? 'divide-zinc-800' : 'divide-gray-100'}`}>
              {displayedVariableTransactions.slice(0, 15).map((tx: any) => (
                <div key={tx.id} className={`p-3 flex justify-between items-center transition-colors ${theme.cardHover}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>{tx.type === 'income' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}</div>
                    <div>
                      <p className={`text-sm font-medium line-clamp-1 ${theme.text}`}>{tx.description}</p>
                      <p className={`text-[10px] font-bold uppercase flex items-center gap-1 ${theme.textMuted}`}>{tx.entityType === 'pj' ? <Briefcase className="w-3 h-3 text-blue-500"/> : <User className="w-3 h-3 opacity-50"/>}{tx.date.split('-').reverse().join('/')} • {rawData.allCategories.find((c: any) => c.id === tx.categoryId)?.name || 'Geral'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono text-sm font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : theme.text}`}>{tx.type === 'expense' && '- '}{formatCurrency(Number(tx.amount))}</span >
                    <div className="flex flex-col gap-1"><button onClick={() => handleEdit(tx)} className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded transition-colors"><Pencil className="w-3.5 h-3.5"/></button><button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button></div>
                  </div>
                </div>
              ))}
                {displayedVariableTransactions.length === 0 && ( <p className={`text-sm text-center py-8 ${theme.textMuted}`}>Nenhum lançamento encontrado.</p> )}
            </div>
          </div>
        </div>
      </div>
      
      {/* MODAIS CLÁSSICOS */}
      {isModalOpen && (<TransactionModal categories={rawData.allCategories} transaction={editingTransaction} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); loadData(); }} userPlan={rawData.planType} onRequestPremium={() => setShowPremium(true)} />)}
      {budgetModalOpen && selectedCategory && (<BudgetModal category={selectedCategory} onClose={() => { setBudgetModalOpen(false); loadData(); }} />)}
      <PremiumModal isOpen={showPremium} onClose={() => setShowPremium(false)} />
      {isReportModalOpen && (<ReportModal onClose={() => setIsReportModalOpen(false)} userPlan={rawData.planType} onRequestPremium={() => setShowPremium(true)} />)}
      
      {/* 🔥 NOVO MODAL DE REVISÃO DA IA 🔥 */}
      <ImportReviewModal 
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        initialTransactions={reviewTransactions}
        categories={rawData.allCategories}
        onConfirm={handleConfirmImport}
        isSaving={isSavingBulk}
      />
    </main>
  );
}