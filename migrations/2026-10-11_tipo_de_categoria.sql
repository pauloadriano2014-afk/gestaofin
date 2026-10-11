-- ============================================================================
-- KORE (gestaofin) — Migração: tipo explícito de categoria
-- Gerado em 11/10/2026
-- ============================================================================
-- Seguro de rodar mais de uma vez. Antes o app reconhecia "Investimentos",
-- "Cartão de Crédito" e "Reembolsos" pelo NOME da categoria; renomear uma
-- delas quebrava as contas sem aviso. Agora o tipo fica gravado.
--
-- O backfill só preenche categorias SEM tipo (kind IS NULL) e usa exatamente
-- a mesma regra de nome que o app usava, então nenhum número muda.
-- ============================================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS kind TEXT;

UPDATE categories SET kind = CASE
  WHEN lower(name) LIKE '%investimento%'      THEN 'investment'
  WHEN lower(name) LIKE '%cartão de crédito%' THEN 'card_payment'
  WHEN lower(name) LIKE '%reembolso%'         THEN 'refund'
  ELSE 'operational'
END
WHERE kind IS NULL;
