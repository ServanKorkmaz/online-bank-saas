import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { 
  Shield, 
  Smartphone, 
  CreditCard, 
  TrendingUp, 
  Users, 
  Zap,
  CheckCircle,
  ArrowRight,
  Building2,
  FileText,
  DollarSign,
  BarChart3,
  Key
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface BankIDStatus {
  demoMode: boolean;
  available: boolean;
  configured: boolean;
}

export default function Landing() {
  // Check BankID status
  const { data: bankIdStatus } = useQuery<BankIDStatus>({
    queryKey: ["/api/auth/bankid/status"],
    retry: false,
  });

  const handleBankIDLogin = () => {
    window.location.href = "/api/auth/bankid";
  };

  const handleReplitLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="bg-primary rounded-2xl p-4 shadow-lg">
                <Building2 className="h-12 w-12 text-primary-foreground" />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Norges nye
              <span className="text-primary"> bedriftsbank</span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
              Sikker, moderne og effektiv banking for norske bedrifter. Med BankID-innlogging, 
              PSD2-integrering og automatisert fakturahåndtering.
            </p>

            {bankIdStatus?.demoMode && (
              <Badge className="mb-8 bg-yellow-100 text-yellow-800 border-yellow-300">
                Demo Mode - Testmiljø aktivt
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Login Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        <div className="grid md:grid-cols-2 gap-8">
          {/* BankID Login */}
          <Card className="border-2 border-primary/20 shadow-xl">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="bg-primary/10 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Logg inn med BankID
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Trygg og sikker innlogging med din vanlige BankID
                </p>
              </div>

              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                  Bank-standard sikkerhet
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                  Samme innlogging som din bank
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                  Ingen nye passord å huske
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                  GDPR-kompatibel og norsk lagring
                </li>
              </ul>

              <Button 
                onClick={handleBankIDLogin}
                className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90"
                disabled={!bankIdStatus?.available}
              >
                <Key className="mr-2 h-5 w-5" />
                Logg inn med BankID
              </Button>

              {bankIdStatus?.demoMode && (
                <p className="text-xs text-center text-yellow-600 dark:text-yellow-400 mt-3">
                  Testmodus: Velg blant forhåndsdefinerte testbrukere
                </p>
              )}
            </CardContent>
          </Card>

          {/* Alternative Login */}
          <Card className="shadow-lg">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Users className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Utvikler-innlogging
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  For testing og utviklingsformål
                </p>
              </div>

              <ul className="space-y-3 mb-6 text-sm">
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-blue-500 mr-3" />
                  Rask tilgang for utviklere
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-blue-500 mr-3" />
                  Testing og demo
                </li>
                <li className="flex items-center text-gray-700 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-blue-500 mr-3" />
                  Ikke for produksjonsbruk
                </li>
              </ul>

              <Button 
                onClick={handleReplitLogin}
                variant="outline"
                className="w-full h-12 text-lg font-semibold"
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                Utvikler-innlogging
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Alt du trenger for bedriftsbanking
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Inspirert av Revolut, bygget for norske bedrifter med full regelverksetterlevelse
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-3 w-12 h-12 mb-4">
                <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                PSD2 Bankintegrering
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Direkte tilkobling til alle norske banker via Tink og Neonomics. 
                Sanntidsbalanse og transaksjoner.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="bg-green-100 dark:bg-green-900 rounded-lg p-3 w-12 h-12 mb-4">
                <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Smart Fakturahåndtering
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Automatisk KID-nummerkjending, batch-betaling og 
                integrasjon med regnskapssystemer.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="bg-purple-100 dark:bg-purple-900 rounded-lg p-3 w-12 h-12 mb-4">
                <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                KYC/AML Compliance
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                SumSub-integrert identitetsverifisering og automatisk 
                AML-screening for norsk regelverk.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="bg-orange-100 dark:bg-orange-900 rounded-lg p-3 w-12 h-12 mb-4">
                <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Sanntids Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Avansert cash flow-analyse, automatisk kategorisering 
                og prediktiv økonomisk innsikt.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="bg-red-100 dark:bg-red-900 rounded-lg p-3 w-12 h-12 mb-4">
                <Zap className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Øyeblikkelige Overføringer
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Instant SEPA, Vipps integration og automatiserte 
                lønnskjøringer med full revisjonsspor.
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <div className="bg-teal-100 dark:bg-teal-900 rounded-lg p-3 w-12 h-12 mb-4">
                <Smartphone className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Mobil-først Design
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Responsiv Progressive Web App med offline-support 
                og push-notifikasjoner for kritisk aktivitet.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Norsk fintech-løsning bygget for fremtiden
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              GDPR-kompatibel • Norsk datalagring • Bank-standard sikkerhet
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}