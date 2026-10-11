-- ============================================================================
-- KORE (gestaofin) — Migração: donos (Paulo / Adri / Empresa) e contas
-- Gerado em 11/10/2026
-- ============================================================================
-- Seguro de rodar mais de uma vez (IF NOT EXISTS). Só CRIA tabelas e colunas
-- novas; não altera nem apaga nenhum dado existente.
--
-- O preenchimento dos donos nos lançamentos antigos NÃO é feito aqui: o app
-- faz isso sozinho no primeiro acesso de cada usuário (ver
-- src/db/owners.ts -> ensureOwners). Regra do preenchimento:
--   lançamentos PF -> dono "Paulo"      lançamentos PJ -> dono "Empresa"
-- Depois você reclassifica o que for da Adri pela própria tela.
-- ============================================================================

CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pf',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owners_user_idx ON owners (user_id);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  owner_id UUID REFERENCES owners(id),
  name TEXT NOT NULL,
  institution TEXT,
  kind TEXT NOT NULL DEFAULT 'checking',
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts (user_id);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
ALTER TABLE fixed_bills  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id);
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES owners(id);

CREATE INDEX IF NOT EXISTS transactions_owner_idx ON transactions (owner_id);
