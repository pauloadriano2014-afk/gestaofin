import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define as rotas públicas (Login, Cadastro e Webhook do Stripe)
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)',
  '/api/webhooks/stripe'
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Se o usuário NÃO estiver logado E a rota NÃO for pública
  if (!userId && !isPublicRoute(req)) {
    
    // TRUQUE DO MESTRE: Força usar o endereço do site real, nunca o localhost
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gestaofin.onrender.com';
    
    const signInUrl = new URL('/sign-in', appUrl);
    signInUrl.searchParams.set('redirect_url', req.url); // Manda o usuário de volta para a página que ele tentou acessar
    
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};