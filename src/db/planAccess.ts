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

// A checagem por e-mail é uma chamada de rede ao Clerk; guardamos o resultado
// por alguns minutos pra não repetir a cada carregamento de tela.
const MASTER_CACHE_TTL_MS = 10 * 60 * 1000;
const masterCache = new Map<string, { value: boolean; at: number }>();

export async function isMasterUser(userId: string): Promise<boolean> {
  if (MASTER_USER_IDS.includes(userId)) return true;

  const cached = masterCache.get(userId);
  if (cached && Date.now() - cached.at < MASTER_CACHE_TTL_MS) return cached.value;

  try {
    const user = await currentUser();
    if (!user || user.id !== userId) return false;
    const value = hasVerifiedMasterEmail(user.emailAddresses);
    masterCache.set(userId, { value, at: Date.now() });
    return value;
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
// Ordem pensada pra ser rápida: assinatura ativa no banco resolve com UMA
// consulta, sem chamar o Clerk. Só quando o banco diz "não é PRO" é que se
// confere se é conta master (e, sendo, o registro é consertado).
const ensuredMasters = new Set<string>();

export async function resolveIsPro(userId: string): Promise<boolean> {
  if (MASTER_USER_IDS.includes(userId)) {
    if (!ensuredMasters.has(userId)) { await ensureMasterRow(userId); ensuredMasters.add(userId); }
    return true;
  }

  const row = (await db.select().from(userSettings).where(eq(userSettings.userId, userId)))[0];
  if (isPlanPro(row?.planType, row?.status)) return true;

  if (await isMasterUser(userId)) {
    await ensureMasterRow(userId);
    return true;
  }
  return false;
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

// --- CONTAS QUE NÃO PASSAM PELA ESCOLHA DE ORGANIZAÇÃO ---
// Contas que já usam a organização atual (donos Paulo / Adri / Empresa) e não
// devem ser mexidas: ficam como estão e nunca veem a tela de escolha.
// Por padrão, só a gestaokore@outlook.com. Dá pra somar e-mails sem mexer no
// código com a variável OWNER_SETUP_EXEMPT_EMAILS="a@x.com,b@y.com".
const SETUP_EXEMPT_EMAILS = new Set(
  ["gestaokore@outlook.com", ...(process.env.OWNER_SETUP_EXEMPT_EMAILS || "").split(",")]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);
const exemptCache = new Map<string, { value: boolean; at: number }>();

export async function isOwnerSetupExempt(userId: string): Promise<boolean> {
  const cached = exemptCache.get(userId);
  if (cached && Date.now() - cached.at < MASTER_CACHE_TTL_MS) return cached.value;
  try {
    const user = await currentUser();
    if (!user || user.id !== userId) return false;
    const value = user.emailAddresses.some(
      (e) => e.verification?.status === "verified" && SETUP_EXEMPT_EMAILS.has(e.emailAddress.trim().toLowerCase())
    );
    exemptCache.set(userId, { value, at: Date.now() });
    return value;
  } catch (error) {
    console.error("Falha ao checar conta isenta no Clerk:", error);
    return false;
  }
}
