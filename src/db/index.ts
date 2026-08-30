import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';
import * as schema from './schema';

// Carrega o .env.local se estiver rodando fora do Next.js (como no seed ou terminal)
// 🔥 CORRIGIDO: apontava para um arquivo ".env" que não existe no projeto
// (as variáveis reais estão em ".env.local") — então scripts rodados fora do
// "next dev" (ex: npx tsx src/db/seed.ts) falhavam com DATABASE_URL ausente.
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrada no arquivo .env.local');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });