'use client'

import { useState } from 'react';
import { X, Check, Star, Zap, Crown, ShieldCheck, Loader2 } from "lucide-react"; // <--- ADICIONEI O Loader2 AQUI
import { createCheckoutSession } from '@/app/payment-actions';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlanType = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('annual'); // Padrão no Anual
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubscribe() {
    setIsLoading(true);
    try {
      // Chama a Server Action
      const { url, error } = await createCheckoutSession(selectedPlan);
      
      if (error) {
        alert(error);
        setIsLoading(false);
        return;
      }

      if (url) {
        // Redireciona para o Checkout do Stripe
        window.location.href = url;
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao iniciar pagamento.");
      setIsLoading(false);
    }
  }

  const plans = {
    monthly: {
      id: 'monthly',
      label: 'Mensal',
      price: 'R$ 29,90',
      period: '/mês',
      total: null,
      savings: null
    },
    quarterly: {
      id: 'quarterly',
      label: 'Trimestral',
      price: 'R$ 26,63',
      period: '/mês',
      total: 'Total de R$ 79,90',
      savings: '11% OFF'
    },
    semiannual: {
      id: 'semiannual',
      label: 'Semestral',
      price: 'R$ 24,98',
      period: '/mês',
      total: 'Total de R$ 149,90',
      savings: '16% OFF'
    },
    annual: {
      id: 'annual',
      label: 'Anual',
      price: 'R$ 23,90',
      period: '/mês',
      total: 'Total de R$ 287,00',
      savings: '20% OFF' 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl rounded-3xl overflow-hidden relative shadow-2xl flex flex-col md:flex-row animate-in fade-in zoom-in duration-300">
        
        {/* Botão Fechar */}
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all">
          <X className="w-5 h-5" />
        </button>

        {/* Lado Esquerdo: Benefícios */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-blue-900 via-zinc-900 to-black p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 px-3 py-1 rounded-full mb-6">
              <Crown className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">KORE Premium</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              A inteligência de um <span className="text-blue-400">CFO</span> no seu bolso.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
              Pare de apenas anotar gastos. Comece a gerir seu patrimônio com Inteligência Artificial e automação profissional.
            </p>

            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="p-1 bg-green-500/20 rounded-full mt-0.5"><Zap className="w-4 h-4 text-green-400" /></div>
                <div>
                  <strong className="text-white block text-sm">CFO Virtual com IA</strong>
                  <span className="text-zinc-500 text-xs">Análises estratégicas do seu fluxo de caixa em segundos.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-1 bg-blue-500/20 rounded-full mt-0.5"><Star className="w-4 h-4 text-blue-400" /></div>
                <div>
                  <strong className="text-white block text-sm">Lançamento por Voz Ilimitado</strong>
                  <span className="text-zinc-500 text-xs">"Gastei 50 no mercado". Fale e está pronto.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="p-1 bg-purple-500/20 rounded-full mt-0.5"><ShieldCheck className="w-4 h-4 text-purple-400" /></div>
                <div>
                  <strong className="text-white block text-sm">Alarmes de Vencimento</strong>
                  <span className="text-zinc-500 text-xs">Nunca mais pague juros por esquecimento.</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="mt-8 relative z-10">
            <div className="flex -space-x-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[10px] text-zinc-500">User</div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">+2.400 usuários já controlam suas finanças.</p>
          </div>
        </div>

        {/* Lado Direito: Seleção de Plano */}
        <div className="w-full md:w-1/2 bg-zinc-950 p-6 md:p-8 flex flex-col">
          <h3 className="text-xl font-bold text-white mb-6">Escolha seu plano</h3>
          
          <div className="flex-1 space-y-3 mb-6 overflow-y-auto max-h-[400px] custom-scrollbar pr-1">
            {/* PLANO ANUAL */}
            <div 
              onClick={() => setSelectedPlan('annual')}
              className={`relative cursor-pointer p-4 rounded-xl border-2 transition-all ${selectedPlan === 'annual' ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'}`}
            >
              {selectedPlan === 'annual' && <div className="absolute -top-3 right-4 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-blue-500/20">RECOMENDADO</div>}
              <div className="flex justify-between items-center">
                <div>
                  <h4 className={`font-bold ${selectedPlan === 'annual' ? 'text-white' : 'text-zinc-300'}`}>{plans.annual.label}</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-white">{plans.annual.price}</span>
                    <span className="text-xs text-zinc-500">{plans.annual.period}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{plans.annual.total}</p>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">{plans.annual.savings}</span>
                  {selectedPlan === 'annual' ? <div className="mt-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mx-auto"><Check className="w-3 h-3 text-white"/></div> : <div className="mt-3 w-5 h-5 rounded-full border border-zinc-700 mx-auto"></div>}
                </div>
              </div>
            </div>

            {/* PLANO SEMESTRAL */}
            <div 
              onClick={() => setSelectedPlan('semiannual')}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${selectedPlan === 'semiannual' ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className={`font-bold ${selectedPlan === 'semiannual' ? 'text-white' : 'text-zinc-300'}`}>{plans.semiannual.label}</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-white">{plans.semiannual.price}</span>
                    <span className="text-xs text-zinc-500">{plans.semiannual.period}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{plans.semiannual.total}</p>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-bold text-emerald-400/80 bg-emerald-400/5 px-2 py-1 rounded">{plans.semiannual.savings}</span>
                  {selectedPlan === 'semiannual' ? <div className="mt-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mx-auto"><Check className="w-3 h-3 text-white"/></div> : <div className="mt-3 w-5 h-5 rounded-full border border-zinc-700 mx-auto"></div>}
                </div>
              </div>
            </div>

            {/* PLANO TRIMESTRAL */}
            <div 
              onClick={() => setSelectedPlan('quarterly')}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${selectedPlan === 'quarterly' ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className={`font-bold ${selectedPlan === 'quarterly' ? 'text-white' : 'text-zinc-300'}`}>{plans.quarterly.label}</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-white">{plans.quarterly.price}</span>
                    <span className="text-xs text-zinc-500">{plans.quarterly.period}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{plans.quarterly.total}</p>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-bold text-emerald-400/80 bg-emerald-400/5 px-2 py-1 rounded">{plans.quarterly.savings}</span>
                  {selectedPlan === 'quarterly' ? <div className="mt-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mx-auto"><Check className="w-3 h-3 text-white"/></div> : <div className="mt-3 w-5 h-5 rounded-full border border-zinc-700 mx-auto"></div>}
                </div>
              </div>
            </div>

            {/* PLANO MENSAL */}
            <div 
              onClick={() => setSelectedPlan('monthly')}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${selectedPlan === 'monthly' ? 'border-blue-500 bg-blue-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className={`font-bold ${selectedPlan === 'monthly' ? 'text-white' : 'text-zinc-300'}`}>{plans.monthly.label}</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold text-white">{plans.monthly.price}</span>
                    <span className="text-xs text-zinc-500">{plans.monthly.period}</span>
                  </div>
                </div>
                <div className="text-right">
                  {selectedPlan === 'monthly' ? <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mx-auto"><Check className="w-3 h-3 text-white"/></div> : <div className="w-5 h-5 rounded-full border border-zinc-700 mx-auto"></div>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <button 
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-white/5"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-black" />}
              {isLoading ? "Indo para o pagamento..." : "Assinar Agora"}
            </button>
            <p className="text-center text-[10px] text-zinc-500 mt-4 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3"/> Pagamento seguro via Stripe. Cancele quando quiser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}