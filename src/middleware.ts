import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define as rotas públicas
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)',
  '/api/webhooks/stripe'
]);

export default clerkMiddleware((auth, req) => {
  // 1. Pega o ID do usuário diretamente (isso não quebra)
  const { userId } = auth();

  // 2. Se o usuário NÃO estiver logado E a rota NÃO for pública
  if (!userId && !isPublicRoute(req)) {
    // 3. Força o redirecionamento manual para o login
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url); // Para voltar à página que ele queria
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    // Pula arquivos estáticos e imagens
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Roda em todas as rotas de API
    '/(api|trpc)(.*)',
  ],
};