-- ============================================================================
-- KORE (gestaofin) — Migração: organização escolhida (casal, família, empresa...)
-- Gerado em 11/10/2026
-- ============================================================================
-- Seguro de rodar mais de uma vez. Só CRIA uma tabela pequena que guarda quais
-- contas já escolheram como organizar seus donos (pessoas e empresas). Não
-- altera nem apaga nenhum dado.
--
-- A conta gestaokore@outlook.com não precisa de nenhuma linha aqui: o app já a
-- trata como "organizada" e ela continua exatamente como está.
-- ============================================================================

CREATE TABLE IF NOT EXISTS owner_setups (
  user_id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW()
);
