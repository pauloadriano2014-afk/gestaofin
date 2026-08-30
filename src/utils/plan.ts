// --- HELPER CENTRAL DE PLANO PRO ---
// Antes desta função, cada arquivo comparava `planType === 'pro'` (ou pior,
// o webhook salvava o NOME do plano — 'monthly' | 'quarterly' | 'semiannual'
// | 'annual' — em vez do literal "pro", então clientes pagantes nunca eram
// reconhecidos como PRO). Esta função central resolve isso e também
// considera o status da assinatura (cancelada/inadimplente deixa de contar
// como PRO), servindo tanto para registros antigos (planType = nome do
// plano) quanto para os novos (planType = 'pro').

const PAID_PLAN_TYPES = ["monthly", "quarterly", "semiannual", "annual", "pro"];

export function isPlanPro(planType?: string | null, status?: string | null): boolean {
  if (!planType) return false;
  const normalizedPlan = String(planType).trim().toLowerCase();

  if (normalizedPlan === "free" || !PAID_PLAN_TYPES.includes(normalizedPlan)) {
    return false;
  }

  // Registros antigos podem não ter status salvo; nesse caso não bloqueamos.
  if (!status) return true;

  const normalizedStatus = String(status).trim().toLowerCase();
  return normalizedStatus === "active";
}
