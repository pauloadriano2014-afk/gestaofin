// Tira-dúvidas do KORE, sem IA: respostas prontas sobre como o app calcula as
// coisas + uma explicação dos números da tela feita a partir dos dados do
// próprio usuário. Funções puras (sem banco, sem rede), por isso testáveis.

import { buildKindSets } from "./categoryKinds";
import { matchesView } from "./owners";

// ---------------------------------------------------------------------------
// 1) PERGUNTAS E RESPOSTAS
// ---------------------------------------------------------------------------

export interface HelpEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string; // palavras que a pessoa pode usar ao perguntar
}

export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: "saldo-vs-resultado",
    question: "Por que o Saldo é diferente de Receita menos Despesas?",
    answer:
      "Receita e Despesas são do período e só contam gastos e ganhos \"de verdade\" (ficam de fora investimentos, reembolsos e pagamento de fatura). O Saldo conta tudo que entrou e saiu da conta, mas também deixa de fora transferências e pagamento de fatura. No modo \"Mês isolado\" o saldo é só daquele mês; no modo \"Período\" com a chave desligada ele soma tudo desde o começo. Use \"Explicar meus números\" para ver a conta feita com os seus dados.",
    keywords: "saldo diferente nao bate receita despesa resultado conta",
  },
  {
    id: "card-saldo",
    question: "Card Saldo Principal: o que ele mostra?",
    answer:
      "Tudo que entrou menos tudo que saiu. No modo Mês isolado conta só aquele mês; no modo Período com \"começar do zero\" desligado soma tudo desde o início até o fim do período. Ficam de fora transferências e pagamento de fatura (as compras do cartão já contam no dia da compra). Clique no card para ver a lista que forma esse valor.",
    keywords: "card saldo principal disponivel conta",
  },
  {
    id: "card-receita",
    question: "Card Receita Operacional: o que entra?",
    answer:
      "As entradas do período e da visão selecionada, sem investimentos (resgates), reembolsos/empréstimos e pagamento de fatura. É o que você realmente ganhou. Clique no card para ver a lista e, se quiser, incluir tudo no Bruto.",
    keywords: "card receita operacional entradas ganhou bruto",
  },
  {
    id: "card-despesas",
    question: "Card Despesas de Fato: o que entra?",
    answer:
      "As saídas do período e da visão selecionada, sem aportes de investimento, reembolsos/empréstimos e pagamento de fatura do cartão (porque as compras já contam). É o que você realmente gastou. Clique no card para ver a lista por categoria.",
    keywords: "card despesas de fato saidas gastou gasto",
  },
  {
    id: "card-investido",
    question: "Card Aportes / Investido: como é calculado?",
    answer:
      "Aportes (dinheiro que foi para investimento) menos resgates (que voltaram). Não conta como despesa nem como receita: é patrimônio que mudou de lugar. O que é investimento depende do tipo da categoria, que você muda em Cadastros > Categorias.",
    keywords: "card aportes investido patrimonio alocado",
  },
  {
    id: "cartao-lancamentos",
    question: "Os itens do cartão de crédito aparecem em Lançamentos? Polui?",
    answer:
      "Aparecem, porque cada compra é um lançamento de verdade: conta como gasto no dia da compra, com o dono e a categoria dela. Para não poluir, a tela de Lançamentos agrupa as compras do cartão em UMA linha por fatura (cartão, vencimento, quantos itens, total e se está paga). Clique na linha para abrir os itens. Para ver tudo solto, desmarque \"Agrupar compras do cartão por fatura\" (ou use a busca).",
    keywords: "cartao itens lancamentos poluicao confusao agrupar fatura compras aparecem",
  },
  {
    id: "baixa-fatura-extrato",
    question: "Importei o extrato do banco: ele dá baixa na fatura do cartão?",
    answer:
      "Dá, com a sua confirmação. Na revisão da importação, a linha de pagamento de fatura (por exemplo \"Pagamento de fatura Nubank\") ganha um seletor \"Dar baixa: cartão, vencimento e valor\". Quando o valor bate com uma única fatura fechada, ele já vem escolhido. Ao confirmar, a linha é salva como pagamento de fatura (fora de Despesas e do Saldo, porque as compras já contam) e todos os itens da fatura ficam pagos, na data do pagamento.",
    keywords: "baixa fatura extrato banco importar pagamento cartao quitar pagar automatico",
  },
  {
    id: "fatura-dividida",
    question: "A fatura apareceu dividida ou um item caiu na fatura errada. E agora?",
    answer:
      "O app sugere a fatura pela data da compra e pelo dia de fechamento do cartão, mas o banco às vezes cobra numa fatura diferente (compra internacional lançada dias depois, IOF). Ao importar uma fatura, informe em \"Esta fatura vence em\": todos os itens vão para ela, mesmo os de datas vizinhas. Para itens já importados, abra \"ver itens\" na fatura, marque os itens e use \"Mover de fatura\".",
    keywords: "fatura dividida errada item caiu outra fatura internacional iof fechamento mover vence",
  },
  {
    id: "mes-isolado",
    question: "O que é Mês isolado e o que é Período?",
    answer:
      "Mês isolado mostra um mês só, sem nada dos outros: saldo, cards, gráficos e extrato são apenas daquele mês (use as setas para trocar). Período deixa escolher De/Até; a chave \"Começar do zero neste período\" decide se o saldo ignora o que veio antes (ligada) ou soma tudo desde o início (desligada).",
    keywords: "mes isolado periodo de ate zerar passado acumulado saldo",
  },
  {
    id: "fatura-nao-conta",
    question: "Por que o pagamento da fatura do cartão não conta como despesa?",
    answer:
      "Porque as compras do cartão já contam no dia em que foram feitas. Se o pagamento da fatura também contasse, o gasto entraria duas vezes (e ainda cairia no mês seguinte). Por isso categorias do tipo \"Pagamento de fatura\" ficam fora de Despesas e do Saldo. Se você nunca lançou as compras daquele cartão e quer que o pagamento conte, troque a categoria dele por uma de gasto normal.",
    keywords: "fatura cartao pagamento duplicado dobro despesa conta credito",
  },
  {
    id: "tipo-categoria",
    question: "Como mudo o tipo de uma categoria (investimento, reembolso, fatura)?",
    answer:
      "Em Cadastros > Categorias, cada categoria tem um seletor com o tipo: gasto/receita normal, investimento, reembolso/empréstimo ou pagamento de fatura. O tipo define como ela entra nas contas. Renomear a categoria não muda o tipo.",
    keywords: "categoria tipo investimento reembolso emprestimo fatura mudar trocar",
  },
  {
    id: "casal",
    question: "O que são as visões do topo (Tudo, Casal/Família, cada nome)?",
    answer:
      "Cada lançamento, cartão, conta e conta fixa tem um dono, que pode ser uma pessoa ou uma empresa, com os nomes que você escolheu. Cada nome mostra só o que é dele; o grupo (Casal com duas pessoas, Família com três ou mais) soma as pessoas físicas; Tudo soma todos. Para mudar os nomes ou o modelo, use Cadastros > Pessoas e Contas > Reorganizar.",
    keywords: "casal familia empresa dono nome visao pf pj separar grupo organizar reorganizar",
  },
  {
    id: "mover-fatura",
    question: "Como movo itens do cartão pessoal para a empresa?",
    answer:
      "Em Cadastros > Meus Cartões, clique em \"ver itens\" na fatura, marque os itens, escolha o novo dono (e, se quiser, outro cartão) e clique em Mover. Valor, data e categoria não mudam; muda quem é o dono, e o item passa a contar na visão da empresa.",
    keywords: "mover itens fatura cartao pj empresa pessoal migrar trocar dono",
  },
  {
    id: "transferencia",
    question: "O que é uma Transferência?",
    answer:
      "É dinheiro que só mudou de lugar (por exemplo, da conta da empresa para a sua). Não é receita nem despesa e não entra no Saldo, em Receita nem em Despesas. Ao lançar, escolha o tipo \"Transferência\".",
    keywords: "transferencia entre contas mover dinheiro nao conta",
  },
  {
    id: "investimento-reembolso",
    question: "Como Investimentos e Reembolsos entram nas contas?",
    answer:
      "Aportes e resgates aparecem no card Investido (aportes menos resgates) e não contam como despesa nem receita. Reembolsos e empréstimos também ficam fora de Receita e Despesas, porque o dinheiro volta ou vai embora sem ser consumo. Clicando no card dá para ver a lista e incluir tudo no \"Bruto\".",
    keywords: "investimento aporte resgate reembolso emprestimo investido bruto",
  },
  {
    id: "contas-fixas",
    question: "Como funcionam as Contas Fixas e o Virar Mês?",
    answer:
      "Em Cadastros > Contas Fixas você cadastra o molde (nome, valor, dia de vencimento, dono). O app gera a cobrança do mês sozinho e ela aparece em Contas em Aberto até você dar baixa. Ao dar baixa com um valor diferente do original, a diferença vira juros ou desconto.",
    keywords: "conta fixa virar mes molde vencimento baixa aluguel internet",
  },
  {
    id: "dar-baixa",
    question: "Como dou baixa em uma conta ou fatura?",
    answer:
      "Conta fixa: clique no círculo ao lado dela (em Contas em Aberto ou na lista) para marcar como paga. Fatura de cartão: em Meus Cartões, clique em Pagar na fatura, que dá baixa em todos os itens dela de uma vez.",
    keywords: "baixa pagar pago marcar fatura conta paga",
  },
  {
    id: "contas-em-aberto",
    question: "O que aparece em Contas em Aberto?",
    answer:
      "Contas fixas ainda não pagas do período selecionado e da visão selecionada (Tudo, o grupo de pessoas ou um nome específico). As vencidas ficam em vermelho. O painel pode ser recolhido clicando no título.",
    keywords: "contas aberto vencidas pendentes nao pagas painel",
  },
  {
    id: "importar",
    question: "Como importo extrato, fatura ou vendas do Asaas?",
    answer:
      "Botão Importar: \"Extrato do banco\" lê um CSV; \"Fatura do cartão\" lê CSV, OFX ou PDF e manda para o dono do cartão; \"Sincronizar vendas do Asaas\" busca direto da API as vendas do período. Antes de salvar, você revisa cada linha (categoria e dono). Rodar de novo não duplica as vendas do Asaas.",
    keywords: "importar extrato csv fatura ofx pdf asaas vendas sincronizar",
  },
];

const normalize = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function searchHelp(query: string, entries: HelpEntry[] = HELP_ENTRIES, limit = 5): HelpEntry[] {
  const tokens = normalize(query).split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return [];
  return entries
    .map((e) => {
      const hay = normalize(`${e.question} ${e.keywords}`);
      const body = normalize(e.answer);
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t)) score += 3;
        else if (body.includes(t)) score += 1;
      }
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

// ---------------------------------------------------------------------------
// 2) EXPLICAR OS NÚMEROS DA TELA
// ---------------------------------------------------------------------------

export interface ExcludedLine { label: string; count: number; amount: number }

export interface NumbersExplanation {
  mode: "isolado" | "acumulado";
  despesas: { operacional: number; bruto: number; excluidos: ExcludedLine[] };
  receita: { operacional: number; bruto: number; excluidos: ExcludedLine[] };
  // Saldo só com o que está no período na tela (no modo acumulado o saldo
  // também soma os meses anteriores, que não ficam carregados na tela).
  saldoDoPeriodo: number;
  ignoradosNoSaldo: ExcludedLine[];
  alertas: string[];
}

const abs = (t: any) => Math.abs(Number(t.amount));
const total = (arr: any[]) => Math.round(arr.reduce((a, t) => a + abs(t), 0) * 100) / 100;

export function explainNumbers(raw: any, viewMode: string, isolatePeriod: boolean): NumbersExplanation {
  const kinds = buildKindSets(raw?.allCategories || []);
  const txs = (raw?.transactions || []).filter((t: any) => matchesView(t, viewMode));
  const inKind = (t: any, k: "investment" | "refund" | "card_payment") => !!t.categoryId && kinds[k].has(t.categoryId);

  const expenses = txs.filter((t: any) => t.type === "expense");
  const incomes = txs.filter((t: any) => t.type === "income");
  const transfers = txs.filter((t: any) => t.type === "transfer");

  const line = (label: string, arr: any[]): ExcludedLine => ({ label, count: arr.length, amount: total(arr) });
  const nonEmpty = (l: ExcludedLine) => l.count > 0;

  const exclSide = (arr: any[]) =>
    [
      line("Investimentos", arr.filter((t) => inKind(t, "investment"))),
      line("Reembolsos / empréstimos", arr.filter((t) => inKind(t, "refund"))),
      line("Pagamento de fatura", arr.filter((t) => inKind(t, "card_payment"))),
    ].filter(nonEmpty);

  const isExcluded = (t: any) => inKind(t, "investment") || inKind(t, "refund") || inKind(t, "card_payment");

  // Saldo do período: igual a utils/balance.ts (fora transferência e pagamento de fatura).
  const balanceRows = txs.filter((t: any) => (t.type === "income" || t.type === "expense") && !inKind(t, "card_payment"));
  const saldoDoPeriodo =
    Math.round(
      balanceRows.reduce((a: number, t: any) => a + (t.type === "income" ? abs(t) : -abs(t)), 0) * 100
    ) / 100;

  const ignoradosNoSaldo = [
    line("Transferências", transfers),
    line("Pagamento de fatura", txs.filter((t: any) => (t.type === "income" || t.type === "expense") && inKind(t, "card_payment"))),
  ].filter(nonEmpty);

  // --- alertas: causas comuns de "não bate" ---
  const alertas: string[] = [];
  const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const semCategoria = txs.filter((t: any) => t.type !== "transfer" && !t.categoryId);
  if (semCategoria.length > 0) alertas.push(`${semCategoria.length} lançamento(s) sem categoria (${money(total(semCategoria))}). Eles contam como gasto/receita normal; categorize para o app tratar certo.`);

  const semDono = txs.filter((t: any) => !t.ownerId);
  if (semDono.length > 0) alertas.push(`${semDono.length} lançamento(s) sem dono. Eles aparecem em Tudo, mas somem das visões de cada nome.`);

  const seen = new Map<string, number>();
  for (const t of txs) {
    const key = `${t.date}|${t.type}|${abs(t).toFixed(2)}|${normalize(t.description).trim()}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dup = Array.from(seen.values()).filter((n) => n > 1).length;
  if (dup > 0) alertas.push(`${dup} grupo(s) de lançamentos idênticos (mesma data, valor e descrição). Pode ser duplicidade de importação; confira no extrato.`);

  const faturaIncluida = ignoradosNoSaldo.find((l) => l.label === "Pagamento de fatura");
  if (faturaIncluida) alertas.push(`${faturaIncluida.count} pagamento(s) de fatura (${money(faturaIncluida.amount)}) não entram em Despesas nem no Saldo. Se as compras desse cartão NÃO foram lançadas, troque a categoria para gasto normal.`);

  if (!isolatePeriod) alertas.push("Você está no modo acumulado: o Saldo soma também os meses anteriores ao período, que não aparecem nesta conta. Para ver só este período, use Mês isolado.");

  return {
    mode: isolatePeriod ? "isolado" : "acumulado",
    despesas: { operacional: total(expenses.filter((t: any) => !isExcluded(t))), bruto: total(expenses), excluidos: exclSide(expenses) },
    receita: { operacional: total(incomes.filter((t: any) => !isExcluded(t))), bruto: total(incomes), excluidos: exclSide(incomes) },
    saldoDoPeriodo,
    ignoradosNoSaldo,
    alertas,
  };
}
