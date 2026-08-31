-- ============================================================================
-- KORE (gestaofin) — Migração: correções críticas + novas funcionalidades
-- Gerado em 30/08/2026
-- ============================================================================
-- Todos os comandos abaixo são seguros de rodar mais de uma vez
-- (usam IF NOT EXISTS / verificações antes de alterar dados).
--
-- IMPORTANTE — leia antes de rodar:
-- O passo 1 corrige uma falha real do webhook da Stripe que fazia todo
-- cliente pagante continuar registrado como "free" no banco (o webhook
-- salvava o nome do plano, ex. 'monthly', em vez do texto "pro"). Se você já
-- tem assinantes pagando, rode este script para reclassificá-los como PRO
-- imediatamente — sem isso, eles só seriam corrigidos no próximo evento que
-- a Stripe mandar (ex. na próxima cobrança).
-- ============================================================================

-- 1) CORRIGE clientes pagantes que ficaram presos como "free"
--    (move o nome do plano pra billing_interval e marca plan_type = 'pro')
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS billing_interval TEXT;

UPDATE user_settings
SET billing_interval = plan_type,
    plan_type = 'pro'
WHERE plan_type IN ('monthly', 'quarterly', 'semiannual', 'annual')
  AND (status IS NULL OR status = 'active');

-- 2) Tabela de cartões de crédito
CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  closing_day INTEGER NOT NULL,
  due_day INTEGER NOT NULL,
  limit_amount NUMERIC(12, 2),
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- 3) Tabela de regras de categorização (aprendizado automático + manuais)
CREATE TABLE IF NOT EXISTS category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  source TEXT DEFAULT 'auto',
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 4) Novas colunas em transactions: data exata da baixa + cartão usado
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_at DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS credit_card_id UUID REFERENCES credit_cards(id);

-- 5) Valor da fatura do cartão declarado na mão (por cartão + mês)
--    Permite digitar direto "a fatura de agosto foi R$1.234,56" sem precisar
--    lançar compra por compra. Quando existe um valor aqui pra um
--    cartão+ciclo, ele SUBSTITUI o total calculado a partir das transações
--    daquele ciclo (nunca soma os dois).
CREATE TABLE IF NOT EXISTS credit_card_invoice_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  credit_card_id UUID NOT NULL REFERENCES credit_cards(id),
  cycle_key TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  paid_at DATE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 6) "Minhas Contas Fixas": molde de cada conta fixa (nome, categoria, dia de
--    vencimento e valor original) separado das transações que ele gera todo
--    mês. Permite comparar valor original x valor pago (juro/desconto).
CREATE TABLE IF NOT EXISTS fixed_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  original_amount NUMERIC(12, 2) NOT NULL,
  due_day INTEGER NOT NULL,
  entity_type TEXT DEFAULT 'pf',
  credit_card_id UUID REFERENCES credit_cards(id),
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- 7) Vínculo de cada transação com o molde da conta fixa + valor original
--    esperado daquela ocorrência específica (amount continua sendo o valor
--    efetivamente pago).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fixed_bill_id UUID REFERENCES fixed_bills(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12, 2);

-- ============================================================================
-- Como rodar:
--   Opção mais simples: "npx drizzle-kit push" (detecta sozinho comparando
--   com src/db/schema.ts e pergunta antes de aplicar).
--   Ou cole este arquivo direto no SQL editor do seu projeto Neon.
-- ============================================================================
