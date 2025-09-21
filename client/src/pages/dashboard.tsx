import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import AccountCards from "@/components/dashboard/account-cards";
import TransactionList from "@/components/dashboard/transaction-list";
import QuickActions from "@/components/dashboard/quick-actions";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  interface DashboardData {
    company: any;
    accounts: any[];
    transactions: any[];
    pendingInvoices: number;
    summary: {
      totalBalance: number;
      monthlyRevenue: number;
      pendingInvoicesCount: number;
      overdueAmount: number;
    };
  }

  const { data: dashboardData, isLoading: dashboardLoading, error } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Ikke autorisert",
        description: "Du er logget ut. Logger inn på nytt...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  if (isLoading || dashboardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Ingen data tilgjengelig
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Kunne ikke laste inn dashboard-data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bedriftsoversikt</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Velkommen tilbake, {user?.firstName || 'bruker'}. Her er en oversikt over din bedrifts økonomi.
            </p>
            {user?.isBankIDAuth && (
              <div className="mt-2 flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600 dark:text-green-400">
                  Autentisert med BankID
                </span>
                {user?.personnummer && (
                  <span className="text-xs text-gray-500">
                    (ID: {user.personnummer.replace(/(\d{6})(\d{5})/, '$1*****')})
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {user?.isBankIDAuth ? (
              <a
                href="/api/auth/bankid/logout"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logg ut (BankID)
              </a>
            ) : (
              <a
                href="/api/logout"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Logg ut
              </a>
            )}
          </div>
        </div>

        {/* Account Overview Cards */}
        <AccountCards summary={dashboardData.summary} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Transactions */}
          <div className="lg:col-span-2">
            <TransactionList transactions={dashboardData.transactions} />
          </div>

          {/* Quick Actions */}
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
