import { pgTable, uuid, text, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  budget: numeric("budget", { precision: 10, scale: 2 }).default("0"), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").defaultNow().notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  aiTags: text("ai_tags").array(), 
  
  isFixed: boolean("is_fixed").default(false), 
  isPaid: boolean("is_paid").default(true),    
  
  // --- NOVO CAMPO: Tipo de Entidade (PF ou PJ) ---
  entityType: text("entity_type").default("pf"), // 'pf' | 'pj'
  // ----------------------------------------------

  createdAt: timestamp("created_at").defaultNow(),
});

// --- NOVA TABELA: ASSINATURAS (SaaS) ---
// Essa tabela armazena o estado do plano do usuário (Free ou Pro)
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(), // ID do Clerk
  planType: text("plan_type").default("free"), // 'free', 'monthly', 'quarterly', 'annual'
  stripeCustomerId: text("stripe_customer_id"), // ID do cliente na Stripe
  stripeSubscriptionId: text("stripe_subscription_id"), // ID da assinatura
  status: text("status").default("active"), // 'active', 'past_due', 'canceled'
  nextBillingDate: timestamp("next_billing_date"), // Data da próxima cobrança
});