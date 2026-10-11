'use server'

import { db } from "@/db";
import { accounts, transactions, categoryRules } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUser } from "./actions";
import { getOwners } from "@/db/owners";
import { mapAsaasPayment, type AsaasPayment } from "@/utils/asaas";
import { findMatchingRuleCategoryId } from "@/utils/categoryRules";
import { loadUserRules } from "@/db/rules";

// --- SINCRONIZAÇÃO DAS VENDAS DO ASAAS ---
// Puxa as cobranças RECEBIDAS no período direto da API do Asaas e lança como
// entrada (+ a taxa como saída) na conta "Asaas". Pode rodar quantas vezes
// quiser: cada cobrança tem um external_id único, então não duplica.
//
// Configuração (variáveis de ambiente, nunca no código):
//   ASAAS_API_KEY  -> chave de API (Asaas: Integrações > Chave de API)
//   ASAAS_API_URL  -> opcional; padrão https://api.asaas.com/v3
//                     (sandbox: https://api-sandbox.asaas.com/v3)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 100;
const MAX_PAGES = 20; // trava de segurança: 2.000 cobranças por sincronização

export async function syncAsaasPayments(startDate: string, endDate: string) {
  try {
    const userId = await getUser();
    if (!userId) return { success: false, message: "Login necessário." };

    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) return { success: false, message: "Chave do Asaas não configurada. Defina ASAAS_API_KEY no ambiente." };
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return { success: false, message: "Período inválido." };

    const baseUrl = (process.env.ASAAS_API_URL || "https://api.asaas.com/v3").replace(/\/$/, "");

    // 1. Conta "Asaas" (cria na primeira vez, no dono PJ).
    const ownerList = await getOwners(userId);
    let account = (await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.institution, "asaas"), eq(accounts.archived, false))))[0];
    if (!account) {
      const owner = ownerList.find((o) => o.kind === "pj") ?? ownerList[0];
      account = (await db.insert(accounts).values({ userId, ownerId: owner?.id ?? null, name: "Asaas", institution: "asaas", kind: "gateway" }).returning())[0];
    }
    const owner = ownerList.find((o) => o.id === account.ownerId) ?? ownerList[0];

    // 2. Busca as cobranças recebidas, página por página.
    const payments: AsaasPayment[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const qs = new URLSearchParams({
        status: "RECEIVED",
        "paymentDate[ge]": startDate,
        "paymentDate[le]": endDate,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      const res = await fetch(`${baseUrl}/payments?${qs}`, {
        headers: { access_token: apiKey, "Content-Type": "application/json", "User-Agent": "KORE-gestaofin" },
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("Asaas respondeu", res.status, await res.text().catch(() => ""));
        return { success: false, message: res.status === 401 ? "O Asaas recusou a chave (401). Confira ASAAS_API_KEY e o ambiente (produção x sandbox)." : `O Asaas respondeu com erro ${res.status}.` };
      }
      const body = await res.json();
      payments.push(...(body.data || []));
      if (!body.hasMore) break;
    }

    // 3. Converte e grava (ignora o que já foi sincronizado antes).
    const rules = await loadUserRules(userId);
    const rows = payments.flatMap(mapAsaasPayment).map((m) => ({
      userId,
      description: m.description,
      amount: m.amount,
      type: m.type,
      date: m.date,
      categoryId: findMatchingRuleCategoryId(m.description, rules) || null,
      isFixed: false,
      isPaid: true,
      paidAt: m.date,
      entityType: owner?.kind ?? "pj",
      ownerId: account.ownerId,
      accountId: account.id,
      externalId: m.externalId,
      aiTags: ["asaas"],
    }));

    let inserted = 0;
    if (rows.length > 0) {
      const result = await db.insert(transactions).values(rows).onConflictDoNothing().returning({ id: transactions.id });
      inserted = result.length;
    }

    revalidatePath("/");
    return { success: true, fetched: payments.length, inserted, skipped: rows.length - inserted };
  } catch (error) {
    console.error("Erro ao sincronizar Asaas:", error);
    return { success: false, message: "Erro ao sincronizar com o Asaas." };
  }
}
