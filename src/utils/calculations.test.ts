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
