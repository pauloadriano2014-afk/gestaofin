-- ============================================================================
-- KORE (gestaofin) — Migração: identificador externo (sincronização Asaas)
-- Gerado em 11/10/2026
-- ============================================================================
-- Seguro de rodar mais de uma vez. Permite sincronizar vendas do Asaas várias
-- vezes sem duplicar: cada venda/taxa vira um lançamento com external_id único
-- por usuário. Lançamentos manuais ficam com external_id nulo e não são afetados.
-- ============================================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_uidx
  ON transactions (user_id, external_id)
  WHERE external_id IS NOT NULL;
