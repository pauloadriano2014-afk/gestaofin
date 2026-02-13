'use server'

import { redirect } from 'next/navigation';
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from 'stripe';
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

// Inicializa o Stripe com a chave secreta do .env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-01-28.clover', // Versão atualizada exigida pelo Stripe
});

export async function createCheckoutSession(planType: 'monthly' | 'quarterly' | 'semiannual' | 'annual') {
  // Garante autenticação segura
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return { url: null, error: "Você precisa estar logado." };
  }

  // Mapeia o nome do plano para o ID do preço no .env
  const priceMap = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    quarterly: process.env.STRIPE_PRICE_QUARTERLY,
    semiannual: process.env.STRIPE_PRICE_SEMIANNUAL,
    annual: process.env.STRIPE_PRICE_ANNUAL,
  };

  const priceId = priceMap[planType];

  if (!priceId) {
    console.error("ID do preço não encontrado no .env para:", planType);
    return { url: null, error: "Erro de configuração do plano (ID não encontrado)." };
  }

  try {
    // Tenta buscar o user_settings no banco para ver se já tem stripeCustomerId
    const dbUserResults = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    let dbUser = dbUserResults[0];

    // Se não existir na tabela user_settings, cria agora
    if (!dbUser) {
      await db.insert(userSettings).values({
        userId: userId,
        planType: 'free',
      });
      
      const newResults = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
      dbUser = newResults[0];
    }

    // Define ou recupera o Customer ID do Stripe
    let stripeCustomerId = dbUser?.stripeCustomerId;

    // Se o usuário ainda não tem um ID na Stripe, criamos um cliente lá
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.emailAddresses[0].emailAddress,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: userId, // Importante para o Webhook saber quem é
        }
      });
      stripeCustomerId = customer.id;

      // Salva o ID do cliente no nosso banco
      await db.update(userSettings)
        .set({ stripeCustomerId: stripeCustomerId })
        .where(eq(userSettings.userId, userId));
    }

    // Cria a sessão de Checkout (A tela de pagamento da Stripe)
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      
      // --- AJUSTE DE PAGAMENTO ---
      // Adicionamos 'boleto' pois ele está ativo no seu painel.
      // O 'pix' foi removido temporariamente para evitar o erro, já que não apareceu na sua lista de recorrentes.
      payment_method_types: ['card', 'boleto'], 
      // ---------------------------

      // Endereço e Telefone são OBRIGATÓRIOS para Boleto/PIX
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?canceled=true`,
      metadata: {
        userId: userId,
        planType: planType,
      },
    });

    if (!session.url) {
      return { url: null, error: "Erro ao gerar link de pagamento." };
    }

    // Retorna a URL para o front-end redirecionar
    return { url: session.url, error: null };

  } catch (error: any) {
    console.error("Erro no Stripe:", error);
    // Retorna a mensagem original do erro para facilitar o debug se acontecer de novo
    return { url: null, error: `Erro Stripe: ${error.message}` };
  }
}