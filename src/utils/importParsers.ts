// --- PARSERS DE IMPORTAÇÃO DE FATURA DE CARTÃO (CSV / OFX) ---
// Separado do parser de extrato bancário que já existe em page.tsx (esse
// aqui não mexe nele) porque a convenção de sinal é DIFERENTE: num extrato
// bancário, positivo = dinheiro que ENTROU (receita); numa fatura de
// cartão, positivo = uma COMPRA (despesa) e negativo é estorno/pagamento
// recebido. Por isso um parser dedicado, mesmo reaproveitando a mesma
// lógica de leitura de CSV.

export type RawImportRow = { date: string; amount: number; description: string };

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim());
}

export function normalizeHeaderCell(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Aceita "29.90"/"-0.99" (ponto decimal) e "1.234,56"/"29,90" (formato BR).
export function parseAmountValue(raw: string): number {
  let v = (raw || '').replace(/[^\d,.\-]/g, '');
  if (!v) return NaN;
  const hasComma = v.includes(',');
  const hasDot = v.includes('.');
  if (hasComma && hasDot) {
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
  } else if (hasComma) {
    v = v.replace(',', '.');
  }
  return parseFloat(v);
}

function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  // dd/mm/yyyy
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyy-mm-dd (já pronto)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// --- CSV DA FATURA ---
// Cabeçalhos variam bastante entre emissores (Nubank exporta em inglês:
// "date,title,amount"; outros usam português "Data,Descrição,Valor") — por
// isso o matching de coluna é tolerante aos dois idiomas.
const DATE_HEADERS = ['data', 'date'];
const AMOUNT_HEADERS = ['valor', 'amount', 'value'];
const DESC_HEADERS = ['descricao', 'titulo', 'title', 'historico', 'memo', 'name', 'estabelecimento'];

export function parseCardInvoiceCsv(text: string): RawImportRow[] {
  const lines = text.split(/\r\n|\n/);
  let headerIndex = -1;
  let columns: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCsvLine(lines[i]).map(normalizeHeaderCell);
    if (DATE_HEADERS.some((h) => cols.includes(h)) && AMOUNT_HEADERS.some((h) => cols.includes(h))) {
      headerIndex = i;
      columns = cols;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const dateIdx = columns.findIndex((c) => DATE_HEADERS.includes(c));
  const amountIdx = columns.findIndex((c) => AMOUNT_HEADERS.includes(c));
  const descIdx = columns.findIndex((c) => DESC_HEADERS.some((h) => c.includes(h)));

  const rows: RawImportRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseCsvLine(lines[i]);
    const dateRaw = (fields[dateIdx] || '').trim();
    const amountRaw = (fields[amountIdx] || '').trim();
    const descRaw = descIdx >= 0 ? (fields[descIdx] || '').trim() : '';

    const isoDate = toIsoDate(dateRaw);
    if (!isoDate) continue;

    const amount = parseAmountValue(amountRaw);
    if (Number.isNaN(amount)) continue;

    rows.push({ date: isoDate, amount, description: (descRaw || 'Item da fatura').substring(0, 200) });
  }
  return rows;
}

// --- OFX DA FATURA ---
// OFX (mesmo o "SGML" mais antigo, com tags sem fechamento) sempre tem os
// lançamentos dentro de blocos <STMTTRN>...</STMTTRN>, então dá pra extrair
// com regex em vez de precisar de um parser XML completo.
export function parseOfx(text: string): RawImportRow[] {
  const rows: RawImportRow[] = [];
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

  for (const block of blocks) {
    const dateMatch = block.match(/<DTPOSTED>([^\s<]+)/i);
    const amountMatch = block.match(/<TRNAMT>([^\s<]+)/i);
    const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i);
    const nameMatch = block.match(/<NAME>([^<\r\n]+)/i);

    if (!dateMatch || !amountMatch) continue;

    // DTPOSTED vem como YYYYMMDD ou YYYYMMDDHHMMSS[.xxx][fuso]
    const rawDate = dateMatch[1];
    const y = rawDate.substring(0, 4);
    const mo = rawDate.substring(4, 6);
    const d = rawDate.substring(6, 8);
    if (!y || !mo || !d) continue;

    const amount = parseFloat(amountMatch[1]);
    if (Number.isNaN(amount)) continue;

    const description = (memoMatch?.[1] || nameMatch?.[1] || 'Item da fatura').trim().substring(0, 200);
    rows.push({ date: `${y}-${mo}-${d}`, amount, description });
  }
  return rows;
}
