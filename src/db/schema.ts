import { pgTable, uuid, text, numeric, date, timestamp, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  budget: numeric("budget", { precision: 10, scale: 2 }).default("0"),
  // Como a categoria entra nas contas (ver src/utils/categoryKinds.ts):
  // 'operational' | 'investment' | 'refund' | 'card_payment'. Nulo = palpite pelo nome.
  kind: text("kind"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- NOVA TABELA: DONOS (quem é o titular de cada gasto/conta/cartão) ---
// Substitui o "PF/PJ" fixo: o mesmo login enxerga Paulo, Adri e Empresa
// separadamente e também em conjunto. "kind" mantém a compatibilidade com o
// antigo entityType: pessoa física ('pf') ou pessoa jurídica ('pj').
export const owners = pgTable("owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["pf", "pj"] }).notNull().default("pf"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- NOVA TABELA: ORGANIZAÇÃO ESCOLHIDA ---
// Guarda que a pessoa já escolheu como organizar a conta (só eu, casal, família,
// empresa...). Fica numa tabela própria, e não em user_settings, de propósito:
// user_settings é lida em todo carregamento, então uma coluna nova ali quebraria
// o app inteiro se a migração não tivesse sido rodada.
export const ownerSetups = pgTable("owner_setups", {
  userId: text("user_id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- NOVA TABELA: CONTAS (corrente, gateway de vendas, caixa) ---
// Cartões de crédito continuam na tabela credit_cards. Aqui ficam as contas
// onde o dinheiro de fato entra e sai: Itaú, Caixa, Asaas, Nubank conta etc.
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  ownerId: uuid("owner_id").references(() => owners.id),
  name: text("name").notNull(), // ex: "Itaú PJ"
  institution: text("institution"), // ex: "itau", "nubank", "caixa", "asaas"
  kind: text("kind", { enum: ["checking", "gateway", "cash"] }).notNull().default("checking"),
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- NOVA TABELA: CARTÕES DE CRÉDITO ---
// Cada cartão tem seu próprio ciclo de fatura (dia de fechamento e vencimento),
// usado para calcular em qual fatura uma compra cai.
export const creditCards = pgTable("credit_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  ownerId: uuid("owner_id").references(() => owners.id), // de quem é o cartão
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

// --- NOVA TABELA: MOLDES DE CONTAS FIXAS ---
// O "molde" de cada conta fixa (Aluguel, Internet, Financiamento da faculdade
// etc): nome, categoria, dia de vencimento e valor original esperado. O
// "Virar Mês" gera a cobrança do mês seguinte a partir daqui, e cada
// transação gerada aponta de volta pro molde (transactions.fixedBillId) —
// isso permite comparar valor original x valor pago mês a mês (juros/desconto)
// sem perder o valor "de referência" da conta.
export const fixedBills = pgTable("fixed_bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }).notNull(),
  dueDay: integer("due_day").notNull(), // dia do mês em que costuma vencer (1-31)
  entityType: text("entity_type").default("pf"), // 'pf' | 'pj'
  ownerId: uuid("owner_id").references(() => owners.id),
  creditCardId: uuid("credit_card_id").references(() => creditCards.id), // opcional: se essa conta fixa é debitada no cartão
  archived: boolean("archived").default(false), // "excluir" só arquiva, pra não quebrar o histórico de transações já vinculadas
  createdAt: timestamp("created_at").defaultNow(),
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

  // 🔥 NOVO: vínculo com o molde da conta fixa (ver tabela fixedBills) +
  // valor original esperado dessa ocorrência específica. "amount" continua
  // sendo o valor efetivamente pago; a diferença entre os dois é juro (pagou
  // mais) ou desconto (pagou menos). Ambos ficam nulos pra qualquer
  // transação que não seja uma conta fixa vinculada a um molde.
  fixedBillId: uuid("fixed_bill_id").references(() => fixedBills.id),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }),

  // Se a despesa foi feita num cartão de crédito, aponta pra ele. Nulo = dinheiro/débito/pix.
  creditCardId: uuid("credit_card_id").references(() => creditCards.id),

  // --- NOVO CAMPO: Tipo de Entidade (PF ou PJ) ---
  entityType: text("entity_type").default("pf"), // 'pf' | 'pj'
  // ----------------------------------------------

  // Dono do lançamento (Paulo, Adri, Empresa...). entityType continua sendo
  // gravado, derivado de owners.kind, pra não quebrar o que já usa PF/PJ.
  ownerId: uuid("owner_id").references(() => owners.id),
  // Conta de onde o dinheiro saiu/entrou (nulo = não informada).
  accountId: uuid("account_id").references(() => accounts.id),

  // Identificador do lançamento na origem (ex: "asaas:pay:pay_123"). Serve pra
  // sincronizar de novo sem duplicar. Nulo pra lançamentos manuais/importados.
  externalId: text("external_id"),

  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  uniqueIndex("transactions_external_uidx").on(t.userId, t.externalId).where(sql`${t.externalId} is not null`),
]);

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