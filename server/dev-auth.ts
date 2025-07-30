import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Simple development authentication for when Replit Auth is not available
export function setupDevAuth(app: Express) {
  // Simple dev login endpoint that creates a test user
  app.post("/api/auth/dev-login", async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "Username required" });
      }

      // Create or get test user
      const user = await storage.upsertUser({
        id: `dev-${username}`,
        email: `${username}@dev.local`,
        firstName: username,
        lastName: "Developer",
        profileImageUrl: null,
      });

      // Create a simple session
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        claims: { sub: user.id }
      };

      res.json({ success: true, user });
    } catch (error) {
      console.error("Dev login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Dev user info endpoint
  app.get("/api/auth/dev-user", (req, res) => {
    const user = (req.session as any)?.user;
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(user);
  });

  // Dev logout endpoint
  app.post("/api/auth/dev-logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Dev logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ success: true });
    });
  });
}

// Middleware to check if user is authenticated via dev auth
export const isDevAuthenticated: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  req.user = user;
  next();
};