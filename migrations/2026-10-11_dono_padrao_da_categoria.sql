-- ============================================================================
-- KORE (gestaofin) — Migração: dono padrão da categoria
-- Gerado em 11/10/2026
-- ============================================================================
-- Seguro de rodar mais de uma vez. Só CRIA uma tabela pequena que guarda, por
-- categoria, o dono padrão (ex: Transporte -> Empresa). Não altera nem apaga
-- nenhum dado. Sem ela o app funciona normalmente, só não oferece o dono padrão.
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_owner_defaults (
  user_id TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, category_id)
);
