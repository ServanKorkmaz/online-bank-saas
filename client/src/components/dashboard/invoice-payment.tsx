import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function InvoicePayment() {
  const [kidNumber, setKidNumber] = useState("");
  const [amount, setAmount] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const paymentMutation = useMutation({
    mutationFn: async ({ kidNumber, amount }: { kidNumber: string; amount: string }) => {
      await apiRequest("POST", "/api/payments/invoice", { kidNumber, amount });
    },
    onSuccess: () => {
      toast({
        title: "Betaling vellykket",
        description: "Fakturabetalingen er gjennomført",
      });
      setKidNumber("");
      setAmount("");
      // Invalidate dashboard data to refresh balances
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Ikke autorisert",
          description: "Du er logget ut. Logger inn på nytt...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Betalingsfeil",
        description: "Kunne ikke gjennomføre betalingen. Prøv igjen senere.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!kidNumber || !amount) {
      toast({
        title: "Manglende informasjon",
        description: "Både KID-nummer og beløp må fylles ut",
        variant: "destructive",
      });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Ugyldig beløp",
        description: "Beløpet må være et gyldig tall større enn 0",
        variant: "destructive",
      });
      return;
    }

    paymentMutation.mutate({ kidNumber, amount: numericAmount.toString() });
  };

  return (
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <CardHeader className="border-b border-gray-200 dark:border-gray-700">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
          Betal faktura
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="kid-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              KID-nummer
            </Label>
            <Input
              type="text"
              id="kid-number"
              value={kidNumber}
              onChange={(e) => setKidNumber(e.target.value)}
              className="mt-1 block w-full"
              placeholder="123456789"
              disabled={paymentMutation.isPending}
            />
          </div>
          
          <div>
            <Label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Beløp
            </Label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400 sm:text-sm">kr</span>
              </div>
              <Input
                type="text"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 block w-full"
                placeholder="0,00"
                disabled={paymentMutation.isPending}
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={paymentMutation.isPending}
          >
            {paymentMutation.isPending ? "Behandler..." : "Betal faktura"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
