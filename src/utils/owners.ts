// Regras de "visão" por dono. Mantido fora dos arquivos 'use server' pra poder
// ser usado tanto no servidor quanto no navegador.
//
// A visão (view) pode ser:
//   'all'      -> tudo
//   'pf'       -> todos os donos pessoa física juntos (o "Casal")
//   'pj'       -> todos os donos pessoa jurídica
//   <uuid>     -> um dono específico (Paulo, Adri, Empresa...)

export type OwnerView = string;

export function matchesView(
  t: { entityType?: string | null; ownerId?: string | null },
  view: OwnerView
): boolean {
  if (!view || view === "all") return true;
  if (view === "pf" || view === "pj") return t.entityType === view;
  return t.ownerId === view;
}
