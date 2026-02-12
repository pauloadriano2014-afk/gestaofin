import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';
import * as schema from './schema';

// Carrega o .env se estiver rodando fora do Next.js (como no seed ou terminal)
config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrada no arquivo .env');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });