import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define as rotas que não precisam de login
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)',
  '/api/webhooks/stripe'
]);

export default clerkMiddleware(async (auth, req) => {
  // Se não for rota pública, o protect() cuida do redirecionamento
  // No modo Teste, ele te manda para o portal do Clerk automaticamente
  if (!isPublicRoute(req)) {
    await auth().protect();
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