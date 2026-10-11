'use server'

import { db } from "@/db";
import { owners, accounts } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUser } from "./actions";
import { getOwners, loadOwnerSetupState, applyOwnerSetup, keepOwnersAsIs } from "@/db/owners";
import type { OwnerSpec } from "@/utils/ownerSetup";

// --- DONOS (pessoas e empresas da conta) E CONTAS ---

export async function getOwnersAndAccounts() {
  const userId = await getUser();
  if (!userId) return { owners: [], accounts: [] };
  const ownerList = await getOwners(userId);
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
    const existing = await getOwners(userId);
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
    const ownerList = await getOwners(userId);
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
    const ownerList = await getOwners(userId);
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

// --- ORGANIZAÇÃO DA CONTA (só eu, casal, família, empresa, nomes livres) ---

// Estado atual pra tela de escolha: quem já existe (e se tem dados) e quantos
// lançamentos antigos ainda estão sem dono.
export async function getOwnerSetup() {
  const userId = await getUser();
  if (!userId) return { owners: [], legacy: { pf: 0, pj: 0 } };
  const { existing, legacy } = await loadOwnerSetupState(userId);
  return { owners: existing, legacy };
}

export async function saveOwnerSetup(desired: OwnerSpec[]) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    const res = await applyOwnerSetup(userId, desired);
    if (res.success) revalidatePath("/");
    return res;
  } catch (error) {
    console.error("Erro ao salvar a organização da conta:", error);
    return { success: false, message: "Não foi possível salvar. Tente de novo." };
  }
}

// "Manter como está": só para quem já tem donos e não quer mudar nada.
export async function confirmCurrentOwners() {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };
    const owners = await getOwners(userId);
    if (owners.length === 0) return { success: false, message: "Escolha uma organização." };
    await keepOwnersAsIs(userId);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Não foi possível salvar." };
  }
}
