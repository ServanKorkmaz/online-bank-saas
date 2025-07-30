import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Globe
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
    alertType?: string;
    createdAt: string;
    updatedAt: string;
  };
  marketData: MarketData | null;
}

export default function Markets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch market overview
  const { data: marketOverview, isLoading: overviewLoading } = useQuery<MarketData[]>({
    queryKey: ["/api/market/overview"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch user's watchlist
  const { data: watchlist, isLoading: watchlistLoading } = useQuery<WatchedAsset[]>({
    queryKey: ["/api/market/watchlist"],
    refetchInterval: 30000,
  });

  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async ({ symbol, isFavorite }: { symbol: string; isFavorite?: boolean }) => {
      return apiRequest("/api/market/watch", "POST", { symbol, isFavorite });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/watchlist"] });
      toast({
        title: "Success",
        description: "Asset added to watchlist",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add asset to watchlist",
        variant: "destructive",
      });
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("/api/market/toggle-favorite", "POST", { symbol });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/watchlist"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      });
    },
  });

  const formatPrice = (price: string, currency: string = "NOK") => {
    const numPrice = parseFloat(price);
    return new Intl.NumberFormat("no-NO", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(numPrice);
  };

  const formatChange = (change: string, changePercent: string) => {
    const numChange = parseFloat(change);
    const numChangePercent = parseFloat(changePercent);
    const isPositive = numChange >= 0;

    return {
      value: `${isPositive ? "+" : ""}${numChange.toFixed(2)}`,
      percent: `${isPositive ? "+" : ""}${numChangePercent.toFixed(2)}%`,
      isPositive,
    };
  };

  const getPriceChangeColor = (change: string) => {
    const numChange = parseFloat(change);
    if (numChange > 0) return "text-green-600 dark:text-green-400";
    if (numChange < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const filteredMarketData = marketOverview?.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const favorites = watchlist?.filter(item => item.watchedAsset.isFavorite) || [];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Markets
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track Norwegian and international stocks in real-time
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search stocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
      </motion.div>

      {/* Market Status Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg p-4 border"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Oslo Børs Open</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Globe className="w-3 h-3 mr-1" />
              Live Data
            </Badge>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleTimeString("no-NO")}
          </div>
        </div>
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Market Overview</TabsTrigger>
          <TabsTrigger value="watchlist">My Watchlist</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6">
            {overviewLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </Card>
                ))}
              </div>
            ) : (
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <AnimatePresence>
                  {filteredMarketData.map((asset, index) => {
                    const changeData = formatChange(asset.change, asset.changePercent);
                    
                    return (
                      <motion.div
                        key={asset.symbol}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.02 }}
                        className="group"
                      >
                        <Card className="p-6 h-full hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold text-lg truncate">{asset.symbol}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {asset.exchange}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                {asset.name}
                              </p>
                              {asset.sector && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  {asset.sector}
                                </Badge>
                              )}
                            </div>
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => addToWatchlistMutation.mutate({ symbol: asset.symbol, isFavorite: true })}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => addToWatchlistMutation.mutate({ symbol: asset.symbol })}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-end">
                              <div>
                                <div className="text-2xl font-bold">
                                  {formatPrice(asset.price, asset.currency)}
                                </div>
                                <div className={`flex items-center space-x-1 text-sm ${getPriceChangeColor(asset.change)}`}>
                                  {changeData.isPositive ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  )}
                                  <span>{changeData.value} ({changeData.percent})</span>
                                </div>
                              </div>
                              {asset.sparklineData && asset.sparklineData.length > 0 && (
                                <div className="w-20 h-10">
                                  <Sparklines data={asset.sparklineData} width={80} height={40}>
                                    <SparklinesLine 
                                      color={changeData.isPositive ? "#10b981" : "#ef4444"} 
                                      style={{ strokeWidth: 2 }}
                                    />
                                  </Sparklines>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                              <div>
                                <span className="block">High</span>
                                <span className="font-medium">{formatPrice(asset.dayHigh, asset.currency)}</span>
                              </div>
                              <div>
                                <span className="block">Low</span>
                                <span className="font-medium">{formatPrice(asset.dayLow, asset.currency)}</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-6">
          {watchlistLoading ? (
            <div className="text-center py-8">Loading your watchlist...</div>
          ) : watchlist && watchlist.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {watchlist.map((item) => {
                const asset = item.marketData;
                if (!asset) return null;

                const changeData = formatChange(asset.change, asset.changePercent);

                return (
                  <motion.div
                    key={item.watchedAsset.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <Card className="p-6 relative">
                      <div className="absolute top-4 right-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleFavoriteMutation.mutate(asset.symbol)}
                          className={item.watchedAsset.isFavorite ? "text-yellow-500" : "text-gray-400"}
                        >
                          {item.watchedAsset.isFavorite ? (
                            <Star className="h-4 w-4 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <div className="pr-12">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-lg">{asset.symbol}</h3>
                          <Badge variant="outline">{asset.exchange}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {asset.name}
                        </p>

                        <div className="space-y-2">
                          <div className="text-2xl font-bold">
                            {formatPrice(asset.price, asset.currency)}
                          </div>
                          <div className={`flex items-center space-x-1 text-sm ${getPriceChangeColor(asset.change)}`}>
                            {changeData.isPositive ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            <span>{changeData.value} ({changeData.percent})</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No stocks in watchlist</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start tracking your favorite Norwegian and international stocks
              </p>
              <Button onClick={() => setSelectedTab("overview")}>
                Browse Market Overview
              </Button>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="favorites" className="space-y-6">
          {favorites.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((item) => {
                const asset = item.marketData;
                if (!asset) return null;

                const changeData = formatChange(asset.change, asset.changePercent);

                return (
                  <motion.div
                    key={item.watchedAsset.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    className="relative"
                  >
                    <Card className="p-6 border-l-4 border-l-yellow-500">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <h3 className="font-semibold text-lg">{asset.symbol}</h3>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {asset.name}
                          </p>
                        </div>
                        {asset.sparklineData && asset.sparklineData.length > 0 && (
                          <div className="w-16 h-8">
                            <Sparklines data={asset.sparklineData} width={64} height={32}>
                              <SparklinesLine 
                                color={changeData.isPositive ? "#10b981" : "#ef4444"} 
                                style={{ strokeWidth: 2 }}
                              />
                            </Sparklines>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-2xl font-bold">
                          {formatPrice(asset.price, asset.currency)}
                        </div>
                        <div className={`flex items-center space-x-1 text-sm ${getPriceChangeColor(asset.change)}`}>
                          {changeData.isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span>{changeData.value} ({changeData.percent})</span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Star className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No favorite stocks yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Mark stocks as favorites to track your top picks
              </p>
              <Button onClick={() => setSelectedTab("overview")}>
                Find Stocks to Favorite
              </Button>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}