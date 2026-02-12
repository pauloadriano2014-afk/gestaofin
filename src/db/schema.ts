import { pgTable, uuid, text, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  // --- NOVO CAMPO: Orçamento (Meta) ---
  budget: numeric("budget", { precision: 10, scale: 2 }).default("0"), 
  // ------------------------------------
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
  
  // Seus campos já existentes
  isFixed: boolean("is_fixed").default(false), 
  isPaid: boolean("is_paid").default(true),    
  
  createdAt: timestamp("created_at").defaultNow(),
});