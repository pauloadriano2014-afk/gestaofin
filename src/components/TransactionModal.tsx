'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, Loader2, Mic, MicOff, Calendar, CheckCircle2, CreditCard, User, Building2, Trash2, Wallet, Repeat, TrendingUp, TrendingDown } from 'lucide-react'
import { createTransaction, updateTransaction, deleteTransaction, getFixedBills } from '@/app/actions'
import { getUserCreditCards } from '@/app/creditCardActions'
import { getInvoiceCycleForDate } from '@/utils/creditCard'

export function TransactionModal({ 
  categories, 
  onClose, 
  transaction, 
  userPlan = 'free', 
  onRequestPremium 
}: { 
  categories: any[], 
  onClose: () => void,
  transaction?: any,
  userPlan?: string,
  onRequestPremium?: () => void
}) {
  const [description, setDescription] = useState(transaction?.description || '')
  const [amount, setAmount] = useState(transaction?.amount ? Math.abs(Number(transaction.amount)).toString() : '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId || '')
  const [type, setType] = useState<"income" | "expense" | "transfer">(transaction?.type || 'expense')
  
  const [date, setDate] = useState(() => {
    if (transaction?.date) return transaction.date;
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  }) 

  const [isFixed, setIsFixed] = useState(transaction?.isFixed || false)
  const [isPaid, setIsPaid] = useState(transaction?.isPaid ?? true) 
  const [installments, setInstallments] = useState(1) 

  const [entityType, setEntityType] = useState<'pf' | 'pj'>(transaction?.entityType || 'pf')

  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)

  // --- NOVO: cartão de crédito vinculado à compra ---
  const [creditCardId, setCreditCardId] = useState<string>(transaction?.creditCardId || '')
  const [userCreditCards, setUserCreditCards] = useState<any[]>([])

  // 🔥 NOVO: vínculo com um molde de "Minhas Contas Fixas" + valor original
  // esperado dessa ocorrência (pra comparar com o valor pago e saber se teve
  // juro ou desconto).
  const [fixedBillId, setFixedBillId] = useState<string>(transaction?.fixedBillId || '')
  const [originalAmount, setOriginalAmount] = useState<string>(transaction?.originalAmount ? Math.abs(Number(transaction.originalAmount)).toString() : '')
  const [userFixedBills, setUserFixedBills] = useState<any[]>([])

  useEffect(() => {
    getUserCreditCards().then(setUserCreditCards).catch(() => setUserCreditCards([]))
    getFixedBills().then(setUserFixedBills).catch(() => setUserFixedBills([]))
  }, [])

  function handleSelectFixedBill(id: string) {
    setFixedBillId(id)
    if (!id) return
    const tpl = userFixedBills.find((b: any) => b.id === id)
    if (!tpl) return
    setOriginalAmount(Math.abs(Number(tpl.originalAmount)).toString())
    if (tpl.categoryId) setCategoryId(tpl.categoryId)
    if (!description.trim()) setDescription(tpl.name)
    // Só sugere o valor pago igual ao original em lançamento novo — editando
    // um lançamento existente, o valor pago já digitado não deve ser mexido.
    if (!transaction && !amount) setAmount(Math.abs(Number(tpl.originalAmount)).toString())
  }

  const activeFixedBills = userFixedBills.filter((b: any) => !b.archived)
  const amountDiff = originalAmount && amount ? Number(amount) - Number(originalAmount) : 0

  const selectedCard = userCreditCards.find((c) => c.id === creditCardId)

  // --- LÓGICA DE IA (AGORA ESCUTANDO DATE E ENTITYTYPE) ---
  const handleAIProcess = async (text: string) => {
    if (!text || text.trim().length < 3 || transaction) return; 

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
        setDescription(data.description || text);
        setAmount(data.amount ? data.amount.toString() : '');
        setType(data.type || 'expense');
        
        // --- AS LINHAS MÁGICAS ESTÃO AQUI ---
        // Se a IA mandou uma data válida, atualiza o formulário
        if (data.date) setDate(data.date);
        
        // Se a IA mandou 'pj', atualiza os botões lá em cima
        if (data.entityType) setEntityType(data.entityType);
        // ------------------------------------

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

  const startListening = () => {
    if (isListening) return;

    if (userPlan === 'free') {
        if (onRequestPremium) onRequestPremium(); 
        return; 
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Seu navegador não suporta comando de voz. Tente usar o Chrome ou Safari atualizado.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;
      
      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDescription(transcript);
        handleAIProcess(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false); 
        
        if (event.error === 'aborted') {
            return; 
        }

        console.error("Erro Mic:", event.error);
        
        if (event.error === 'not-allowed') {
            alert("Acesso ao microfone negado. Permita o acesso nas configurações do navegador.");
        } else if (event.error === 'no-speech') {
            alert("Não escutei nada. Tente falar mais perto.");
        } else if (event.error === 'network') {
            alert("Erro de conexão. Verifique sua internet.");
        } else {
            alert("Erro no microfone: " + event.error);
        }
      };

      recognition.start();

    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction?.id) return;
    if (confirm("Deseja realmente excluir este lançamento?")) {
      setLoading(true);
      await deleteTransaction(transaction.id);
      setLoading(false);
      onClose();
    }
  };

  const handleSave = async () => {
    if (!description || !amount) {
      alert("Preencha descrição e valor!");
      return;
    }

    setLoading(true);
    const payload = {
      description,
      amount,
      categoryId,
      type,
      date,
      isFixed: creditCardId ? false : isFixed,
      isPaid,
      installments: Number(installments),
      entityType,
      creditCardId: type === 'expense' ? (creditCardId || null) : null,
      fixedBillId: isFixed && !creditCardId ? (fixedBillId || null) : null,
      originalAmount: isFixed && !creditCardId ? (originalAmount || null) : null,
    };

    if (transaction?.id) {
      await updateTransaction(transaction.id, payload);
    } else {
      await createTransaction(payload);
    }

    setLoading(false);
    onClose();
  };

  const uniqueCategories = Array.from(
    new Map(categories.map((cat) => [cat.name.trim().toLowerCase(), cat])).values()
  );

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] transition-all">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-2xl relative">
        
        <div className="flex justify-between items-center sticky top-0 bg-zinc-900 z-10 pb-4 mb-2 border-b border-zinc-800/50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-blue-500" />
            {transaction ? 'Editar Lançamento' : 'Lançamento Inteligente'}
          </h2>
          <div className="flex items-center gap-2">
            {transaction && (
              <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Excluir">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="space-y-6"> 
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
              <button
                onClick={() => { setType('transfer'); setCategoryId(''); setCreditCardId(''); }}
                className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-300 ${type === 'transfer' ? 'bg-blue-500/10 text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Transferência
              </button>
            </div>

            {type === 'transfer' && (
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300 leading-relaxed">
                Pra dinheiro que só mudou de lugar: entre suas próprias contas (ex: Asaas → Nubank) ou acerto de contas com quem mora com você. Não conta como gasto nem receita no seu resumo — é só um registro pra você lembrar que o dinheiro mudou de lugar.
              </div>
            )}

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
                  className={`p-4 rounded-xl border transition-all duration-300 flex items-center justify-center relative group ${
                    isListening 
                      ? 'bg-red-600 border-red-500 animate-pulse text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' 
                      : 'bg-zinc-800 border-zinc-700 text-blue-400 hover:bg-zinc-700 hover:text-white'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  
                  {userPlan === 'free' && (
                      <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-lg" title="Recurso PRO" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <div className={type === 'transfer' ? 'col-span-2' : ''}>
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

              {type !== 'transfer' && (
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Categoria</label>
                <select
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600 transition-all appearance-none"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {[...uniqueCategories].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')).map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              )}
            </div>

            {type === 'expense' && (
              <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800 space-y-4">

                {/* NOVO: Como foi pago (dinheiro/débito/pix ou cartão de crédito) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                    <Wallet className="w-3 h-3" /> Como foi pago?
                  </label>
                  <select
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600 transition-all appearance-none"
                    value={creditCardId}
                    onChange={(e) => setCreditCardId(e.target.value)}
                  >
                    <option value="">Dinheiro / Débito / Pix</option>
                    {userCreditCards.map((card: any) => (
                      <option key={card.id} value={card.id}>Cartão: {card.name}</option>
                    ))}
                  </select>
                  {selectedCard && date && (
                    <p className="text-[10px] text-blue-400 pt-1">
                      {(() => {
                        const cycle = getInvoiceCycleForDate(date, selectedCard.closingDay, selectedCard.dueDay)
                        const fmt = (s: string) => s.split('-').reverse().join('/')
                        return `Entra na fatura que fecha em ${fmt(cycle.closingDate)} e vence em ${fmt(cycle.dueDate)}.`
                      })()}
                    </p>
                  )}
                </div>

                {!creditCardId && (
                <div
                  onClick={() => {
                    setIsFixed(!isFixed);
                    if (!isFixed) setInstallments(1);
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
                )}

                {!creditCardId && isFixed && (
                  <div className="space-y-3 pl-6 border-l-2 border-blue-500/20 animate-in slide-in-from-top-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> É uma conta fixa cadastrada?
                      </label>
                      <select
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-600 transition-all appearance-none text-sm"
                        value={fixedBillId}
                        onChange={(e) => handleSelectFixedBill(e.target.value)}
                      >
                        <option value="">Nenhuma / avulsa</option>
                        {activeFixedBills.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name} (venc. dia {b.dueDay})</option>
                        ))}
                      </select>
                      {activeFixedBills.length === 0 && (
                        <p className="text-[10px] text-zinc-600 pt-1">Nenhuma conta fixa cadastrada ainda — cadastre em &quot;Minhas Contas Fixas&quot; no topo da tela pra poder vincular aqui.</p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Valor original (o que era pra pagar)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-3.5 text-zinc-500 text-sm font-bold">R$</span>
                        <input
                          type="number"
                          placeholder="0,00"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 pl-10 text-white outline-none focus:border-blue-600 transition-all font-mono text-sm"
                          value={originalAmount}
                          onChange={(e) => setOriginalAmount(e.target.value)}
                        />
                      </div>
                    </div>

                    {originalAmount && amount && amountDiff !== 0 && (
                      <p className={`text-xs font-bold flex items-center gap-1 ${amountDiff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {amountDiff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {amountDiff > 0 ? 'Juros: ' : 'Desconto: '}
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(amountDiff))}
                      </p>
                    )}
                  </div>
                )}

                {!creditCardId && (
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
                )}

                {creditCardId && (
                  <p className="text-xs text-zinc-500 bg-zinc-900 rounded-lg p-2">
                    Compras no cartão são baixadas quando você pagar a fatura inteira (tela de Cartões), não uma por uma.
                  </p>
                )}

                {!isFixed && !transaction && (
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
                    </div>
                )}
              </div>
            )}

            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (transaction ? "Salvar Alterações" : "Confirmar Lançamento")}
            </button>
        </div>

      </div>
    </div>
  )
}
