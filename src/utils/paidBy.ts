// "Conta usada": de quem é o DINHEIRO que saiu (ou entrou), quando é diferente
// de quem é o gasto. Ex: mercado de casa (gasto do Paulo) pago no cartão da
// Empresa: o gasto é do Paulo (Despesas e relatórios), mas o dinheiro saiu da
// conta da Empresa (o saldo dela cai, como no banco).
//
// Guardado numa etiqueta ("pagopor:<id do dono>") em aiTags: não precisa de
// migração. Sem a etiqueta, o dinheiro é do próprio dono do lançamento.

export const PAID_BY_PREFIX = "pagopor:";

export function paidByFromTags(tags: string[] | null | undefined): string | null {
  const t = (tags || []).find((x) => typeof x === "string" && x.startsWith(PAID_BY_PREFIX));
  return t ? t.slice(PAID_BY_PREFIX.length) || null : null;
}

// Troca (ou tira, com null) a etiqueta, mantendo as outras.
export function withPaidBy(tags: string[] | null | undefined, ownerId: string | null): string[] {
  const rest = (tags || []).filter((x) => !(typeof x === "string" && x.startsWith(PAID_BY_PREFIX)));
  return ownerId ? [...rest, `${PAID_BY_PREFIX}${ownerId}`] : rest;
}

interface CashRowInput { ownerId?: string | null; entityType?: string | null; aiTags?: string[] | null }

// A linha "vista pelo caixa": dono e tipo (PF/PJ) passam a ser os da conta usada.
export function toCashRow<T extends CashRowInput>(t: T, owners: { id: string; kind: string }[]): T {
  const payer = paidByFromTags(t.aiTags);
  if (!payer || payer === t.ownerId) return t;
  const owner = owners.find((o) => o.id === payer);
  if (!owner) return t;
  return { ...t, ownerId: owner.id, entityType: owner.kind };
}

// Nome da conta usada, só quando difere do dono (para mostrar na lista).
export function paidByLabel(t: CashRowInput, ownerName: (id: any) => string): string {
  const payer = paidByFromTags(t.aiTags);
  return payer && payer !== t.ownerId ? ownerName(payer) : "";
}

// Valor efetivo na revisão de importação: 'self' = o próprio dono (sem etiqueta);
// sem escolha, assume a conta do extrato/cartão quando ela é de outro dono.
export function effectivePaidBy(
  row: { ownerId?: string | null; paidByOwnerId?: string | null },
  statementOwnerId: string | null | undefined
): string | null {
  if (row.paidByOwnerId === "self") return null;
  if (row.paidByOwnerId) return row.paidByOwnerId === row.ownerId ? null : row.paidByOwnerId;
  return statementOwnerId && statementOwnerId !== row.ownerId ? statementOwnerId : null;
}
