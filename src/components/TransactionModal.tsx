'use client'

import { useState } from 'react'
import { X, Sparkles, Loader2, Mic, MicOff, Calendar, CheckCircle2, CreditCard, User, Building2 } from 'lucide-react'
import { createTransaction } from '@/app/actions'

export function TransactionModal({ categories, onClose }: { categories: any[], onClose: () => void }) {
  // Estados de Dados
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [type, setType] = useState<"income" | "expense">('expense')
  
  // Novos Campos (Data, Fixos e Parcelas)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]) // Começa com hoje
  const [isFixed, setIsFixed] = useState(false)
  const [isPaid, setIsPaid] = useState(true) // Padrão: Pago
  const [installments, setInstallments] = useState(1) // NOVO: Parcelas

  // NOVO: Tipo de Entidade (PF ou PJ)
  const [entityType, setEntityType] = useState<'pf' | 'pj'>('pf')

  // Estados de UI
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)

  // --- LÓGICA DE IA ---
  const handleAIProcess = async (text: string) => {
    if (!text || text.trim().length < 3) return;

    setLoading(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, categories })
      });

      const data = await response.json();

      if (data.error) {
        alert("Erro na IA: " + data.error);
      } else {
        // Preenche os campos
        setDescription(data.description || text);
        setAmount(data.amount ? data.amount.toString() : '');
        setType(data.type || 'expense');

        // Tenta achar a categoria
        if (data.categoryName) {
          const foundCategory = categories.find(c => 
            c.name.toLowerCase() === data.categoryName.toLowerCase()
          );
          if (foundCategory) setCategoryId(foundCategory.id);
        }
      }
    } catch (error) {
      console.error("Erro IA:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE MICROFONE ---
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Navegador sem suporte a voz. Use o Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription(transcript);
      handleAIProcess(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Erro Mic:", event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  // --- SALVAR ---
  const handleSave = async () => {
    if (!description || !amount) {
      alert("Preencha descrição e valor!");
      return;
    }

    setLoading(true);
    await createTransaction({ 
      description, 
      amount, 
      categoryId, 
      type,
      date,      // Envia a data escolhida
      isFixed,   // Envia se é fixo
      isPaid,    // Envia se está pago
      installments: Number(installments), // Envia o número de parcelas
      entityType // Envia se é PF ou PJ
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl p-6 space-y-6 shadow-2xl relative">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-blue-500" />
            Lançamento Inteligente
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* SELETOR DE ENTIDADE (PF / PJ) - NOVO */}
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button 
            onClick={() => setEntityType('pf')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${entityType === 'pf' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <User className="w-4 h-4" /> Pessoa Física
          </button>
          <button 
            onClick={() => setEntityType('pj')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${entityType === 'pj' ? 'bg-blue-900/30 text-blue-400 shadow-sm border border-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Building2 className="w-4 h-4" /> Pessoa Jurídica
          </button>
        </div>

        {/* Botões de Tipo (Receita/Despesa) */}
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button 
            onClick={() => setType('expense')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${type === 'expense' ? 'bg-red-500/10 text-red-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Gasto
          </button>
          <button 
            onClick={() => setType('income')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${type === 'income' ? 'bg-green-500/10 text-green-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Entrada
          </button>
        </div>

        {/* Input Descrição + Microfone */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">O que você fez?</label>
          <div className="flex gap-3">
            <input 
              placeholder="Ex: Mercado 50 reais..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white placeholder:text-zinc-600 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description.length > 3 && handleAIProcess(description)}
            />
            <button 
              onClick={startListening}
              className={`p-4 rounded-xl border transition-all duration-300 flex items-center justify-center ${
                isListening 
                  ? 'bg-red-600 border-red-500 animate-pulse text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
                  : 'bg-zinc-800 border-zinc-700 text-blue-400 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Grid de Detalhes (Data, Valor, Categoria) */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Data */}
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Data</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" />
              <input 
                type="date" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 pl-10 text-white outline-none focus:border-blue-600 transition-all appearance-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Valor Total</label>
            <div className="relative">
              <span className="absolute left-3 top-3.5 text-zinc-500 text-sm font-bold">R$</span>
              <input 
                type="number"
                placeholder="0,00"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 pl-10 text-white outline-none focus:border-blue-600 transition-all font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Categoria</label>
            <select 
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600 transition-all appearance-none"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Opções Extras (Só para Gasto) */}
        {type === 'expense' && (
          <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800 space-y-4">
            
            {/* Toggle Fixa */}
            <div 
              onClick={() => { 
                setIsFixed(!isFixed); 
                if (!isFixed) setInstallments(1); // Se marcar como fixo, reseta parcelas
              }} 
              className="flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isFixed ? 'bg-blue-600 border-blue-600' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                  {isFixed && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-zinc-300 font-medium select-none">É uma despesa fixa?</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">(Aluguel, Luz...)</span>
            </div>

            {/* Toggle Pago */}
            <div 
              onClick={() => setIsPaid(!isPaid)}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isPaid ? 'bg-green-500 border-green-500' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                {isPaid && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-zinc-300 font-medium select-none">
                Status: <span className={isPaid ? "text-green-500" : "text-orange-500"}>{isPaid ? "Pago" : "Pendente"}</span>
              </span>
            </div>

            {/* Parcelamento (Só aparece se NÃO for fixo) */}
            {!isFixed && (
               <div className="pt-2 border-t border-zinc-800 animate-in slide-in-from-top-2">
                 <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block flex items-center gap-1">
                   <CreditCard className="w-3 h-3" /> Parcelamento
                 </label>
                 <div className="flex items-center gap-3">
                   <input 
                     type="range" min="1" max="12" step="1"
                     className="flex-1 accent-blue-600 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                     value={installments}
                     onChange={(e) => setInstallments(Number(e.target.value))}
                   />
                   <span className="bg-zinc-800 px-3 py-1 rounded-lg text-white font-mono font-bold text-sm min-w-[3rem] text-center">
                     {installments}x
                   </span>
                 </div>
                 {installments > 1 && (
                   <p className="text-[10px] text-zinc-500 mt-2 text-right">
                     Serão criados {installments} lançamentos mensais de {amount ? (Number(amount)/installments).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '...'}
                   </p>
                 )}
               </div>
            )}
          </div>
        )}

        {/* Botão Salvar */}
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-[0.98]"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Lançamento"}
        </button>

      </div>
    </div>
  )
}