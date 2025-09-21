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

// Global stock exchanges and popular stocks
const EXCHANGE_STOCKS = {
  "OL": [ // Oslo Børs
    { symbol: "EQNR.OL", name: "Equinor ASA", sector: "Energy" },
    { symbol: "DNB.OL", name: "DNB Bank ASA", sector: "Financial Services" },
    { symbol: "TEL.OL", name: "Telenor ASA", sector: "Telecommunications" },
    { symbol: "MOWI.OL", name: "Mowi ASA", sector: "Food & Beverages" },
    { symbol: "NHY.OL", name: "Norsk Hydro ASA", sector: "Basic Materials" },
    { symbol: "YAR.OL", name: "Yara International ASA", sector: "Basic Materials" },
    { symbol: "ORKLA.OL", name: "Orkla ASA", sector: "Consumer Goods" },
    { symbol: "STL.OL", name: "Statoil ASA", sector: "Energy" },
  ],
  "US": [ // US Exchanges (NASDAQ/NYSE)
    { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
    { symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
    { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
    { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary" },
    { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary" },
    { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology" },
    { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financial Services" },
    { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  ],
  "L": [ // London Stock Exchange
    { symbol: "SHEL.L", name: "Shell plc", sector: "Energy" },
    { symbol: "AZN.L", name: "AstraZeneca PLC", sector: "Healthcare" },
    { symbol: "ULVR.L", name: "Unilever PLC", sector: "Consumer Goods" },
    { symbol: "LSEG.L", name: "London Stock Exchange Group", sector: "Financial Services" },
    { symbol: "RIO.L", name: "Rio Tinto Group", sector: "Basic Materials" },
    { symbol: "BP.L", name: "BP p.l.c.", sector: "Energy" },
  ],
  "DE": [ // Frankfurt Stock Exchange
    { symbol: "SAP.DE", name: "SAP SE", sector: "Technology" },
    { symbol: "ASME.DE", name: "ASML Holding N.V.", sector: "Technology" },
    { symbol: "SIE.DE", name: "Siemens AG", sector: "Industrials" },
    { symbol: "ALV.DE", name: "Allianz SE", sector: "Financial Services" },
    { symbol: "DTE.DE", name: "Deutsche Telekom AG", sector: "Telecommunications" },
    { symbol: "BAS.DE", name: "BASF SE", sector: "Basic Materials" },
  ],
  "HK": [ // Hong Kong Stock Exchange
    { symbol: "0700.HK", name: "Tencent Holdings Ltd.", sector: "Technology" },
    { symbol: "9988.HK", name: "Alibaba Group Holding Ltd.", sector: "Technology" },
    { symbol: "0005.HK", name: "HSBC Holdings plc", sector: "Financial Services" },
    { symbol: "1299.HK", name: "AIA Group Ltd.", sector: "Financial Services" },
    { symbol: "2318.HK", name: "Ping An Insurance", sector: "Financial Services" },
    { symbol: "3690.HK", name: "Meituan", sector: "Consumer Discretionary" },
  ],
  "T": [ // Tokyo Stock Exchange
    { symbol: "7203.T", name: "Toyota Motor Corp", sector: "Consumer Discretionary" },
    { symbol: "6758.T", name: "Sony Group Corp", sector: "Technology" },
    { symbol: "9984.T", name: "SoftBank Group Corp", sector: "Technology" },
    { symbol: "8306.T", name: "Mitsubishi UFJ Financial Group", sector: "Financial Services" },
    { symbol: "6861.T", name: "Keyence Corp", sector: "Technology" },
    { symbol: "4063.T", name: "Shin-Etsu Chemical Co", sector: "Basic Materials" },
  ],
  "ST": [ // Stockholm Stock Exchange
    { symbol: "VOLV-B.ST", name: "Volvo AB", sector: "Industrials" },
    { symbol: "ERICB.ST", name: "Telefonaktiebolaget LM Ericsson", sector: "Technology" },
    { symbol: "ATLAS-B.ST", name: "Atlas Copco AB", sector: "Industrials" },
    { symbol: "HEXA-B.ST", name: "Hexagon AB", sector: "Technology" },
    { symbol: "SSAB-A.ST", name: "SSAB AB", sector: "Basic Materials" },
    { symbol: "SKF-B.ST", name: "SKF AB", sector: "Industrials" },
  ]
};

const NORWEGIAN_STOCKS = EXCHANGE_STOCKS["OL"];

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
      const stockInfo = Object.values(EXCHANGE_STOCKS)
        .flat()
        .find(stock => stock.symbol === symbol);

      await db.insert(marketData).values({
        symbol,
        name: profile?.name || stockInfo?.name || symbol,
        exchange: profile?.exchange || symbol.split('.')[1] || "US",
        price: quote.c.toString(),
        change: quote.d.toString(),
        changePercent: quote.dp.toString(),
        volume: "N/A", // Finnhub doesn't provide volume in basic quote
        marketCap: profile?.marketCapitalization ? (profile.marketCapitalization * 1000000).toString() : null,
        previousClose: quote.pc.toString(),
        dayHigh: quote.h.toString(),
        dayLow: quote.l.toString(),
        currency: profile?.currency || (symbol.includes(".OL") ? "NOK" : "USD"),
        sector: stockInfo?.sector || profile?.finnhubIndustry || "Unknown",
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

    } catch (error) {
      console.error(`Failed to update market data for ${symbol}:`, error);
      throw error;
    }
  }

  async initializeNorwegianStocks(): Promise<void> {
    for (const stock of NORWEGIAN_STOCKS) {
      try {
        await this.updateMarketData(stock.symbol);
        await new Promise(resolve => setTimeout(resolve, 1100));
      } catch (error) {
        console.error(`Failed to initialize ${stock.symbol}:`, error);
      }
    }
  }

  async getMarketDataFromDB(symbols?: string[]) {
    if (symbols && symbols.length > 0) {
      return db.select().from(marketData).where(inArray(marketData.symbol, symbols));
    }
    
    return db.select().from(marketData).orderBy(desc(marketData.lastUpdated));
  }

  async getMarketDataByExchange(exchange: string) {
    const exchangeStocks = EXCHANGE_STOCKS[exchange as keyof typeof EXCHANGE_STOCKS];
    
    if (!exchangeStocks) {
      throw new Error(`Unsupported exchange: ${exchange}`);
    }

    // First ensure we have fresh data for this exchange
    await this.initializeExchangeData(exchange);
    
    // Get all symbols for this exchange
    const symbols = exchangeStocks.map(stock => stock.symbol);
    
    return await this.getMarketDataFromDB(symbols);
  }

  async initializeExchangeData(exchange: string): Promise<void> {
    const exchangeStocks = EXCHANGE_STOCKS[exchange as keyof typeof EXCHANGE_STOCKS];
    
    if (!exchangeStocks) {
      return;
    }

    for (const stock of exchangeStocks) {
      try {
        // Check if we have recent data (less than 5 minutes old)
        const existingData = await db.select()
          .from(marketData)
          .where(eq(marketData.symbol, stock.symbol))
          .limit(1);
        
        const shouldUpdate = !existingData[0] || 
          (new Date().getTime() - new Date(existingData[0].lastUpdated!).getTime()) > 5 * 60 * 1000;
        
        if (shouldUpdate) {
          await this.updateMarketData(stock.symbol);
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      } catch (error) {
        console.error(`Failed to initialize ${stock.symbol} on ${exchange}:`, error);
      }
    }
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

  async addWatchedAsset(userId: string, symbol: string, isFavorite = false, extraData?: { exchange?: string; name?: string; assetType?: string; region?: string }) {
    // Ensure we have market data for this symbol
    try {
      await this.updateMarketData(symbol);
    } catch (error) {
      console.warn(`Could not fetch market data for ${symbol}, adding anyway`);
    }

    return db.insert(watchedAssets).values({
      userId,
      symbol,
      name: extraData?.name,
      exchange: extraData?.exchange,
      isFavorite,
      assetType: extraData?.assetType || "stock",
      region: extraData?.region || "Global",
    }).onConflictDoUpdate({
      target: [watchedAssets.userId, watchedAssets.symbol],
      set: {
        isFavorite,
        updatedAt: new Date(),
      },
    });
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