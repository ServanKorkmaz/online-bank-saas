import {
  users,
  companies,
  accounts,
  transactions,
  invoices,
  psd2Logs,
  type User,
  type UpsertUser,
  type Company,
  type InsertCompany,
  type Account,
  type InsertAccount,
  type Transaction,
  type InsertTransaction,
  type Invoice,
  type InsertInvoice,
  type PSD2Log,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Company operations
  getCompanyByUser(userId: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompanyKYC(companyId: string, status: string, data?: any): Promise<Company>;
  getAllCompanies(): Promise<Company[]>;
  
  // Account operations
  getAccountsByCompany(companyId: string): Promise<Account[]>;
  getAccountById(accountId: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccountBalance(accountId: string, amount: string): Promise<Account>;
  
  // Enhanced account operations
  getAllAccountsForUser(userId: string): Promise<Account[]>;
  createEnhancedAccount(userId: string, accountData: any): Promise<Account>;
  getInterestHistory(accountId: string): Promise<any[]>;
  
  // Transaction operations
  getTransactionsByAccount(accountId: string, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getRecentTransactions(companyId: string, limit?: number): Promise<Transaction[]>;
  
  // Invoice operations
  getInvoicesByCompany(companyId: string): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoiceStatus(invoiceId: string, status: string, paymentDate?: Date): Promise<Invoice>;
  getPendingInvoices(companyId: string): Promise<Invoice[]>;
  
  // PSD2 logging
  logPSD2Request(provider: string, requestType: string, status: string, requestData?: any, responseData?: any, errorMessage?: string): Promise<PSD2Log>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Company operations
  async getCompanyByUser(userId: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).limit(1);
    return company;
  }

  async createCompany(companyData: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values(companyData)
      .returning();
    return company;
  }

  async updateCompanyKYC(companyId: string, status: string, data?: any): Promise<Company> {
    const [company] = await db
      .update(companies)
      .set({
        kycStatus: status,
        kycData: data,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId))
      .returning();
    return company;
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(desc(companies.createdAt));
  }

  // Account operations
  async getAccountsByCompany(companyId: string): Promise<Account[]> {
    return await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, companyId));
  }

  async getAccountById(accountId: string): Promise<Account | undefined> {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    return account;
  }

  async createAccount(accountData: InsertAccount): Promise<Account> {
    const [account] = await db
      .insert(accounts)
      .values(accountData)
      .returning();
    return account;
  }

  async updateAccountBalance(accountId: string, amount: string): Promise<Account> {
    const [account] = await db
      .update(accounts)
      .set({
        balance: amount,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId))
      .returning();
    return account;
  }

  // Transaction operations
  async getTransactionsByAccount(accountId: string, limit = 50): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .orderBy(desc(transactions.transactionDate))
      .limit(limit);
  }

  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(transactionData)
      .returning();
    return transaction;
  }

  async getRecentTransactions(companyId: string, limit = 10): Promise<Transaction[]> {
    return await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        type: transactions.type,
        amount: transactions.amount,
        currency: transactions.currency,
        description: transactions.description,
        counterpartyName: transactions.counterpartyName,
        counterpartyAccount: transactions.counterpartyAccount,
        reference: transactions.reference,
        kidNumber: transactions.kidNumber,
        status: transactions.status,
        transactionDate: transactions.transactionDate,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(eq(accounts.companyId, companyId))
      .orderBy(desc(transactions.transactionDate))
      .limit(limit);
  }

  // Invoice operations
  async getInvoicesByCompany(companyId: string): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.createdAt));
  }

  async createInvoice(invoiceData: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db
      .insert(invoices)
      .values(invoiceData)
      .returning();
    return invoice;
  }

  async updateInvoiceStatus(invoiceId: string, status: string, paymentDate?: Date): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({
        status,
        paymentDate,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return invoice;
  }

  async getPendingInvoices(companyId: string): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, companyId),
          eq(invoices.status, "pending")
        )
      )
      .orderBy(desc(invoices.dueDate));
  }

  // PSD2 logging
  async logPSD2Request(
    provider: string,
    requestType: string,
    status: string,
    requestData?: any,
    responseData?: any,
    errorMessage?: string
  ): Promise<PSD2Log> {
    const [log] = await db
      .insert(psd2Logs)
      .values({
        provider,
        requestType,
        status,
        requestData,
        responseData,
        errorMessage,
      })
      .returning();
    return log;
  }

  async getAllAccountsForUser(userId: string): Promise<Account[]> {
    if (userId === "dev-test") {
      const existingAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.companyId, userId))
        .orderBy(desc(accounts.createdAt));
      
      if (existingAccounts.length > 0) {
        return existingAccounts;
      }
      
      const sampleAccounts = [
        {
          companyId: userId,
          accountNumber: "1234 56 12345",
          accountType: "checking" as const,
          accountName: "Daglig brukskonto",
          balance: "25000.00",
          currency: "NOK",
          interestRate: "0.0000",
          minimumBalance: "0.00",
          totalInterestEarned: "0.00",
          isActive: true
        },
        {
          companyId: userId,
          accountNumber: "1234 56 67890",
          accountType: "savings" as const,
          accountName: "Sparekonto",
          balance: "150000.00",
          currency: "NOK",
          interestRate: "0.0150",
          minimumBalance: "0.00",
          totalInterestEarned: "0.00",
          isActive: true
        }
      ];

      const createdAccounts = [];
      for (const accountData of sampleAccounts) {
        const [account] = await db
          .insert(accounts)
          .values(accountData)
          .returning();
        createdAccounts.push(account);
      }
      
      return createdAccounts;
    }
    const userCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.id, userId));
    
    if (userCompanies.length === 0) {
      const defaultCompany = await this.createCompany({
        name: "Personal Banking",
        orgNumber: `PB${Date.now()}`,
        address: "Oslo, Norway",
        city: "Oslo",
        postalCode: "0150",
        country: "NO",
        kycStatus: "verified"
      });
      
      return await db
        .select()
        .from(accounts)
        .where(eq(accounts.companyId, defaultCompany.id))
        .orderBy(desc(accounts.createdAt));
    }
    
    return await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, userCompanies[0].id))
      .orderBy(desc(accounts.createdAt));
  }

  async createEnhancedAccount(userId: string, accountData: any): Promise<Account> {
    // Get or create user's company
    let userCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.id, userId));
    
    let companyId = userId;
    if (userCompanies.length === 0) {
      const defaultCompany = await this.createCompany({
        name: "Personal Banking",
        orgNumber: `PB${Date.now()}`,
        address: "Oslo, Norway",
        city: "Oslo",
        postalCode: "0150",
        country: "NO",
        kycStatus: "verified"
      });
      companyId = defaultCompany.id;
    } else {
      companyId = userCompanies[0].id;
    }

    // Generate account number (Norwegian format: 4 digits + 2 digits + 5 digits)
    const bankCode = "1234";
    const branchCode = "56";
    const accountSeq = Math.floor(Math.random() * 90000) + 10000;
    const accountNumber = `${bankCode} ${branchCode} ${accountSeq}`;

    // Calculate next interest payout date (monthly for savings, at maturity for fixed)
    let nextInterestPayout = null;
    if (accountData.accountType === "savings") {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1); // First day of next month
      nextInterestPayout = nextMonth;
    } else if (accountData.maturityDate) {
      nextInterestPayout = new Date(accountData.maturityDate);
    }

    // Create account with all required fields
    const account = await this.createAccount({
      companyId,
      accountNumber,
      accountType: accountData.accountType,
      accountName: accountData.accountName || `${accountData.accountType} Account`,
      balance: accountData.initialDeposit || "0.00",
      currency: accountData.currency || "NOK",
      interestRate: accountData.interestRate || "0.0000",
      minimumBalance: "0.00",
      totalInterestEarned: "0.00",
      fixedTermMonths: accountData.fixedTermMonths || null,
      maturityDate: accountData.maturityDate ? new Date(accountData.maturityDate) : null,
      conditions: accountData.conditions || null,
      isActive: true
    });

    return account;
  }

  async getInterestHistory(accountId: string): Promise<any[]> {
    return [];
  }
}

export const storage = new DatabaseStorage();
