// Regras de "visão" por dono. Mantido fora dos arquivos 'use server' pra poder
// ser usado tanto no servidor quanto no navegador.
//
// A visão (view) pode ser:
//   'all'      -> tudo
//   'pf'       -> todos os donos pessoa física juntos (o "Casal")
//   'pj'       -> todos os donos pessoa jurídica
//   <uuid>     -> um dono específico (uma pessoa ou empresa da conta)

export type OwnerView = string;

export function matchesView(
  t: { entityType?: string | null; ownerId?: string | null },
  view: OwnerView
): boolean {
  if (!view || view === "all") return true;
  if (view === "pf" || view === "pj") return t.entityType === view;
  return t.ownerId === view;
}

// Nome do grupo de pessoas físicas na barra de visões: 2 pessoas = "Casal",
// 3 ou mais = "Família". Com 1 pessoa não existe grupo.
export function personGroupLabel(pfCount: number): string {
  return pfCount >= 3 ? "Família" : "Casal";
}

export interface ViewOption { id: string; label: string; kind: "all" | "pf" | "pj" }

// Visões da barra do topo: Tudo, os grupos (só quando fazem sentido) e cada
// dono separado, com os nomes que a própria pessoa escolheu.
export function buildViewOptions(owners: { id: string; name: string; kind: string }[]): ViewOption[] {
  const pf = owners.filter((o) => o.kind === "pf");
  const pj = owners.filter((o) => o.kind === "pj");
  return [
    { id: "all", label: "Tudo", kind: "all" },
    ...(pf.length >= 2 ? [{ id: "pf", label: personGroupLabel(pf.length), kind: "pf" as const }] : []),
    ...(pj.length >= 2 ? [{ id: "pj", label: "Empresas", kind: "pj" as const }] : []),
    ...owners.map((o) => ({ id: o.id, label: o.name, kind: (o.kind === "pj" ? "pj" : "pf") as "pf" | "pj" })),
  ];
}
