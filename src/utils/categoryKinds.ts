// Tipo "contábil" de uma categoria. Decide como ela entra nas contas:
//   operational  -> gasto/receita de verdade (padrão)
//   investment   -> aporte/resgate: movimenta patrimônio, não é gasto nem renda
//   refund       -> reembolso/empréstimo: o dinheiro volta ou vai embora, não é gasto nem renda
//   card_payment -> pagamento de fatura vindo do extrato: as compras já foram
//                   lançadas uma a uma, então contar isso de novo seria duplicar
//
// O campo explícito (categories.kind) sempre vence. Só quando ele está vazio
// (categoria antiga ou criada sem escolher) cai no palpite pelo nome, que é a
// regra que o app usava antes — assim nada muda para quem não mexer.

export type CategoryKind = "operational" | "investment" | "refund" | "card_payment";

export const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  operational: "Gasto/receita normal",
  investment: "Investimento",
  refund: "Reembolso / empréstimo",
  card_payment: "Pagamento de fatura",
};

const KINDS = new Set<string>(["operational", "investment", "refund", "card_payment"]);

export function inferKindFromName(name: string): CategoryKind {
  const n = (name || "").toLowerCase();
  if (n.includes("investimento")) return "investment";
  if (n.includes("cartão de crédito")) return "card_payment";
  if (n.includes("reembolso")) return "refund";
  return "operational";
}

export function resolveCategoryKind(cat: { name: string; kind?: string | null }): CategoryKind {
  if (cat.kind && KINDS.has(cat.kind)) return cat.kind as CategoryKind;
  return inferKindFromName(cat.name);
}

// Conjuntos de ids por tipo. Diferente do `.find()` antigo, pega TODAS as
// categorias do tipo (se houver duas de investimento, as duas contam).
export function buildKindSets(categories: { id: string; name: string; kind?: string | null }[]) {
  const sets = {
    investment: new Set<string>(),
    refund: new Set<string>(),
    card_payment: new Set<string>(),
  };
  for (const c of categories || []) {
    const k = resolveCategoryKind(c);
    if (k !== "operational") sets[k].add(c.id);
  }
  return sets;
}

// "Operacional" = fora de investimento, reembolso e pagamento de fatura.
export function isOperational(
  categoryId: string | null | undefined,
  sets: ReturnType<typeof buildKindSets>
): boolean {
  if (!categoryId) return true;
  return !sets.investment.has(categoryId) && !sets.refund.has(categoryId) && !sets.card_payment.has(categoryId);
}
