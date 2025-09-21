import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { 
  Plus, 
  Wallet,
  TrendingUp,
  Filter,
  Download,
  Shield,
  AlertTriangle,
  CheckCircle2,
  PiggyBank,
  CreditCard,
  Building,
  Clock,
  Calendar,
  Calculator,
  FileText
} from "lucide-react";

// Account type definitions matching Norwegian banking standards
const ACCOUNT_TYPES = [
  {
    id: "savings",
    name: "Sparekonto",
    description: "Fleksibel sparekonto med konkurransedyktig rente",
    interestRate: 1.5,
    minDeposit: 0,
    features: ["Ubegrenset antall uttak", "Månedlig renteutbetaling", "Ingen binding"],
    icon: PiggyBank,
    color: "bg-green-50 border-green-200 text-green-800",
    bgColor: "bg-green-500"
  },
  {
    id: "fixed_deposit",
    name: "Fastrenteinnskudd",
    description: "Høy rente med fast bindingstid",
    terms: [
      { months: "3", rate: 3.25, penalty: 0.5 },
      { months: "6", rate: 3.75, penalty: 0.75 },
      { months: "12", rate: 4.2, penalty: 1.0 }
    ],
    minDeposit: 500,
    features: ["Fast rente hele perioden", "Garantert avkastning", "Tidlig uttak med gebyr"],
    icon: TrendingUp,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    bgColor: "bg-blue-500"
  },
  {
    id: "everyday",
    name: "Brukskonto",
    description: "Daglig brukskonto for lønn og utgifter",
    interestRate: 0,
    minDeposit: 0,
    features: ["Ubegrenset transaksjoner", "Betalingskort inkludert", "Nettbank og mobilbank"],
    icon: CreditCard,
    color: "bg-gray-50 border-gray-200 text-gray-800",
    bgColor: "bg-gray-500"
  },
  {
    id: "tax_deduction",
    name: "Skattetrekkskonto",
    description: "Spesialkonto for skattetrekk og avgifter",
    interestRate: 0,
    minDeposit: 0,
    features: ["Kun for skattetrekk", "Begrenset tilgang", "Automatiske overføringer"],
    icon: Shield,
    color: "bg-orange-50 border-orange-200 text-orange-800",
    bgColor: "bg-orange-500",
    restricted: true
  }
];

// Form schemas
const createAccountSchema = z.object({
  accountType: z.string().min(1, "Velg kontotype"),
  accountName: z.string().min(1, "Kontonavn er påkrevet").max(100, "Kontonavn kan ikke være lengre enn 100 tegn"),
  initialDeposit: z.number().min(0, "Innskudd kan ikke være negativt"),
  fixedTermMonths: z.string().optional(),
  confirmTerms: z.boolean().refine(val => val === true, "Du må akseptere vilkårene")
});

type CreateAccountForm = z.infer<typeof createAccountSchema>;

interface Account {
  id: string;
  accountNumber: string;
  accountType: string;
  accountName: string;
  balance: string;
  currency: string;
  interestRate: string;
  minimumBalance: string;
  fixedTermMonths?: string;
  maturityDate?: string;
  nextInterestPayout?: string;
  lastInterestPayout?: string;
  totalInterestEarned: string;
  conditions?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InterestHistory {
  id: string;
  amount: string;
  interestRate: string;
  period: string;
  paymentDate: string;
}

export default function Accounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccountType, setSelectedAccountType] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const form = useForm<CreateAccountForm>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      accountType: "",
      accountName: "",
      initialDeposit: 0,
      fixedTermMonths: "",
      confirmTerms: false
    }
  });

  // Fetch user's accounts
  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts/all"],
  });

  // Fetch interest history for selected account
  const { data: interestHistory } = useQuery<InterestHistory[]>({
    queryKey: ["/api/accounts/interest-history", selectedAccount?.id],
    enabled: !!selectedAccount?.id,
  });

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (data: CreateAccountForm) => {
      const accountType = ACCOUNT_TYPES.find(type => type.id === data.accountType);
      let interestRate = 0;
      let fixedTermMonths = null;
      let maturityDate = null;
      let conditions = {};

      if (data.accountType === "fixed_deposit" && data.fixedTermMonths) {
        const term = accountType?.terms?.find(t => t.months === data.fixedTermMonths);
        interestRate = term?.rate || 0;
        fixedTermMonths = data.fixedTermMonths;
        
        // Calculate maturity date
        const maturity = new Date();
        maturity.setMonth(maturity.getMonth() + parseInt(data.fixedTermMonths));
        maturityDate = maturity.toISOString();
        
        conditions = {
          termMonths: data.fixedTermMonths,
          penaltyRate: term?.penalty || 0,
          earlyWithdrawal: "Tidlig uttak medfører gebyr"
        };
      } else if (data.accountType === "savings") {
        interestRate = accountType?.interestRate || 0;
      }

      const response = await apiRequest("POST", "/api/accounts/create", {
        accountType: data.accountType,
        accountName: data.accountName,
        initialDeposit: data.initialDeposit.toString(),
        interestRate: interestRate.toString(),
        fixedTermMonths,
        maturityDate,
        conditions
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/all"] });
      setShowCreateDialog(false);
      form.reset();
      toast({
        title: "Konto opprettet",
        description: "Din nye konto er nå aktiv og klar til bruk",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Feil ved opprettelse",
        description: error.message || "Kunne ikke opprette konto",
        variant: "destructive",
      });
    },
  });

  const selectedAccountTypeInfo = ACCOUNT_TYPES.find(type => type.id === selectedAccountType);

  const handleCreateAccount = (data: CreateAccountForm) => {
    createAccountMutation.mutate(data);
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return num.toLocaleString('nb-NO', { 
      style: 'currency', 
      currency: 'NOK',
      minimumFractionDigits: 2 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getAccountTypeInfo = (type: string) => {
    return ACCOUNT_TYPES.find(t => t.id === type);
  };

  const filteredAccounts = accounts?.filter(account => {
    if (accountFilter === "all") return true;
    return account.accountType === accountFilter;
  }) || [];

  const totalBalance = accounts?.reduce((sum, account) => 
    sum + parseFloat(account.balance), 0) || 0;

  const totalInterestEarned = accounts?.reduce((sum, account) => 
    sum + parseFloat(account.totalInterestEarned || "0"), 0) || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
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
              Mine kontoer
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Administrer dine bankkontoer og spareordninger
            </p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Opprett ny konto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Opprett ny konto</DialogTitle>
                <DialogDescription>
                  Velg kontotype som passer dine behov. Alle kontoer følger norske bankstandarder.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-6">
                  {/* Account Type Selection */}
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Velg kontotype</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ACCOUNT_TYPES.map((accountType) => {
                        const Icon = accountType.icon;
                        const isSelected = selectedAccountType === accountType.id;
                        
                        return (
                          <motion.div
                            key={accountType.id}
                            className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                              isSelected 
                                ? "border-primary bg-primary/5" 
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => {
                              setSelectedAccountType(accountType.id);
                              form.setValue("accountType", accountType.id);
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`p-2 rounded-lg ${accountType.bgColor}`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-gray-900">{accountType.name}</h3>
                                  {accountType.restricted && (
                                    <Shield className="w-4 h-4 text-orange-500" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{accountType.description}</p>
                                {accountType.interestRate !== undefined && (
                                  <div className="text-sm font-medium text-green-600 mt-2">
                                    {accountType.interestRate}% rente p.a.
                                  </div>
                                )}
                                {accountType.terms && (
                                  <div className="text-sm text-gray-600 mt-2">
                                    Renter: {accountType.terms.map(t => `${t.months} mnd: ${t.rate}%`).join(", ")}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Account Details */}
                  {selectedAccountTypeInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="accountName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kontonavn</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder={`Min ${selectedAccountTypeInfo.name}`}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="initialDeposit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Første innskudd (NOK)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                min={selectedAccountTypeInfo.minDeposit || 0}
                                placeholder="0"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            {selectedAccountTypeInfo.minDeposit > 0 && (
                              <p className="text-sm text-gray-600">
                                Minimum innskudd: {formatCurrency(selectedAccountTypeInfo.minDeposit.toString())}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Fixed Term Selection */}
                      {selectedAccountTypeInfo.id === "fixed_deposit" && (
                        <FormField
                          control={form.control}
                          name="fixedTermMonths"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bindingstid</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Velg bindingstid" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {selectedAccountTypeInfo.terms?.map((term) => (
                                    <SelectItem key={term.months} value={term.months}>
                                      {term.months} måneder - {term.rate}% rente p.a.
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {/* Account Features */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Kontoegenskaper</h4>
                        <ul className="space-y-1">
                          {selectedAccountTypeInfo.features.map((feature, index) => (
                            <li key={index} className="flex items-center text-sm text-gray-600">
                              <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Special Warning for Tax Deduction Account */}
                      {selectedAccountTypeInfo.id === "tax_deduction" && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Skattetrekkskontoer har begrenset tilgang og er kun ment for skattetrekk og avgifter. 
                            Kontoen kan ikke brukes til vanlige transaksjoner.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Terms Acceptance */}
                      <FormField
                        control={form.control}
                        name="confirmTerms"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={field.value}
                                onChange={field.onChange}
                                className="mt-1"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm">
                                Jeg aksepterer vilkårene for kontoen og bekrefter at informasjonen er korrekt
                              </FormLabel>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </motion.div>
                  )}

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowCreateDialog(false)}
                    >
                      Avbryt
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={!selectedAccountTypeInfo || createAccountMutation.isPending}
                    >
                      {createAccountMutation.isPending ? "Oppretter..." : "Opprett konto"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wallet className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total saldo</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(totalBalance.toString())}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Opptjent rente</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(totalInterestEarned.toString())}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Aktive kontoer</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {accounts?.filter(a => a.isActive).length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer kontoer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle kontoer</SelectItem>
                <SelectItem value="savings">Sparekontoer</SelectItem>
                <SelectItem value="fixed_deposit">Fastrenteinnskudd</SelectItem>
                <SelectItem value="everyday">Brukskontoer</SelectItem>
                <SelectItem value="tax_deduction">Skattetrekk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Eksporter
            </Button>
          </div>
        </div>

        {/* Accounts List */}
        {filteredAccounts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {accounts?.length === 0 ? "Ingen kontoer opprettet ennå" : "Ingen kontoer matcher filteret"}
              </h3>
              <p className="text-gray-600 mb-4">
                {accounts?.length === 0 
                  ? "Opprett din første konto for å komme i gang med sparing og banking"
                  : "Prøv å endre filteret for å se andre kontoer"
                }
              </p>
              {accounts?.length === 0 && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Opprett konto
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredAccounts.map((account) => {
              const accountType = getAccountTypeInfo(account.accountType);
              const Icon = accountType?.icon || Wallet;
              
              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="cursor-pointer"
                  onClick={() => setSelectedAccount(account)}
                >
                  <Card className="hover:shadow-lg transition-all duration-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${accountType?.bgColor || "bg-gray-500"}`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{account.accountName}</CardTitle>
                            <CardDescription>
                              {accountType?.name} • {account.accountNumber}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={account.isActive ? "default" : "secondary"}>
                          {account.isActive ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-sm text-gray-500">Saldo</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {formatCurrency(account.balance)}
                            </p>
                          </div>
                          {parseFloat(account.interestRate) > 0 && (
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Rente</p>
                              <p className="text-lg font-semibold text-green-600">
                                {parseFloat(account.interestRate).toFixed(2)}%
                              </p>
                            </div>
                          )}
                        </div>

                        {account.maturityDate && (
                          <div className="flex items-center gap-2 text-sm text-amber-600">
                            <Clock className="w-4 h-4" />
                            <span>Forfaller: {formatDate(account.maturityDate)}</span>
                          </div>
                        )}

                        {account.nextInterestPayout && (
                          <div className="flex items-center gap-2 text-sm text-blue-600">
                            <Calendar className="w-4 h-4" />
                            <span>Neste renteutbetaling: {formatDate(account.nextInterestPayout)}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Opprettet</p>
                            <p className="font-medium">{formatDate(account.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Opptjent rente</p>
                            <p className="font-medium text-green-600">
                              {formatCurrency(account.totalInterestEarned)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Account Detail Dialog */}
        <Dialog open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedAccount?.accountName}</DialogTitle>
              <DialogDescription>
                Detaljert kontoinformasjon og transaksjonshistorikk
              </DialogDescription>
            </DialogHeader>

            {selectedAccount && (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Oversikt</TabsTrigger>
                  <TabsTrigger value="interest">Rentehistorikk</TabsTrigger>
                  <TabsTrigger value="export">Eksporter</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Kontoinformasjon</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Kontonummer:</span>
                          <span className="font-mono">{selectedAccount.accountNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Kontotype:</span>
                          <span>{getAccountTypeInfo(selectedAccount.accountType)?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Valuta:</span>
                          <span>{selectedAccount.currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Rente:</span>
                          <span>{parseFloat(selectedAccount.interestRate).toFixed(2)}% p.a.</span>
                        </div>
                        {selectedAccount.minimumBalance !== "0.00" && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Minimumssaldo:</span>
                            <span>{formatCurrency(selectedAccount.minimumBalance)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Saldo og avkastning</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gjeldende saldo:</span>
                          <span className="text-xl font-bold">
                            {formatCurrency(selectedAccount.balance)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total opptjent rente:</span>
                          <span className="text-lg font-semibold text-green-600">
                            {formatCurrency(selectedAccount.totalInterestEarned)}
                          </span>
                        </div>
                        {selectedAccount.lastInterestPayout && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Siste renteutbetaling:</span>
                            <span>{formatDate(selectedAccount.lastInterestPayout)}</span>
                          </div>
                        )}
                        {selectedAccount.nextInterestPayout && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Neste renteutbetaling:</span>
                            <span>{formatDate(selectedAccount.nextInterestPayout)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {selectedAccount.fixedTermMonths && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Fastrentebetingelser</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Bindingstid</p>
                            <p className="font-medium">{selectedAccount.fixedTermMonths} måneder</p>
                          </div>
                          {selectedAccount.maturityDate && (
                            <div>
                              <p className="text-sm text-gray-500">Forfallsdato</p>
                              <p className="font-medium">{formatDate(selectedAccount.maturityDate)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <Badge variant={new Date() < new Date(selectedAccount.maturityDate || "") ? "default" : "secondary"}>
                              {new Date() < new Date(selectedAccount.maturityDate || "") ? "Aktiv binding" : "Forfall"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="interest" className="space-y-4">
                  {interestHistory && interestHistory.length > 0 ? (
                    <div className="space-y-4">
                      {interestHistory.map((entry) => (
                        <Card key={entry.id}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{entry.period}</p>
                                <p className="text-sm text-gray-500">
                                  Rente: {parseFloat(entry.interestRate).toFixed(2)}%
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-green-600">
                                  {formatCurrency(entry.amount)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {formatDate(entry.paymentDate)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Ingen rentehistorikk tilgjengelig ennå</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="export" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Kontoutskrift</CardTitle>
                        <CardDescription>
                          Last ned detaljert kontoutskrift som PDF
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button className="w-full">
                          <FileText className="w-4 h-4 mr-2" />
                          Last ned PDF
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">CSV Export</CardTitle>
                        <CardDescription>
                          Eksporter transaksjonsdata til regneark
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button variant="outline" className="w-full">
                          <Download className="w-4 h-4 mr-2" />
                          Last ned CSV
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}