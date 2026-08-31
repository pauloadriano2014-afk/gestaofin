import { pgTable, uuid, text, numeric, date, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  budget: numeric("budget", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- NOVA TABELA: CARTÕES DE CRÉDITO ---
// Cada cartão tem seu próprio ciclo de fatura (dia de fechamento e vencimento),
// usado para calcular em qual fatura uma compra cai.
export const creditCards = pgTable("credit_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(), // apelido do cartão, ex: "Nubank"
  closingDay: integer("closing_day").notNull(), // dia do mês em que a fatura fecha (1-31)
  dueDay: integer("due_day").notNull(), // dia do mês em que a fatura vence (1-31)
  limitAmount: numeric("limit_amount", { precision: 12, scale: 2 }),
  archived: boolean("archived").default(false), // "excluir" um cartão só arquiva, pra não quebrar o histórico de compras já vinculadas
  createdAt: timestamp("created_at").defaultNow(),
});

// --- NOVA TABELA: VALOR DECLARADO NA MÃO DA FATURA (por cartão + mês) ---
// Cobre o caso de quem não lança compra por compra no cartão e só quer
// digitar direto "a fatura de agosto foi R$1.234,56, vence dia 10" — sem
// isso, o total da fatura só existia calculado a partir de transações
// lançadas. Quando existe um valor aqui pra um cartão+ciclo, ele SUBSTITUI
// o total calculado a partir das transações (evita ficar somando os dois).
export const creditCardInvoiceOverrides = pgTable("credit_card_invoice_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  creditCardId: uuid("credit_card_id").notNull().references(() => creditCards.id),
  cycleKey: text("cycle_key").notNull(), // "YYYY-MM" do mês em que a fatura fecha, mesmo formato usado no cálculo automático
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paidAt: date("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- NOVA TABELA: REGRAS DE CATEGORIZAÇÃO (aprendizado + manuais) ---
export const categoryRules = pgTable("category_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  pattern: text("pattern").notNull(), // trecho normalizado da descrição, ex: "uber"
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  source: text("source", { enum: ["auto", "manual"] }).default("auto"),
  matchCount: integer("match_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").defaultNow().notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  // 🔥 NOVO: "transfer" cobre transferência entre suas próprias contas (ex:
  // Asaas -> Nubank) ou acerto de contas internas (ex: casal que paga tudo
  // junto). Não é receita nem despesa de verdade — o dinheiro só mudou de
  // lugar, seu patrimônio não muda — então esse tipo fica de fora dos
  // cálculos de receita/despesa/saldo (ver getDashboardData e
  // calculateDashboardData, que só somam 'income'/'expense').
  type: text("type", { enum: ["income", "expense", "transfer"] }).notNull(),
  aiTags: text("ai_tags").array(),

  isFixed: boolean("is_fixed").default(false),
  isPaid: boolean("is_paid").default(true),
  // Data exata em que a conta foi dada baixa (independente de isPaid, que já existia).
  paidAt: date("paid_at"),

  // Se a despesa foi feita num cartão de crédito, aponta pra ele. Nulo = dinheiro/débito/pix.
  creditCardId: uuid("credit_card_id").references(() => creditCards.id),

  // --- NOVO CAMPO: Tipo de Entidade (PF ou PJ) ---
  entityType: text("entity_type").default("pf"), // 'pf' | 'pj'
  // ----------------------------------------------

  createdAt: timestamp("created_at").defaultNow(),
});

// --- NOVA TABELA: ASSINATURAS (SaaS) ---
// Essa tabela armazena o estado do plano do usuário (Free ou Pro)
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(), // ID do Clerk
  planType: text("plan_type").default("free"), // 'free' | 'pro' — usado pra liberar recursos PRO
  billingInterval: text("billing_interval"), // 'monthly' | 'quarterly' | 'semiannual' | 'annual' — só informativo
  stripeCustomerId: text("stripe_customer_id"), // ID do cliente na Stripe
  stripeSubscriptionId: text("stripe_subscription_id"), // ID da assinatura
  status: text("status").default("active"), // 'active', 'past_due', 'canceled'
  nextBillingDate: timestamp("next_billing_date"), // Data da próxima cobrança
});