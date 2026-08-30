import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// 🔥 CORRIGIDO: a senha do banco estava escrita direto no código-fonte
// (e ia parar no Git). Agora lemos do .env.local, igual o resto do app.
// Troque a senha no Neon já que ela ficou exposta no histórico do projeto.
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não encontrada no .env.local");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});