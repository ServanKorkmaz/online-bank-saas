import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // user, admin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Business companies table
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  orgNumber: varchar("org_number", { length: 20 }).unique().notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 10 }),
  country: varchar("country", { length: 2 }).default("NO"),
  phone: varchar("phone", { length: 20 }),
  website: varchar("website", { length: 255 }),
  industry: varchar("industry", { length: 100 }),
  kycStatus: varchar("kyc_status").default("pending"), // pending, verified, rejected
  kycData: jsonb("kyc_data"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Business accounts table
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: uuid("company_id").references(() => companies.id),
  accountNumber: varchar("account_number", { length: 20 }).unique().notNull(),
  accountType: varchar("account_type").default("business"), // business, savings
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 3 }).default("NOK"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: uuid("account_id").references(() => accounts.id),
  type: varchar("type").notNull(), // debit, credit
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("NOK"),
  description: text("description").notNull(),
  counterpartyName: varchar("counterparty_name", { length: 255 }),
  counterpartyAccount: varchar("counterparty_account", { length: 50 }),
  reference: varchar("reference", { length: 100 }),
  kidNumber: varchar("kid_number", { length: 25 }),
  status: varchar("status").default("completed"), // pending, completed, failed
  transactionDate: timestamp("transaction_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: uuid("company_id").references(() => companies.id),
  invoiceNumber: varchar("invoice_number", { length: 50 }).unique().notNull(),
  kidNumber: varchar("kid_number", { length: 25 }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("NOK"),
  dueDate: timestamp("due_date").notNull(),
  status: varchar("status").default("pending"), // pending, paid, overdue, cancelled
  paymentDate: timestamp("payment_date"),
  creditorName: varchar("creditor_name", { length: 255 }).notNull(),
  creditorAccount: varchar("creditor_account", { length: 50 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PSD2 integration logs table
export const psd2Logs = pgTable("psd2_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider").notNull(), // tink, neonomics
  requestType: varchar("request_type").notNull(), // auth, account_info, payment
  status: varchar("status").notNull(), // success, error
  requestData: jsonb("request_data"),
  responseData: jsonb("response_data"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stock and fund tracking tables
export const watchedAssets = pgTable("watched_assets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  symbol: varchar("symbol", { length: 20 }).notNull(), // e.g., EQNR.OL, AAPL
  name: varchar("name", { length: 255 }), // Company/fund name
  exchange: varchar("exchange", { length: 10 }), // OL, NASDAQ, etc.
  assetType: varchar("asset_type").default("stock"), // stock, fund, crypto
  region: varchar("region", { length: 5 }).default("NO"), // NO, US, EU
  isFavorite: boolean("is_favorite").default(false),
  alertPrice: decimal("alert_price", { precision: 15, scale: 4 }),
  alertType: varchar("alert_type"), // above, below
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marketData = pgTable("market_data", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  exchange: varchar("exchange", { length: 10 }),
  price: decimal("price", { precision: 15, scale: 4 }).notNull(),
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  volume: varchar("volume"),
  marketCap: varchar("market_cap"),
  previousClose: decimal("previous_close", { precision: 15, scale: 4 }),
  dayHigh: decimal("day_high", { precision: 15, scale: 4 }),
  dayLow: decimal("day_low", { precision: 15, scale: 4 }),
  currency: varchar("currency", { length: 3 }).default("NOK"),
  sector: varchar("sector", { length: 100 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  sparklineData: jsonb("sparkline_data"), // Array of price points for mini chart
});

export const marketNews = pgTable("market_news", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  headline: text("headline").notNull(),
  summary: text("summary"),
  url: varchar("url", { length: 500 }),
  source: varchar("source", { length: 100 }),
  relatedSymbols: text("related_symbols").array(), // ['EQNR.OL', 'DNB.OL']
  sentiment: varchar("sentiment"), // positive, negative, neutral
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const userCompanyRelations = relations(users, ({ many }) => ({
  companies: many(companies),
  watchedAssets: many(watchedAssets),
}));

export const companyRelations = relations(companies, ({ many }) => ({
  accounts: many(accounts),
  invoices: many(invoices),
}));

export const accountRelations = relations(accounts, ({ one, many }) => ({
  company: one(companies, {
    fields: [accounts.companyId],
    references: [companies.id],
  }),
  transactions: many(transactions),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
}));

export const invoiceRelations = relations(invoices, ({ one }) => ({
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
}));

export const watchedAssetRelations = relations(watchedAssets, ({ one }) => ({
  user: one(users, {
    fields: [watchedAssets.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWatchedAssetSchema = createInsertSchema(watchedAssets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMarketDataSchema = createInsertSchema(marketData).omit({ id: true, lastUpdated: true });
export const insertMarketNewsSchema = createInsertSchema(marketNews).omit({ id: true, createdAt: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type PSD2Log = typeof psd2Logs.$inferSelect;
export type WatchedAsset = typeof watchedAssets.$inferSelect;
export type InsertWatchedAsset = z.infer<typeof insertWatchedAssetSchema>;
export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type MarketNews = typeof marketNews.$inferSelect;
export type InsertMarketNews = z.infer<typeof insertMarketNewsSchema>;
