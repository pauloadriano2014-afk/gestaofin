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

-- ============================================================================
-- Como rodar:
--   Opção mais simples: "npx drizzle-kit push" (detecta sozinho comparando
--   com src/db/schema.ts e pergunta antes de aplicar).
--   Ou cole este arquivo direto no SQL editor do seu projeto Neon.
-- ============================================================================
