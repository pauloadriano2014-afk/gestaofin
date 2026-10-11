export const dynamic = 'force-dynamic';

// Rota leve e pública pra um monitor externo (UptimeRobot, cron-job.org etc)
// visitar de tempos em tempos e não deixar o serviço do Render dormir no plano
// free. Propositalmente NÃO acessa o banco: só acorda o servidor Next.
export async function GET() {
  // "commit" diz qual versão do código está rodando (útil pra conferir um deploy).
  return Response.json({ ok: true, commit: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7) }, { headers: { 'Cache-Control': 'no-store' } });
}

// Alguns monitores usam HEAD em vez de GET.
export async function HEAD() {
  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
