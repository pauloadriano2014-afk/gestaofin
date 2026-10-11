import { db } from "@/db";
import { categoryRules, categories, categoryOwnerDefaults, balanceCheckpoints } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { resolveCategoryKind } from "@/utils/categoryKinds";

// Regras de categorização do usuário, sem as que apontam para "Ajuste de saldo"
// (só da conciliação com o banco) nem para categorias de pagamento de fatura de
// cartão: a linha vira pagamento de fatura só quando é vinculada a uma fatura, nunca
// por regra. Regras antigas aprendidas errado por um bug passado também ficam de fora.
export async function loadUserRules(userId: string) {
  const [rules, adjust] = await Promise.all([
    db.select().from(categoryRules).where(eq(categoryRules.userId, userId)),
    db.select().from(categories).where(and(eq(categories.userId, userId))),
  ]);
  const blocked = new Set(adjust.filter((c) => c.name.trim().toLowerCase() === "ajuste de saldo" || resolveCategoryKind(c) === "card_payment").map((c) => c.id));
  return rules.filter((r) => !blocked.has(r.categoryId));
}

// Dono padrão por categoria ({ categoryId: ownerId }). Se a tabela ainda não existe
// (migração não rodada), devolve vazio em vez de quebrar o app.
export async function loadCategoryOwnerDefaults(userId: string): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(categoryOwnerDefaults).where(eq(categoryOwnerDefaults.userId, userId));
    return Object.fromEntries(rows.map((r) => [r.categoryId, r.ownerId]));
  } catch {
    return {};
  }
}

// Saldo conferido com o banco por dono ({ ownerId: { date, amount } }). Sem a tabela
// (migração não rodada), devolve vazio.
export async function loadBalanceCheckpoints(userId: string): Promise<Record<string, { date: string; amount: number }>> {
  try {
    const rows = await db.select().from(balanceCheckpoints).where(eq(balanceCheckpoints.userId, userId));
    return Object.fromEntries(rows.map((r) => [r.ownerId, { date: r.date, amount: Number(r.amount) }]));
  } catch {
    return {};
  }
}
