// Cor de destaque por "contexto" (quem estou olhando), pra nunca confundir se
// o que estou vendo/lançando é do Paulo, da Adri, da Empresa ou de todos.
// As classes ficam escritas por extenso de propósito: o Tailwind só gera as
// classes que aparecem literalmente no código.

export interface Accent {
  id: string;
  bar: string;        // faixa fina no topo da área de conteúdo
  dot: string;        // bolinha ao lado do nome
  chipActive: string; // botão do dono selecionado
  soft: string;       // etiquetas suaves
}

const NEUTRAL: Accent = { id: "neutral", bar: "bg-slate-400", dot: "bg-slate-400", chipActive: "", soft: "bg-slate-500/10 text-slate-600" };
const COUPLE: Accent = { id: "couple", bar: "bg-emerald-500", dot: "bg-emerald-500", chipActive: "bg-emerald-600 text-white shadow-md", soft: "bg-emerald-500/10 text-emerald-700" };
const COMPANY: Accent = { id: "company", bar: "bg-cyan-600", dot: "bg-cyan-600", chipActive: "bg-cyan-600 text-white shadow-md", soft: "bg-cyan-600/10 text-cyan-700" };

const PEOPLE: Accent[] = [
  { id: "p0", bar: "bg-indigo-500", dot: "bg-indigo-500", chipActive: "bg-indigo-600 text-white shadow-md", soft: "bg-indigo-500/10 text-indigo-700" },
  { id: "p1", bar: "bg-rose-500", dot: "bg-rose-500", chipActive: "bg-rose-600 text-white shadow-md", soft: "bg-rose-500/10 text-rose-700" },
  { id: "p2", bar: "bg-amber-500", dot: "bg-amber-500", chipActive: "bg-amber-600 text-white shadow-md", soft: "bg-amber-500/10 text-amber-700" },
  { id: "p3", bar: "bg-teal-500", dot: "bg-teal-500", chipActive: "bg-teal-600 text-white shadow-md", soft: "bg-teal-500/10 text-teal-700" },
];

// view: 'all' | 'pf' (Casal) | 'pj' | id de um dono.
export function accentFor(view: string, owners: { id: string; kind: string }[]): Accent {
  if (!view || view === "all") return NEUTRAL;
  if (view === "pf") return COUPLE;
  if (view === "pj") return COMPANY;
  const owner = owners.find((o) => o.id === view);
  if (!owner) return NEUTRAL;
  if (owner.kind === "pj") return COMPANY;
  const idx = owners.filter((o) => o.kind === "pf").findIndex((o) => o.id === view);
  return PEOPLE[Math.max(idx, 0) % PEOPLE.length];
}
