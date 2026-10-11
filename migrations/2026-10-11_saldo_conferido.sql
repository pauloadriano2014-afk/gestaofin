-- ============================================================================
-- KORE (gestaofin) — Migração: saldo conferido com o banco
-- Gerado em 11/10/2026
-- ============================================================================
-- Seguro de rodar mais de uma vez. Só CRIA uma tabela pequena com o saldo que
-- você conferiu no banco (por pessoa/empresa e data). Não altera nem apaga nenhum
-- lançamento. Sem ela o app funciona, só não mostra o "Saldo hoje" conferido.
-- ============================================================================

CREATE TABLE IF NOT EXISTS balance_checkpoints (
  user_id TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, owner_id)
);
