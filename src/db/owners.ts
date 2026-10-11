import { db } from "@/db";
import { owners, transactions, fixedBills, creditCards, accounts, ownerSetups } from "@/db/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { isOwnerSetupExempt } from "@/db/planAccess";
import { planOwnerSetup, type OwnerSpec, type ExistingOwner } from "@/utils/ownerSetup";

export type OwnerRow = typeof owners.$inferSelect;

// Donos da conta, na ordem escolhida. NÃO cria nada: cada conta escolhe a
// própria organização (só eu, casal, família, empresa...) na primeira vez.
export async function getOwners(userId: string): Promise<OwnerRow[]> {
  return db.select().from(owners).where(eq(owners.userId, userId)).orderBy(asc(owners.sortOrder), asc(owners.createdAt));
}

// Resolve dono + entityType de um lançamento novo. Regra:
//  - veio ownerId válido do usuário -> usa ele, e entityType = kind do dono;
//  - senão cai pro primeiro dono do tipo pedido (pf/pj); sem nenhum dono ainda
//    (conta que não escolheu a organização), grava sem dono.
export async function resolveOwnership(
  userId: string,
  input: { ownerId?: string | null; entityType?: string | null }
): Promise<{ ownerId: string | null; entityType: "pf" | "pj" }> {
  const list = await getOwners(userId);
  const byId = list.find((o) => o.id === input.ownerId);
  if (byId) return { ownerId: byId.id, entityType: byId.kind };
  const kind: "pf" | "pj" = input.entityType === "pj" ? "pj" : "pf";
  const fallback = list.find((o) => o.kind === kind) ?? list[0];
  return { ownerId: fallback?.id ?? null, entityType: fallback?.kind ?? kind };
}

// ---------------------------------------------------------------------------
// ESCOLHA DE ORGANIZAÇÃO
// ---------------------------------------------------------------------------

// A conta precisa escolher a organização? Sim, a menos que já tenha escolhido
// ou seja uma conta isenta (a gestaokore, que segue como está). Se a tabela
// ainda não existir (migração não rodada), responde "não" pra não travar o app.
export async function ownerSetupNeeded(userId: string): Promise<boolean> {
  try {
    const row = (await db.select().from(ownerSetups).where(eq(ownerSetups.userId, userId)))[0];
    if (row) return false;
    return !(await isOwnerSetupExempt(userId));
  } catch (error) {
    console.error("Não foi possível checar a organização da conta (migração rodada?):", error);
    return false;
  }
}

async function markSetupDone(userId: string) {
  await db.insert(ownerSetups).values({ userId }).onConflictDoNothing();
}

export async function keepOwnersAsIs(userId: string) {
  await markSetupDone(userId);
}

const countBy = async (table: any, ownerCol: any, userCol: any, userId: string) => {
  const rows = await db.select({ ownerId: ownerCol, n: sql<number>`count(*)::int` }).from(table).where(eq(userCol, userId)).groupBy(ownerCol);
  return new Map<string | null, number>(rows.map((r: any) => [r.ownerId, Number(r.n)]));
};

// Donos atuais com a informação de se têm algo ligado a eles, e quantos
// lançamentos antigos ainda estão sem dono (de antes do recurso de donos).
export async function loadOwnerSetupState(userId: string) {
  const list = await getOwners(userId);
  const [tx, fb, cc, ac] = await Promise.all([
    countBy(transactions, transactions.ownerId, transactions.userId, userId),
    countBy(fixedBills, fixedBills.ownerId, fixedBills.userId, userId),
    countBy(creditCards, creditCards.ownerId, creditCards.userId, userId),
    countBy(accounts, accounts.ownerId, accounts.userId, userId),
  ]);
  const existing: ExistingOwner[] = list.map((o) => ({
    id: o.id, name: o.name, kind: o.kind,
    hasData: [tx, fb, cc, ac].some((m) => (m.get(o.id) || 0) > 0),
  }));

  const legacy = { pf: 0, pj: 0 };
  for (const kind of ["pf", "pj"] as const) {
    const [t, f] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(transactions).where(and(eq(transactions.userId, userId), isNull(transactions.ownerId), eq(transactions.entityType, kind))),
      db.select({ n: sql<number>`count(*)::int` }).from(fixedBills).where(and(eq(fixedBills.userId, userId), isNull(fixedBills.ownerId), eq(fixedBills.entityType, kind))),
    ]);
    legacy[kind] = Number(t[0]?.n || 0) + Number(f[0]?.n || 0);
  }
  return { existing, legacy };
}

// Aplica a organização escolhida sem perder nada: reaproveita (e renomeia) os
// donos que já existem, cria os novos, junta os que saem no dono que fica e dá
// dono aos lançamentos antigos que ainda não tinham.
export async function applyOwnerSetup(userId: string, desired: OwnerSpec[]): Promise<{ success: boolean; message?: string }> {
  const { existing, legacy } = await loadOwnerSetupState(userId);

  const plan = planOwnerSetup(existing, desired);
  if (!plan.ok) return { success: false, message: plan.error };

  const hasKind = (k: "pf" | "pj") => plan.final.some((f) => f.kind === k);
  if (legacy.pf > 0 && !hasKind("pf")) return { success: false, message: "Você tem lançamentos de pessoa física sem dono. Inclua pelo menos um nome de pessoa (PF)." };
  if (legacy.pj > 0 && !hasKind("pj")) return { success: false, message: "Você tem lançamentos de empresa sem dono. Inclua pelo menos um nome de empresa (PJ)." };

  // 1) donos que ficam (renomeia/reordena) e novos
  const finalIds: string[] = [];
  for (let i = 0; i < plan.final.length; i++) {
    const f = plan.final[i];
    if (f.existingId) {
      await db.update(owners).set({ name: f.name, sortOrder: i }).where(and(eq(owners.id, f.existingId), eq(owners.userId, userId)));
      finalIds.push(f.existingId);
    } else {
      const created = await db.insert(owners).values({ userId, name: f.name, kind: f.kind, sortOrder: i }).returning({ id: owners.id });
      finalIds.push(created[0].id);
    }
  }

  // 2) donos que saem: tudo que era deles passa para o dono (do mesmo tipo) que fica
  for (const m of plan.merges) {
    if (m.intoIndex !== null) {
      const to = finalIds[m.intoIndex];
      await db.update(transactions).set({ ownerId: to }).where(and(eq(transactions.userId, userId), eq(transactions.ownerId, m.fromId)));
      await db.update(fixedBills).set({ ownerId: to }).where(and(eq(fixedBills.userId, userId), eq(fixedBills.ownerId, m.fromId)));
      await db.update(creditCards).set({ ownerId: to }).where(and(eq(creditCards.userId, userId), eq(creditCards.ownerId, m.fromId)));
      await db.update(accounts).set({ ownerId: to }).where(and(eq(accounts.userId, userId), eq(accounts.ownerId, m.fromId)));
    }
    await db.delete(owners).where(and(eq(owners.id, m.fromId), eq(owners.userId, userId)));
  }

  // 3) lançamentos e contas fixas antigos, sem dono: o primeiro dono do mesmo tipo
  for (const kind of ["pf", "pj"] as const) {
    const idx = plan.final.findIndex((f) => f.kind === kind);
    if (idx === -1) continue;
    const to = finalIds[idx];
    await db.update(transactions).set({ ownerId: to }).where(and(eq(transactions.userId, userId), isNull(transactions.ownerId), eq(transactions.entityType, kind)));
    await db.update(fixedBills).set({ ownerId: to }).where(and(eq(fixedBills.userId, userId), isNull(fixedBills.ownerId), eq(fixedBills.entityType, kind)));
  }
  // cartões sem dono: o primeiro dono
  await db.update(creditCards).set({ ownerId: finalIds[0] }).where(and(eq(creditCards.userId, userId), isNull(creditCards.ownerId)));

  await markSetupDone(userId);
  return { success: true };
}
