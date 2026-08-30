// --- APRENDIZADO DE CATEGORIZAÇÃO (funções puras, sem banco) ---

const STOP_WORDS = new Set(["DE", "DA", "DO", "EM", "PARA", "COM", "LTDA", "SA", "EIRELI", "ME", "S/A"]);

// Reduz uma descrição de transação a um "padrão" estável, ignorando números,
// datas e identificadores que mudam a cada compra (mas o nome do
// estabelecimento costuma se manter). Ex:
//   "UBER *TRIP 8005928996"        -> "UBER"
//   "UBER   *TRIP HELP.UBER.COM"   -> "UBER"
//   "IFOOD *IFD1234567 SAO PAULO"  -> "IFOOD"
//   "Pagamento de Energia Elétrica - CEMIG" -> "PAGAMENTO ENERGIA ELETRICA" (sem pontuação/acento)
export function normalizeDescriptionPattern(description: string): string {
  if (!description) return "";

  let s = description.toUpperCase().trim();
  // Remove acentos (NFD separa a letra da marca de acento, aqui removemos a marca).
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Corta a partir de blocos que normalmente são identificador/número/data,
  // não parte do nome do estabelecimento.
  s = s.split(/\d{2,}|\*|\d{2}\/\d{2}|\s#/)[0];

  s = s.replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const words = s.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return words.slice(0, 3).join(" ").trim();
}

export interface CategoryRuleLike {
  pattern: string;
  categoryId: string;
}

// Procura, entre as regras do usuário, uma categoria compatível com a
// descrição informada. Prioriza match exato do padrão normalizado
// (regras aprendidas automaticamente); cai para "contém" quando a regra é
// mais curta/específica (bom para regras manuais como "NETFLIX", "UBER").
export function findMatchingRuleCategoryId(description: string, rules: CategoryRuleLike[]): string | null {
  if (!description || rules.length === 0) return null;

  const normalizedDesc = normalizeDescriptionPattern(description);
  const upperDesc = description.toUpperCase();

  const exact = rules.find((r) => r.pattern === normalizedDesc && normalizedDesc.length >= 3);
  if (exact) return exact.categoryId;

  const partial = rules.find((r) => r.pattern.length >= 3 && upperDesc.includes(r.pattern));
  if (partial) return partial.categoryId;

  return null;
}
