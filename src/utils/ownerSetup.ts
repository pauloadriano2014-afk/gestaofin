// Organização da conta em "donos" (pessoas e empresas). Funções puras, sem
// banco: decidem como transformar os donos que a conta TEM hoje nos donos que
// a pessoa ESCOLHEU, sem perder nenhum lançamento.

export type OwnerKind = "pf" | "pj";

export interface OwnerSpec { name: string; kind: OwnerKind }
export interface ExistingOwner { id: string; name: string; kind: OwnerKind; hasData: boolean }

export interface PlanEntry { existingId: string | null; name: string; kind: OwnerKind }
export type PlanResult =
  | {
      ok: true;
      final: PlanEntry[]; // donos que ficam (existingId null = criar)
      // dono que sai: seus lançamentos vão para final[intoIndex]; null = nada a mover
      merges: { fromId: string; intoIndex: number | null }[];
    }
  | { ok: false; error: string };

export const MAX_OWNERS = 12;
const MAX_NAME = 40;

export function planOwnerSetup(existing: ExistingOwner[], desired: OwnerSpec[]): PlanResult {
  const cleaned = desired.map((d) => ({ name: (d.name || "").trim().replace(/\s+/g, " "), kind: d.kind === "pj" ? ("pj" as const) : ("pf" as const) }));

  if (cleaned.length === 0) return { ok: false, error: "Adicione pelo menos um nome." };
  if (cleaned.length > MAX_OWNERS) return { ok: false, error: `No máximo ${MAX_OWNERS} nomes.` };
  if (cleaned.some((d) => !d.name)) return { ok: false, error: "Todo nome precisa ser preenchido." };
  if (cleaned.some((d) => d.name.length > MAX_NAME)) return { ok: false, error: `Nomes de até ${MAX_NAME} letras.` };
  const lower = cleaned.map((d) => d.name.toLowerCase());
  if (new Set(lower).size !== lower.length) return { ok: false, error: "Há nomes repetidos." };

  const used = new Set<string>();
  const final: PlanEntry[] = cleaned.map((d) => ({ existingId: null, name: d.name, kind: d.kind }));

  // 1ª passada: mesmo nome e mesmo tipo reaproveita o dono existente.
  final.forEach((f) => {
    const match = existing.find((e) => !used.has(e.id) && e.kind === f.kind && e.name.trim().toLowerCase() === f.name.toLowerCase());
    if (match) { f.existingId = match.id; used.add(match.id); }
  });
  // 2ª passada: reaproveita (renomeando) o próximo dono existente do mesmo tipo.
  final.forEach((f) => {
    if (f.existingId) return;
    const match = existing.find((e) => !used.has(e.id) && e.kind === f.kind);
    if (match) { f.existingId = match.id; used.add(match.id); }
  });

  const merges: { fromId: string; intoIndex: number | null }[] = [];
  for (const e of existing) {
    if (used.has(e.id)) continue;
    const target = final.findIndex((f) => f.kind === e.kind);
    if (target === -1) {
      if (e.hasData) {
        const what = e.kind === "pj" ? "de empresa" : "de pessoa física";
        return { ok: false, error: `Você já tem lançamentos ${what}. Inclua pelo menos um nome ${e.kind === "pj" ? "de empresa (PJ)" : "de pessoa (PF)"} para recebê-los.` };
      }
      merges.push({ fromId: e.id, intoIndex: null });
    } else {
      merges.push({ fromId: e.id, intoIndex: target });
    }
  }
  return { ok: true, final, merges };
}

// ---------------------------------------------------------------------------
// Modelos prontos para escolher na primeira vez.
// ---------------------------------------------------------------------------

export interface SetupTemplate {
  id: string;
  title: string;
  description: string;
  // pontos de partida editáveis; o texto é só uma sugestão de nome
  owners: OwnerSpec[];
}

export const SETUP_TEMPLATES: SetupTemplate[] = [
  { id: "solo", title: "Só eu", description: "Finanças pessoais, uma pessoa.", owners: [{ name: "Eu", kind: "pf" }] },
  { id: "couple", title: "Casal", description: "Duas pessoas, com a visão de cada um e a visão conjunta.", owners: [{ name: "Eu", kind: "pf" }, { name: "Cônjuge", kind: "pf" }] },
  { id: "family", title: "Família", description: "Três ou mais pessoas, com visão de cada um e da família.", owners: [{ name: "Eu", kind: "pf" }, { name: "Cônjuge", kind: "pf" }, { name: "Filho(a)", kind: "pf" }] },
  { id: "solo-business", title: "Eu e minha empresa", description: "Pessoa física e pessoa jurídica separadas.", owners: [{ name: "Eu", kind: "pf" }, { name: "Minha empresa", kind: "pj" }] },
  { id: "couple-business", title: "Casal e empresa", description: "Duas pessoas e uma empresa.", owners: [{ name: "Eu", kind: "pf" }, { name: "Cônjuge", kind: "pf" }, { name: "Minha empresa", kind: "pj" }] },
  { id: "business", title: "Só empresa", description: "Apenas o financeiro de uma empresa.", owners: [{ name: "Minha empresa", kind: "pj" }] },
  { id: "custom", title: "Personalizado", description: "Monte do seu jeito, com os nomes que quiser.", owners: [{ name: "", kind: "pf" }] },
];
