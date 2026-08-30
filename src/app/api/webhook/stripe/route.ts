export const dynamic = 'force-dynamic'; // Adicione esta linha aqui!
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

export async function POST(req: Request) {
  const body = await req.text();
  // No Next.js 15, o headers() precisa ser invocado e a assinatura lida assim:
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (error: any) {
    console.error(`❌ Erro de Assinatura: ${error.message}`);
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // Se o evento for de checkout completo
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    // 🔥 CORRIGIDO: "planType" aqui guardava o NOME do plano vendido
    // ('monthly', 'quarterly'...), mas em todo o resto do sistema (actions.ts)
    // o acesso PRO é liberado checando se planType === 'pro'. Como esse valor
    // nunca era literalmente 'pro', TODO cliente que pagava continuava
    // bloqueado como "free" depois do pagamento — a única forma de virar PRO
    // era estar na lista VIP_USERS hardcoded. Agora guardamos o valor real do
    // plano em billingInterval (útil pra saber o que ele assinou) e sempre
    // gravamos planType: 'pro'.
    const billingInterval = session.metadata?.planType || 'monthly';
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    if (!userId) {
      return new Response("UserId faltando", { status: 200 });
    }

    try {
      // 1. Verifica se o usuário já existe na tabela
      const existingUser = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

      if (existingUser.length === 0) {
        // 2. Se não existe (usuário antigo), cria agora
        await db.insert(userSettings).values({
          userId: userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscriptionId,
          planType: 'pro',
          billingInterval: billingInterval,
          status: 'active',
        });
        console.log(`✨ Usuário ${userId} criado como PRO (${billingInterval}).`);
      } else {
        // 3. Se já existe, atualiza para PRO
        await db.update(userSettings).set({
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscriptionId,
          planType: 'pro',
          billingInterval: billingInterval,
          status: 'active',
        }).where(eq(userSettings.userId, userId));
        console.log(`✅ Usuário ${userId} atualizado para PRO (${billingInterval}).`);
      }
    } catch (dbError: any) {
      console.error("❌ Erro de Banco no Webhook:", dbError.message);
      // Retornamos 500 para o Stripe tentar de novo se o banco oscilar
      return new Response("Erro de Banco", { status: 500 });
    }
  }

  // 🔥 NOVO: sem isso, uma assinatura cancelada ou com pagamento recusado
  // nunca rebaixava o usuário — ele continuava PRO pra sempre depois de
  // cancelar, e o Stripe.exe/painel podia mostrar "cancelado" enquanto o
  // app continuava liberando tudo.
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

    try {
      const isCanceled = event.type === "customer.subscription.deleted" || subscription.status === 'canceled' || subscription.status === 'unpaid';
      const isPastDue = subscription.status === 'past_due';

      await db.update(userSettings).set({
        status: isCanceled ? 'canceled' : isPastDue ? 'past_due' : 'active',
        planType: isCanceled ? 'free' : 'pro',
      }).where(eq(userSettings.stripeCustomerId, customerId));

      console.log(`🔄 Assinatura do cliente ${customerId} atualizada: status=${subscription.status}`);
    } catch (dbError: any) {
      console.error("❌ Erro ao atualizar assinatura no Webhook:", dbError.message);
      return new Response("Erro de Banco", { status: 500 });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (customerId) {
      try {
        await db.update(userSettings).set({ status: 'past_due' }).where(eq(userSettings.stripeCustomerId, customerId));
        console.log(`⚠️ Pagamento falhou para o cliente ${customerId}, marcado como past_due.`);
      } catch (dbError: any) {
        console.error("❌ Erro ao marcar past_due no Webhook:", dbError.message);
      }
    }
  }

  // Retorna 200 para todos os outros eventos para o Stripe parar de dar erro no log
  return new Response("OK", { status: 200 });
}