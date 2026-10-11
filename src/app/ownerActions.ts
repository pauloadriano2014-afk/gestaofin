'use server'

import { db } from "@/db";
import { owners, accounts } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUser } from "./actions";
import { ensureOwners } from "@/db/owners";

// --- DONOS (Paulo, Adri, Empresa...) E CONTAS ---

export async function getOwnersAndAccounts() {
  const userId = await getUser();
  if (!userId) return { owners: [], accounts: [] };
  const ownerList = await ensureOwners(userId);
  const accountList = await db.select().from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.archived, false)))
    .orderBy(asc(accounts.name));
  return { owners: ownerList, accounts: accountList };
}

export async function createOwner(data: { name: string; kind: "pf" | "pj" }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!data.name?.trim()) return { success: false, message: "Dê um nome." };
    const existing = await ensureOwners(userId);
    await db.insert(owners).values({
      userId,
      name: data.name.trim(),
      kind: data.kind === "pj" ? "pj" : "pf",
      sortOrder: existing.length,
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar dono:", error);
    return { success: false, message: "Erro ao criar." };
  }
}

// Renomear não mexe no tipo (PF/PJ): trocar o tipo mudaria o entityType de
// todos os lançamentos já gravados, então fica fora de propósito.
export async function renameOwner(id: string, name: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!name?.trim()) return { success: false, message: "Dê um nome." };
    await db.update(owners).set({ name: name.trim() }).where(and(eq(owners.id, id), eq(owners.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao renomear." };
  }
}

export async function createAccount(data: {
  name: string; ownerId: string; institution?: string; kind?: "checking" | "gateway" | "cash";
}) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!data.name?.trim()) return { success: false, message: "Dê um nome pra conta." };
    const ownerList = await ensureOwners(userId);
    if (!ownerList.some((o) => o.id === data.ownerId)) return { success: false, message: "Escolha o dono da conta." };
    await db.insert(accounts).values({
      userId,
      ownerId: data.ownerId,
      name: data.name.trim(),
      institution: data.institution?.trim() || null,
      kind: data.kind ?? "checking",
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return { success: false, message: "Erro ao criar conta." };
  }
}

export async function updateAccount(id: string, data: { name: string; ownerId: string; institution?: string }) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    if (!data.name?.trim()) return { success: false, message: "Dê um nome pra conta." };
    const ownerList = await ensureOwners(userId);
    if (!ownerList.some((o) => o.id === data.ownerId)) return { success: false, message: "Escolha o dono da conta." };
    await db.update(accounts).set({
      name: data.name.trim(),
      ownerId: data.ownerId,
      institution: data.institution?.trim() || null,
    }).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao atualizar conta." };
  }
}

// "Excluir" só arquiva, pra não quebrar o histórico de lançamentos já vinculados.
export async function setAccountArchived(id: string, archived: boolean) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    await db.update(accounts).set({ archived }).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao arquivar conta." };
  }
}
