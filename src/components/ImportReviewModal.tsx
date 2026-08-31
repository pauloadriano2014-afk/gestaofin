import { useState, useEffect } from "react";
import { X, CheckCircle2, ArrowUpRight, ArrowDownRight, Briefcase, User, Loader2, Trash2 } from "lucide-react";

export function ImportReviewModal({ isOpen, onClose, initialTransactions, categories, onConfirm, isSaving, pendingFixedBills = [] }: any) {
  const [transactions, setTransactions] = useState<any[]>([]);

  // Quando o modal abre, ele carrega os dados que vieram da IA
  useEffect(() => {
    if (isOpen && initialTransactions) {
      setTransactions(initialTransactions);
    }
  }, [isOpen, initialTransactions]);

  if (!isOpen) return null;

  // Função para atualizar um campo específico de uma linha
  const handleUpdate = (index: number, field: string, value: any) => {
    const updated = [...transactions];
    updated[index] = { ...updated[index], [field]: value };
    setTransactions(updated);
  };

  // 🔥 NOVO: dá pra remover uma linha antes de confirmar — útil pra descartar
  // itens duplicados (ex: "Valor pendente do mês anterior" que já apareceu
  // como itens soltos na fatura anterior, ou "Pagamento recebido" que é só
  // a quitação desse saldo, não uma despesa/receita nova).
  const handleRemove = (index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    // 🔥 FIX: esse modal agora também abre por cima do "Importar Fatura de
    // Cartão" (que usa z-[9999]) — precisa de um z-index maior que o dele,
    // senão fica escondido atrás e os cliques vão pro modal de trás.
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* HEADER DO MODAL */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-50 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-blue-500" />
              Revisão de Importação
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
              A IA sugeriu estas categorias. Revise o que é PF/PJ antes de salvar.
              {pendingFixedBills.length > 0 && ' Se algum item já é uma conta fixa cadastrada, vincule pra dar baixa nela em vez de duplicar.'}
            </p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO / LISTA DE TRANSAÇÕES */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50 dark:bg-zinc-950/50">
          <div className="space-y-3">
            {transactions.map((tx, idx) => {
              const isLinked = !!tx.linkedFixedBillTxId;
              // Uma mesma conta fixa pendente não pode ser escolhida em duas
              // linhas ao mesmo tempo (senão dá baixa duplicada) — some da
              // lista de opções das outras linhas assim que for escolhida.
              const usedElsewhere = new Set(
                transactions.map((t, i) => (i !== idx ? t.linkedFixedBillTxId : null)).filter(Boolean)
              );
              const availableFixedBills = pendingFixedBills.filter(
                (fb: any) => !usedElsewhere.has(fb.id)
              );

              return (
              <div key={idx} className={`p-4 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center gap-4 justify-between transition-all ${isLinked ? 'bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-300 dark:border-emerald-500/40' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-500/50'}`}>

                {/* Info Básica: Data, Nome e Valor */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                    {tx.type === 'income' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-zinc-50 truncate" title={tx.description}>
                      {tx.description}
                    </p>
                    <p className="text-[11px] font-mono text-gray-500 dark:text-zinc-400 mt-0.5">
                      {tx.date.split('-').reverse().join('/')}
                    </p>
                  </div>
                  <div className={`font-mono font-bold text-sm whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-zinc-50'}`}>
                    {tx.type === 'expense' && '- '}{formatCurrency(Number(tx.amount))}
                  </div>
                </div>

                {/* Seletores de Edição a Jato */}
                <div className="flex flex-col md:items-end gap-2 w-full md:w-auto shrink-0">
                  <div className="flex items-center gap-2 w-full md:w-auto">

                    {/* Seletor de vínculo com conta fixa pendente */}
                    {pendingFixedBills.length > 0 && (
                      <select
                        value={tx.linkedFixedBillTxId || ''}
                        onChange={(e) => handleUpdate(idx, 'linkedFixedBillTxId', e.target.value)}
                        className={`flex-1 md:w-48 border text-xs rounded-lg px-2 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${isLinked ? 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold' : 'bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-50'}`}
                      >
                        <option value="">Novo lançamento</option>
                        {availableFixedBills.map((fb: any) => (
                          <option key={fb.id} value={fb.id}>
                            Dar baixa: {fb.description} ({formatCurrency(Number(fb.amount))})
                          </option>
                        ))}
                      </select>
                    )}

                    {!isLinked && (
                      <>
                        {/* Seletor Categoria */}
                        <select
                          value={tx.categoryId || ""}
                          onChange={(e) => handleUpdate(idx, 'categoryId', e.target.value)}
                          className="flex-1 md:w-40 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-50 text-xs rounded-lg px-2 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="">Geral (Sem Categoria)</option>
                          {categories.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>

                        {/* Seletor PF / PJ */}
                        <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg shrink-0">
                          <button
                            onClick={() => handleUpdate(idx, 'entityType', 'pf')}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${tx.entityType === 'pf' ? 'bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-50 shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'}`}
                          >
                            <User className="w-3 h-3" /> PF
                          </button>
                          <button
                            onClick={() => handleUpdate(idx, 'entityType', 'pj')}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${tx.entityType === 'pj' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'}`}
                          >
                            <Briefcase className="w-3 h-3" /> PJ
                          </button>
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      title="Remover este item (não importar)"
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  </div>

                  {isLinked && (
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                      Essa conta fixa será marcada como PAGA com esse valor — categoria e PF/PJ dela não mudam.
                    </p>
                  )}
                </div>
              </div>
              );
            })}

            {transactions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-10">Todos os itens foram removidos. Cancele ou volte a escolher o arquivo se não era essa a intenção.</p>
            )}
          </div>
        </div>

        {/* FOOTER / AÇÕES */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(transactions)}
            disabled={isSaving || transactions.length === 0}
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSaving ? "Salvando..." : `Confirmar e Salvar (${transactions.length})`}
          </button>
        </div>

      </div>
    </div>
  );
}