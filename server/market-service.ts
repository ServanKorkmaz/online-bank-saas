import { db } from "./db";
import { marketData, watchedAssets } from "@shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

interface FinnhubQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

interface FinnhubCompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

interface FinnhubNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// Popular Norwegian stocks for initial data
const NORWEGIAN_STOCKS = [
  { symbol: "EQNR.OL", name: "Equinor ASA", sector: "Energy" },
  { symbol: "DNB.OL", name: "DNB Bank ASA", sector: "Financial Services" },
  { symbol: "TEL.OL", name: "Telenor ASA", sector: "Telecommunications" },
  { symbol: "MOWI.OL", name: "Mowi ASA", sector: "Food & Beverages" },
  { symbol: "NHY.OL", name: "Norsk Hydro ASA", sector: "Basic Materials" },
  { symbol: "YAR.OL", name: "Yara International ASA", sector: "Basic Materials" },
  { symbol: "ORKLA.OL", name: "Orkla ASA", sector: "Consumer Goods" },
  { symbol: "STL.OL", name: "Statoil ASA", sector: "Energy" },
  { symbol: "SALM.OL", name: "SalMar ASA", sector: "Food & Beverages" },
  { symbol: "XXL.OL", name: "XXL ASA", sector: "Retail" },
];

export class MarketDataService {
  private apiKey: string;

  constructor() {
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error("FINNHUB_API_KEY environment variable is required");
    }
    this.apiKey = process.env.FINNHUB_API_KEY;
  }

  private async fetchFromFinnhub(endpoint: string): Promise<any> {
    const url = `${FINNHUB_BASE_URL}${endpoint}&token=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Finnhub API error: ${data.error}`);
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to fetch from Finnhub: ${endpoint}`, error);
      throw error;
    }
  }

  async getQuote(symbol: string): Promise<FinnhubQuote> {
    return this.fetchFromFinnhub(`/quote?symbol=${symbol}`);
  }

  async getCompanyProfile(symbol: string): Promise<FinnhubCompanyProfile> {
    return this.fetchFromFinnhub(`/stock/profile2?symbol=${symbol}`);
  }

  async getMarketNews(category = "general", count = 20): Promise<FinnhubNews[]> {
    return this.fetchFromFinnhub(`/news?category=${category}&count=${count}`);
  }

  async getCompanyNews(symbol: string, from: string, to: string): Promise<FinnhubNews[]> {
    return this.fetchFromFinnhub(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
  }

  // Generate sparkline data for the last 7 days (mock implementation)
  private generateSparklineData(currentPrice: number, change: number): number[] {
    const points = [];
    const basePrice = currentPrice - change;
    
    for (let i = 0; i < 7; i++) {
      const variation = (Math.random() - 0.5) * (currentPrice * 0.05);
      const price = basePrice + (change * (i / 6)) + variation;
      points.push(Math.round(price * 100) / 100);
    }
    
    return points;
  }

  async updateMarketData(symbol: string): Promise<void> {
    try {
      const [quote, profile] = await Promise.all([
        this.getQuote(symbol),
        this.getCompanyProfile(symbol).catch(() => null), // Profile might not be available for all symbols
      ]);

      const sparklineData = this.generateSparklineData(quote.c, quote.d);
      const norwegianStock = NORWEGIAN_STOCKS.find(stock => stock.symbol === symbol);

      await db.insert(marketData).values({
        symbol,
        name: profile?.name || norwegianStock?.name || symbol,
        exchange: profile?.exchange || "OL",
        price: quote.c.toString(),
        change: quote.d.toString(),
        changePercent: quote.dp.toString(),
        volume: "N/A", // Finnhub doesn't provide volume in basic quote
        marketCap: profile?.marketCapitalization ? (profile.marketCapitalization * 1000000).toString() : null,
        previousClose: quote.pc.toString(),
        dayHigh: quote.h.toString(),
        dayLow: quote.l.toString(),
        currency: profile?.currency || "NOK",
        sector: norwegianStock?.sector || profile?.finnhubIndustry || "Unknown",
        sparklineData: sparklineData,
      }).onConflictDoUpdate({
        target: marketData.symbol,
        set: {
          price: quote.c.toString(),
          change: quote.d.toString(),
          changePercent: quote.dp.toString(),
          previousClose: quote.pc.toString(),
          dayHigh: quote.h.toString(),
          dayLow: quote.l.toString(),
          sparklineData: sparklineData,
          lastUpdated: new Date(),
        },
      });

      console.log(`Updated market data for ${symbol}: ${quote.c} ${profile?.currency || "NOK"}`);
    } catch (error) {
      console.error(`Failed to update market data for ${symbol}:`, error);
      throw error;
    }
  }

  async initializeNorwegianStocks(): Promise<void> {
    console.log("Initializing Norwegian stock data...");
    
    for (const stock of NORWEGIAN_STOCKS) {
      try {
        await this.updateMarketData(stock.symbol);
        // Add delay to respect rate limits (60 calls/minute = 1 call per second)
        await new Promise(resolve => setTimeout(resolve, 1100));
      } catch (error) {
        console.error(`Failed to initialize ${stock.symbol}:`, error);
      }
    }
    
    console.log("Norwegian stock data initialization completed");
  }

  async getMarketDataFromDB(symbols?: string[]) {
    if (symbols && symbols.length > 0) {
      return db.select().from(marketData).where(inArray(marketData.symbol, symbols));
    }
    
    return db.select().from(marketData).orderBy(desc(marketData.lastUpdated));
  }

  async getUserWatchedAssets(userId: string) {
    return db.select({
      watchedAsset: watchedAssets,
      marketData: marketData,
    })
    .from(watchedAssets)
    .leftJoin(marketData, eq(watchedAssets.symbol, marketData.symbol))
    .where(eq(watchedAssets.userId, userId))
    .orderBy(desc(watchedAssets.isFavorite), watchedAssets.createdAt);
  }

  async addWatchedAsset(userId: string, symbol: string, isFavorite = false) {
    // Ensure we have market data for this symbol
    try {
      await this.updateMarketData(symbol);
    } catch (error) {
      console.warn(`Could not fetch market data for ${symbol}, adding anyway`);
    }

    return db.insert(watchedAssets).values({
      userId,
      symbol,
      isFavorite,
    }).onConflictDoNothing();
  }

  async toggleFavorite(userId: string, symbol: string) {
    const existing = await db.select()
      .from(watchedAssets)
      .where(and(eq(watchedAssets.userId, userId), eq(watchedAssets.symbol, symbol)))
      .limit(1);

    if (existing.length === 0) {
      // Add as favorite if doesn't exist
      return this.addWatchedAsset(userId, symbol, true);
    } else {
      // Toggle favorite status
      return db.update(watchedAssets)
        .set({ isFavorite: !existing[0].isFavorite, updatedAt: new Date() })
        .where(and(eq(watchedAssets.userId, userId), eq(watchedAssets.symbol, symbol)));
    }
  }

  async removeWatchedAsset(userId: string, symbol: string) {
    return db.delete(watchedAssets)
      .where(and(eq(watchedAssets.userId, userId), eq(watchedAssets.symbol, symbol)));
  }
}

export const marketService = new MarketDataService();