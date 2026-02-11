import { config } from 'dotenv';
import { defineConfig } from "drizzle-kit";

// Força o carregamento do arquivo .env
config({ path: '.env' });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});