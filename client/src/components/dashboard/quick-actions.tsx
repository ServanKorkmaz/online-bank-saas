import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InvoicePayment from "@/components/dashboard/invoice-payment";

export default function QuickActions() {
  const handleTransfer = () => {
    // TODO: Open transfer dialog
    console.log("Open transfer dialog");
  };

  const handleExport = () => {
    // TODO: Open export dialog
    console.log("Open export dialog");
  };

  const handleKYC = () => {
    // TODO: Open KYC verification flow with SumSub
    console.log("Open KYC verification");
  };

  return (
    <div className="space-y-6">
      {/* Invoice Payment Section */}
      <InvoicePayment />

      {/* Quick Actions */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
            Hurtighandlinger
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <Button
            variant="outline"
            className="w-full flex items-center justify-between p-3 text-left border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
            onClick={handleTransfer}
          >
            <div className="flex items-center space-x-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
              </svg>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Overfør penger</span>
            </div>
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </Button>

          <Button
            variant="outline"
            className="w-full flex items-center justify-between p-3 text-left border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
            onClick={handleExport}
          >
            <div className="flex items-center space-x-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Eksporter data</span>
            </div>
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </Button>

          <Button
            variant="outline"
            className="w-full flex items-center justify-between p-3 text-left border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
            onClick={handleKYC}
          >
            <div className="flex items-center space-x-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Verifiser identitet</span>
            </div>
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </Button>
        </CardContent>
      </Card>

      {/* Security Status */}
      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-6">
        <div className="flex items-center space-x-3">
          <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Kontoen er sikker</h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">Alle sikkerhetstiltak er aktivert</p>
          </div>
        </div>
      </div>
    </div>
  );
}
