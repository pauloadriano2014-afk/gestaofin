import { useState, useEffect } from "react";
import { effectivePaidBy } from "@/utils/paidBy";
import { findReversalPairs } from "@/utils/reversals";
import { looksLikeInvoicePaymentLine, looksLikeBankInvoicePayment, matchInvoiceByAmount } from "@/utils/invoiceLines";
import { X, CheckCircle2, ArrowUpRight, ArrowDownRight, Briefcase, User, Loader2, Trash2, Scissors } from "lucide-react";
import { looksLikeTransfer, pairWithinList, rankFixedBills, mentionsOwner } from "@/utils/transfers";
import { resolveCategoryKind, pickRefundCategory } from "@/utils/categoryKinds";
import { findTransferMatches } from "@/app/actions";

export function ImportReviewModal({ isOpen, onClose, initialTransactions, categories, onConfirm, isSaving, pendingFixedBills = [], owners = [], defaultOwnerId, flagInvoicePayments = false, headerExtra = null, invoices = [], accounts = [] }: any) {
  const [transactions, setTransactions] = useState<any[]>([]);
  // "Outra ponta" já salva (de outro extrato), por chave da linha; e sugestões dispensadas.
  const [matches, setMatches] = useState<Record<string, any>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [importAccountId, setImportAccountId] = useState('');
  // De quem é o arquivo inteiro (extrato): define o dono de todas as linhas de uma vez.
  const [fileOwnerId, setFileOwnerId] = useState('');

  // Quando o modal abre, ele carrega os dados que vieram da IA
  useEffect(() => {
    if (isOpen && initialTransactions) {
      // Cada linha já nasce com um dono: o padrão da tela (visão atual, ou dono
      // do cartão na fatura) ou o primeiro dono do tipo PF/PJ que a IA sugeriu.
      const mapped = initialTransactions.map((t: any, i: number) => ({
        ...t,
        _k: t._k || `r${i}`,
        ownerId: t.ownerId || defaultOwnerId || owners.find((o: any) => o.kind === (t.entityType || 'pf'))?.id || owners[0]?.id || null,
        // Pagamento de fatura no extrato: já vem ligado à fatura quando o valor
        // bate com uma só fatura em aberto.
        linkedInvoice: t.linkedInvoice || (
          !flagInvoicePayments && t.type === 'expense' && looksLikeBankInvoicePayment(t.description)
            ? (() => { const m: any = matchInvoiceByAmount(Number(t.amount), invoices as { total: number }[]); return m ? `${m.cardId}|${m.cycleKey}` : ''; })()
            : ''
        ),
      }));
      // Transferência que cita um dos donos (você, a Adri...) é dinheiro entre os donos:
      // já vem como Reembolso / Empréstimo (neutro), se a categoria ainda é "normal".
      const refundCat = pickRefundCategory(categories || []);
      const ownerAware = mapped.map((t: any) => {
        if (!refundCat || flagInvoicePayments || !mentionsOwner(t.description, owners)) return t;
        const cur = (categories || []).find((c: any) => c.id === t.categoryId);
        return !cur || resolveCategoryKind(cur) === 'operational' ? { ...t, categoryId: refundCat.id } : t;
      });
      // Categoria com dono padrão (ex: Transporte -> Empresa): a linha já vem como desse dono.
      const withCatOwner = ownerAware.map((t: any) => {
        const cat = (categories || []).find((c: any) => c.id === t.categoryId);
        const o = cat?.defaultOwnerId ? owners.find((x: any) => x.id === cat.defaultOwnerId) : null;
        return o ? { ...t, ownerId: o.id, entityType: o.kind } : t;
      });
      setTransactions(withCatOwner);
      setFileOwnerId(!flagInvoicePayments && defaultOwnerId ? defaultOwnerId : '');
      setMatches({});
      setDismissed(new Set());
      setImportAccountId('');
      // Extrato do banco: procura, entre o que já foi salvo, a outra ponta de
      // transferências entre contas (para perguntar em vez de contar em dobro).
      if (!flagInvoicePayments && mapped.some((t: any) => looksLikeTransfer(t.description))) {
        findTransferMatches(mapped.map((t: any) => ({ date: t.date, amount: t.amount, type: t.type, description: t.description })))
          .then((res: any) => {
            const byKey: Record<string, any> = {};
            Object.entries(res || {}).forEach(([i, m]) => { const row = mapped[Number(i)]; if (row) byKey[row._k] = m; });
            setMatches(byKey);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTransactions]);

  if (!isOpen) return null;

  // Função para atualizar um campo específico de uma linha
  // Funcional (usa o estado mais recente): duas mudanças seguidas na mesma linha
  // (ex: dono + tipo PF/PJ) não podem se sobrescrever.
  const handleUpdates = (index: number, patch: Record<string, any>) => {
    setTransactions((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };
  const handleUpdate = (index: number, field: string, value: any) => handleUpdates(index, { [field]: value });

  // 🔥 NOVO: dá pra remover uma linha antes de confirmar — útil pra descartar
  // itens duplicados (ex: "Valor pendente do mês anterior" que já apareceu
  // como itens soltos na fatura anterior, ou "Pagamento recebido" que é só
  // a quitação desse saldo, não uma despesa/receita nova).
  const handleRemove = (index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
  };

  const refundCategoryId: string | null = pickRefundCategory(categories || [])?.id || null;
  const pairs = pairWithinList(transactions as any);
  const reversalPairs = findReversalPairs(transactions as any);
  const shortDate = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

  // Confirma que a linha é movimentação entre contas/pessoas (ou empréstimo): vira
  // "Reembolsos / Empréstimos", que não conta como receita nem gasto. Se a outra
  // ponta está nesta mesma lista, as duas viram; se já estava salva, ela é
  // atualizada junto ao confirmar.
  const applyTransfer = (idx: number, partnerIdx?: number, existingId?: string) => {
    if (!refundCategoryId) { alert('Não encontrei a categoria "Reembolsos / Empréstimos". Crie uma em Cadastros > Categorias com o tipo "Reembolso / empréstimo".'); return; }
    setTransactions((prev) => prev.map((t, i) => (
      i === idx ? { ...t, categoryId: refundCategoryId, ...(existingId ? { pairedExistingId: existingId } : {}) }
      : i === partnerIdx ? { ...t, categoryId: refundCategoryId } : t
    )));
  };
  const dismissSuggestion = (key: string) => setDismissed((prev) => new Set(prev).add(key));

  // Divide uma linha em duas (ex: pagamento de 520 = 500 do empréstimo + 20 de juros).
  const handleSplit = (idx: number) => {
    const row = transactions[idx];
    const total = Math.abs(Number(row.amount));
    const raw = window.prompt(`Dividir ${formatCurrency(total)} em duas partes.\nQuanto vai para a 2ª parte (por exemplo, os juros)?`);
    if (!raw) return;
    const part = Number(raw.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(part) || part <= 0 || part >= total) { alert('Valor inválido: precisa ser maior que zero e menor que o total.'); return; }
    const first = Math.round((total - part) * 100) / 100;
    setTransactions((prev) => {
      const next = [...prev];
      next[idx] = { ...row, amount: first.toFixed(2) };
      next.splice(idx + 1, 0, {
        ...row, _k: `${row._k}-s${Date.now()}`, amount: part.toFixed(2), description: `${row.description} (parte 2)`,
        categoryId: '', linkedFixedBillTxId: '', linkedInvoice: '', pairedExistingId: undefined,
      });
      return next;
    });
  };

  // "De quem é este arquivo?": dono de todas as linhas (depois dá para ajustar linha a linha).
  const applyFileOwner = (ownerId: string) => {
    setFileOwnerId(ownerId);
    const owner = owners.find((o: any) => o.id === ownerId);
    if (!owner) return;
    setTransactions((prev) => prev.map((t) => {
      const cat = (categories || []).find((c: any) => c.id === t.categoryId);
      const catOwner = cat?.defaultOwnerId ? owners.find((x: any) => x.id === cat.defaultOwnerId) : null;
      const o = catOwner || owner; // o dono padrão da categoria vale mais que o do arquivo
      return { ...t, ownerId: o.id, entityType: o.kind, paidByOwnerId: undefined };
    }));
  };

  // Extrato inteiro de uma conta cadastrada: define dono e conta de todas as linhas de uma vez.
  const applyAccount = (accountId: string) => {
    setImportAccountId(accountId);
    const acc = accounts.find((a: any) => a.id === accountId);
    if (!acc) return;
    const owner = owners.find((o: any) => o.id === acc.ownerId);
    if (owner) setFileOwnerId(owner.id);
    setTransactions((prev) => prev.map((t) => ({ ...t, accountId: acc.id, ...(owner ? { ownerId: owner.id, entityType: owner.kind, paidByOwnerId: undefined } : {}) })));
  };

  // Dono da conta/cartão deste arquivo: o dinheiro sai (ou entra) nela. Na fatura é
  // o dono do cartão; no extrato, o dono da conta escolhida em "Este extrato é da conta".
  const statementOwnerId: string | null = flagInvoicePayments
    ? (defaultOwnerId || null)
    : (fileOwnerId || accounts.find((a: any) => a.id === importAccountId)?.ownerId || null);
  const rowPaidBy = (t: any) => effectivePaidBy(t, statementOwnerId) || 'self';

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
            {headerExtra}
            {!flagInvoicePayments && owners.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-700 dark:text-zinc-200">De quem é este arquivo?</span>
                {owners.map((o: any) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => applyFileOwner(o.id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${fileOwnerId === o.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-blue-400'}`}
                  >{o.name}</button>
                ))}
                {!fileOwnerId && <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Escolha para preencher o dono de todas as linhas.</span>}
              </div>
            )}
            {!flagInvoicePayments && accounts.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <label className="text-sm font-bold text-gray-700 dark:text-zinc-200" htmlFor="import-account">Este extrato é da conta</label>
                <select
                  id="import-account"
                  value={importAccountId}
                  onChange={(e) => applyAccount(e.target.value)}
                  className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-50 text-sm rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Escolha…</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}{owners.find((o: any) => o.id === a.ownerId) ? ` (${owners.find((o: any) => o.id === a.ownerId).name})` : ''}</option>)}
                </select>
                <span className="text-xs text-gray-500 dark:text-zinc-400">Define o dono e a conta de todos os itens de uma vez.</span>
              </div>
            )}
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO / LISTA DE TRANSAÇÕES */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50 dark:bg-zinc-950/50">
          {flagInvoicePayments && transactions.some((t) => looksLikeInvoicePaymentLine(t)) && (
            <div className="mb-3 p-4 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                <b>{transactions.filter((t) => looksLikeInvoicePaymentLine(t)).length} item(ns) parecem o pagamento da fatura anterior</b> (por exemplo &quot;Pagamento recebido&quot;).
                Isso não é receita nem gasto: as compras daquela fatura já foram contadas. Recomendo remover.
              </p>
              <button
                onClick={() => setTransactions((prev) => prev.filter((t) => !looksLikeInvoicePaymentLine(t)))}
                className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
              >
                Remover esses itens
              </button>
            </div>
          )}
          {reversalPairs.length > 0 && (
            <div className="mb-3 p-4 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                <b>{reversalPairs.length} compra(s) foram estornadas</b> ({reversalPairs.length * 2} linhas). A saída e o estorno se anulam, então não precisam ser salvos.
              </p>
              <button
                onClick={() => { const drop = new Set(reversalPairs.flat()); setTransactions((prev) => prev.filter((_, i) => !drop.has(i))); }}
                className="shrink-0 text-xs font-bold px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
              >
                Remover esses pares
              </button>
            </div>
          )}
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
              <div key={idx} className={`p-4 rounded-xl border shadow-sm flex flex-col gap-3 transition-all ${isLinked ? 'bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-300 dark:border-emerald-500/40' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-500/50'}`}>

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
                    {flagInvoicePayments && looksLikeInvoicePaymentLine(tx) && (
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">Parece pagamento da fatura anterior — não é receita</p>
                    )}
                  </div>
                  <div className={`font-mono font-bold text-sm whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-zinc-50'}`}>
                    {tx.type === 'expense' && '- '}{formatCurrency(Number(tx.amount))}
                  </div>
                </div>

                {/* Seletores de Edição a Jato */}
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex flex-wrap items-center gap-2 w-full">

                    {/* Seletor de vínculo com conta fixa pendente */}
                    {pendingFixedBills.length > 0 && (
                      <select
                        value={tx.linkedFixedBillTxId || ''}
                        onChange={(e) => handleUpdate(idx, 'linkedFixedBillTxId', e.target.value)}
                        className={`flex-1 min-w-[9rem] md:max-w-[15rem] border text-xs rounded-lg px-2 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${isLinked ? 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold' : 'bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-50'}`}
                      >
                        <option value="">Novo lançamento</option>
                        {rankFixedBills(tx.amount, availableFixedBills).map((fb: any) => (
                          <option key={fb.id} value={fb.id}>
                            {fb.suggested ? '★ ' : ''}Dar baixa: {fb.description} · vence {shortDate(fb.date)} ({formatCurrency(Number(fb.amount))})
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Pagamento de fatura no extrato: dar baixa na fatura do cartão */}
                    {!flagInvoicePayments && invoices.length > 0 && tx.type === 'expense' && looksLikeBankInvoicePayment(tx.description) && (
                      <select
                        value={tx.linkedInvoice || ''}
                        onChange={(e) => handleUpdate(idx, 'linkedInvoice', e.target.value)}
                        className={`flex-1 min-w-[9rem] md:max-w-[17rem] border text-xs rounded-lg px-2 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${tx.linkedInvoice ? 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300' : 'bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-50'}`}
                        title="Dar baixa na fatura do cartão com este pagamento"
                      >
                        <option value="">Sem baixa em fatura</option>
                        {invoices.map((inv: any) => (
                          <option key={`${inv.cardId}|${inv.cycleKey}`} value={`${inv.cardId}|${inv.cycleKey}`}>
                            Dar baixa: {inv.cardName}{inv.isOpen ? ' (aberta)' : ''} · vence {inv.dueDate.split('-').reverse().slice(0, 2).join('/')} ({formatCurrency(Number(inv.total))})
                          </option>
                        ))}
                      </select>
                    )}

                    {!isLinked && (
                      <>
                        {/* Seletor Categoria */}
                        <select
                          value={tx.categoryId || ""}
                          onChange={(e) => {
                            const cat = (categories || []).find((c: any) => c.id === e.target.value);
                            const o = cat?.defaultOwnerId ? owners.find((x: any) => x.id === cat.defaultOwnerId) : null;
                            handleUpdates(idx, o ? { categoryId: e.target.value, ownerId: o.id, entityType: o.kind, paidByOwnerId: undefined } : { categoryId: e.target.value });
                          }}
                          className="flex-1 min-w-[9rem] md:max-w-[13rem] bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-50 text-xs rounded-lg px-2 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="">Geral (Sem Categoria)</option>
                          {categories.filter((c: any) => c.name.trim().toLowerCase() !== 'ajuste de saldo' || c.id === tx.categoryId).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>

                        {/* Dono do lançamento (Paulo / Adri / Empresa...) */}
                        {owners.length > 0 && (
                          <select
                            value={tx.ownerId || ''}
                            onChange={(e) => {
                              const o = owners.find((x: any) => x.id === e.target.value);
                              handleUpdates(idx, o ? { ownerId: e.target.value, entityType: o.kind } : { ownerId: e.target.value });
                            }}
                            className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-50 text-xs font-bold rounded-lg px-2 py-2.5 shrink-0 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            {owners.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        )}

                        {/* Conta usada: quando o dinheiro sai da conta de outro dono (ex: mercado do Paulo no cartão da Empresa) */}
                        {owners.length > 1 && (
                          <select
                            value={rowPaidBy(tx)}
                            onChange={(e) => handleUpdate(idx, 'paidByOwnerId', e.target.value)}
                            title="De qual conta o dinheiro saiu (ou entrou). O gasto continua sendo do dono escolhido ao lado."
                            className={`border text-[11px] font-semibold rounded-lg px-2 py-2.5 shrink-0 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[11rem] ${rowPaidBy(tx) === 'self' ? 'bg-gray-50 dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-400/60 text-amber-800 dark:text-amber-300'}`}
                          >
                            <option value="self">Conta: do próprio dono</option>
                            {owners.filter((o: any) => o.id !== tx.ownerId).map((o: any) => <option key={o.id} value={o.id}>Conta: {o.name}</option>)}
                          </select>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSplit(idx)}
                      title="Dividir esta linha em duas (ex: principal + juros)"
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors shrink-0"
                    >
                      <Scissors className="w-4 h-4" />
                    </button>

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

                  {/* Transferência / mesma movimentação entre contas: perguntar em vez de contar como receita ou gasto */}
                  {(() => {
                    if (flagInvoicePayments || isLinked || tx.linkedInvoice || !refundCategoryId) return null;
                    // Quem já escolheu uma categoria neutra (reembolso, pagamento de fatura,
                    // investimento) já decidiu: não pergunta de novo.
                    const chosen = (categories || []).find((c: any) => c.id === tx.categoryId);
                    if ((chosen && resolveCategoryKind(chosen) !== 'operational') || dismissed.has(tx._k)) return null;
                    const partnerIdx = pairs.get(idx);
                    const partner = partnerIdx !== undefined ? transactions[partnerIdx] : null;
                    const existing = matches[tx._k];
                    if (!partner && !existing && !looksLikeTransfer(tx.description)) return null;
                    return (
                      <div className="mt-1 p-2 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 text-[11px] text-amber-900 dark:text-amber-200 flex flex-col gap-1.5 md:max-w-lg">
                        <p>
                          {partner
                            ? <>Parece a outra ponta de <b>{partner.description}</b> ({shortDate(partner.date)}) neste mesmo extrato. Se for a mesma movimentação entre suas contas, não é receita nem gasto.</>
                            : existing
                              ? <>Parece a outra ponta de <b>{existing.description}</b> ({shortDate(existing.date)}, {formatCurrency(Math.abs(Number(existing.amount)))}), que já está salvo. Se for a mesma movimentação, não é receita nem gasto.</>
                              : <>Transferência: se foi entre você, a Adri, a empresa, ou um empréstimo, não é receita nem gasto.</>}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => applyTransfer(idx, partnerIdx, existing?.id)} className="font-bold px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white">
                            {partner || existing ? 'É a mesma movimentação' : 'Marcar como Reembolso / Empréstimo'}
                          </button>
                          <button onClick={() => dismissSuggestion(tx._k)} className="font-bold px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10">
                            {partner || existing ? 'Não é' : 'É receita/gasto de verdade'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
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
            onClick={() => onConfirm(transactions.map((t) => ({ ...t, paidByOwnerId: rowPaidBy(t) })))}
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