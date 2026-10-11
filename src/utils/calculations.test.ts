import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateDashboardData } from "./dashboardCalculations";
import { buildKindSets, isOperational, resolveCategoryKind, inferKindFromName } from "./categoryKinds";
import { matchesView } from "./owners";
import { addMonthsClamped, splitAmountIntoInstallments } from "./dates";
import { getInvoiceCycleForDate } from "./creditCard";

const PAULO = "owner-paulo", ADRI = "owner-adri", EMPRESA = "owner-empresa";
const CAT = { mercado: "c-mercado", invest: "c-invest", cartao: "c-cartao", reemb: "c-reemb", vendas: "c-vendas" };

const categories = [
  { id: CAT.mercado, name: "Mercado", type: "expense", budget: "500", kind: null },
  { id: CAT.invest, name: "Investimentos", type: "income", budget: "0", kind: "investment" },
  { id: CAT.cartao, name: "Cartão de Crédito", type: "expense", budget: "0", kind: "card_payment" },
  { id: CAT.reemb, name: "Reembolsos / Empréstimos", type: "expense", budget: "0", kind: "refund" },
  { id: CAT.vendas, name: "Vendas", type: "income", budget: "0", kind: null },
];

const tx = (id: number, type: string, amount: string, ownerId: string, categoryId: string | null, extra: object = {}) => ({
  id, type, amount, ownerId, categoryId, entityType: ownerId === EMPRESA ? "pj" : "pf", date: "2026-10-05", isFixed: false, ...extra,
});

const raw = {
  allCategories: categories,
  transactions: [
    tx(1, "expense", "100", PAULO, CAT.mercado),
    tx(2, "expense", "40", ADRI, CAT.mercado),
    tx(3, "income", "1000", EMPRESA, CAT.vendas),
    tx(4, "expense", "300", PAULO, CAT.invest),    // aporte
    tx(5, "income", "50", PAULO, CAT.invest),      // resgate
    tx(6, "expense", "900", PAULO, CAT.cartao),    // pagamento de fatura (extrato)
    tx(7, "expense", "70", ADRI, CAT.reemb),       // reembolso
    tx(8, "transfer", "500", PAULO, null),         // transferência entre contas
  ],
  summary: { globalBalance: 0, globalBalancePF: 0, globalBalancePJ: 0, balanceByOwner: { [PAULO]: -111, [ADRI]: -22, [EMPRESA]: 1000 } },
};

const view = (v: string) => calculateDashboardData(raw, v, null).summary;

test("despesa/receita operacional ignora investimento, reembolso, fatura e transferência", () => {
  const s = view("all");
  assert.equal(s.expense, 140);   // só mercado (100 + 40)
  assert.equal(s.income, 1000);   // só vendas
});

test("bruto inclui tudo que é receita/despesa, mas não transferência", () => {
  const s = view("all");
  assert.equal(s.grossExpense, 100 + 40 + 300 + 900 + 70);
  assert.equal(s.grossIncome, 1000 + 50);
});

test("investido = aportes - resgates", () => {
  assert.equal(view("all").invested, 250);
});

test("visão por dono separa Paulo, Adri e Empresa", () => {
  assert.equal(view(PAULO).expense, 100);
  assert.equal(view(ADRI).expense, 40);
  assert.equal(view(EMPRESA).income, 1000);
  assert.equal(view(EMPRESA).expense, 0);
});

test("visão 'Casal' (pf) soma Paulo + Adri e deixa a empresa de fora", () => {
  const s = view("pf");
  assert.equal(s.expense, 140);
  assert.equal(s.income, 0);
});

test("a soma das visões individuais bate com 'Tudo'", () => {
  const sum = (k: "expense" | "income") => view(PAULO)[k] + view(ADRI)[k] + view(EMPRESA)[k];
  assert.equal(sum("expense"), view("all").expense);
  assert.equal(sum("income"), view("all").income);
});

test("saldo vem do saldo por dono quando uma pessoa está selecionada", () => {
  assert.equal(view(PAULO).balance, -111);
  assert.equal(view(ADRI).balance, -22);
});

test("renomear a categoria não muda o tipo (tipo explícito vence o nome)", () => {
  const renamed = categories.map((c) => (c.id === CAT.invest ? { ...c, name: "Minha Caixinha" } : c));
  const out = calculateDashboardData({ ...raw, allCategories: renamed }, "all", null).summary;
  assert.equal(out.expense, 140);
  assert.equal(out.invested, 250);
});

test("sem tipo gravado, cai no palpite pelo nome (comportamento antigo)", () => {
  assert.equal(resolveCategoryKind({ name: "Investimentos", kind: null }), "investment");
  assert.equal(resolveCategoryKind({ name: "Cartão de Crédito" }), "card_payment");
  assert.equal(resolveCategoryKind({ name: "Reembolsos / Empréstimos" }), "refund");
  assert.equal(resolveCategoryKind({ name: "Mercado" }), "operational");
  assert.equal(inferKindFromName("Renda de Investimento"), "investment");
});

test("duas categorias do mesmo tipo contam as duas (antes só a primeira)", () => {
  const sets = buildKindSets([
    { id: "a", name: "Investimentos" },
    { id: "b", name: "Investimento exterior" },
  ]);
  assert.equal(isOperational("a", sets), false);
  assert.equal(isOperational("b", sets), false);
  assert.equal(isOperational(null, sets), true);
});

test("matchesView", () => {
  const t = { entityType: "pf", ownerId: PAULO };
  assert.equal(matchesView(t, "all"), true);
  assert.equal(matchesView(t, "pf"), true);
  assert.equal(matchesView(t, "pj"), false);
  assert.equal(matchesView(t, PAULO), true);
  assert.equal(matchesView(t, ADRI), false);
});

test("parcelamento não perde centavos", () => {
  const parts = splitAmountIntoInstallments(100, 3);
  assert.deepEqual(parts, ["33.34", "33.33", "33.33"]);
  assert.equal(parts.reduce((a, b) => a + Number(b), 0).toFixed(2), "100.00");
});

test("datas de parcela não viram 31 de fevereiro", () => {
  assert.equal(addMonthsClamped("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsClamped("2026-11-30", 3), "2027-02-28");
});

test("ciclo da fatura: antes e depois do fechamento", () => {
  // fecha dia 10, vence dia 17
  assert.equal(getInvoiceCycleForDate("2026-10-10", 10, 17).cycleKey, "2026-10");
  assert.equal(getInvoiceCycleForDate("2026-10-11", 10, 17).cycleKey, "2026-11");
  // fecha dia 28, vence dia 5 -> vence no mês seguinte ao fechamento
  const c = getInvoiceCycleForDate("2026-10-20", 28, 5);
  assert.equal(c.closingDate, "2026-10-28");
  assert.equal(c.dueDate, "2026-11-05");
});

import { mapAsaasPayment } from "./asaas";

test("Asaas: venda recebida vira entrada + taxa como saída separada", () => {
  const r = mapAsaasPayment({ id: "pay_1", description: "Consultoria", value: 1000, netValue: 996.51, paymentDate: "2026-10-08", status: "RECEIVED" });
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].type, r[0].amount, r[0].externalId], ["income", "1000.00", "asaas:pay:pay_1"]);
  assert.deepEqual([r[1].type, r[1].amount, r[1].externalId], ["expense", "3.49", "asaas:fee:pay_1"]);
});

test("Asaas: sem taxa não cria lançamento de taxa; pendente é ignorada", () => {
  assert.equal(mapAsaasPayment({ id: "p", value: 50, netValue: 50, paymentDate: "2026-10-01", status: "RECEIVED" }).length, 1);
  assert.equal(mapAsaasPayment({ id: "p", value: 50, paymentDate: "2026-10-01", status: "PENDING" }).length, 0);
  assert.equal(mapAsaasPayment({ id: "p", value: 50, status: "RECEIVED" }).length, 0); // sem data
});

import { summarizeByOwner } from "./invoice";

test("fatura: total por dono mostra quanto é da empresa", () => {
  const owners = [{ id: "p", name: "Paulo" }, { id: "e", name: "Empresa" }];
  const r = summarizeByOwner([
    { amount: "100.10", ownerId: "p" },
    { amount: "250.00", ownerId: "e" },
    { amount: "49.90", ownerId: "p" },
    { amount: "10", ownerId: null },
  ], owners);
  assert.deepEqual(r.map((x) => [x.name, x.total, x.count]), [["Empresa", 250, 1], ["Paulo", 150, 2], ["Sem dono", 10, 1]]);
});

import { sumBalance } from "./balance";

test("saldo: ignora transferência e pagamento de fatura (que já entrou nas compras)", () => {
  const sets = buildKindSets(categories);
  const rows = [
    { type: "income", amount: "1000", categoryId: CAT.vendas },
    { type: "expense", amount: "200", categoryId: CAT.mercado },
    { type: "expense", amount: "900", categoryId: CAT.cartao },   // pagamento da fatura do extrato
    { type: "transfer", amount: "500", categoryId: null },
  ];
  assert.equal(sumBalance(rows, sets), 800);
});

test("saldo: mês isolado não é afetado por pagamento de fatura do mês anterior", () => {
  const sets = buildKindSets(categories);
  // outubro: vendas 1000, mercado 200; no dia 5 caiu o pagamento da fatura de setembro (900)
  const outubro = [
    { type: "income", amount: "1000", categoryId: CAT.vendas },
    { type: "expense", amount: "200", categoryId: CAT.mercado },
    { type: "expense", amount: "900", categoryId: CAT.cartao },
  ];
  assert.equal(sumBalance(outubro, sets), 800); // e não -100
});

test("saldo: despesa do cartão (sem categoria de fatura) continua contando", () => {
  const sets = buildKindSets(categories);
  assert.equal(sumBalance([{ type: "expense", amount: "75.50", categoryId: CAT.mercado }], sets), -75.5);
});

import { explainNumbers, searchHelp } from "./help";

test("tira-dúvidas: explica de onde vem despesa, receita e saldo", () => {
  const e = explainNumbers(raw, "all", true);
  assert.equal(e.despesas.operacional, 140);
  assert.equal(e.despesas.bruto, 100 + 40 + 300 + 900 + 70);
  assert.deepEqual(e.despesas.excluidos.map((l) => [l.label, l.amount]), [["Investimentos", 300], ["Reembolsos / empréstimos", 70], ["Pagamento de fatura", 900]]);
  assert.equal(e.receita.operacional, 1000);
  assert.equal(e.saldoDoPeriodo, 1000 + 50 - (100 + 40 + 300 + 70)); // fatura e transferência fora
  assert.deepEqual(e.ignoradosNoSaldo.map((l) => l.label), ["Transferências", "Pagamento de fatura"]);
});

test("tira-dúvidas: o saldo explicado bate com o cálculo do saldo", () => {
  const sets = buildKindSets(categories);
  const e = explainNumbers(raw, "all", true);
  assert.equal(e.saldoDoPeriodo, sumBalance(raw.transactions as any, sets));
});

test("tira-dúvidas: respeita a visão e avisa de lançamento sem categoria/dono/duplicado", () => {
  assert.equal(explainNumbers(raw, ADRI, true).despesas.operacional, 40);
  const sujo = { ...raw, transactions: [
    { id: 1, type: "expense", amount: "10", ownerId: null, categoryId: null, entityType: "pf", date: "2026-10-01", description: "Padaria" },
    { id: 2, type: "expense", amount: "10", ownerId: null, categoryId: null, entityType: "pf", date: "2026-10-01", description: "padaria" },
  ] };
  const a = explainNumbers(sujo, "all", true).alertas.join(" ");
  assert.match(a, /sem categoria/);
  assert.match(a, /sem dono/);
  assert.match(a, /idênticos/);
  assert.match(explainNumbers(raw, "all", false).alertas.join(" "), /acumulado/);
});

test("tira-dúvidas: a busca acha a resposta mesmo sem acento", () => {
  assert.equal(searchHelp("por que a fatura do cartao conta em dobro")[0].id, "fatura-nao-conta");
  assert.equal(searchHelp("como mover item para empresa")[0].id, "mover-fatura");
  assert.equal(searchHelp("o que e mes isolado")[0].id, "mes-isolado");
  assert.deepEqual(searchHelp("xx"), []);
});

import { filterTransactions, findDuplicateIds, summarizeTxs, EMPTY_FILTERS } from "./txFilters";

const L = (id: string, o: any = {}) => ({ id, description: "Mercado Central", amount: "129.00", type: "expense", date: "2026-10-05", categoryId: "c1", ownerId: "p", isPaid: true, creditCardId: null, accountId: null, ...o });

test("lançamentos: busca por texto, sem acento, e por valor", () => {
  const txs = [L("1"), L("2", { description: "Padaria São João", amount: "35.50" }), L("3", { description: "Uber", amount: "129.00" })];
  assert.deepEqual(filterTransactions(txs, { ...EMPTY_FILTERS, search: "sao joao" }).map((t) => t.id), ["2"]);
  assert.deepEqual(filterTransactions(txs, { ...EMPTY_FILTERS, search: "129" }).map((t) => t.id), ["1", "3"]);
  assert.deepEqual(filterTransactions(txs, { ...EMPTY_FILTERS, search: "mercado 129" }).map((t) => t.id), ["1"]);
});

test("lançamentos: filtros de tipo, status, origem e atalhos de conferência", () => {
  const txs = [
    L("1"),
    L("2", { type: "income", categoryId: null }),
    L("3", { isPaid: false, ownerId: null, creditCardId: "k" }),
    L("4", { type: "transfer", categoryId: null }),
  ];
  const ids = (f: any) => filterTransactions(txs, { ...EMPTY_FILTERS, ...f }).map((t) => t.id);
  assert.deepEqual(ids({ type: "income" }), ["2"]);
  assert.deepEqual(ids({ status: "pending" }), ["3"]);
  assert.deepEqual(ids({ origin: "card" }), ["3"]);
  assert.deepEqual(ids({ quick: "sem-categoria" }), ["2"]);   // transferência não conta como "sem categoria"
  assert.deepEqual(ids({ quick: "sem-dono" }), ["3"]);
  assert.deepEqual(ids({ quick: "pendentes" }), ["3"]);
});

test("lançamentos: detecta duplicados e resume totais", () => {
  const txs = [L("1"), L("2"), L("3", { amount: "10" })];
  assert.deepEqual(Array.from(findDuplicateIds(txs)).sort(), ["1", "2"]);
  assert.deepEqual(filterTransactions(txs, { ...EMPTY_FILTERS, quick: "duplicados" }).map((t) => t.id), ["1", "2"]);
  assert.deepEqual(summarizeTxs([L("1", { type: "income", amount: "100" }), L("2", { amount: "40.5" })]), { count: 2, income: 100, expense: 40.5 });
});

import { monthChecklist } from "./closing";

test("fechamento do mês: aponta pendências e respeita a visão", () => {
  const data = { transactions: [
    L("1", { isFixed: true, isPaid: false, amount: "100" }),
    L("2", { categoryId: null, ownerId: "a" }),
    L("3", { ownerId: null }),
    L("4"), L("5"),
  ] };
  const r = monthChecklist(data, "all", [{ closedUnpaidCycles: [{}], closedUnpaidTotal: 500 }]);
  const byId = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.equal(byId["contas-fixas"].ok, false);
  assert.equal(byId["faturas"].ok, false);
  assert.equal(byId["categorias"].ok, false);
  assert.equal(byId["donos"].ok, false);
  assert.equal(byId["duplicados"].ok, false);   // 4 e 5 são idênticos
  assert.equal(r.done, 0);
  assert.equal(r.total, 5);
  // visão de um dono só: o lançamento sem dono sai da conta
  const so = monthChecklist(data, "p", []);
  assert.equal(so.items.find((i) => i.id === "donos")!.ok, true);
});

test("fechamento do mês: tudo certo", () => {
  const r = monthChecklist({ transactions: [L("1")] }, "all", []);
  assert.equal(r.done, r.total);
});

import { planOwnerSetup, SETUP_TEMPLATES } from "./ownerSetup";
import { buildViewOptions } from "./owners";

const EX = (id: string, name: string, kind: "pf" | "pj", hasData = false) => ({ id, name, kind, hasData });

test("organização: conta nova cria os donos escolhidos", () => {
  const r = planOwnerSetup([], [{ name: " Ana ", kind: "pf" }, { name: "Loja da Ana", kind: "pj" }]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.final.map((f) => [f.existingId, f.name, f.kind]), [[null, "Ana", "pf"], [null, "Loja da Ana", "pj"]]);
    assert.deepEqual(r.merges, []);
  }
});

test("organização: reaproveita donos existentes (renomeia) e preserva os ids", () => {
  const existing = [EX("a", "Paulo", "pf", true), EX("b", "Adri", "pf", true), EX("c", "Empresa", "pj", true)];
  const r = planOwnerSetup(existing, [{ name: "João", kind: "pf" }, { name: "Maria", kind: "pf" }, { name: "Padaria", kind: "pj" }]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.final.map((f) => f.existingId), ["a", "b", "c"]);
    assert.deepEqual(r.merges, []);
  }
});

test("organização: 'Só eu' junta a outra pessoa física no dono que fica (nada se perde)", () => {
  const existing = [EX("a", "Paulo", "pf", true), EX("b", "Adri", "pf", true)];
  const r = planOwnerSetup(existing, [{ name: "Eu", kind: "pf" }]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.final.map((f) => f.existingId), ["a"]);
    assert.deepEqual(r.merges, [{ fromId: "b", intoIndex: 0 }]);
  }
});

test("organização: não deixa jogar lançamentos de empresa dentro de pessoa física", () => {
  const existing = [EX("a", "Paulo", "pf", true), EX("c", "Empresa", "pj", true)];
  const r = planOwnerSetup(existing, [{ name: "Eu", kind: "pf" }]);
  assert.equal(r.ok, false);
  // sem dados, a empresa vazia pode simplesmente sair
  const vazio = planOwnerSetup([EX("a", "Paulo", "pf", true), EX("c", "Empresa", "pj", false)], [{ name: "Eu", kind: "pf" }]);
  assert.ok(vazio.ok);
  if (vazio.ok) assert.deepEqual(vazio.merges, [{ fromId: "c", intoIndex: null }]);
});

test("organização: validações de nome", () => {
  assert.equal(planOwnerSetup([], []).ok, false);
  assert.equal(planOwnerSetup([], [{ name: "  ", kind: "pf" }]).ok, false);
  assert.equal(planOwnerSetup([], [{ name: "Ana", kind: "pf" }, { name: "ana", kind: "pj" }]).ok, false);
  assert.equal(planOwnerSetup([], [{ name: "x".repeat(41), kind: "pf" }]).ok, false);
});

test("organização: os modelos prontos são válidos (menos o personalizado, que começa vazio)", () => {
  for (const t of SETUP_TEMPLATES.filter((x) => x.id !== "custom")) assert.ok(planOwnerSetup([], t.owners).ok, t.id);
});

test("visões: o nome do grupo se adapta (Casal, Família, Empresas)", () => {
  const o = (id: string, kind: string) => ({ id, name: id.toUpperCase(), kind });
  assert.deepEqual(buildViewOptions([o("a", "pf")]).map((v) => v.label), ["Tudo", "A"]);
  assert.deepEqual(buildViewOptions([o("a", "pf"), o("b", "pf")]).map((v) => v.label), ["Tudo", "Casal", "A", "B"]);
  assert.deepEqual(buildViewOptions([o("a", "pf"), o("b", "pf"), o("c", "pf")])[1].label, "Família");
  assert.deepEqual(buildViewOptions([o("a", "pf"), o("x", "pj"), o("y", "pj")]).map((v) => v.label), ["Tudo", "Empresas", "A", "X", "Y"]);
});

import { looksLikeInvoicePayment } from "./invoiceLines";

test("fatura: reconhece o pagamento da fatura anterior, mas não compras nem estornos", () => {
  assert.equal(looksLikeInvoicePayment("Pagamento recebido"), true);
  assert.equal(looksLikeInvoicePayment("PAGAMENTO EFETUADO"), true);
  assert.equal(looksLikeInvoicePayment("Pagamento Fatura Anterior"), true);
  assert.equal(looksLikeInvoicePayment("Valor pendente do mês anterior"), true);
  assert.equal(looksLikeInvoicePayment("Google One"), false);
  assert.equal(looksLikeInvoicePayment("Estorno Uber"), false);
  assert.equal(looksLikeInvoicePayment("Pagamento de salário funcionário"), false);
});

import { cycleKeyOfTransaction, cycleKeyForDueMonth, dueMonthForCycleKey, withInvoiceTag, cycleKeyFromTags } from "./creditCard";

test("fatura explícita: a etiqueta vence a data (compra internacional lançada depois)", () => {
  const card = { closingDay: 31, dueDay: 9 };
  // sem etiqueta: 31/08 cai na fatura que fecha em 31/08 (vence 09/09)
  assert.equal(cycleKeyOfTransaction({ date: "2026-08-31" }, card), "2026-08");
  // com a etiqueta da fatura que vence em 09/10 (fecha em 30/09)
  assert.equal(cycleKeyOfTransaction({ date: "2026-08-31", aiTags: ["importado_fatura_cartao", "fatura:2026-09"] }, card), "2026-09");
  // etiqueta inválida é ignorada
  assert.equal(cycleKeyOfTransaction({ date: "2026-08-31", aiTags: ["fatura:xx"] }, card), "2026-08");
});

test("fatura explícita: vencimento <-> mês de fechamento", () => {
  // fecha dia 31, vence dia 9: a fatura que vence em out/2026 fechou em set/2026
  assert.equal(cycleKeyForDueMonth("2026-10", 31, 9), "2026-09");
  assert.equal(dueMonthForCycleKey("2026-09", 31, 9), "2026-10");
  // fecha dia 5, vence dia 15: vence no mesmo mês em que fecha
  assert.equal(cycleKeyForDueMonth("2026-10", 5, 15), "2026-10");
  assert.equal(dueMonthForCycleKey("2026-10", 5, 15), "2026-10");
  // virada de ano
  assert.equal(cycleKeyForDueMonth("2027-01", 28, 5), "2026-12");
});

test("fatura explícita: trocar a etiqueta mantém as outras", () => {
  assert.deepEqual(withInvoiceTag(["importado_fatura_cartao", "fatura:2026-08"], "2026-09"), ["importado_fatura_cartao", "fatura:2026-09"]);
  assert.equal(cycleKeyFromTags(withInvoiceTag(null, "2026-10")), "2026-10");
});

import { looksLikeBankInvoicePayment, matchInvoiceByAmount } from "./invoiceLines";

test("extrato: reconhece pagamento de fatura e casa pelo valor com uma única fatura", () => {
  assert.equal(looksLikeBankInvoicePayment("PAGAMENTO FATURA NUBANK"), true);
  assert.equal(looksLikeBankInvoicePayment("Pix recebido de Maria"), false);
  const inv = [{ id: "a", total: 793.57 }, { id: "b", total: 120 }];
  assert.equal(matchInvoiceByAmount(793.57, inv)?.id, "a");
  assert.equal(matchInvoiceByAmount(-793.57, inv)?.id, "a");
  assert.equal(matchInvoiceByAmount(500, inv), null);
  // duas faturas com o mesmo valor: ambíguo, não escolhe sozinho
  assert.equal(matchInvoiceByAmount(100, [{ total: 100 }, { total: 100 }]), null);
});

import { groupCardItems } from "./cardGroups";

test("lançamentos: compras do cartão viram uma linha por fatura", () => {
  const cards = [{ id: "k", name: "Nubank PF", closingDay: 31, dueDay: 9 }];
  const rows = [
    L("1", { creditCardId: "k", date: "2026-09-20", amount: "100", isPaid: false }),
    L("2", { creditCardId: "k", date: "2026-08-31", amount: "27.99", isPaid: false, aiTags: ["fatura:2026-09"] }), // explícita: entra na de 09/10
    L("3", { creditCardId: "k", date: "2026-09-25", amount: "10", type: "income", isPaid: false }),        // crédito reduz o total
    L("4", { creditCardId: null, date: "2026-09-21" }),
    L("5", { creditCardId: "arquivado", date: "2026-09-22" }),                                              // cartão desconhecido: linha solta
  ];
  const out = groupCardItems(rows, cards);
  const inv = out.filter((e) => e.kind === "invoice");
  assert.equal(inv.length, 1);
  const g: any = inv[0];
  assert.equal(g.cycleKey, "2026-09");
  assert.equal(g.dueDate, "2026-10-09");
  assert.equal(g.count, 3);
  assert.equal(g.total, 117.99);        // 100 + 27,99 - 10
  assert.equal(g.allPaid, false);
  assert.equal(out.filter((e) => e.kind === "tx").length, 2);
  // ordenado por data, mais recente primeiro
  const dates = out.map((e) => e.sortDate);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

import { searchHelp as _searchHelp } from "./help";
test("tira-dúvidas: acha as respostas sobre cartão e baixa de fatura", () => {
  assert.equal(_searchHelp("itens do cartao poluem os lancamentos")[0].id, "cartao-lancamentos");
  assert.equal(_searchHelp("extrato do banco da baixa na fatura")[0].id, "baixa-fatura-extrato");
  assert.equal(_searchHelp("item caiu na fatura errada")[0].id, "fatura-dividida");
});

import { dedupeAgainstExisting } from "./invoiceLines";

test("importar a fatura de novo: só entra o que falta, contando repetidos legítimos", () => {
  const item = (d: string, a: string, desc: string) => ({ date: d, amount: a, description: desc });
  const existing = [item("2026-09-19", "5.00", "Asa*Pa Elite Team"), item("2026-09-19", "5.00", "Asa*Pa Elite Team"), item("2026-09-18", "96.99", "Google One")];
  const incoming = [
    item("2026-09-19", "5", "ASA*PA ELITE TEAM"),
    item("2026-09-19", "5", "Asa*Pa Elite Team"),
    item("2026-09-19", "5", "Asa*Pa Elite Team"),   // 3ª compra igual: é nova
    item("2026-09-18", "96,99".replace(",", "."), "Google One"),
    item("2026-09-25", "82.89", "Italo Supermercado"), // nova
  ];
  const r = dedupeAgainstExisting(existing, incoming);
  assert.equal(r.skipped.length, 3);
  assert.deepEqual(r.fresh.map((t) => t.description), ["Asa*Pa Elite Team", "Italo Supermercado"]);
  // arquivo idêntico ao que já existe: nada novo
  assert.equal(dedupeAgainstExisting(existing, existing).fresh.length, 0);
  // nada existente: tudo entra
  assert.equal(dedupeAgainstExisting([], incoming).fresh.length, 5);
});

import { looksLikeTransfer, pairWithinList, bestExistingMatch, rankFixedBills } from "./transfers";

test("transferências: reconhece o que costuma ser dinheiro trocando de mãos", () => {
  assert.equal(looksLikeTransfer("Transferência enviada pelo Pix - ADRIELLE"), true);
  assert.equal(looksLikeTransfer("Reembolso recebido pelo Pix"), true);
  assert.equal(looksLikeTransfer("Compra no débito via NuPay - Uber"), false);
});

test("transferências: acha a outra ponta dentro da própria importação", () => {
  const rows = [
    { date: "2026-10-07", amount: "104.13", type: "expense", description: "Transferência enviada pelo Pix" },
    { date: "2026-10-07", amount: "104.13", type: "income", description: "Reembolso recebido pelo Pix" },
    { date: "2026-10-08", amount: "89.75", type: "expense", description: "Transferência enviada pelo Pix" },
    { date: "2026-10-09", amount: "17.94", type: "expense", description: "Compra no débito" },
  ];
  const pairs = pairWithinList(rows);
  assert.equal(pairs.get(0), 1);
  assert.equal(pairs.get(1), 0);
  assert.equal(pairs.has(2), false);   // sem par
  assert.equal(pairs.has(3), false);
  // valores iguais, mas nenhum parece transferência: não é par
  assert.equal(pairWithinList([
    { date: "2026-10-01", amount: "50", type: "expense", description: "Mercado" },
    { date: "2026-10-01", amount: "50", type: "income", description: "Venda loja" },
  ]).size, 0);
});

test("transferências: acha a ponta já salva de outro extrato (valor igual, até 3 dias)", () => {
  const existing = [
    { id: "a", date: "2026-10-01", amount: "1200.00", type: "income", description: "Transferência recebida" },
    { id: "b", date: "2026-09-20", amount: "1200.00", type: "income", description: "Transferência recebida" },
    { id: "c", date: "2026-10-02", amount: "1200.00", type: "expense", description: "Transferência enviada" },
  ];
  const row = { date: "2026-10-02", amount: "1200", type: "expense", description: "Transferência enviada pelo Pix" };
  assert.equal(bestExistingMatch(row, existing)?.id, "a");
  assert.equal(bestExistingMatch({ ...row, amount: "999" }, existing), null);
});

test("contas fixas: sugere as de valor parecido primeiro e ordena o resto por data", () => {
  const bills = [
    { id: "1", date: "2026-11-10", amount: "500" },
    { id: "2", date: "2026-10-10", amount: "65" },
    { id: "3", date: "2026-09-10", amount: "65" },
    { id: "4", date: "2026-10-05", amount: "1827.95" },
  ];
  const r = rankFixedBills("65.78", bills);
  assert.deepEqual(r.map((b: any) => [b.id, b.suggested]), [["3", true], ["2", true], ["4", false], ["1", false]]);
});

test("extrato: pagamento de cartão sem a palavra 'fatura' também é reconhecido", () => {
  assert.equal(looksLikeBankInvoicePayment("Pagamento cartão de crédito Itaú"), true);
  assert.equal(looksLikeBankInvoicePayment("PGTO CARTAO ADRI"), true);
  assert.equal(looksLikeBankInvoicePayment("Compra no débito - Uber"), false);
  assert.equal(_searchHelp("emprestei 500 e o banco cobrou 520 de juros")[0].id, "emprestimo-juros");
  assert.equal(_searchHelp("mandei dinheiro pra adri como categorizo")[0].id, "transferencias-emprestimos");
});
