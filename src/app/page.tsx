'use client'

import { useState, useEffect, useMemo, useRef } from "react";
import { ReportModal } from "@/components/ReportModal"; 
import { getDashboardData, toggleTransactionStatus, copyFixedExpenses, generateMonthlyReport, deleteTransaction, processCSVWithAI, saveBulkTransactions, getPendingFixedBillOccurrences } from "./actions";
import { TransactionModal } from "@/components/TransactionModal";
import { BudgetModal } from "@/components/BudgetModal";
import { ImportReviewModal } from "@/components/ImportReviewModal";
import { UserButton } from "@clerk/nextjs"; 
import { DashboardCards } from "@/components/DashboardCards";
import { DashboardCharts } from "@/components/DashboardCharts";
import { calculateDashboardData } from "@/utils/dashboardCalculations";
import {
  Plus,
  Clock, CheckCircle2, Circle, Copy, Loader2,
  Briefcase, User, Layers, MessageSquare, X, Palette, Pencil, Trash2, AlertCircle, Crown, FileText, Download, Filter, Calendar as CalendarIcon, ToggleLeft, ToggleRight, CreditCard, Tag, Tags, Repeat, Upload
} from "lucide-react";
import { PremiumModal } from "@/components/PremiumModal";
import { OpenBillsPanel } from "@/components/OpenBillsPanel";
import { ForecastPanel } from "@/components/ForecastPanel";
import { CreditCardsModal } from "@/components/CreditCardsModal";
import { CategoryRulesModal } from "@/components/CategoryRulesModal";
import { CategoriesModal } from "@/components/CategoriesModal";
import { FixedBillsModal } from "@/components/FixedBillsModal";
import { CardInvoiceImportModal } from "@/components/CardInvoiceImportModal";

// --- CONFIGURAÇÃO DE TEMAS ---
const THEMES = {
  dark: { id: 'dark', hex: '#09090b', bg: 'bg-zinc-950', text: 'text-zinc-50', textMuted: 'text-zinc-400', card: 'bg-zinc-900 border-zinc-800', cardHover: 'hover:bg-zinc-800/50', button: 'bg-blue-600 hover:bg-blue-700 text-white', buttonSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300', iconBg: 'bg-zinc-800', navActive: 'bg-zinc-800 text-white', navInactive: 'text-zinc-500 hover:text-zinc-300', logoFilter: 'invert brightness-0 invert' },
  nubank: { id: 'nubank', hex: '#f5f5f5', bg: 'bg-[#f5f5f5]', text: 'text-gray-900', textMuted: 'text-gray-500', card: 'bg-white border-gray-200 shadow-sm', cardHover: 'hover:bg-gray-50', button: 'bg-purple-600 hover:bg-purple-700 text-white', buttonSecondary: 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200', iconBg: 'bg-purple-50 text-purple-600', navActive: 'bg-purple-600 text-white shadow-md', navInactive: 'text-gray-500 hover:bg-gray-200', logoFilter: '' },
  green: { id: 'green', hex: '#ecfdf5', bg: 'bg-[#ecfdf5]', text: 'text-emerald-950', textMuted: 'text-emerald-600/70', card: 'bg-white border-emerald-100 shadow-sm', cardHover: 'hover:bg-emerald-50', button: 'bg-emerald-600 hover:bg-emerald-700 text-white', buttonSecondary: 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-100', iconBg: 'bg-emerald-100 text-emerald-700', navActive: 'bg-emerald-600 text-white shadow-md', navInactive: 'text-emerald-600/60 hover:bg-emerald-100', logoFilter: '' },
  blue: { id: 'blue', hex: '#f8fafc', bg: 'bg-[#f8fafc]', text: 'text-slate-900', textMuted: 'text-slate-500', card: 'bg-white border-slate-200 shadow-sm', cardHover: 'hover:bg-slate-50', button: 'bg-blue-700 hover:bg-blue-800 text-white', buttonSecondary: 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200', iconBg: 'bg-blue-50 text-blue-700', navActive: 'bg-slate-900 text-white shadow-md', navInactive: 'text-slate-500 hover:bg-slate-200', logoFilter: '' },
  red: { id: 'red', hex: '#fff1f2', bg: 'bg-[#fff1f2]', text: 'text-rose-950', textMuted: 'text-rose-600/70', card: 'bg-white border-rose-100 shadow-sm', cardHover: 'hover:bg-rose-50', button: 'bg-rose-600 hover:bg-rose-700 text-white', buttonSecondary: 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-100', iconBg: 'bg-rose-100 text-rose-700', navActive: 'bg-rose-600 text-white shadow-md', navInactive: 'text-rose-600/60 hover:bg-rose-100', logoFilter: '' }
};

// --- IMPORTAÇÃO DE CSV: parser robusto ---
// 🔥 CORRIGIDO: o parser antigo assumia sempre a mesma ordem fixa de colunas
// (Data, Valor, Identificador, Descrição) sem aspas — funcionava pro extrato
// simples de banco, mas quebrava com exports mais completos (ex: Asaas), que
// vêm com todo campo entre aspas, colunas em outra ordem, uma linha de
// metadado antes do cabeçalho de verdade e linhas de "Saldo Inicial/Final"
// no meio. Isso fazia todo valor virar NaN (aspas atrapalhavam o parseFloat)
// e todo mundo saía com R$ 0,00 na revisão.
//
// Agora: 1) faz o parse respeitando aspas (campo entre aspas pode até ter
// vírgula dentro); 2) acha a linha de cabeçalho de verdade procurando quem
// tem colunas "Data" e "Valor" (em vez de assumir que é sempre a linha 0);
// 3) usa o NOME das colunas pra descobrir onde estão data/valor/descrição,
// então funciona tanto no formato antigo quanto no do Asaas.

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

function normalizeHeaderCell(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Aceita tanto "29.90"/"-0.99" (Asaas, ponto decimal) quanto "1.234,56" ou
// "29,90" (formato BR com vírgula decimal).
function parseAmountValue(raw: string): number {
  let v = (raw || '').replace(/[^\d,.\-]/g, '');
  if (!v) return NaN;
  const hasComma = v.includes(',');
  const hasDot = v.includes('.');
  if (hasComma && hasDot) {
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
  } else if (hasComma) {
    v = v.replace(',', '.');
  }
  return parseFloat(v);
}

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTransactions, setReviewTransactions] = useState<any[]>([]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  // 🔥 NOVO: ocorrências de conta fixa pendentes (ainda não pagas), pra dar
  // baixa nelas direto na tela de revisão de importação em vez de duplicar.
  const [pendingFixedBills, setPendingFixedBills] = useState<any[]>([]);

  // 🔥 NOVO: cartões de crédito, regras de categorização e um "carimbo" pra
  // avisar os painéis de previsão/contas em aberto que algo mudou.
  const [isCreditCardsModalOpen, setIsCreditCardsModalOpen] = useState(false);
  const [isCategoryRulesModalOpen, setIsCategoryRulesModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isFixedBillsModalOpen, setIsFixedBillsModalOpen] = useState(false);
  const [isCardInvoiceModalOpen, setIsCardInvoiceModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 🔥 NOVOS ESTADOS DE RANGE DE DATA 🔥
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState<number>(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState<number>(new Date().getFullYear());
  const [isolatePeriod, setIsolatePeriod] = useState<boolean>(false); // Chavinha de ZERAR o passado

  const theme = THEMES[currentTheme];
  const [rawData, setRawData] = useState<any>({ allCategories: [], transactions: [], summary: { globalBalance: 0 }, planType: 'free' });

  // 🔥 NOVO: refs pros campos de mês, pra abrir o calendário nativo clicando
  // em qualquer lugar do "cartão" (não só no ícone minúsculo do navegador).
  const startMonthInputRef = useRef<HTMLInputElement>(null);
  const endMonthInputRef = useRef<HTMLInputElement>(null);
  const openPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    try { ref.current?.showPicker?.(); } catch { /* navegador sem suporte a showPicker(); o clique no campo já funciona normalmente */ }
  };

  useEffect(() => { document.body.style.backgroundColor = theme.hex; }, [currentTheme, theme.hex]);

  // Carrega sempre que o range ou a chavinha mudar
  async function loadData() {
    const [result, pending] = await Promise.all([
      getDashboardData(startMonth, startYear, endMonth, endYear, isolatePeriod),
      getPendingFixedBillOccurrences(),
    ]);
    setRawData(result);
    setPendingFixedBills(pending);
    setRefreshKey((k) => k + 1); // avisa os painéis de Contas em Aberto / Previsão para atualizar também
  }

  useEffect(() => { loadData(); setSelectedDay(null); }, [startMonth, startYear, endMonth, endYear, isolatePeriod]);

  const handleFileUpload = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r\n|\n/);
        const transactionsRaw: { date: string; amount: number; description: string }[] = [];

        // 🔥 CORRIGIDO: acha a linha de cabeçalho de verdade (procurando quem
        // tem "Data" e "Valor" entre as colunas) em vez de assumir que é
        // sempre a primeira linha — arquivos como o do Asaas vêm com uma
        // linha de metadado ("Período a partir de...") antes do cabeçalho.
        let headerIndex = -1;
        let columns: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cols = parseCsvLine(lines[i]).map(normalizeHeaderCell);
          if (cols.includes('data') && cols.includes('valor')) {
            headerIndex = i;
            columns = cols;
            break;
          }
        }

        if (headerIndex === -1) {
          alert("Não consegui identificar as colunas do CSV (preciso achar 'Data' e 'Valor' no cabeçalho do arquivo). Confira se é um extrato/CSV válido.");
          setUploadStatus("");
          return;
        }

        const dateIdx = columns.indexOf('data');
        const valorIdx = columns.indexOf('valor');
        const descIdx = columns.findIndex((c) => c.includes('descricao'));

        for (let i = headerIndex + 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const fields = parseCsvLine(lines[i]);
          const dataRaw = (fields[dateIdx] || '').trim();
          const valorRaw = (fields[valorIdx] || '').trim();
          const descricaoRaw = descIdx >= 0 ? (fields[descIdx] || '').trim() : '';

          // Ignora linhas de resumo do extrato (ex: "Saldo Inicial"/"Saldo
          // Final" do Asaas), que não têm uma data de transação de verdade.
          if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataRaw)) continue;

          const amount = parseAmountValue(valorRaw);
          if (Number.isNaN(amount)) continue;

          transactionsRaw.push({ date: dataRaw, amount, description: (descricaoRaw || 'Importado').substring(0, 200) });
        }

        const BATCH_SIZE = 15;
        const totalBatches = Math.ceil(transactionsRaw.length / BATCH_SIZE);
        let allProcessed: any[] = []; 

        for (let i = 0; i < transactionsRaw.length; i += BATCH_SIZE) {
          const loteAtual = Math.floor(i / BATCH_SIZE) + 1;
          const batch = transactionsRaw.slice(i, i + BATCH_SIZE);
          setUploadStatus(`IA Lote ${loteAtual} de ${totalBatches}...`);

          const result = await processCSVWithAI(batch);
          if (result.success && result.data) {
            allProcessed = [...allProcessed, ...result.data];
          }
        }

        setUploadStatus(""); 
        
        if (allProcessed.length > 0) {
            setReviewTransactions(allProcessed);
            setIsReviewModalOpen(true);
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

  const processedData = useMemo(() => {
    return calculateDashboardData(rawData, viewMode, selectedDay);
  }, [rawData, viewMode, selectedDay]);

  async function handleTogglePay(id: string, currentStatus: boolean) { await toggleTransactionStatus(id, currentStatus); loadData(); }
  async function handleCopyMonth() { 
      if(confirm("Deseja copiar todas as contas fixas deste mês inicial para o próximo?")) { 
          setCopying(true); const res = await copyFixedExpenses(startMonth, startYear); alert(res.message); setCopying(false); 
      } 
  }
  
  async function handleAnalyze() { 
    setAnalyzing(true); setAdvice(''); 
    const res = await generateMonthlyReport(endMonth, endYear); 
    if (res.message && res.message.includes("RECURSO PREMIUM")) { setAnalyzing(false); setShowPremium(true); return; }
    setAdvice(res.message || "Erro ao analisar."); setAnalyzing(false); 
  }

  function handleExportPDF() { setIsReportModalOpen(true); }
  async function handleDelete(id: string) { if(confirm("Deseja realmente excluir este lançamento?")) { await deleteTransaction(id); loadData(); } }
  function handleEdit(tx: any) { setEditingTransaction(tx); setIsModalOpen(true); }

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const isPro = rawData.planType !== 'free';

  const displayedFixedExpenses = processedData.fixedExpenses.filter((tx: any) => filterCategory === 'all' || tx.categoryId === filterCategory);
  // 🔥 NOVO: categorias em ordem alfabética em todo canto que elas aparecem como lista/seleção.
  const sortedCategories = [...rawData.allCategories].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <main className={`min-h-screen w-full ${theme.bg} ${theme.text} pt-4 md:pt-8 font-sans transition-colors duration-500 overflow-x-hidden`}>
      <div className="max-w-7xl mx-auto space-y-6 px-4 md:px-0">
        
        <header className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
            <div className="w-full md:w-auto flex justify-center md:justify-start">
              <img src="/logo.png" alt="KORE" className={`h-24 md:h-40 w-auto object-contain transition-all duration-500 ${theme.logoFilter}`} />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto justify-end">
                <div className="flex items-center gap-3 w-full justify-center md:justify-end">
                    {!isPro && (<button onClick={() => setShowPremium(true)} className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-3 py-2 rounded-full text-xs hover:scale-105 transition-all shadow-lg flex items-center gap-2 animate-pulse whitespace-nowrap"><Crown className="w-4 h-4"/> Seja PRO</button>)}
                    {isPro && (<span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider shadow-lg flex items-center gap-1 whitespace-nowrap"><Crown className="w-3 h-3"/> PRO</span>)}
                    <button onClick={() => setIsCreditCardsModalOpen(true)} className={`p-2 rounded-full border transition-all shrink-0 ${theme.card}`} title="Meus Cartões"><CreditCard className="w-5 h-5" /></button>
                    <button onClick={() => setIsCategoryRulesModalOpen(true)} className={`p-2 rounded-full border transition-all shrink-0 ${theme.card}`} title="Regras de Categorização"><Tag className="w-5 h-5" /></button>
                    <button onClick={() => setIsCategoriesModalOpen(true)} className={`p-2 rounded-full border transition-all shrink-0 ${theme.card}`} title="Minhas Categorias"><Tags className="w-5 h-5" /></button>
                    <button onClick={() => setIsFixedBillsModalOpen(true)} className={`p-2 rounded-full border transition-all shrink-0 ${theme.card}`} title="Minhas Contas Fixas"><Repeat className="w-5 h-5" /></button>
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
            
            {/* 🔥 BARRA DE CONTROLE DE PERÍODO (DATA RANGE) 🔥
                Redesenhado: antes eram 3 ícones de calendário amontoados (1
                decorativo + 1 nativo por campo) e só o ícone minúsculo do
                navegador abria o seletor. Agora cada campo é um "cartão"
                inteiro clicável (abre o calendário em qualquer ponto dele),
                com um rótulo De/Até e um único ícone por campo. */}
            <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto p-3 rounded-2xl border ${theme.card}`}>
                <div className="flex items-center gap-2 flex-1">
                    <div
                        onClick={() => openPicker(startMonthInputRef)}
                        className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors hover:border-blue-400 ${currentTheme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <CalendarIcon className={`w-4 h-4 shrink-0 ${theme.textMuted}`} />
                        <div className="min-w-0">
                            <p className={`text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 ${theme.textMuted}`}>De</p>
                            <input
                                ref={startMonthInputRef}
                                type="month"
                                value={`${startYear}-${String(startMonth).padStart(2, '0')}`}
                                onChange={(e) => { const [y, m] = e.target.value.split('-'); setStartYear(Number(y)); setStartMonth(Number(m)); }}
                                className={`w-full bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:hidden ${theme.text}`}
                            />
                        </div>
                    </div>

                    <div
                        onClick={() => openPicker(endMonthInputRef)}
                        className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors hover:border-blue-400 ${currentTheme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}
                    >
                        <CalendarIcon className={`w-4 h-4 shrink-0 ${theme.textMuted}`} />
                        <div className="min-w-0">
                            <p className={`text-[9px] font-bold uppercase tracking-wider leading-none mb-0.5 ${theme.textMuted}`}>Até</p>
                            <input
                                ref={endMonthInputRef}
                                type="month"
                                value={`${endYear}-${String(endMonth).padStart(2, '0')}`}
                                onChange={(e) => { const [y, m] = e.target.value.split('-'); setEndYear(Number(y)); setEndMonth(Number(m)); }}
                                className={`w-full bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none [&::-webkit-calendar-picker-indicator]:hidden ${theme.text}`}
                            />
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block w-px h-8 bg-gray-200 dark:bg-zinc-800"></div>

                <button
                    onClick={() => setIsolatePeriod(!isolatePeriod)}
                    className={`flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all shrink-0 ${isolatePeriod ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : theme.navInactive}`}
                    title="Se ativado, o Saldo Principal zera o passado e calcula APENAS as receitas e despesas deste período."
                >
                    {isolatePeriod ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    Isolar Saldo
                </button>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
                <label className={`flex-1 md:flex-none ${theme.buttonSecondary} cursor-pointer active:scale-95 px-6 py-4 md:py-3 rounded-full font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all border ${uploadStatus ? 'bg-purple-100 text-purple-600 border-purple-300' : ''}`}>
                  {uploadStatus ? <Loader2 className="w-5 h-5 animate-spin text-purple-600" /> : <FileText className="w-5 h-5" />} 
                  {uploadStatus ? uploadStatus : "Importar CSV"}
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={!!uploadStatus} />
                </label>
                <button onClick={() => setIsCardInvoiceModalOpen(true)} className={`flex-1 md:flex-none ${theme.buttonSecondary} active:scale-95 px-6 py-4 md:py-3 rounded-full font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all border`} title="Importar itens de uma fatura de cartão (.csv, .ofx ou .pdf)"><Upload className="w-5 h-5" /> Importar Fatura</button>
                <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className={`flex-1 md:flex-none ${theme.button} active:scale-95 px-6 py-4 md:py-3 rounded-full font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all`}><Plus className="w-5 h-5" /> Lançar</button>
            </div>
          </div>
        </header>

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

        {/* 🔥 NOVO: previsão do mês + contas em aberto (independente do período filtrado) */}
        <ForecastPanel theme={theme} formatCurrency={formatCurrency} refreshKey={refreshKey} viewMode={viewMode} />
        <OpenBillsPanel theme={theme} formatCurrency={formatCurrency} onChanged={loadData} refreshKey={refreshKey} startMonth={startMonth} startYear={startYear} endMonth={endMonth} endYear={endYear} />

        {/* COMPONENTES ISOLADOS */}
        <DashboardCards
          theme={theme}
          summary={processedData.summary}
          selectedDay={selectedDay}
          formatCurrency={formatCurrency}
          incomeTxs={processedData.incomeTxs}
          expenseTxs={processedData.expenseTxs}
          investedTxs={processedData.investedTxs}
          grossIncomeTxs={processedData.grossIncomeTxs}
          grossExpenseTxs={processedData.grossExpenseTxs}
          categories={rawData.allCategories}
          startMonth={startMonth}
          startYear={startYear}
          endMonth={endMonth}
          endYear={endYear}
          isolatePeriod={isolatePeriod}
          viewMode={viewMode}
          onEditTransaction={handleEdit}
        />
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
                    {sortedCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* LISTA DE CUSTOS FIXOS — Fluxo Variável foi removido daqui: os cards
            clicáveis de Receita/Despesa acima já cobrem o mesmo detalhamento,
            agora organizado por categoria. */}
        <div className="pb-8">
          <div className={`${theme.card} border rounded-2xl overflow-hidden flex flex-col max-w-2xl`}>
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
                // 🔥 NOVO: quando a conta tem um valor original registrado (vinda de
                // um molde de "Minhas Contas Fixas" ou digitado na hora), mostra a
                // diferença pro valor pago como juro (pagou mais) ou desconto (pagou menos).
                const hasOriginal = tx.originalAmount !== null && tx.originalAmount !== undefined;
                const diff = hasOriginal ? Number(tx.amount) - Number(tx.originalAmount) : 0;
                return (
                  <div key={tx.id} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${currentTheme === 'dark' ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-100 hover:border-blue-200 shadow-sm'}`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleTogglePay(tx.id, tx.isPaid)} className={`p-2 rounded-full transition-all ${tx.isPaid ? 'text-emerald-600 bg-emerald-500/10' : 'text-slate-400 bg-slate-100/50 hover:text-orange-500'}`}>{tx.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button>
                      <div>
                        <p className={`font-semibold text-sm ${tx.isPaid ? 'text-zinc-500 line-through' : theme.text}`}>{tx.description}</p>
                        <p className={`text-[10px] font-bold uppercase flex items-center gap-1 ${theme.textMuted}`}>{tx.entityType === 'pj' ? <Briefcase className="w-3 h-3 text-blue-500"/> : <User className="w-3 h-3 opacity-50"/>}{isLate ? (<span className="flex items-center gap-1 text-red-500 animate-pulse"><AlertCircle className="w-3 h-3"/> VENCIDO (Dia {tx.date.split('-')[2]})</span>) : isToday ? (<span className="flex items-center gap-1 text-amber-500 font-bold"><Clock className="w-3 h-3"/> VENCE HOJE</span>) : (<span>Dia {tx.date.split('-')[2]}</span>)}</p>
                        {hasOriginal && Math.abs(diff) > 0.009 && (
                          <p className={`text-[9px] font-bold pt-0.5 ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            Original: {formatCurrency(Number(tx.originalAmount))} • {diff > 0 ? 'Juros' : 'Desconto'} de {formatCurrency(Math.abs(diff))}
                          </p>
                        )}
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
        </div>
      </div>
      
      {/* MODAIS CLÁSSICOS */}
      {isModalOpen && (<TransactionModal categories={rawData.allCategories} transaction={editingTransaction} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); loadData(); }} userPlan={rawData.planType} onRequestPremium={() => setShowPremium(true)} />)}
      {budgetModalOpen && selectedCategory && (<BudgetModal category={selectedCategory} onClose={() => { setBudgetModalOpen(false); loadData(); }} />)}
      <PremiumModal isOpen={showPremium} onClose={() => setShowPremium(false)} />
      {isReportModalOpen && (<ReportModal onClose={() => setIsReportModalOpen(false)} userPlan={rawData.planType} onRequestPremium={() => setShowPremium(true)} />)}
      {isCreditCardsModalOpen && (<CreditCardsModal onClose={() => { setIsCreditCardsModalOpen(false); loadData(); }} />)}
      {isCategoryRulesModalOpen && (<CategoryRulesModal onClose={() => setIsCategoryRulesModalOpen(false)} categories={rawData.allCategories} />)}
      {isCategoriesModalOpen && (<CategoriesModal onClose={() => { setIsCategoriesModalOpen(false); loadData(); }} />)}
      {isFixedBillsModalOpen && (<FixedBillsModal categories={rawData.allCategories} onClose={() => { setIsFixedBillsModalOpen(false); loadData(); }} />)}
      {isCardInvoiceModalOpen && (<CardInvoiceImportModal categories={rawData.allCategories} pendingFixedBills={pendingFixedBills} onClose={() => { setIsCardInvoiceModalOpen(false); loadData(); }} />)}

      {/* 🔥 NOVO MODAL DE REVISÃO DA IA 🔥 */}
      <ImportReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        initialTransactions={reviewTransactions}
        categories={rawData.allCategories}
        onConfirm={handleConfirmImport}
        isSaving={isSavingBulk}
        pendingFixedBills={pendingFixedBills}
      />
    </main>
  );
}
