'use client'

import { useState, useEffect, useMemo } from "react";
import { ReportModal } from "@/components/ReportModal"; 
import { getDashboardData, toggleTransactionStatus, copyFixedExpenses, generateMonthlyReport, deleteTransaction } from "./actions"; 
import { TransactionModal } from "@/components/TransactionModal";
import { BudgetModal } from "@/components/BudgetModal";
import { UserButton } from "@clerk/nextjs"; 
import { 
  TrendingUp, Calendar as CalendarIcon, Plus, ArrowUpRight, ArrowDownRight, 
  Wallet, Clock, CheckCircle2, Circle, Copy, Loader2,
  Briefcase, User, Layers, Target, AlertTriangle, MessageSquare, X, ChevronLeft, ChevronRight, Palette, Pencil, Trash2, AlertCircle, Crown, Mic, FileText, Download
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { PremiumModal } from "@/components/PremiumModal";

// --- CONFIGURAÇÃO DE TEMAS ---
const THEMES = {
  dark: {
    id: 'dark',
    name: 'Dark',
    bg: 'bg-zinc-950',
    text: 'text-zinc-50',
    textMuted: 'text-zinc-400',
    card: 'bg-zinc-900 border-zinc-800',
    cardHover: 'hover:bg-zinc-800/50',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
    iconBg: 'bg-zinc-800',
    navActive: 'bg-zinc-800 text-white',
    navInactive: 'text-zinc-500 hover:text-zinc-300',
    logoFilter: 'invert brightness-0 invert'
  },
  nubank: {
    id: 'nubank',
    name: 'Nubank',
    bg: 'bg-gray-50',
    text: 'text-gray-900',
    textMuted: 'text-gray-500',
    card: 'bg-white border-gray-200 shadow-sm',
    cardHover: 'hover:bg-gray-50',
    button: 'bg-purple-600 hover:bg-purple-700 text-white',
    buttonSecondary: 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200',
    iconBg: 'bg-purple-50 text-purple-600',
    navActive: 'bg-purple-600 text-white shadow-md',
    navInactive: 'text-gray-500 hover:bg-gray-200',
    logoFilter: ''
  },
  green: {
    id: 'green',
    name: 'Eco',
    bg: 'bg-emerald-50',
    text: 'text-emerald-950',
    textMuted: 'text-emerald-600/70',
    card: 'bg-white border-emerald-100 shadow-sm',
    cardHover: 'hover:bg-emerald-50',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    buttonSecondary: 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-100',
    iconBg: 'bg-emerald-100 text-emerald-700',
    navActive: 'bg-emerald-600 text-white shadow-md',
    navInactive: 'text-emerald-600/60 hover:bg-emerald-100',
    logoFilter: ''
  },
  blue: {
    id: 'blue',
    name: 'Executivo',
    bg: 'bg-slate-50',
    text: 'text-slate-900',
    textMuted: 'text-slate-500',
    card: 'bg-white border-slate-200 shadow-sm',
    cardHover: 'hover:bg-slate-50',
    button: 'bg-blue-700 hover:bg-blue-800 text-white',
    buttonSecondary: 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200',
    iconBg: 'bg-blue-50 text-blue-700',
    navActive: 'bg-slate-900 text-white shadow-md',
    navInactive: 'text-slate-500 hover:bg-slate-200',
    logoFilter: ''
  },
  red: {
    id: 'red',
    name: 'Red',
    bg: 'bg-rose-50',
    text: 'text-rose-950',
    textMuted: 'text-rose-600/70',
    card: 'bg-white border-rose-100 shadow-sm',
    cardHover: 'hover:bg-rose-50',
    button: 'bg-rose-600 hover:bg-rose-700 text-white',
    buttonSecondary: 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-100',
    iconBg: 'bg-rose-100 text-rose-700',
    navActive: 'bg-rose-600 text-white shadow-md',
    navInactive: 'text-rose-600/60 hover:bg-rose-100',
    logoFilter: ''
  }
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

  // --- ESTADOS DE UI ---
  const [viewMode, setViewMode] = useState<'all' | 'pf' | 'pj'>('all');
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'nubank' | 'green' | 'blue' | 'red'>('nubank');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false); 

  const theme = THEMES[currentTheme];

  const [rawData, setRawData] = useState<any>({ allCategories: [], transactions: [], planType: 'free' });

  async function loadData() {
    console.log("🔄 Carregando dados...");
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const result = await getDashboardData(month, year);
    setRawData(result);
  }

  // --- GERAÇÃO DOS DIAS DO MÊS ---
  const daysInMonthArray = useMemo(() => {
    const days = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => i + 1);
  }, [currentDate]);

  const processedData = useMemo(() => {
    // 1. Filtra por PF/PJ
    let txs = (rawData.transactions || []).filter((t: any) => 
      viewMode === 'all' ? true : t.entityType === viewMode
    );

    // 2. Filtra por Dia (se selecionado)
    if (selectedDay !== null) {
      const targetDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
      txs = txs.filter((t: any) => t.date === targetDate);
    }

    const income = txs.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    const expense = txs.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Number(t.amount), 0);
    
    const fixedExpenses = txs.filter((t: any) => t.isFixed && t.type === 'expense');
    const variableTransactions = txs.filter((t: any) => !t.isFixed || t.type === 'income');

    const categoryStats = (rawData.allCategories || []).map((cat: any) => {
        const spent = txs.filter((t: any) => t.categoryId === cat.id && t.type === 'expense').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        return { ...cat, id: cat.id, name: cat.name, value: spent, budget: Number(cat.budget || 0) };
    }).filter((c: any) => c.value > 0 || c.budget > 0).sort((a: any, b: any) => b.value - a.value);

    // Dados para gráfico
    const chartTxs = (rawData.transactions || []).filter((t: any) => viewMode === 'all' ? true : t.entityType === viewMode);
    
    const dailyData = [];
    for (let i = 1; i <= daysInMonthArray.length; i++) {
        const d = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const dayTxs = chartTxs.filter((t: any) => t.date === d);
        if(dayTxs.length > 0) {
            dailyData.push({
                day: i,
                entrada: dayTxs.filter((t: any) => t.type === 'income').reduce((a: number, b: any) => a + Number(b.amount), 0),
                saida: dayTxs.filter((t: any) => t.type === 'expense').reduce((a: number, b: any) => a + Number(b.amount), 0)
            });
        }
    }

    return { summary: { balance: income - expense, income, expense }, fixedExpenses, variableTransactions, categoryStats, dailyData };
  }, [rawData, viewMode, currentDate, selectedDay, daysInMonthArray]);

  useEffect(() => { loadData(); setSelectedDay(null); }, [currentDate]);

  async function handleTogglePay(id: string, currentStatus: boolean) { await toggleTransactionStatus(id, currentStatus); loadData(); }
  async function handleCopyMonth() { if(confirm("Deseja copiar todas as contas fixas deste mês para o próximo?")) { setCopying(true); const res = await copyFixedExpenses(currentDate.getMonth()+1, currentDate.getFullYear()); alert(res.message); setCopying(false); if(res.success) changeMonth(1); } }
  
  async function handleAnalyze() { 
    setAnalyzing(true); 
    setAdvice(''); 
    const res = await generateMonthlyReport(currentDate.getMonth()+1, currentDate.getFullYear()); 
    if (res.message && res.message.includes("RECURSO PREMIUM")) {
        setAnalyzing(false);
        setShowPremium(true);
        return;
    }
    setAdvice(res.message || "Erro ao analisar."); 
    setAnalyzing(false); 
  }

  function handleExportPDF() {
    setIsReportModalOpen(true);
  }

  async function handleDelete(id: string) {
    if(confirm("Deseja realmente excluir este lançamento?")) {
      await deleteTransaction(id);
      loadData();
    }
  }

  function handleEdit(tx: any) {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  }

  const changeMonth = (offset: number) => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1)); setAdvice(''); };
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const isPro = rawData.planType !== 'free';

  return (
    <main 
      className={`min-h-screen w-full ${theme.bg} ${theme.text} pt-4 md:pt-8 font-sans transition-colors duration-500 overflow-x-hidden`}
      style={{ backgroundImage: 'none', backgroundColor: currentTheme === 'dark' ? '#09090b' : undefined }} 
    >
      <div className="max-w-7xl mx-auto space-y-6 px-4 md:px-0">
        
        {/* HEADER RESPONSIVO */}
        <header className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
            
            {/* LOGO */}
            <div className="w-full md:w-auto flex justify-center md:justify-start">
              <img 
                src="/logo.png" 
                alt="KORE" 
                className={`h-24 md:h-40 w-auto object-contain transition-all duration-500 ${theme.logoFilter}`} 
              />
            </div>

            {/* BARRA DE AÇÕES SUPERIOR */}
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto justify-end">
                
                <div className="flex items-center gap-3 w-full justify-center md:justify-end">
                    {/* BOTÃO PRO */}
                    {!isPro && (
                        <button 
                          onClick={() => setShowPremium(true)} 
                          className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-3 py-2 rounded-full text-xs hover:scale-105 transition-all shadow-lg flex items-center gap-2 animate-pulse whitespace-nowrap"
                        >
                          <Crown className="w-4 h-4"/> Seja PRO
                        </button>
                    )}

                    {isPro && (
                        <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider shadow-lg flex items-center gap-1 whitespace-nowrap">
                            <Crown className="w-3 h-3"/> PRO
                        </span>
                    )}

                    <div className="flex items-center justify-center bg-white/10 rounded-full p-1 shrink-0" title="Minha Conta">
                       <UserButton afterSignOutUrl="/sign-in" />
                    </div>

                    <div className="relative shrink-0">
                        <button 
                            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                            className={`p-2 rounded-full border transition-all ${isThemeMenuOpen ? theme.navActive : theme.card}`}
                        >
                            <Palette className="w-5 h-5" />
                        </button>
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

                {/* FILTROS PF/PJ */}
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
                    <span className={`text-2xl font-bold capitalize leading-none tracking-tight ${theme.text}`}>
                        {currentDate.toLocaleString('pt-BR', { month: 'long' })}
                    </span>
                    <span className={`text-xs font-bold tracking-widest uppercase opacity-50 ${theme.text}`}>
                        {currentDate.getFullYear()}
                    </span>
                </div>
                <button onClick={() => changeMonth(1)} className={`p-2 rounded-full transition-colors ${theme.navInactive}`}><ChevronRight className="w-6 h-6" /></button>
            </div>

            {/* BOTÃO DE LANÇAR - GRANDE */}
            <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
                  className={`flex-1 md:flex-none ${theme.button} active:scale-95 px-6 py-4 md:py-3 rounded-full font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all`}
                >
                  <Plus className="w-5 h-5" /> Lançar Nova Transação
                </button>
            </div>
          </div>
        </header>

        {/* CALENDÁRIO */}
        <div className={`w-full overflow-x-auto pb-4 custom-scrollbar`}>
           <div className="flex gap-2 min-w-max px-1">
              <button 
                onClick={() => setSelectedDay(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedDay === null ? theme.navActive : theme.card + ' ' + theme.navInactive}`}
              >
                Mês Todo
              </button>
              {daysInMonthArray.map(day => {
                 const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                 const isSelected = selectedDay === day;
                 return (
                   <button
                     key={day}
                     onClick={() => setSelectedDay(isSelected ? null : day)}
                     className={`w-10 h-10 flex flex-col items-center justify-center rounded-xl border transition-all text-xs font-bold ${
                       isSelected ? theme.navActive : isToday ? `border-blue-400 border-2 ${theme.text}` : `${theme.card} ${theme.navInactive}`
                     }`}
                   >
                     {day}
                     {isToday && <span className="w-1 h-1 rounded-full bg-blue-500 mt-0.5"></span>}
                   </button>
                 )
              })}
           </div>
        </div>

        {/* ÁREA DE IA E RELATÓRIOS - WRAP NOS BOTOES */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap justify-end gap-2">
             {/* BOTÃO PDF */}
             {!advice && (
                 <button 
                   onClick={handleExportPDF}
                   className={`flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-full border shadow-sm transition-all hover:scale-105 ${theme.buttonSecondary}`}
                   title="Relatórios Executivos"
                 >
                   <Download className={`w-4 h-4 ${!isPro && 'text-zinc-400'}`} />
                   <span className="inline">Relatório PDF</span>
                   {!isPro && <span className="text-[10px] bg-yellow-400 text-black px-1 rounded font-bold">PRO</span>}
                 </button>
             )}

             {!advice && (
               <button 
                 onClick={handleAnalyze}
                 disabled={analyzing}
                 className={`flex-1 md:flex-none flex items-center justify-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full border shadow-sm transition-all hover:bg-blue-500 hover:text-white ${theme.buttonSecondary}`}
               >
                 {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                 {analyzing ? "Analisando..." : "Análise IA"}
               </button>
             )}
          </div>
          {advice && (
            <div className={`${theme.card} p-6 rounded-2xl relative animate-in slide-in-from-top-4 fade-in duration-500`}>
              <button onClick={() => setAdvice('')} className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-colors"><X className="w-5 h-5" /></button>
              <div className="flex flex-col md:flex-row gap-4">
                <div className={`p-3 rounded-xl h-fit w-fit ${theme.iconBg}`}>
                  <Briefcase className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    Parecer Técnico <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold ${currentTheme === 'dark' ? 'bg-blue-600 text-white' : 'bg-black text-white'}`}>CFO Virtual</span>
                  </h3>
                  <div className={`text-sm leading-relaxed whitespace-pre-line ${theme.textMuted}`}>
                    {advice}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RESTANTE DA DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${theme.card} p-6 rounded-2xl border relative overflow-hidden group transition-all`}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet className="w-16 h-16" /></div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.textMuted}`}>Saldo Líquido {selectedDay && `(Dia ${selectedDay})`}</p>
            <h2 className={`text-4xl font-mono font-bold ${processedData.summary.balance >= 0 ? theme.text : 'text-red-500'}`}>
              {formatCurrency(processedData.summary.balance)}
            </h2>
          </div>
          <div className={`${theme.card} p-6 rounded-2xl border transition-all`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.textMuted}`}>Receita Operacional</p>
            <h2 className="text-2xl font-mono font-bold text-emerald-500">{formatCurrency(processedData.summary.income)}</h2>
          </div>
          <div className={`${theme.card} p-6 rounded-2xl border transition-all`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.textMuted}`}>Despesas</p>
            <h2 className="text-2xl font-mono font-bold text-red-500">{formatCurrency(processedData.summary.expense)}</h2>
          </div>
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`lg:col-span-2 ${theme.card} p-6 rounded-2xl border flex flex-col h-[350px]`}>
            <h3 className={`text-sm font-bold mb-6 flex items-center gap-2 ${theme.textMuted}`}>
              <TrendingUp className="w-4 h-4" /> Fluxo de Caixa (Visão Mensal)
            </h3>
            <div className="flex-1 w-full">
              {processedData.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={processedData.dailyData}>
                    <defs>
                      <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={currentTheme === 'dark' ? '#27272a' : '#f1f5f9'} vertical={false} />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `R$${val}`} tickLine={false} axisLine={false} width={60} />
                    <RechartsTooltip contentStyle={{ backgroundColor: currentTheme === 'dark' ? '#18181b' : '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="entrada" name="Entrada" stroke="#10b981" fillOpacity={1} fill="url(#colorEntrada)" strokeWidth={2} />
                    <Area type="monotone" dataKey="saida" name="Saída" stroke="#ef4444" fillOpacity={1} fill="url(#colorSaida)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : ( <div className={`h-full flex items-center justify-center text-sm ${theme.textMuted}`}>Sem dados suficientes.</div> )}
            </div>
          </div>

          <div className={`${theme.card} p-6 rounded-2xl border flex flex-col h-[350px]`}>
            <h3 className={`text-sm font-bold mb-4 flex items-center justify-between ${theme.textMuted}`}>
              <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Metas Orçamentárias</span>
              <span className={`text-[10px] uppercase px-2 py-1 rounded ${currentTheme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'}`}>Clique para editar</span>
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar">
              {processedData.categoryStats?.map((item: any, idx: number) => {
                const percentage = item.budget > 0 ? (item.value / item.budget) * 100 : 0;
                let barColor = "bg-emerald-500"; 
                let textColor = "text-emerald-500";
                
                if (percentage >= 75) { barColor = "bg-amber-500"; textColor = "text-amber-500"; }
                if (percentage >= 100) { barColor = "bg-red-500"; textColor = "text-red-500"; }

                return (
                  <div 
                    key={idx} 
                    className={`group cursor-pointer p-2 -mx-2 rounded-lg transition-all ${theme.cardHover}`}
                    onClick={() => { setSelectedCategory(item); setBudgetModalOpen(true); }}
                  >
                    <div className="flex justify-between text-xs mb-2">
                      <span className={`font-bold flex items-center gap-2 ${theme.text}`}>
                        {item.name}
                        {percentage >= 100 && <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />}
                      </span>
                      <span className={`font-mono ${theme.textMuted}`}>
                        <span className={percentage >= 100 ? "text-red-500 font-bold" : theme.text}>{formatCurrency(item.value)}</span>
                        <span className="opacity-50"> / {item.budget > 0 ? Number(item.budget).toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : '∞'}</span>
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-3 overflow-hidden relative ${currentTheme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100'}`}>
                      <div className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </div>
                    <div className="flex justify-end mt-1">
                      <span className={`text-[9px] font-bold ${textColor}`}>
                        {item.budget > 0 ? `${percentage.toFixed(0)}%` : 'Sem meta'}
                      </span>
                    </div>
                  </div>
                )
              })}
              {(!processedData.categoryStats || processedData.categoryStats.length === 0) && (
                <div className={`text-center text-xs mt-10 ${theme.textMuted}`}>Nenhuma despesa ou meta registrada.</div>
              )}
            </div>
          </div>
        </div>

        {/* LISTAS COM EDIÇÃO E EXCLUSÃO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
          
          {/* Contas Fixas (COM ALARMES) */}
          <div className={`${theme.card} border rounded-2xl overflow-hidden flex flex-col`}>
            <div className={`p-4 border-b flex justify-between items-center ${currentTheme === 'dark' ? 'bg-zinc-950/30 border-zinc-800' : 'bg-gray-50/50 border-gray-100'}`}>
              <h3 className={`font-bold flex items-center gap-2 ${theme.text}`}>
                <Clock className="w-4 h-4 text-orange-500" /> Custos Fixos
              </h3>
              
              {processedData.fixedExpenses.length > 0 && (
                <button 
                  onClick={handleCopyMonth}
                  disabled={copying}
                  className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all border ${theme.buttonSecondary}`}
                >
                  {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                  Virar Mês
                </button>
              )}
            </div>
            
            <div className="p-4 space-y-3">
              {processedData.fixedExpenses.map((tx: any) => {
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                const isLate = !tx.isPaid && tx.date < todayStr;
                const isToday = !tx.isPaid && tx.date === todayStr;

                return (
                  <div key={tx.id} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${currentTheme === 'dark' ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-100 hover:border-blue-200 shadow-sm'}`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleTogglePay(tx.id, tx.isPaid)} className={`p-2 rounded-full transition-all ${tx.isPaid ? 'text-emerald-600 bg-emerald-500/10' : 'text-slate-400 bg-slate-100/50 hover:text-orange-500'}`}>
                        {tx.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <div>
                        <p className={`font-semibold text-sm ${tx.isPaid ? 'text-zinc-500 line-through' : theme.text}`}>{tx.description}</p>
                        <p className={`text-[10px] font-bold uppercase flex items-center gap-1 ${theme.textMuted}`}>
                          {tx.entityType === 'pj' ? <Briefcase className="w-3 h-3 text-blue-500"/> : <User className="w-3 h-3 opacity-50"/>}
                          
                          {isLate ? (
                            <span className="flex items-center gap-1 text-red-500 animate-pulse"><AlertCircle className="w-3 h-3"/> VENCIDO (Dia {tx.date.split('-')[2]})</span>
                          ) : isToday ? (
                            <span className="flex items-center gap-1 text-amber-500 font-bold"><Clock className="w-3 h-3"/> VENCE HOJE</span>
                          ) : (
                            <span>Dia {tx.date.split('-')[2]}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-bold font-mono text-sm ${theme.text}`}>{formatCurrency(Number(tx.amount))}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${tx.isPaid ? 'text-emerald-600' : isLate ? 'text-red-500' : 'text-orange-500'}`}>{tx.isPaid ? 'PAGO' : 'PENDENTE'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                          <button onClick={() => handleEdit(tx)} className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                          <button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {processedData.fixedExpenses.length === 0 && ( <p className={`text-sm text-center py-8 ${theme.textMuted}`}>Nenhuma conta fixa.</p> )}
            </div>
          </div>

          {/* Gastos Variáveis */}
          <div className={`${theme.card} border rounded-2xl overflow-hidden flex flex-col`}>
            <div className={`p-4 border-b ${currentTheme === 'dark' ? 'bg-zinc-950/30 border-zinc-800' : 'bg-gray-50/50 border-gray-100'}`}>
              <h3 className={`font-bold flex items-center gap-2 ${theme.text}`}>
                <ArrowDownRight className="w-4 h-4 text-blue-500" /> Fluxo Variável
              </h3>
            </div>
            <div className={`divide-y ${currentTheme === 'dark' ? 'divide-zinc-800' : 'divide-gray-100'}`}>
              {processedData.variableTransactions.slice(0, 15).map((tx: any) => (
                <div key={tx.id} className={`p-3 flex justify-between items-center transition-colors ${theme.cardHover}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                      {tx.type === 'income' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className={`text-sm font-medium line-clamp-1 ${theme.text}`}>{tx.description}</p>
                      <p className={`text-[10px] font-bold uppercase flex items-center gap-1 ${theme.textMuted}`}>
                        {tx.entityType === 'pj' ? <Briefcase className="w-3 h-3 text-blue-500"/> : <User className="w-3 h-3 opacity-50"/>}
                        {tx.date.split('-').reverse().join('/')} • {rawData.allCategories.find((c: any) => c.id === tx.categoryId)?.name || 'Geral'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono text-sm font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-500' : theme.text}`}>{tx.type === 'expense' && '- '}{formatCurrency(Number(tx.amount))}</span >
                    <div className="flex flex-col gap-1">
                        <button onClick={() => handleEdit(tx)} className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                        <button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                </div>
              ))}
                {processedData.variableTransactions.length === 0 && ( <p className={`text-sm text-center py-8 ${theme.textMuted}`}>Sem lançamentos.</p> )}
            </div>
          </div>
        </div>
      </div>
      
      {/* MODAIS */}
      {isModalOpen && (
        <TransactionModal 
            categories={rawData.allCategories} 
            transaction={editingTransaction}
            onClose={() => { 
                setIsModalOpen(false); 
                setEditingTransaction(null);
                loadData(); 
            }}
            userPlan={rawData.planType}
            onRequestPremium={() => setShowPremium(true)}
        />
      )}
      
      {budgetModalOpen && selectedCategory && (
        <BudgetModal category={selectedCategory} onClose={() => { setBudgetModalOpen(false); loadData(); }} />
      )}

      {/* MODAL PREMIUM */}
      <PremiumModal isOpen={showPremium} onClose={() => setShowPremium(false)} />

      {/* MODAL DE RELATÓRIO AVANÇADO (PDF) */}
      {isReportModalOpen && (
         <ReportModal 
            onClose={() => setIsReportModalOpen(false)} 
            userPlan={rawData.planType} 
            onRequestPremium={() => setShowPremium(true)} 
         />
      )}
    </main>
  );
}