import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 1. Define as rotas públicas
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)',
  '/api/webhooks/stripe'
]);

export default clerkMiddleware(async (auth, req) => {
  // 2. Se a rota NÃO for pública, protege
  if (!isPublicRoute(req)) {
    const authObject = await auth();
    authObject.protect();
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