'use client'

import { useState, useEffect } from "react";
import { getDashboardData, toggleTransactionStatus, copyFixedExpenses, generateMonthlyReport } from "./actions"; // + generateMonthlyReport
import { TransactionModal } from "@/components/TransactionModal";
import { 
  TrendingUp, Calendar, Plus, ArrowUpRight, ArrowDownRight, 
  Wallet, Filter, Clock, CheckCircle2, Circle, Copy, Loader2,
  Dumbbell, MessageSquareQuote, X 
} from "lucide-react";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid 
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [copying, setCopying] = useState(false);
  
  // Novos estados para o Personal
  const [advice, setAdvice] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const [data, setData] = useState<any>({ 
    allCategories: [], 
    summary: { balance: 0, income: 0, expense: 0, incomeChange: 0, expenseChange: 0 },
    fixedExpenses: [], 
    variableTransactions: [], 
    pieData: [],
    dailyData: []
  });

  async function loadData() {
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const result = await getDashboardData(month, year);
    setData(result);
  }

  async function handleTogglePay(id: string, currentStatus: boolean) {
    await toggleTransactionStatus(id, currentStatus);
    loadData(); 
  }

  async function handleCopyMonth() {
    if (!confirm("Deseja copiar todas as contas fixas deste mês para o próximo?")) return;
    setCopying(true);
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const result = await copyFixedExpenses(month, year);
    alert(result.message);
    setCopying(false);
    if (result.success) changeMonth(1);
  }

  // --- FUNÇÃO DO PERSONAL FINANCEIRO ---
  async function handleAnalyze() {
    setAnalyzing(true);
    setAdvice(''); // Limpa análise anterior
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    
    const result = await generateMonthlyReport(month, year);
    setAdvice(result.message || "Erro ao analisar.");
    setAnalyzing(false);
  }

  useEffect(() => { loadData(); }, [currentDate]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    setAdvice(''); // Limpa o conselho ao mudar de mês
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Visão Geral
            </h1>
            <p className="text-zinc-400 text-sm mt-1">Paulo Adriano TEAM • Gestão Financeira</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-sm">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"><ArrowDownRight className="rotate-45" /></button>
              <div className="flex items-center gap-2 px-4 min-w-[140px] justify-center text-sm font-bold capitalize text-zinc-200">
                <Calendar className="w-4 h-4 text-blue-500" />
                {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"><ArrowUpRight className="rotate-45" /></button>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-5 h-5" /> Novo Lançamento
            </button>
          </div>
        </header>

        {/* --- ÁREA DO PERSONAL FINANCEIRO --- */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
             {!advice && (
               <button 
                 onClick={handleAnalyze}
                 disabled={analyzing}
                 className="flex items-center gap-2 text-sm font-bold bg-zinc-800 hover:bg-zinc-700 text-blue-400 px-4 py-2 rounded-xl border border-zinc-700 transition-all hover:border-blue-500/50"
               >
                 {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dumbbell className="w-4 h-4" />}
                 {analyzing ? "Analisando treino..." : "Pedir Análise do Personal"}
               </button>
             )}
          </div>

          {/* O Feedback da IA */}
          {advice && (
            <div className="bg-gradient-to-r from-blue-900/10 to-zinc-900 border border-blue-500/30 p-6 rounded-2xl relative animate-in slide-in-from-top-4 fade-in duration-500">
              <button onClick={() => setAdvice('')} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="bg-blue-600/20 p-3 rounded-full h-fit w-fit">
                  <MessageSquareQuote className="w-8 h-8 text-blue-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    Feedback do Treinador
                    <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded text-white uppercase tracking-wider font-bold">IA</span>
                  </h3>
                  <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">
                    {advice}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet className="w-16 h-16" /></div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Saldo Total</p>
            <h2 className={`text-4xl font-mono font-bold ${data.summary.balance >= 0 ? 'text-white' : 'text-red-400'}`}>
              {formatCurrency(data.summary.balance)}
            </h2>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Entradas</p>
            <h2 className="text-2xl font-mono font-bold text-green-400">{formatCurrency(data.summary.income)}</h2>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 backdrop-blur-sm">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Saídas</p>
            <h2 className="text-2xl font-mono font-bold text-red-400">{formatCurrency(data.summary.expense)}</h2>
          </div>
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-col h-[350px]">
            <h3 className="text-sm font-bold text-zinc-300 mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Fluxo de Caixa (Dia a Dia)
            </h3>
            <div className="flex-1 w-full">
              {data.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyData}>
                    <defs>
                      <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="day" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickFormatter={(val) => `R$${val}`} tickLine={false} axisLine={false} width={60} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} itemStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" dataKey="entrada" name="Entrada" stroke="#10b981" fillOpacity={1} fill="url(#colorEntrada)" strokeWidth={2} />
                    <Area type="monotone" dataKey="saida" name="Saída" stroke="#ef4444" fillOpacity={1} fill="url(#colorSaida)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : ( <div className="h-full flex items-center justify-center text-zinc-600 text-sm">Sem dados suficientes.</div> )}
            </div>
          </div>
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-col h-[350px]">
            <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-purple-500" /> Top Despesas
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {data.pieData.map((item: any, idx: number) => (
                <div key={idx} className="group">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">{item.name}</span>
                    <span className="text-zinc-400">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${data.summary.expense > 0 ? (item.value / data.summary.expense) * 100 : 0}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                  </div>
                </div>
              ))}
              {data.pieData.length === 0 && ( <div className="text-center text-zinc-600 text-xs mt-10">Nenhuma despesa registrada.</div> )}
            </div>
          </div>
        </div>

        {/* LISTAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LISTA 1: Contas Fixas + BOTÃO DE COPIAR */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/30 flex justify-between items-center">
              <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" /> Contas Fixas
              </h3>
              
              {data.fixedExpenses.length > 0 && (
                <button 
                  onClick={handleCopyMonth}
                  disabled={copying}
                  className="text-xs flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-all border border-zinc-700"
                  title="Copiar todas as contas fixas para o próximo mês"
                >
                  {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                  Virar Mês
                </button>
              )}
            </div>
            
            <div className="p-4 space-y-3">
              {data.fixedExpenses.map((tx: any) => (
                <div key={tx.id} className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleTogglePay(tx.id, tx.isPaid)} className={`p-2 rounded-full transition-all ${tx.isPaid ? 'text-green-500 bg-green-500/10' : 'text-zinc-600 bg-zinc-800 hover:text-orange-500'}`}>
                      {tx.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <div>
                      <p className={`font-semibold text-sm ${tx.isPaid ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{tx.description}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">Dia {tx.date.split('-')[2]}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold font-mono text-zinc-200 text-sm">{formatCurrency(Number(tx.amount))}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${tx.isPaid ? 'text-green-600' : 'text-orange-500'}`}>{tx.isPaid ? 'PAGO' : 'PENDENTE'}</span>
                  </div>
                </div>
              ))}
              {data.fixedExpenses.length === 0 && ( <p className="text-zinc-600 text-sm text-center py-8">Nenhuma conta fixa.</p> )}
            </div>
          </div>

          {/* LISTA 2: Gastos Variáveis */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/30">
              <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-blue-500" /> Gastos Variáveis
              </h3>
            </div>
            <div className="divide-y divide-zinc-800">
              {data.variableTransactions.slice(0, 10).map((tx: any) => (
                <div key={tx.id} className="p-3 flex justify-between items-center hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {tx.type === 'income' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200 line-clamp-1">{tx.description}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">{new Date(tx.date).toLocaleDateString('pt-BR')} • {data.allCategories.find((c: any) => c.id === tx.categoryId)?.name || 'Geral'}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-green-400' : 'text-zinc-300'}`}>{tx.type === 'expense' && '- '}{formatCurrency(Number(tx.amount))}</span>
                </div>
              ))}
               {data.variableTransactions.length === 0 && ( <p className="text-zinc-600 text-sm text-center py-8">Sem lançamentos.</p> )}
            </div>
          </div>
        </div>
      </div>
      {isModalOpen && <TransactionModal categories={data.allCategories} onClose={() => { setIsModalOpen(false); loadData(); }} />}
    </main>
  );
}