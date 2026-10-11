import { db } from "@/db";
import { categoryRules, categories } from "@/db/schema";
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
