import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isPlanPro } from "@/utils/plan";

// --- ACESSO PRO: ÚNICO LUGAR QUE DECIDE ---
// Contas master (as suas) NUNCA perdem o PRO, aconteça o que acontecer com a
// assinatura na Stripe (cancelamento, cobrança recusada, webhook, banco).
//
// Uma conta é master se:
//  1. o ID do Clerk está na lista abaixo (as contas que já eram VIP), OU
//  2. algum e-mail VERIFICADO dela está em MASTER_EMAILS. Isso cobre
//     gestaokore@outlook.com e paulo_adriano2014@live.com sem depender de eu
//     saber qual ID é de qual. E-mail não verificado não vale.
//
// Dá pra incluir mais e-mails sem mexer no código: variável de ambiente
// MASTER_EMAILS="a@x.com,b@y.com" (somada a estes).

const MASTER_USER_IDS = [
  "user_39lFK9Lr5j7Y5lg1e4ZPwb6ZTx8", // Paulo e Gestão Kore (antigo)
  "user_39obnDo2iFblIK7qxNyKkL0H8Hn", // Adrielle
  "user_39ocZfmiOfwA0Q3mXpJ158M3Nkw", // ID novo
];

const MASTER_EMAILS = new Set(
  ["gestaokore@outlook.com", "paulo_adriano2014@live.com", ...(process.env.MASTER_EMAILS || "").split(",")]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isMasterEmail(email: string): boolean {
  return MASTER_EMAILS.has(email.trim().toLowerCase());
}

type ClerkEmailLike = { emailAddress: string; verification?: { status?: string } | null };
const hasVerifiedMasterEmail = (emails: ClerkEmailLike[]) =>
  emails.some((e) => e.verification?.status === "verified" && isMasterEmail(e.emailAddress));

export async function isMasterUser(userId: string): Promise<boolean> {
  if (MASTER_USER_IDS.includes(userId)) return true;
  try {
    const user = await currentUser();
    if (!user || user.id !== userId) return false;
    return hasVerifiedMasterEmail(user.emailAddresses);
  } catch (error) {
    // Se o Clerk falhar, não derruba ninguém: cai pro que está gravado no banco
    // (contas master ficam gravadas como PRO ativo, ver ensureMasterRow).
    console.error("Falha ao checar conta master no Clerk:", error);
    return false;
  }
}

// Grava a conta master como PRO ativo no banco. Assim, mesmo que o Clerk
// esteja fora do ar num momento, o plano gravado continua valendo, e a tela
// de planos/cobrança não enxerga essa conta como "free".
async function ensureMasterRow(userId: string) {
  try {
    const existing = (await db.select().from(userSettings).where(eq(userSettings.userId, userId)))[0];
    if (existing && existing.planType === "pro" && existing.status === "active") return;
    await db
      .insert(userSettings)
      .values({ userId, planType: "pro", status: "active" })
      .onConflictDoUpdate({ target: userSettings.userId, set: { planType: "pro", status: "active" } });
  } catch (error) {
    console.error("Falha ao gravar conta master:", error);
  }
}

// true = tem acesso PRO (master, ou assinatura ativa).
export async function resolveIsPro(userId: string): Promise<boolean> {
  if (await isMasterUser(userId)) {
    await ensureMasterRow(userId);
    return true;
  }
  const row = (await db.select().from(userSettings).where(eq(userSettings.userId, userId)))[0];
  return isPlanPro(row?.planType, row?.status);
}

// Usado pelo webhook da Stripe, que roda sem usuário logado: descobre o dono do
// customerId e checa se é conta master (por ID ou e-mail verificado no Clerk).
// Se não der pra descobrir, responde false — o webhook então segue o fluxo normal.
export async function isMasterStripeCustomer(stripeCustomerId: string): Promise<boolean> {
  try {
    const row = (await db.select().from(userSettings).where(eq(userSettings.stripeCustomerId, stripeCustomerId)))[0];
    if (!row) return false;
    if (MASTER_USER_IDS.includes(row.userId)) return true;
    const client = await clerkClient();
    const user = await client.users.getUser(row.userId);
    return hasVerifiedMasterEmail(user.emailAddresses);
  } catch (error) {
    console.error("Falha ao checar conta master pelo cliente Stripe:", error);
    return false;
  }
}
