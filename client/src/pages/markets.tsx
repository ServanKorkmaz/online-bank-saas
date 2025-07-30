import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown, 
  Star, 
  StarOff, 
  Search, 
  Plus,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Activity,
  Globe,
  Building2,
  Flag,
  RefreshCw,
  Clock
} from "lucide-react";
import { Sparklines, SparklinesLine } from "react-sparklines";

interface MarketData {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  price: string;
  change: string;
  changePercent: string;
  volume?: string;
  marketCap?: string;
  previousClose: string;
  dayHigh: string;
  dayLow: string;
  currency: string;
  sector: string;
  lastUpdated: string;
  sparklineData?: number[];
}

interface WatchedAsset {
  watchedAsset: {
    id: string;
    userId: string;
    symbol: string;
    name?: string;
    exchange?: string;
    assetType: string;
    region: string;
    isFavorite: boolean;
    alertPrice?: string;
    createdAt: string;
    updatedAt: string;
  };
}

const GLOBAL_EXCHANGES = [
  { 
    code: "OL", 
    name: "Oslo Børs", 
    country: "Norge", 
    flag: "🇳🇴",
    currency: "NOK",
    timezone: "Europe/Oslo",
    popular: ["EQNR.OL", "DNB.OL", "TEL.OL", "MOWI.OL", "NHY.OL", "YAR.OL"]
  },
  { 
    code: "US", 
    name: "NASDAQ", 
    country: "USA", 
    flag: "🇺🇸",
    currency: "USD",
    timezone: "America/New_York",
    popular: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META"]
  },
  { 
    code: "US", 
    name: "NYSE", 
    country: "USA", 
    flag: "🇺🇸",
    currency: "USD",
    timezone: "America/New_York",
    popular: ["JPM", "JNJ", "V", "PG", "UNH", "HD"]
  },
  { 
    code: "L", 
    name: "London Stock Exchange", 
    country: "UK", 
    flag: "🇬🇧",
    currency: "GBP",
    timezone: "Europe/London",
    popular: ["SHEL.L", "AZN.L", "ULVR.L", "LSEG.L", "RIO.L", "BP.L"]
  },
  { 
    code: "DE", 
    name: "Frankfurt Stock Exchange", 
    country: "Tyskland", 
    flag: "🇩🇪",
    currency: "EUR",
    timezone: "Europe/Berlin",
    popular: ["SAP.DE", "ASME.DE", "SIE.DE", "ALV.DE", "DTE.DE", "BAS.DE"]
  },
  { 
    code: "HK", 
    name: "Hong Kong Stock Exchange", 
    country: "Hong Kong", 
    flag: "🇭🇰",
    currency: "HKD",
    timezone: "Asia/Hong_Kong",
    popular: ["0700.HK", "9988.HK", "0005.HK", "1299.HK", "2318.HK", "3690.HK"]
  },
  { 
    code: "T", 
    name: "Tokyo Stock Exchange", 
    country: "Japan", 
    flag: "🇯🇵",
    currency: "JPY",
    timezone: "Asia/Tokyo",
    popular: ["7203.T", "6758.T", "9984.T", "8306.T", "6861.T", "4063.T"]
  },
  { 
    code: "ST", 
    name: "Stockholm Stock Exchange", 
    country: "Sverige", 
    flag: "🇸🇪",
    currency: "SEK",
    timezone: "Europe/Stockholm",
    popular: ["VOLV-B.ST", "ERICB.ST", "ATLAS-B.ST", "HEXA-B.ST", "SSAB-A.ST", "SKF-B.ST"]
  }
];

export default function Markets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedExchange, setSelectedExchange] = useState("OL");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const selectedExchangeInfo = GLOBAL_EXCHANGES.find(ex => ex.code === selectedExchange);

  // Fetch market data with real-time updates
  const { data: marketData, isLoading, error, refetch } = useQuery<MarketData[]>({
    queryKey: [`/api/market/live/${selectedExchange}`],
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });

  // Fetch watchlist
  const { data: watchlist } = useQuery<WatchedAsset[]>({
    queryKey: ["/api/market/watchlist"],
  });

  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async (data: { symbol: string; exchange: string; name: string }) => {
      return await apiRequest(`/api/market/watchlist`, "POST", {
        symbol: data.symbol,
        exchange: data.exchange,
        name: data.name,
        assetType: "stock",
        region: selectedExchangeInfo?.country || "Unknown"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/watchlist"] });
      toast({
        title: "Lagt til i watchlist",
        description: "Aksjen er lagt til din watchlist",
      });
    },
    onError: (error) => {
      toast({
        title: "Feil",
        description: "Kunne ikke legge til i watchlist",
        variant: "destructive",
      });
    },
  });

  // Remove from watchlist mutation
  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return await apiRequest(`/api/market/watchlist/${symbol}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/watchlist"] });
      toast({
        title: "Fjernet fra watchlist",
        description: "Aksjen er fjernet fra din watchlist",
      });
    },
  });

  const isInWatchlist = (symbol: string) => {
    return watchlist?.some(item => item.watchedAsset.symbol === symbol);
  };

  const toggleWatchlist = (stock: MarketData) => {
    if (isInWatchlist(stock.symbol)) {
      removeFromWatchlistMutation.mutate(stock.symbol);
    } else {
      addToWatchlistMutation.mutate({
        symbol: stock.symbol,
        exchange: stock.exchange,
        name: stock.name
      });
    }
  };

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
    toast({
      title: "Oppdatert",
      description: "Markedsdata er oppdatert",
    });
  };

  const filteredData = marketData?.filter(stock =>
    stock.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const formatPrice = (price: string, currency: string) => {
    const numPrice = parseFloat(price);
    if (currency === "NOK") {
      return `${numPrice.toLocaleString('nb-NO', { minimumFractionDigits: 2 })} kr`;
    }
    return `${currency} ${numPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatChange = (change: string, changePercent: string) => {
    const numChange = parseFloat(change);
    const numChangePercent = parseFloat(changePercent);
    const isPositive = numChange >= 0;
    
    return (
      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        <span className="font-medium">
          {isPositive ? '+' : ''}{numChangePercent.toFixed(2)}%
        </span>
        <span className="text-xs text-gray-500">
          ({isPositive ? '+' : ''}{numChange.toFixed(2)})
        </span>
      </div>
    );
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-400">Kunne ikke hente markedsdata</CardTitle>
            <CardDescription>
              Det oppstod en feil ved henting av live markedsdata. Prøv å oppdatere siden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Prøv igjen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Live Markeder
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Følg aksjer og børser over hele verden i sanntid
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="w-4 h-4 mr-1" />
              Sist oppdatert: {lastRefresh.toLocaleTimeString('nb-NO')}
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Oppdater
            </Button>
          </div>
        </div>

        {/* Exchange Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Velg børs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {GLOBAL_EXCHANGES.map((exchange) => (
                <Button
                  key={exchange.code}
                  variant={selectedExchange === exchange.code ? "default" : "outline"}
                  className="flex flex-col items-center p-4 h-auto"
                  onClick={() => setSelectedExchange(exchange.code)}
                >
                  <span className="text-2xl mb-1">{exchange.flag}</span>
                  <span className="font-medium text-xs">{exchange.name}</span>
                  <span className="text-xs text-gray-500">{exchange.country}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Exchange Info */}
        {selectedExchangeInfo && (
          <motion.div
            key={selectedExchange}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{selectedExchangeInfo.flag}</span>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedExchangeInfo.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {selectedExchangeInfo.country} • {selectedExchangeInfo.currency}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="px-3 py-1">
                    Live data
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Search */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Søk etter aksjer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Oversikt</TabsTrigger>
            <TabsTrigger value="watchlist">Min watchlist</TabsTrigger>
            <TabsTrigger value="popular">Populære</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredData.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Ingen aksjer funnet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Prøv å endre søkekriteriene eller velg en annen børs
                  </p>
                </CardContent>
              </Card>
            ) : (
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                layout
              >
                <AnimatePresence>
                  {filteredData.map((stock, index) => (
                    <motion.div
                      key={stock.symbol}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      layout
                    >
                      <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group">
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <CardTitle className="text-lg font-bold">
                                  {stock.symbol}
                                </CardTitle>
                                <Badge variant="outline" className="text-xs">
                                  {stock.exchange}
                                </Badge>
                              </div>
                              <CardDescription className="text-sm line-clamp-2">
                                {stock.name}
                              </CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                toggleWatchlist(stock);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {isInWatchlist(stock.symbol) ? (
                                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              ) : (
                                <StarOff className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {formatPrice(stock.price, stock.currency)}
                              </div>
                              {formatChange(stock.change, stock.changePercent)}
                            </div>
                            
                            {stock.sparklineData && (
                              <div className="h-16 -mx-2">
                                <Sparklines data={stock.sparklineData} width={280} height={64}>
                                  <SparklinesLine 
                                    color={parseFloat(stock.change) >= 0 ? "#10b981" : "#ef4444"} 
                                    style={{ strokeWidth: 2, fill: "none" }}
                                  />
                                </Sparklines>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Volum:</span>
                                <div className="font-medium">
                                  {stock.volume ? parseInt(stock.volume).toLocaleString() : 'N/A'}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-500">Marked kap:</span>
                                <div className="font-medium">
                                  {stock.marketCap ? `${(parseInt(stock.marketCap) / 1e9).toFixed(1)}B` : 'N/A'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-500">
                              Sist oppdatert: {new Date(stock.lastUpdated).toLocaleTimeString('nb-NO')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="watchlist" className="mt-6">
            {watchlist?.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Din watchlist er tom
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Legg til aksjer i watchlisten din for å følge dem tett
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {watchlist?.map((item) => (
                  <motion.div
                    key={item.watchedAsset.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">{item.watchedAsset.symbol}</div>
                        <div className="text-sm text-gray-500">{item.watchedAsset.name}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromWatchlistMutation.mutate(item.watchedAsset.symbol)}
                    >
                      <StarOff className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="popular" className="mt-6">
            {selectedExchangeInfo && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Populære aksjer på {selectedExchangeInfo.name}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {selectedExchangeInfo.popular.map((symbol) => (
                    <Button
                      key={symbol}
                      variant="outline"
                      className="p-3 h-auto flex flex-col items-center"
                      onClick={() => setSearchTerm(symbol)}
                    >
                      <span className="font-medium">{symbol}</span>
                      <span className="text-xs text-gray-500">Populær</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}