'use client'

import { useState, useEffect, useMemo, useRef } from "react";
import { ReportModal } from "@/components/ReportModal"; 
import { getCreditCardsOverview, payCreditCardInvoice } from "./creditCardActions";
import { getDashboardData, toggleTransactionStatus, copyFixedExpenses, generateMonthlyReport, deleteTransaction, processCSVWithAI, saveBulkTransactions, getPendingFixedBillOccurrences } from "./actions";
import { TransactionModal } from "@/components/TransactionModal";
import { BudgetModal } from "@/components/BudgetModal";
import { ImportReviewModal } from "@/components/ImportReviewModal";
import { UserButton } from "@clerk/nextjs"; 
import { DashboardCards } from "@/components/DashboardCards";
import { DashboardCharts } from "@/components/DashboardCharts";
import { calculateDashboardData } from "@/utils/dashboardCalculations";
import {
  Crown, Users, CreditCard, Repeat, Tags, Tag, Info,
} from "lucide-react";
import { PremiumModal } from "@/components/PremiumModal";
import { OpenBillsPanel } from "@/components/OpenBillsPanel";
import { CreditCardsModal } from "@/components/CreditCardsModal";
import { CategoryRulesModal } from "@/components/CategoryRulesModal";
import { CategoriesModal } from "@/components/CategoriesModal";
import { syncAsaasPayments } from "@/app/asaasActions";
import { AppShell, type Section } from "@/components/shell/AppShell";
import { ContextBar } from "@/components/shell/ContextBar";
import { TransactionsView } from "@/components/views/TransactionsView";
import { AccountsView } from "@/components/views/AccountsView";
import { CategoriesView } from "@/components/views/CategoriesView";
import { ReportsView } from "@/components/views/ReportsView";
import { MonthCloseChecklist } from "@/components/MonthCloseChecklist";
import { InvoiceItemsModal } from "@/components/InvoiceItemsModal";
import { accentFor } from "@/utils/ownerAccent";
import { buildViewOptions } from "@/utils/owners";
import { OwnerSetupModal } from "@/components/OwnerSetupModal";
import { monthChecklist } from "@/utils/closing";
import { EMPTY_FILTERS, type TxFilters } from "@/utils/txFilters";
import { todayDateStr } from "@/utils/dates";
import { HelpAssistant } from "@/components/HelpAssistant";
import { OwnersAccountsModal } from "@/components/OwnersAccountsModal";
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
  const [viewMode, setViewMode] = useState<string>('all');
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'nubank' | 'green' | 'blue' | 'red'>('nubank');
  // 'month' = um mês só, isolado (saldo e tudo mais só daquele mês, sem nada dos outros).
  // 'range'  = período com De/Até, com a opção de acumular o saldo de antes ou não.
  const [periodMode, setPeriodMode] = useState<'month' | 'range'>('month');
  const csvInputRef = useRef<HTMLInputElement>(null);
  // Área da tela (menu lateral/inferior) e filtros da tela de Lançamentos.
  const [section, setSection] = useState<Section>('inicio');
  const [txFilters, setTxFilters] = useState<TxFilters>(EMPTY_FILTERS);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpFocus, setHelpFocus] = useState<string | null>(null);
  const [cardsOverview, setCardsOverview] = useState<any[]>([]);
  const [viewingInvoice, setViewingInvoice] = useState<{ cardId: string; cycleKey: string } | null>(null);

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
  const [isOwnersModalOpen, setIsOwnersModalOpen] = useState(false);
  const [isOwnerSetupOpen, setIsOwnerSetupOpen] = useState(false);
  const [isCardInvoiceModalOpen, setIsCardInvoiceModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 🔥 NOVOS ESTADOS DE RANGE DE DATA 🔥
  const [startMonth, setStartMonth] = useState<number>(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState<number>(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState<number>(new Date().getFullYear());
  const [isolatePeriod, setIsolatePeriod] = useState<boolean>(true); // Chavinha de ZERAR o passado (começa ligada: o app abre em "Mês isolado")

  const theme = THEMES[currentTheme];
  const [rawData, setRawData] = useState<any>({ allCategories: [], transactions: [], summary: { globalBalance: 0 }, planType: 'free' });

  useEffect(() => { document.body.style.backgroundColor = theme.hex; }, [currentTheme, theme.hex]);

  // Carrega sempre que o range ou a chavinha mudar
  async function loadData() {
    const [result, pending, cards] = await Promise.all([
      getDashboardData(startMonth, startYear, endMonth, endYear, isolatePeriod),
      getPendingFixedBillOccurrences(),
      getCreditCardsOverview(),
    ]);
    setRawData(result);
    setPendingFixedBills(pending);
    setCardsOverview(cards);
    setRefreshKey((k) => k + 1); // avisa os painéis de Contas em Aberto / Previsão para atualizar também
  }

  useEffect(() => { loadData(); setSelectedDay(null); }, [startMonth, startYear, endMonth, endYear, isolatePeriod]);

  const selectSingleMonth = (year: number, month: number) => {
    setStartYear(year); setStartMonth(month); setEndYear(year); setEndMonth(month);
  };
  const shiftMonth = (delta: number) => {
    const d = new Date(startYear, startMonth - 1 + delta, 1);
    selectSingleMonth(d.getFullYear(), d.getMonth() + 1);
  };
  const switchPeriodMode = (mode: 'month' | 'range') => {
    if (mode === periodMode) return;
    if (mode === 'month') { selectSingleMonth(endYear, endMonth); setIsolatePeriod(true); }
    else { setIsolatePeriod(false); }
    setPeriodMode(mode);
  };

  // Puxa as vendas recebidas no Asaas no período selecionado (sem duplicar).
  const handleSyncAsaas = async () => {
    setUploadStatus("Sincronizando Asaas...");
    const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const res: any = await syncAsaasPayments(startDate, endDate);
    setUploadStatus("");
    if (res.success) {
      alert(`Asaas: ${res.inserted} lançamento(s) novo(s)${res.skipped ? `, ${res.skipped} já existiam` : ''}.`);
      loadData();
    } else {
      alert(res.message || "Erro ao sincronizar com o Asaas.");
    }
  };

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
          alert(`Sucesso! ${finalTransactions.length} transações salvas perfeitamente!${res.settledInvoices ? ` ${res.settledInvoices} fatura(s) de cartão receberam baixa.` : ''}`);
          setIsReviewModalOpen(false);
          setReviewTransactions([]);
          loadData();
      } else {
          alert("Ops! Houve um erro ao salvar no banco. Tente novamente.");
      }
  }

  // Visões da barra do topo: Tudo, os grupos (Casal/Família/Empresas, só quando
  // fazem sentido) e cada dono, com os nomes que a própria pessoa escolheu.
  const owners: any[] = rawData.owners || [];
  const ownerNameById = (id?: string | null) => owners.find((o) => o.id === id)?.name || '';
  const viewOptions = buildViewOptions(owners);

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

  const todayStr = todayDateStr();
  const ownerList: any[] = rawData.owners || [];
  const accent = accentFor(viewMode, ownerList);
  const accentOf = (id: string) => accentFor(id, ownerList);
  const viewLabel = viewOptions.find((o) => o.id === viewMode)?.label || 'Tudo';
  const periodLabel = startMonth === endMonth && startYear === endYear
    ? `${String(startMonth).padStart(2, '0')}/${startYear}`
    : `${String(startMonth).padStart(2, '0')}/${startYear} a ${String(endMonth).padStart(2, '0')}/${endYear}`;

  // Cartões da visão atual (um cartão pertence a um dono).
  const viewCards = cardsOverview.filter((c: any) => {
    if (viewMode === 'all') return true;
    if (viewMode === 'pf' || viewMode === 'pj') return ownerList.find((o) => o.id === c.ownerId)?.kind === viewMode;
    return c.ownerId === viewMode;
  });

  // Faturas fechadas e não pagas de todos os cartões: o extrato do banco pode dar baixa nelas.
  const openInvoices = cardsOverview.flatMap((c: any) =>
    (c.closedUnpaidCycles || []).map((cy: any) => ({ cardId: c.id, cardName: c.name, cycleKey: cy.cycleKey, dueDate: cy.dueDate, total: cy.total }))
  );

  const checklist = useMemo(() => monthChecklist(rawData, viewMode, viewCards), [rawData, viewMode, cardsOverview]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(target: { section: Section; quick?: any }) {
    if (target.section === 'lancamentos') setTxFilters({ ...EMPTY_FILTERS, quick: target.quick || 'todos' });
    setSection(target.section);
  }
  function viewCategoryTransactions(categoryId: string) {
    setTxFilters({ ...EMPTY_FILTERS, categoryId });
    setSection('lancamentos');
  }
  function openHelp(entryId?: string) { setHelpFocus(entryId || null); setHelpOpen(true); }

  async function handlePayInvoice(cardId: string, cycleKey: string, total: number) {
    if (!confirm(`Dar baixa na fatura inteira (${formatCurrency(total)})? Todos os itens dela serão marcados como pagos.`)) return;
    const res = await payCreditCardInvoice(cardId, cycleKey);
    alert(res.message);
    if (res.success) loadData();
  }

  const cadastros = [
    { label: 'Pessoas e Contas', hint: 'Quem tem gastos (pessoas e empresas) e bancos', icon: Users, run: () => setIsOwnersModalOpen(true) },
    { label: 'Meus Cartões', hint: 'Faturas, fechamento e vencimento', icon: CreditCard, run: () => setIsCreditCardsModalOpen(true) },
    { label: 'Contas Fixas', hint: 'Aluguel, internet, assinaturas', icon: Repeat, run: () => setIsFixedBillsModalOpen(true) },
    { label: 'Categorias', hint: 'Metas e como cada uma entra nas contas', icon: Tags, run: () => setIsCategoriesModalOpen(true) },
    { label: 'Regras de Categorização', hint: 'Ensina o app a categorizar sozinho', icon: Tag, run: () => setIsCategoryRulesModalOpen(true) },
    { label: 'Ajuda', hint: 'Tira-dúvidas e explicação dos números', icon: Info, run: () => openHelp() },
  ];

  const badges: Partial<Record<Section, number>> = { contas: (checklist.items.find((i) => i.id === 'faturas' && !i.ok) ? 1 : 0) + (checklist.items.find((i) => i.id === 'contas-fixas' && !i.ok) ? 1 : 0) };

  const proSlot = isPro
    ? (<span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider shadow-lg flex items-center gap-1 whitespace-nowrap"><Crown className="w-3 h-3" /> PRO</span>)
    : (<button onClick={() => setShowPremium(true)} className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-3 py-2 rounded-full text-xs hover:scale-105 transition-all shadow-lg flex items-center gap-2 whitespace-nowrap"><Crown className="w-4 h-4" /> Seja PRO</button>);
  const userSlot = (<div className="flex items-center justify-center bg-white/10 rounded-full p-1 shrink-0" title="Minha Conta"><UserButton afterSignOutUrl="/sign-in" /></div>);
  const themeSlot = (
    <div className="flex items-center gap-1.5" title="Tema">
      {([['dark', 'bg-zinc-950 border border-zinc-700', 'Dark'], ['nubank', 'bg-purple-600', 'Nubank'], ['green', 'bg-emerald-500', 'Eco'], ['blue', 'bg-blue-600', 'Executivo'], ['red', 'bg-rose-600', 'Red']] as const).map(([id, cls, name]) => (
        <button key={id} onClick={() => setCurrentTheme(id)} className={`w-5 h-5 rounded-full hover:scale-110 transition-transform ${cls} ${currentTheme === id ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`} title={name} aria-label={`Tema ${name}`} />
      ))}
    </div>
  );

  const openBillsPanel = (startExpanded: boolean) => (
    <OpenBillsPanel theme={theme} formatCurrency={formatCurrency} onChanged={loadData} refreshKey={refreshKey} startMonth={startMonth} startYear={startYear} endMonth={endMonth} endYear={endYear} viewMode={viewMode} startExpanded={startExpanded} />
  );

  return (
    <main className={`min-h-screen w-full ${theme.bg} ${theme.text} font-sans transition-colors duration-500 overflow-x-hidden`}>
      <AppShell
        theme={theme} section={section} onSection={setSection} accent={accent}
        logoSrc="/logo.png" logoClass={theme.logoFilter} badges={badges} cadastros={cadastros}
        proSlot={proSlot} userSlot={userSlot} themeSlot={themeSlot}
      >
        <ContextBar
          theme={theme} currentTheme={currentTheme}
          viewOptions={viewOptions} viewMode={viewMode} onViewMode={setViewMode} accentOf={accentOf}
          periodMode={periodMode} onPeriodMode={switchPeriodMode}
          startYear={startYear} startMonth={startMonth} endYear={endYear} endMonth={endMonth}
          onSelectMonth={selectSingleMonth} onShiftMonth={shiftMonth}
          onRangeStart={(y: number, m: number) => { setStartYear(y); setStartMonth(m); }}
          onRangeEnd={(y: number, m: number) => { setEndYear(y); setEndMonth(m); }}
          isolatePeriod={isolatePeriod} onToggleIsolate={() => setIsolatePeriod(!isolatePeriod)}
          uploadStatus={uploadStatus}
          onImportCsv={() => csvInputRef.current?.click()}
          onImportCard={() => setIsCardInvoiceModalOpen(true)}
          onSyncAsaas={handleSyncAsaas}
          onNewTransaction={() => { setEditingTransaction(null); setIsModalOpen(true); }}
        />
        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={!!uploadStatus} />

        <div className="pt-4">
          {section === 'inicio' && (
            <div className="space-y-6 pb-8">
              {openBillsPanel(false)}
              <MonthCloseChecklist theme={theme} checklist={checklist} onGo={goTo} />
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
                onHelp={openHelp}
              />
              <DashboardCharts theme={theme} processedData={processedData} currentTheme={currentTheme} formatCurrency={formatCurrency} setSelectedCategory={setSelectedCategory} setBudgetModalOpen={setBudgetModalOpen} />
            </div>
          )}

          {section === 'lancamentos' && (
            <TransactionsView
              theme={theme} currentTheme={currentTheme} formatCurrency={formatCurrency} todayStr={todayStr}
              txs={processedData.allTxs || []} categories={rawData.allCategories} owners={ownerList} accounts={rawData.accounts || []} cards={cardsOverview}
              filters={txFilters} onFilters={setTxFilters}
              onTogglePay={handleTogglePay} onEdit={handleEdit} onDelete={handleDelete} onChanged={loadData}
            />
          )}

          {section === 'contas' && (
            <AccountsView
              theme={theme} currentTheme={currentTheme} formatCurrency={formatCurrency} todayStr={todayStr}
              openBillsPanel={openBillsPanel(true)}
              fixedExpenses={processedData.fixedExpenses} ownerName={ownerNameById} cards={viewCards} owners={ownerList} copying={copying}
              onCopyMonth={handleCopyMonth} onTogglePay={handleTogglePay} onEdit={handleEdit} onDelete={handleDelete}
              onViewInvoiceItems={(cardId: string, cycleKey: string) => setViewingInvoice({ cardId, cycleKey })}
              onPayInvoice={handlePayInvoice}
              onManageCards={() => setIsCreditCardsModalOpen(true)}
              onImportInvoice={() => setIsCardInvoiceModalOpen(true)}
            />
          )}

          {section === 'categorias' && (
            <CategoriesView
              theme={theme} formatCurrency={formatCurrency}
              categories={rawData.allCategories} stats={processedData.categoryStats}
              onOpenBudget={(cat: any) => { setSelectedCategory(cat); setBudgetModalOpen(true); }}
              onViewTransactions={viewCategoryTransactions}
              onManage={() => setIsCategoriesModalOpen(true)}
            />
          )}

          {section === 'relatorios' && (
            <ReportsView
              theme={theme} currentTheme={currentTheme} isPro={isPro} analyzing={analyzing} advice={advice}
              onPDF={handleExportPDF} onAnalyze={handleAnalyze} onClearAdvice={() => setAdvice('')}
              viewLabel={viewLabel} periodLabel={periodLabel}
            />
          )}
        </div>
      </AppShell>

      {/* MODAIS CLÁSSICOS */}
      {isModalOpen && (<TransactionModal categories={rawData.allCategories} transaction={editingTransaction} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); loadData(); }} userPlan={rawData.planType} onRequestPremium={() => setShowPremium(true)} owners={rawData.owners} accounts={rawData.accounts} defaultOwnerId={owners.some((o) => o.id === viewMode) ? viewMode : undefined} />)}
      {budgetModalOpen && selectedCategory && (<BudgetModal category={selectedCategory} onClose={() => { setBudgetModalOpen(false); loadData(); }} />)}
      <PremiumModal isOpen={showPremium} onClose={() => setShowPremium(false)} />
      {isReportModalOpen && (<ReportModal onClose={() => setIsReportModalOpen(false)} userPlan={rawData.planType} onRequestPremium={() => setShowPremium(true)} />)}
      {isCreditCardsModalOpen && (<CreditCardsModal onClose={() => { setIsCreditCardsModalOpen(false); loadData(); }} />)}
      {isCategoryRulesModalOpen && (<CategoryRulesModal onClose={() => setIsCategoryRulesModalOpen(false)} categories={rawData.allCategories} />)}
      {isCategoriesModalOpen && (<CategoriesModal onClose={() => { setIsCategoriesModalOpen(false); loadData(); }} />)}
      <HelpAssistant theme={theme} rawData={rawData} viewMode={viewMode} isolatePeriod={isolatePeriod} formatCurrency={formatCurrency} viewLabel={viewLabel} open={helpOpen} onOpenChange={(v: boolean) => { setHelpOpen(v); if (!v) setHelpFocus(null); }} focusId={helpFocus} />
      {viewingInvoice && (<InvoiceItemsModal cardId={viewingInvoice.cardId} cycleKey={viewingInvoice.cycleKey} onClose={() => setViewingInvoice(null)} onChanged={loadData} />)}
      {isOwnersModalOpen && (<OwnersAccountsModal onClose={() => { setIsOwnersModalOpen(false); loadData(); }} onReorganize={() => { setIsOwnersModalOpen(false); setIsOwnerSetupOpen(true); }} />)}
      {/* Escolha da organização (só eu, casal, família, empresa...): abre sozinha na primeira vez, sem botão de fechar. */}
      {(rawData.needsOwnerSetup || isOwnerSetupOpen) && (
        <OwnerSetupModal
          onClose={rawData.needsOwnerSetup ? undefined : () => setIsOwnerSetupOpen(false)}
          onDone={() => { setIsOwnerSetupOpen(false); setViewMode('all'); loadData(); }}
        />
      )}
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
        invoices={openInvoices}
        owners={owners}
        defaultOwnerId={owners.some((o) => o.id === viewMode) ? viewMode : undefined}
      />
    </main>
  );
}
