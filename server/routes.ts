import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupBankIDAuth, isBankIDAuthenticated, BANKID_DEMO_MODE, logBankIDAttempt } from "./bankid-auth";
import { setupDevAuth, isDevAuthenticated } from "./dev-auth";
import { marketService } from "./market-service";
import { insertTransactionSchema, insertInvoiceSchema, insertCompanySchema } from "@shared/schema";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit payment requests
  message: "Too many payment requests, please try again later.",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Security middleware with CSP configured for development
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  }));
  app.use('/api', apiLimiter);

  // Setup authentication systems
  try {
    // Only setup Replit Auth if environment variables are properly configured
    if (process.env.REPLIT_DOMAINS && process.env.REPL_ID && process.env.SESSION_SECRET) {
      await setupAuth(app);
      console.log("✅ Replit Auth configured successfully");
    } else {
      console.warn("⚠️ Replit Auth environment variables not set, skipping Replit Auth");
    }
  } catch (error) {
    console.warn("⚠️ Replit Auth setup failed, continuing with BankID only:", (error as Error).message);
  }
  
  await setupBankIDAuth(app);
  console.log("✅ BankID Auth configured successfully");
  
  // Setup development authentication as fallback
  setupDevAuth(app);
  console.log("✅ Development Auth configured successfully");

  // Helper function to check if user is authenticated by any method
  const isAnyAuthenticated: any = (req: any, res: any, next: any) => {
    // Check if user is authenticated via BankID
    if (req.user && req.user.personnummer) {
      return next();
    }
    // Check if user is authenticated via Replit Auth
    if (req.user && req.user.claims && req.user.claims.sub) {
      return next();
    }
    // Check if user is authenticated via dev auth
    if ((req.session as any)?.user) {
      req.user = (req.session as any).user;
      return next();
    }
    return res.status(401).json({ message: "Authentication required" });
  };

  // Auth routes
  app.get('/api/auth/user', isAnyAuthenticated, async (req: any, res) => {
    try {
      let userId: string;
      let authMethod: string;
      
      // Determine authentication method and user ID
      if (req.user.personnummer) {
        // BankID authentication
        userId = req.user.personnummer;
        authMethod = "BankID";
      } else if (req.user.claims?.sub) {
        // Replit Auth
        userId = req.user.claims.sub;
        authMethod = "Replit";
      } else if (req.user.id) {
        // Development auth
        userId = req.user.id;
        authMethod = "Development";
      } else {
        return res.status(401).json({ message: "Invalid authentication state" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get user's company information
      const company = await storage.getCompanyByUser(userId);
      
      res.json({
        ...user,
        company,
        authMethod,
        isBankIDAuth: authMethod === "BankID",
        personnummer: req.user.personnummer || null,
        lastLogin: req.user.lastLogin || null,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // BankID logout route
  app.get('/api/auth/bankid/logout', (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie('bankid-session');
        res.redirect('/');
      });
    });
  });

  // BankID status route
  app.get('/api/auth/bankid/status', (req, res) => {
    res.json({
      demoMode: BANKID_DEMO_MODE,
      available: true,
      configured: !!process.env.BANKID_CLIENT_ID || BANKID_DEMO_MODE,
    });
  });

  // Dashboard data route
  app.get('/api/dashboard', isAnyAuthenticated, async (req: any, res) => {
    try {
      // Get user ID from either authentication method
      const userId = req.user.personnummer || req.user.claims?.sub;
      
      // Get user's accounts using the new enhanced method
      const accounts = await storage.getAllAccountsForUser(userId);
      
      // Mock company data for now
      const company = {
        id: userId,
        name: "Personal Banking",
        orgNumber: `PB${userId.slice(-6)}`,
        kycStatus: "verified"
      };

      // Mock transactions and invoices for now
      const transactions = [];
      const pendingInvoices = [];

      // Calculate summary data
      const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || "0"), 0);
      const monthlyRevenue = 0;
      const overdueAmount = 0;

      res.json({
        company,
        accounts: accounts.map(account => ({
          ...account,
          accountName: account.accountName || `${account.accountType} Account`
        })),
        transactions,
        pendingInvoices: pendingInvoices.length,
        summary: {
          totalBalance,
          monthlyRevenue,
          pendingInvoicesCount: pendingInvoices.length,
          overdueAmount,
        },
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Invoice payment route (mock PSD2 integration)
  app.post('/api/payments/invoice', isAuthenticated, paymentLimiter, async (req: any, res) => {
    try {
      const { kidNumber, amount } = req.body;

      // Input validation
      if (!kidNumber || !amount) {
        return res.status(400).json({ message: "KID number and amount are required" });
      }

      const userId = req.user.claims.sub;
      const company = await storage.getCompanyByUser(userId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Mock PSD2 payment processing with Neonomics/Tink
      await storage.logPSD2Request(
        "neonomics", // or "tink"
        "payment_initiation",
        "success",
        { kidNumber, amount, companyId: company.id },
        { paymentId: `pay_${Date.now()}`, status: "initiated" }
      );

      // Create transaction record
      const accounts = await storage.getAccountsByCompany(company.id);
      if (accounts.length > 0) {
        await storage.createTransaction({
          accountId: accounts[0].id,
          type: "debit",
          amount: amount.toString(),
          description: `Fakturabetaling - KID: ${kidNumber}`,
          kidNumber,
          status: "completed",
        });

        // Update account balance
        const newBalance = (parseFloat(accounts[0].balance || "0") - parseFloat(amount)).toString();
        await storage.updateAccountBalance(accounts[0].id, newBalance);
      }

      res.json({
        success: true,
        message: "Payment initiated successfully",
        paymentId: `pay_${Date.now()}`,
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(500).json({ message: "Payment processing failed" });
    }
  });

  // Account information route (mock PSD2 account data)
  app.get('/api/accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const company = await storage.getCompanyByUser(userId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      const accounts = await storage.getAccountsByCompany(company.id);
      
      // Log PSD2 account data request
      await storage.logPSD2Request(
        "neonomics",
        "account_information",
        "success",
        { companyId: company.id },
        { accountCount: accounts.length }
      );

      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  // Transactions route
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const company = await storage.getCompanyByUser(userId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      const { accountId, limit = 50 } = req.query;
      let transactions;

      if (accountId) {
        transactions = await storage.getTransactionsByAccount(accountId as string, Number(limit));
      } else {
        transactions = await storage.getRecentTransactions(company.id, Number(limit));
      }

      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // KYC webhook endpoint for SumSub callbacks
  app.post('/api/webhooks/kyc', async (req, res) => {
    try {
      const { applicantId, reviewStatus, companyId } = req.body;

      // Verify webhook signature in production
      // const signature = req.headers['x-sumsub-signature'];

      if (companyId) {
        await storage.updateCompanyKYC(
          companyId,
          reviewStatus === "completed" ? "verified" : "pending",
          { applicantId, reviewStatus, timestamp: new Date() }
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error processing KYC webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Admin routes
  app.get('/api/admin/companies', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post('/api/admin/companies/:id/verify', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { id } = req.params;
      const { status, notes } = req.body;

      const company = await storage.updateCompanyKYC(
        id,
        status,
        { adminNotes: notes, verifiedBy: user.id, verifiedAt: new Date() }
      );

      res.json(company);
    } catch (error) {
      console.error("Error verifying company:", error);
      res.status(500).json({ message: "Failed to verify company" });
    }
  });

  // Mock Banking-as-a-Service API endpoints (placeholder for Solarisbank/Railsr)
  app.post('/api/baas/accounts', isAuthenticated, async (req: any, res) => {
    try {
      // Mock account creation via Banking-as-a-Service
      const userId = req.user.claims.sub;
      const company = await storage.getCompanyByUser(userId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      const account = await storage.createAccount({
        companyId: company.id,
        accountNumber: `NO${Math.random().toString().substr(2, 11)}`,
        accountType: "business",
        balance: "0.00",
        currency: "NOK",
      });

      res.json(account);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Market data routes
  app.get("/api/market/overview", isAnyAuthenticated, async (req, res) => {
    try {
      const marketData = await marketService.getMarketDataFromDB();
      res.json(marketData.slice(0, 20)); // Return top 20 stocks
    } catch (error) {
      console.error("Error fetching market overview:", error);
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  // Live market data by exchange
  app.get('/api/market/live/:exchange', isAnyAuthenticated, async (req, res) => {
    try {
      const { exchange } = req.params;
      const marketData = await marketService.getMarketDataByExchange(exchange);
      res.json(marketData);
    } catch (error) {
      console.error("Error fetching live market data:", error);
      res.status(500).json({ message: "Failed to fetch live market data" });
    }
  });

  app.get("/api/market/watchlist", isAnyAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const watchedAssets = await marketService.getUserWatchedAssets(userId);
      res.json(watchedAssets);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/market/watchlist", isAnyAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { symbol, exchange, name, assetType, region } = req.body;
      
      await marketService.addWatchedAsset(userId, symbol, false, {
        exchange,
        name,
        assetType,
        region
      });
      res.json({ success: true, message: "Asset added to watchlist" });
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.post("/api/market/watch", isAnyAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { symbol, isFavorite } = req.body;
      
      await marketService.addWatchedAsset(userId, symbol, isFavorite);
      res.json({ success: true, message: "Asset added to watchlist" });
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.post("/api/market/toggle-favorite", isAnyAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { symbol } = req.body;
      
      await marketService.toggleFavorite(userId, symbol);
      res.json({ success: true, message: "Favorite status updated" });
    } catch (error) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ message: "Failed to update favorite status" });
    }
  });

  app.delete("/api/market/watchlist/:symbol", isAnyAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { symbol } = req.params;
      
      await marketService.removeWatchedAsset(userId, symbol);
      res.json({ success: true, message: "Asset removed from watchlist" });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  app.delete("/api/market/watch/:symbol", isAnyAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { symbol } = req.params;
      
      await marketService.removeWatchedAsset(userId, symbol);
      res.json({ success: true, message: "Asset removed from watchlist" });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  app.get("/api/market/quote/:symbol", isAnyAuthenticated, async (req, res) => {
    try {
      const { symbol } = req.params;
      await marketService.updateMarketData(symbol);
      const data = await marketService.getMarketDataFromDB([symbol]);
      
      if (data.length === 0) {
        return res.status(404).json({ message: "Stock not found" });
      }
      
      res.json(data[0]);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  // Initialize Norwegian stocks on startup
  marketService.initializeNorwegianStocks().catch(console.error);

  // Enhanced Account Management Routes
  app.get("/api/accounts/all", isAnyAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const accounts = await storage.getAllAccountsForUser(userId);
      
      // Add mock data for missing fields until schema is updated
      const enhancedAccounts = accounts.map(account => ({
        ...account,
        accountName: account.accountName || `${account.accountType} Account`,
        interestRate: "0.0000",
        minimumBalance: "0.00",
        totalInterestEarned: "0.00",
        nextInterestPayout: null,
        lastInterestPayout: null,
        conditions: null,
        fixedTermMonths: null,
        maturityDate: null
      }));

      res.json(enhancedAccounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.post("/api/accounts/create", isAnyAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const accountData = req.body;

      const account = await storage.createEnhancedAccount(userId, accountData);
      
      // Add mock data for missing fields
      const enhancedAccount = {
        ...account,
        accountName: accountData.accountName || `${accountData.accountType} Account`,
        interestRate: accountData.interestRate || "0.0000",
        minimumBalance: "0.00",
        totalInterestEarned: "0.00",
        nextInterestPayout: null,
        lastInterestPayout: null,
        conditions: accountData.conditions || null,
        fixedTermMonths: accountData.fixedTermMonths || null,
        maturityDate: accountData.maturityDate || null
      };

      res.json(enhancedAccount);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.get("/api/accounts/interest-history/:accountId", isAnyAuthenticated, async (req: any, res) => {
    try {
      const { accountId } = req.params;
      const interestHistory = await storage.getInterestHistory(accountId);
      res.json(interestHistory);
    } catch (error) {
      console.error("Error fetching interest history:", error);
      res.status(500).json({ message: "Failed to fetch interest history" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
