import { pgTable, uuid, text, numeric, date, timestamp } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
});