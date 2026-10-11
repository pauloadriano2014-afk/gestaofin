// --- APRENDIZADO DE CATEGORIZAÇÃO (funções puras, sem banco) ---

const STOP_WORDS = new Set(["DE", "DA", "DO", "EM", "PARA", "COM", "LTDA", "SA", "EIRELI", "ME", "S/A"]);

// Frases fixas de extrato que não dizem de quem é a linha.
const BANK_PREFIX = /^(TRANSFERENCIA|TRANSF)\s+(RECEBIDA|ENVIADA)(\s+PELO\s+(PIX|TED|DOC))?\s*-?\s*|^(PIX|TED|DOC)\s+(RECEBIDO|ENVIADO)\s*-?\s*|^COMPRA\s+NO\s+(DEBITO|CREDITO)\s*-?\s*|^ESTORNO\s*-?\s*|^PAGAMENTO\s+(DE\s+)?(BOLETO|FATURA|CONTA)\s*-?\s*/;

// Palavras de extrato: um padrão feito só delas (regra antiga, aprendida antes
// desta proteção) é genérico demais e não deve decidir categoria.
const GENERIC_WORDS = new Set(["TRANSFERENCIA", "TRANSF", "RECEBIDA", "ENVIADA", "RECEBIDO", "ENVIADO", "PELO", "PIX", "TED", "DOC", "COMPRA", "NO", "DEBITO", "CREDITO", "ESTORNO", "PAGAMENTO", "BOLETO", "FATURA", "CONTA", "REEMBOLSO"]);
export function isGenericPattern(pattern: string): boolean {
  const words = (pattern || "").split(/\s+/).filter(Boolean);
  return words.length === 0 || words.every((w) => GENERIC_WORDS.has(w));
}

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

  // Tira o "texto padrão" do banco, que se repete em TODAS as linhas do mesmo tipo
  // ("Transferência recebida pelo Pix - ...", "Compra no débito - ..."): o que
  // identifica a linha é quem recebeu/enviou, não essa frase. Sem isso, toda
  // transferência Pix viraria a mesma regra.
  for (let i = 0; i < 3; i++) {
    const next = s.replace(BANK_PREFIX, "").trim();
    if (next === s) break;
    s = next;
  }

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

  rules = rules.filter((r) => !isGenericPattern(r.pattern));
  const exact = rules.find((r) => r.pattern === normalizedDesc && normalizedDesc.length >= 3);
  if (exact) return exact.categoryId;

  const partial = rules.find((r) => r.pattern.length >= 3 && upperDesc.includes(r.pattern));
  if (partial) return partial.categoryId;

  return null;
}
