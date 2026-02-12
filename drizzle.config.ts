import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // URL Hardcoded para ignorar o erro de leitura do .env
    url: "postgresql://neondb_owner:npg_D2vnSPaj6XlT@ep-broad-tree-ai9p8clo-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require",
  },
});