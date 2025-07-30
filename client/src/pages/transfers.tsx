import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, Globe, MapPin, CreditCard, Shield, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { motion } from "framer-motion";

// Validation schemas
const domesticTransferSchema = z.object({
  recipientName: z.string().min(2, "Mottakers navn må være minst 2 tegn"),
  accountNumber: z.string().regex(/^\d{11}$/, "Kontonummer må være 11 siffer"),
  amount: z.number().min(1, "Beløp må være større enn 0").max(1000000, "Maksimalt beløp er 1.000.000 NOK"),
  kidOrMessage: z.string().optional(),
  transferDate: z.string(),
  saveRecipient: z.boolean().default(false),
});

const internationalTransferSchema = z.object({
  recipientName: z.string().min(2, "Mottakers navn må være minst 2 tegn"),
  country: z.string().min(1, "Velg land"),
  iban: z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/, "Ugyldig IBAN format"),
  bic: z.string().regex(/^[A-Z]{6}[A-Z2-9][A-NP-Z1-9]([A-Z0-9]{3})?$/, "Ugyldig BIC/SWIFT format"),
  currency: z.string().min(1, "Velg valuta"),
  amount: z.number().min(1, "Beløp må være større enn 0"),
  message: z.string().max(140, "Maks 140 tegn").optional(),
});

type DomesticTransfer = z.infer<typeof domesticTransferSchema>;
type InternationalTransfer = z.infer<typeof internationalTransferSchema>;

const countries = [
  { code: "SE", name: "Sverige" },
  { code: "DK", name: "Danmark" },
  { code: "FI", name: "Finland" },
  { code: "DE", name: "Tyskland" },
  { code: "GB", name: "Storbritannia" },
  { code: "US", name: "USA" },
  { code: "FR", name: "Frankrike" },
  { code: "ES", name: "Spania" },
  { code: "IT", name: "Italia" },
  { code: "NL", name: "Nederland" },
];

const currencies = [
  { code: "EUR", name: "Euro", rate: 11.45 },
  { code: "USD", name: "US Dollar", rate: 10.87 },
  { code: "GBP", name: "Britiske pund", rate: 13.72 },
  { code: "SEK", name: "Svenske kroner", rate: 1.02 },
  { code: "DKK", name: "Danske kroner", rate: 1.54 },
];

export default function Transfers() {
  const { toast } = useToast();
  const [transferType, setTransferType] = useState<"domestic" | "international">("domestic");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transferData, setTransferData] = useState<DomesticTransfer | InternationalTransfer | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");

  const domesticForm = useForm<DomesticTransfer>({
    resolver: zodResolver(domesticTransferSchema),
    defaultValues: {
      transferDate: new Date().toISOString().split('T')[0],
      saveRecipient: false,
    },
  });

  const internationalForm = useForm<InternationalTransfer>({
    resolver: zodResolver(internationalTransferSchema),
    defaultValues: {
      currency: "EUR",
    },
  });

  // Mod-11 validation for Norwegian account numbers
  const validateAccountNumber = (accountNumber: string): boolean => {
    if (!/^\d{11}$/.test(accountNumber)) return false;
    
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    
    for (let i = 0; i < 10; i++) {
      sum += parseInt(accountNumber[i]) * weights[i];
    }
    
    const remainder = sum % 11;
    const controlDigit = remainder === 0 ? 0 : 11 - remainder;
    
    return controlDigit === parseInt(accountNumber[10]);
  };

  const onDomesticSubmit = (data: DomesticTransfer) => {
    if (!validateAccountNumber(data.accountNumber)) {
      toast({
        title: "Ugyldig kontonummer",
        description: "Kontonummeret har feil kontrollsiffer",
        variant: "destructive",
      });
      return;
    }
    
    setTransferData(data);
    setShowConfirmation(true);
  };

  const onInternationalSubmit = (data: InternationalTransfer) => {
    setTransferData(data);
    setShowConfirmation(true);
  };

  const confirmTransfer = async () => {
    try {
      // Here you would integrate with your payment processor
      toast({
        title: "Overføring sendt",
        description: "Overføringen er behandlet og vil bli gjennomført i løpet av kort tid",
      });
      
      setShowConfirmation(false);
      setTransferData(null);
      
      // Reset forms
      if (transferType === "domestic") {
        domesticForm.reset();
      } else {
        internationalForm.reset();
      }
    } catch (error) {
      toast({
        title: "Feil",
        description: "Noe gikk galt. Prøv igjen senere.",
        variant: "destructive",
      });
    }
  };

  const getCurrencyRate = (currencyCode: string) => {
    return currencies.find(c => c.code === currencyCode)?.rate || 1;
  };

  const calculateConversion = (amount: number, currencyCode: string) => {
    const rate = getCurrencyRate(currencyCode);
    return amount * rate;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Overføringer
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Send penger til kontoer i Norge eller utlandet
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              Sikker overføring
            </CardTitle>
            <CardDescription>
              Alle overføringer er kryptert og beskyttes av bankens sikkerhetssystemer
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={transferType} onValueChange={(value) => setTransferType(value as "domestic" | "international")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="domestic" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Norge
            </TabsTrigger>
            <TabsTrigger value="international" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Utlandet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="domestic">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Overføring i Norge
                  </CardTitle>
                  <CardDescription>
                    Send penger til norske kontoer med kontonummer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={domesticForm.handleSubmit(onDomesticSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="recipientName">Mottakers navn</Label>
                        <Input
                          id="recipientName"
                          {...domesticForm.register("recipientName")}
                          placeholder="Ola Nordmann"
                        />
                        {domesticForm.formState.errors.recipientName && (
                          <p className="text-sm text-red-600 mt-1">
                            {domesticForm.formState.errors.recipientName.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="accountNumber">Kontonummer</Label>
                        <Input
                          id="accountNumber"
                          {...domesticForm.register("accountNumber")}
                          placeholder="12345678901"
                          maxLength={11}
                        />
                        {domesticForm.formState.errors.accountNumber && (
                          <p className="text-sm text-red-600 mt-1">
                            {domesticForm.formState.errors.accountNumber.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="amount">Beløp (NOK)</Label>
                        <Input
                          id="amount"
                          type="number"
                          {...domesticForm.register("amount", { valueAsNumber: true })}
                          placeholder="1000"
                          min="1"
                          max="1000000"
                        />
                        {domesticForm.formState.errors.amount && (
                          <p className="text-sm text-red-600 mt-1">
                            {domesticForm.formState.errors.amount.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="transferDate">Overføringsdato</Label>
                        <Input
                          id="transferDate"
                          type="date"
                          {...domesticForm.register("transferDate")}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="kidOrMessage">KID eller melding (valgfritt)</Label>
                      <Textarea
                        id="kidOrMessage"
                        {...domesticForm.register("kidOrMessage")}
                        placeholder="KID-nummer eller melding til mottaker"
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="saveRecipient"
                        {...domesticForm.register("saveRecipient")}
                      />
                      <Label htmlFor="saveRecipient">Lagre mottaker for fremtidige overføringer</Label>
                    </div>

                    <Button type="submit" className="w-full" size="lg">
                      Fortsett til bekreftelse
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="international">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Internasjonal overføring
                  </CardTitle>
                  <CardDescription>
                    Send penger til utlandet med IBAN og SWIFT
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={internationalForm.handleSubmit(onInternationalSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="intRecipientName">Mottakers navn</Label>
                        <Input
                          id="intRecipientName"
                          {...internationalForm.register("recipientName")}
                          placeholder="John Smith"
                        />
                        {internationalForm.formState.errors.recipientName && (
                          <p className="text-sm text-red-600 mt-1">
                            {internationalForm.formState.errors.recipientName.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="country">Land</Label>
                        <Select onValueChange={(value) => internationalForm.setValue("country", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Velg land" />
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {internationalForm.formState.errors.country && (
                          <p className="text-sm text-red-600 mt-1">
                            {internationalForm.formState.errors.country.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="iban">IBAN</Label>
                        <Input
                          id="iban"
                          {...internationalForm.register("iban")}
                          placeholder="GB82 WEST 1234 5698 7654 32"
                          className="font-mono"
                        />
                        {internationalForm.formState.errors.iban && (
                          <p className="text-sm text-red-600 mt-1">
                            {internationalForm.formState.errors.iban.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="bic">BIC/SWIFT</Label>
                        <Input
                          id="bic"
                          {...internationalForm.register("bic")}
                          placeholder="DEUTDEFF"
                          className="font-mono"
                        />
                        {internationalForm.formState.errors.bic && (
                          <p className="text-sm text-red-600 mt-1">
                            {internationalForm.formState.errors.bic.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="currency">Valuta</Label>
                        <Select onValueChange={(value) => {
                          internationalForm.setValue("currency", value);
                          setSelectedCurrency(value);
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Velg valuta" />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.code} - {currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="intAmount">Beløp</Label>
                        <Input
                          id="intAmount"
                          type="number"
                          {...internationalForm.register("amount", { valueAsNumber: true })}
                          placeholder="1000"
                          min="1"
                        />
                        {selectedCurrency && (
                          <p className="text-sm text-gray-600 mt-1">
                            Omtrent {calculateConversion(internationalForm.watch("amount") || 0, selectedCurrency).toFixed(2)} NOK
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedCurrency && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-blue-800 dark:text-blue-200">Valutakurs</span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          1 {selectedCurrency} = {getCurrencyRate(selectedCurrency)} NOK
                        </p>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="message">Melding til mottaker (valgfritt)</Label>
                      <Textarea
                        id="message"
                        {...internationalForm.register("message")}
                        placeholder="Melding til mottaker (maks 140 tegn)"
                        rows={3}
                        maxLength={140}
                      />
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="font-medium text-amber-800 dark:text-amber-200">Leveringstid</span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Internasjonale overføringer tar vanligvis 1-3 virkedager
                      </p>
                    </div>

                    <Button type="submit" className="w-full" size="lg">
                      Fortsett til bekreftelse
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Bekreft overføring
            </DialogTitle>
            <DialogDescription>
              Kontroller at alle opplysninger er korrekte før du sender
            </DialogDescription>
          </DialogHeader>

          {transferData && (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium">Mottaker:</span>
                  <span>{transferData.recipientName}</span>
                </div>
                
                {"accountNumber" in transferData ? (
                  <div className="flex justify-between">
                    <span className="font-medium">Kontonummer:</span>
                    <span className="font-mono">{transferData.accountNumber}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="font-medium">IBAN:</span>
                      <span className="font-mono text-sm">{transferData.iban}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">BIC/SWIFT:</span>
                      <span className="font-mono">{transferData.bic}</span>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex justify-between">
                  <span className="font-medium">Beløp:</span>
                  <span className="font-bold">
                    {transferData.amount.toLocaleString()} {
                      "currency" in transferData ? transferData.currency : "NOK"
                    }
                  </span>
                </div>

                {"currency" in transferData && transferData.currency !== "NOK" && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Omtrent:</span>
                    <span>{calculateConversion(transferData.amount, transferData.currency).toFixed(2)} NOK</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Overføringen kan ikke angres etter sending</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Avbryt
            </Button>
            <Button onClick={confirmTransfer}>
              Send overføring
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}