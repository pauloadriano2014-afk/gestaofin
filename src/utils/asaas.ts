// Conversão de cobranças do Asaas em lançamentos do KORE. Função pura, sem
// rede nem banco, pra poder ser testada. A chamada à API fica em
// src/app/asaasActions.ts.
//
// Campos usados de cada cobrança (GET /v3/payments):
//   id, description, value (valor cobrado), netValue (valor líquido, já sem a
//   taxa), paymentDate / confirmedDate / dueDate (YYYY-MM-DD), status.

export interface AsaasPayment {
  id: string;
  description?: string | null;
  value: number;
  netValue?: number | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  dueDate?: string | null;
  status?: string;
}

export interface MappedTransaction {
  externalId: string;
  description: string;
  amount: string; // sempre positivo, 2 casas
  type: "income" | "expense";
  date: string;
  isFee: boolean;
}

const RECEIVED = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

const cents = (n: number) => Math.round(n * 100);
const fmt = (c: number) => (c / 100).toFixed(2);

// Uma cobrança recebida vira a venda (entrada pelo valor cheio) e, se houve
// taxa (value - netValue), uma saída separada "Taxa Asaas". Assim a receita
// bate com o que o cliente pagou e a taxa aparece como custo, em vez de
// esconder a diferença dentro de um valor líquido.
export function mapAsaasPayment(p: AsaasPayment): MappedTransaction[] {
  if (!p || !p.id) return [];
  if (p.status && !RECEIVED.has(p.status)) return [];

  const date = p.paymentDate || p.confirmedDate || p.dueDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const gross = cents(Number(p.value));
  if (!Number.isFinite(gross) || gross <= 0) return [];

  const out: MappedTransaction[] = [{
    externalId: `asaas:pay:${p.id}`,
    description: (p.description?.trim() || "Venda Asaas").substring(0, 100),
    amount: fmt(gross),
    type: "income",
    date,
    isFee: false,
  }];

  if (p.netValue != null) {
    const fee = gross - cents(Number(p.netValue));
    if (Number.isFinite(fee) && fee > 0) {
      out.push({
        externalId: `asaas:fee:${p.id}`,
        description: `Taxa Asaas${p.description ? ` - ${p.description.trim()}` : ""}`.substring(0, 100),
        amount: fmt(fee),
        type: "expense",
        date,
        isFee: true,
      });
    }
  }
  return out;
}
