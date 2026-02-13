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
    const planType = session.metadata?.planType;

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
          planType: planType || 'monthly',
          status: 'active',
        });
        console.log(`✨ Usuário ${userId} criado como PRO.`);
      } else {
        // 3. Se já existe, atualiza para PRO
        await db.update(userSettings).set({
          stripeCustomerId: session.customer as string,
          planType: planType || 'monthly',
          status: 'active',
        }).where(eq(userSettings.userId, userId));
        console.log(`✅ Usuário ${userId} atualizado para PRO.`);
      }
    } catch (dbError: any) {
      console.error("❌ Erro de Banco no Webhook:", dbError.message);
      // Retornamos 500 para o Stripe tentar de novo se o banco oscilar
      return new Response("Erro de Banco", { status: 500 });
    }
  }

  // Retorna 200 para todos os outros eventos para o Stripe parar de dar erro no log
  return new Response("OK", { status: 200 });
}