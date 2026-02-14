import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define o que é público (Webhook do Stripe tem que ser público!)
const isPublicRoute = createRouteMatcher([
  '/api/webhooks/stripe'
]);

export default clerkMiddleware(async (auth, req) => {
  // Se não for público, protege e garante que o userId chegue no código
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
