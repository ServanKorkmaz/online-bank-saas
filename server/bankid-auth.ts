import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { storage } from "./storage";

// BankID Configuration - Enable demo mode by default for development
const BANKID_DEMO_MODE = process.env.BANKID_DEMO_MODE !== "false"; // Demo mode ON by default
const BANKID_CLIENT_ID = process.env.BANKID_CLIENT_ID || "demo-client";
const BANKID_CLIENT_SECRET = process.env.BANKID_CLIENT_SECRET || "demo-secret";

// BankID Norge OIDC endpoints
const BANKID_ISSUER_URL = BANKID_DEMO_MODE 
  ? "https://auth.current.bankid.no/auth/realms/current" // Test environment
  : "https://auth.current.bankid.no/auth/realms/current"; // Same for demo

interface BankIDUser {
  personnummer: string;
  fullName: string;
  email?: string;
  dateOfBirth?: string;
  authMethod?: string;
  assuranceLevel?: string;
}

// Demo test users - Norwegian format
const DEMO_USERS: Record<string, BankIDUser> = {
  "12345678901": {
    personnummer: "12345678901",
    fullName: "Ola Nordmann",
    email: "ola@example.no",
    dateOfBirth: "1985-06-15",
    authMethod: "BankID High",
    assuranceLevel: "urn:grn:authn:no:bankid:high"
  },
  "98765432109": {
    personnummer: "98765432109", 
    fullName: "Kari Hansen",
    email: "kari@example.no",
    dateOfBirth: "1990-03-22",
    authMethod: "BankID Substantial",
    assuranceLevel: "urn:grn:authn:no:bankid:substantial"
  },
  "11223344556": {
    personnummer: "11223344556",
    fullName: "Lars Eriksen",
    email: "lars@example.no", 
    dateOfBirth: "1978-11-08",
    authMethod: "BankID High",
    assuranceLevel: "urn:grn:authn:no:bankid:high"
  }
};

const getBankIDConfig = memoize(
  async (): Promise<any> => {
    if (BANKID_DEMO_MODE) {
      // Return mock configuration for demo mode
      return {
        issuer: BANKID_ISSUER_URL,
        authorization_endpoint: BANKID_ISSUER_URL + "/protocol/openid-connect/auth",
        token_endpoint: BANKID_ISSUER_URL + "/protocol/openid-connect/token",
        userinfo_endpoint: BANKID_ISSUER_URL + "/protocol/openid-connect/userinfo",
        jwks_uri: BANKID_ISSUER_URL + "/protocol/openid-connect/certs",
        end_session_endpoint: BANKID_ISSUER_URL + "/protocol/openid-connect/logout",
      };
    }
    
    try {
      // For real BankID integration
      return await client.discovery(new URL(BANKID_ISSUER_URL + "/.well-known/openid_configuration"), BANKID_CLIENT_ID, BANKID_CLIENT_SECRET);
    } catch (error) {
      console.warn("Failed to discover BankID configuration, falling back to demo mode");
      // Fallback to demo config
      return {
        issuer: BANKID_ISSUER_URL,
        authorization_endpoint: BANKID_ISSUER_URL + "/protocol/openid-connect/auth",
        token_endpoint: BANKID_ISSUER_URL + "/protocol/openid-connect/token",
        userinfo_endpoint: BANKID_ISSUER_URL + "/protocol/openid-connect/userinfo",
        jwks_uri: BANKID_ISSUER_URL + "/protocol/openid-connect/certs",
        end_session_endpoint: BANKID_ISSUER_URL + "/protocol/openid-connect/logout",
      };
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getBankIDSession() {
  const sessionTtl = 24 * 60 * 60 * 1000; // 24 hours for BankID sessions
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    name: "bankid-session",
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: sessionTtl,
    },
  });
}

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

function updateBankIDUserSession(
  user: any,
  bankIdUser: BankIDUser,
  loginMetadata: {
    loginTime: Date;
    ipAddress: string;
    userAgent: string;
    authMethod: string;
  }
) {
  user.personnummer = bankIdUser.personnummer;
  user.fullName = bankIdUser.fullName;
  user.email = bankIdUser.email;
  user.authMethod = bankIdUser.authMethod;
  user.assuranceLevel = bankIdUser.assuranceLevel;
  user.lastLogin = loginMetadata.loginTime;
  user.loginIpAddress = loginMetadata.ipAddress;
  user.userAgent = loginMetadata.userAgent;
}

async function upsertBankIDUser(bankIdUser: BankIDUser, loginMetadata: any) {
  // Store user with personnummer as ID (following Norwegian standards)
  const user = await storage.upsertUser({
    id: bankIdUser.personnummer,
    email: bankIdUser.email || `${bankIdUser.personnummer}@bankid.temp`,
    firstName: bankIdUser.fullName.split(' ')[0],
    lastName: bankIdUser.fullName.split(' ').slice(1).join(' '),
    profileImageUrl: null,
  });

  // Log the login attempt for audit purposes
  console.log(`BankID login: ${bankIdUser.fullName} (${bankIdUser.personnummer}) at ${loginMetadata.loginTime}`);
  
  return user;
}

export async function setupBankIDAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getBankIDSession());
  app.use(passport.initialize());
  app.use(passport.session());

  if (BANKID_DEMO_MODE) {
    console.log("🔧 BankID Demo Mode Active - Using test users");
    setupDemoAuth(app);
  } else {
    console.log("🔐 BankID Production Mode - Using real BankID Norge");
    await setupRealBankIDAuth(app);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
}

async function setupRealBankIDAuth(app: Express) {
  const config = await getBankIDConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const claims = tokens.claims();
      
      const bankIdUser: BankIDUser = {
        personnummer: String(claims?.nnin_altsub || claims?.sub || 'unknown'), // Norwegian national ID
        fullName: String(claims?.name || `${claims?.given_name || ''} ${claims?.family_name || ''}`).trim() || 'Ukjent navn',
        email: claims?.email ? String(claims.email) : undefined,
        dateOfBirth: claims?.birthdate ? String(claims.birthdate) : undefined,
        authMethod: claims?.acr && String(claims.acr).includes('substantial') ? 'BankID Substantial' : 'BankID High',
        assuranceLevel: claims?.acr ? String(claims.acr) : undefined
      };

      const user = {};
      const loginMetadata = {
        loginTime: new Date(),
        ipAddress: 'unknown', // Will be set in route handler
        userAgent: 'unknown', // Will be set in route handler
        authMethod: bankIdUser.authMethod!
      };

      updateBankIDUserSession(user, bankIdUser, loginMetadata);
      await upsertBankIDUser(bankIdUser, loginMetadata);
      
      verified(null, user);
    } catch (error) {
      console.error("BankID verification error:", error);
      verified(error);
    }
  };

  const strategy = new Strategy(
    {
      name: "bankid",
      config,
      scope: "openid profile nnin_altsub", // Include Norwegian national ID
      callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/bankid/callback`,
    },
    verify,
  );
  
  passport.use(strategy);
}

function setupDemoAuth(app: Express) {
  // Demo BankID authentication routes
  app.get("/api/auth/bankid", (req: any, res) => {
    // In demo mode, redirect to demo selection page
    const state = crypto.randomUUID();
    (req.session as any).bankid_state = state;
    res.redirect(`/demo/bankid-select?state=${state}`);
  });

  app.get("/api/auth/bankid/callback", (req: any, res) => {
    // Handle demo callback
    const { personnummer, state } = req.query;
    
    if (state !== (req.session as any).bankid_state) {
      return res.status(400).json({ error: "Invalid state parameter" });
    }

    const demoUser = DEMO_USERS[personnummer as string];
    if (!demoUser) {
      return res.status(400).json({ error: "Invalid demo user" });
    }

    const user = {};
    const loginMetadata = {
      loginTime: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      authMethod: demoUser.authMethod!
    };

    updateBankIDUserSession(user, demoUser, loginMetadata);
    
    // Log in the user
    req.logIn(user, async (err) => {
      if (err) {
        console.error("Demo login error:", err);
        return res.status(500).json({ error: "Login failed" });
      }
      
      try {
        await upsertBankIDUser(demoUser, loginMetadata);
        res.redirect("/");
      } catch (error) {
        console.error("Demo user creation error:", error);
        res.status(500).json({ error: "User creation failed" });
      }
    });
  });

  // Demo selection page route
  app.get("/demo/bankid-select", (req: any, res) => {
    const { state } = req.query;
    
    if (state !== (req.session as any).bankid_state) {
      return res.status(400).send("Invalid state parameter");
    }

    const html = `
    <!DOCTYPE html>
    <html lang="no">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BankID Demo - Velg testbruker</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full bg-white rounded-lg shadow-md p-6">
            <div class="text-center mb-6">
                <div class="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                    </svg>
                </div>
                <h2 class="text-xl font-bold text-gray-900">BankID Demo Mode</h2>
                <p class="text-sm text-gray-600 mt-2">Velg en testbruker for å logge inn</p>
            </div>
            
            <div class="space-y-3">
                ${Object.entries(DEMO_USERS).map(([personnummer, user]) => `
                    <button onclick="loginAs('${personnummer}')" 
                            class="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div class="font-medium text-gray-900">${user.fullName}</div>
                        <div class="text-sm text-gray-500">Personnummer: ${personnummer}</div>
                        <div class="text-xs text-blue-600 mt-1">${user.authMethod}</div>
                    </button>
                `).join('')}
            </div>
            
            <div class="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p class="text-xs text-yellow-800">
                    <strong>Demo Mode:</strong> Dette er en testversjon. I produksjon vil brukere bli omdirigert til ekte BankID.
                </p>
            </div>
        </div>
        
        <script>
            function loginAs(personnummer) {
                window.location.href = '/api/auth/bankid/callback?personnummer=' + personnummer + '&state=${state}';
            }
        </script>
    </body>
    </html>`;
    
    res.send(html);
  });
}

export const isBankIDAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.personnummer) {
    return res.status(401).json({ message: "BankID authentication required" });
  }

  // Check if session is still valid (24 hours)
  const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
  if (!lastLogin || (Date.now() - lastLogin.getTime()) > 24 * 60 * 60 * 1000) {
    return res.status(401).json({ message: "Session expired, please log in again" });
  }

  return next();
};

export function logBankIDAttempt(req: any, personnummer: string, success: boolean, method: string) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    personnummer: personnummer,
    success,
    method,
    ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
  };
  
  console.log('BankID Login Attempt:', JSON.stringify(logEntry));
  // In production, you'd store this in a dedicated audit log table
}

export { DEMO_USERS, BANKID_DEMO_MODE };