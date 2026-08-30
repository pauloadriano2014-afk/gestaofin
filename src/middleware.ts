import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  // 🔥 CORRIGIDO: a rota real do webhook é /api/webhook/stripe (singular),
  // não /api/webhooks/stripe. Com o nome errado aqui, o middleware do Clerk
  // barrava TODA chamada da Stripe (redirecionava pro login), então nenhuma
  // assinatura era confirmada no banco.
  '/api/webhook/stripe',
  '/manifest.json',         // 🔥 PASSE LIVRE PARA O PWA
  '/manifest.webmanifest',  // 🔥 PASSE LIVRE PARA O PWA
  '/favicon.ico',           // 🔥 PASSE LIVRE PARA ÍCONES
  '/logo.png'               // 🔥 PASSE LIVRE PARA A LOGO
]);

export default clerkMiddleware(async (auth, req) => {
  const session = await auth();

  // Se o usuário NÃO estiver logado e a rota NÃO for pública
  if (!session.userId && !isPublicRoute(req)) {
    // Redireciona para o login oficial do Clerk (modo desenvolvimento)
    return session.redirectToSignIn();
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};