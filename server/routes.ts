import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupBankIDAuth, isBankIDAuthenticated, BANKID_DEMO_MODE, logBankIDAttempt } from "./bankid-auth";
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

  // Setup both authentication systems
  await setupAuth(app);
  await setupBankIDAuth(app);

  // Helper function to check if user is authenticated by either method
  const isAnyAuthenticated: any = (req: any, res: any, next: any) => {
    // Check if user is authenticated via BankID
    if (req.user && req.user.personnummer) {
      return next();
    }
    // Check if user is authenticated via Replit Auth
    if (req.user && req.user.claims && req.user.claims.sub) {
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
      const company = await storage.getCompanyByUser(userId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Get company accounts
      const accounts = await storage.getAccountsByCompany(company.id);
      const mainAccount = accounts[0]; // Assume first account is main account

      // Get recent transactions
      const transactions = await storage.getRecentTransactions(company.id, 5);

      // Get pending invoices
      const pendingInvoices = await storage.getPendingInvoices(company.id);

      // Calculate summary data
      const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || "0"), 0);
      const monthlyRevenue = transactions
        .filter(t => t.type === "credit" && t.transactionDate && 
          new Date(t.transactionDate).getMonth() === new Date().getMonth())
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const overdueInvoices = pendingInvoices.filter(inv => 
        new Date(inv.dueDate) < new Date()
      );
      const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

      res.json({
        company,
        accounts,
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

  const httpServer = createServer(app);
  return httpServer;
}
