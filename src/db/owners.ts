import { db } from "@/db";
import { owners, transactions, fixedBills, creditCards } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

export type OwnerRow = typeof owners.$inferSelect;

// Garante que o usuário tenha donos cadastrados. Na primeira vez cria
// Paulo (PF), Adri (PF) e Empresa (PJ) e preenche o dono dos lançamentos,
// contas fixas e cartões antigos: PF -> Paulo, PJ -> Empresa. Só roda
// quando não existe nenhum dono, então é seguro chamar a cada carregamento.
export async function ensureOwners(userId: string): Promise<OwnerRow[]> {
  const existing = await db.select().from(owners).where(eq(owners.userId, userId)).orderBy(asc(owners.sortOrder), asc(owners.createdAt));
  if (existing.length > 0) return existing;

  const created = await db.insert(owners).values([
    { userId, name: "Paulo", kind: "pf", sortOrder: 0 },
    { userId, name: "Adri", kind: "pf", sortOrder: 1 },
    { userId, name: "Empresa", kind: "pj", sortOrder: 2 },
  ]).returning();

  const paulo = created.find((o) => o.name === "Paulo")!;
  const empresa = created.find((o) => o.name === "Empresa")!;

  for (const table of [transactions, fixedBills] as const) {
    await db.update(table).set({ ownerId: paulo.id }).where(and(eq(table.userId, userId), isNull(table.ownerId), eq(table.entityType, "pf")));
    await db.update(table).set({ ownerId: empresa.id }).where(and(eq(table.userId, userId), isNull(table.ownerId), eq(table.entityType, "pj")));
  }
  // Cartões não tinham PF/PJ: ficam com o primeiro dono; o usuário ajusta na tela de cartões.
  await db.update(creditCards).set({ ownerId: paulo.id }).where(and(eq(creditCards.userId, userId), isNull(creditCards.ownerId)));

  return created.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

// Resolve dono + entityType de um lançamento novo. Regra:
//  - veio ownerId válido do usuário -> usa ele, e entityType = kind do dono;
//  - senão cai pro dono padrão do entityType informado (pf -> 1º PF, pj -> 1º PJ).
// Mantém entityType e ownerId sempre coerentes entre si.
export async function resolveOwnership(
  userId: string,
  input: { ownerId?: string | null; entityType?: string | null }
): Promise<{ ownerId: string | null; entityType: "pf" | "pj" }> {
  const list = await ensureOwners(userId);
  const byId = list.find((o) => o.id === input.ownerId);
  if (byId) return { ownerId: byId.id, entityType: byId.kind };
  const kind: "pf" | "pj" = input.entityType === "pj" ? "pj" : "pf";
  const fallback = list.find((o) => o.kind === kind) ?? list[0];
  return { ownerId: fallback?.id ?? null, entityType: kind };
}
