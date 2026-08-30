'use server'

import { db } from "@/db";
import { categoryRules } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUser } from "./actions";
import { normalizeDescriptionPattern } from "@/utils/categoryRules";

// --- APRENDIZADO AUTOMÁTICO ---
// Chamado sempre que uma transação é salva/editada com uma categoria (lançamento
// manual, edição, ou confirmação da revisão de importação). Não sobrescreve
// regras criadas manualmente pelo usuário — só ajusta regras que a própria IA
// aprendeu sozinha, para não "brigar" com uma decisão explícita do usuário.
export async function learnCategoryRule(userId: string, description: string, categoryId: string) {
  try {
    if (!description || !categoryId) return;
    const pattern = normalizeDescriptionPattern(description);
    if (pattern.length < 3) return; // padrão curto demais não vale a pena guardar

    const existing = await db.select().from(categoryRules).where(
      and(eq(categoryRules.userId, userId), eq(categoryRules.pattern, pattern))
    );

    if (existing.length > 0) {
      const rule = existing[0];
      if (rule.source === "manual") return; // regra manual do usuário tem prioridade, não mexemos
      await db.update(categoryRules).set({
        categoryId,
        matchCount: (rule.matchCount || 0) + 1,
        updatedAt: new Date(),
      }).where(eq(categoryRules.id, rule.id));
    } else {
      await db.insert(categoryRules).values({ userId, pattern, categoryId, source: "auto", matchCount: 1 });
    }
  } catch (error) {
    console.error("Erro ao aprender regra de categorização:", error);
  }
}

// --- LISTAR REGRAS (para a tela de gerenciamento e para o import) ---
export async function getCategoryRules() {
  const userId = await getUser();
  if (!userId) return [];
  return db.select().from(categoryRules).where(eq(categoryRules.userId, userId)).orderBy(desc(categoryRules.updatedAt));
}

// --- CRIAR REGRA MANUAL ---
export async function createManualCategoryRule(pattern: string, categoryId: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const cleanPattern = pattern.trim().toUpperCase();
    if (cleanPattern.length < 2) return { success: false, message: "Digite pelo menos 2 letras." };
    if (!categoryId) return { success: false, message: "Escolha uma categoria." };

    await db.insert(categoryRules).values({ userId, pattern: cleanPattern, categoryId, source: "manual", matchCount: 1 });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao criar regra." };
  }
}

// --- EDITAR REGRA ---
export async function updateManualCategoryRule(id: string, pattern: string, categoryId: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    await db.update(categoryRules).set({
      pattern: pattern.trim().toUpperCase(),
      categoryId,
      updatedAt: new Date(),
    }).where(and(eq(categoryRules.id, id), eq(categoryRules.userId, userId)));

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false, message: "Erro ao atualizar regra." };
  }
}

// --- EXCLUIR REGRA ---
export async function deleteCategoryRule(id: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false };
    await db.delete(categoryRules).where(and(eq(categoryRules.id, id), eq(categoryRules.userId, userId)));
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
