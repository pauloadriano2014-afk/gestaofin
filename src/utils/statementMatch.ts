// Casa as linhas de um EXTRATO do banco com os lançamentos já salvos (mesma data e mesmo valor),
// para descobrir de qual conta o dinheiro realmente saiu ou entrou. Função pura.

export interface StatementRow { date: string; amount: number; description: string }
export interface AppTx { id: string; date: string; amount: number; cashOwnerId: string | null }

const cents = (v: number) => Math.round(Math.abs(v) * 100) * (v < 0 ? -1 : 1);

// Para cada linha do extrato, procura um lançamento ainda livre (mesma data, mesmo valor com
// sinal). Prefere um que já esteja no nome desta conta; senão pega outro igual. Cada
// lançamento casa uma vez só. Devolve os pares e as linhas do extrato sem lançamento.
export function matchStatement(stmt: StatementRow[], txs: AppTx[], ownerId: string): { pairs: { i: number; id: string }[]; missing: number[] } {
  const byKey = new Map<string, AppTx[]>();
  for (const t of txs) {
    const k = `${t.date}|${cents(t.amount)}`;
    const list = byKey.get(k) ?? [];
    list.push(t);
    byKey.set(k, list);
  }
  const used = new Set<string>();
  const pairs: { i: number; id: string }[] = [];
  const missing: number[] = [];
  stmt.forEach((row, i) => {
    const list = (byKey.get(`${row.date}|${cents(row.amount)}`) ?? []).filter((t) => !used.has(t.id));
    const pick = list.find((t) => t.cashOwnerId === ownerId) ?? list[0];
    if (pick) { used.add(pick.id); pairs.push({ i, id: pick.id }); } else { missing.push(i); }
  });
  return { pairs, missing };
}

// Lê o CSV de extrato no formato "Data,Valor,Identificador,Descrição" (Nubank) ou parecido:
// data dd/mm/aaaa ou aaaa-mm-dd; valor com ponto ou vírgula decimal, negativo = saída.
export function parseStatementCsv(text: string): StatementRow[] {
  const lines = (text || "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const rows: StatementRow[] = [];
  for (const line of lines.slice(1)) {
    const c = split(line);
    if (c.length < 2) continue;
    const dm = c[0].trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/) || c[0].trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dm) continue;
    const date = dm[3].length === 4 && c[0].includes("/") ? `${dm[3]}-${dm[2]}-${dm[1]}` : c[0].trim();
    const raw = c[1].trim();
    const amount = /^-?\d+\.\d+$/.test(raw) || /^-?\d+$/.test(raw) ? Number(raw) : Number(raw.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount)) continue;
    rows.push({ date, amount, description: (c[c.length - 1] || c[2] || "").trim() });
  }
  return rows;
}
