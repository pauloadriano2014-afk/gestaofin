import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)',
  '/api/webhooks/stripe'
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