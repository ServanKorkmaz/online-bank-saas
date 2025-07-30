import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Admin() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
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

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast({
        title: "Ingen tilgang",
        description: "Du har ikke tilgang til admin-panelet.",
        variant: "destructive",
      });
      window.location.href = "/";
      return;
    }
  }, [user, toast]);

  const { data: companies, isLoading: companiesLoading, error } = useQuery<any[]>({
    queryKey: ["/api/admin/companies"],
    enabled: isAuthenticated && user?.role === "admin",
    retry: false,
  });

  const verifyCompanyMutation = useMutation({
    mutationFn: async ({ companyId, status, notes }: { companyId: string; status: string; notes: string }) => {
      await apiRequest("POST", `/api/admin/companies/${companyId}/verify`, { status, notes });
    },
    onSuccess: () => {
      toast({
        title: "Suksess",
        description: "Bedrift verifisert",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
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
        title: "Feil",
        description: "Kunne ikke verifisere bedrift",
        variant: "destructive",
      });
    },
  });

  if (isLoading || companiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && isUnauthorizedError(error as Error)) {
    return null; // Will redirect via useEffect
  }

  const handleVerifyCompany = (companyId: string, status: string) => {
    verifyCompanyMutation.mutate({
      companyId,
      status,
      notes: `${status === "verified" ? "Godkjent" : "Avvist"} av admin ${new Date().toLocaleDateString()}`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Verifisert</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Avvist</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Venter</Badge>;
    }
  };

  return (
    <div className="py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Administrer bedriftsverifiseringer og brukerrettigheter
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bedriftsverifiseringer</CardTitle>
          </CardHeader>
          <CardContent>
            {!companies || companies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">Ingen bedrifter registrert</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bedriftsnavn</TableHead>
                      <TableHead>Org.nr</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registrert</TableHead>
                      <TableHead>Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company: any) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.orgNumber}</TableCell>
                        <TableCell>{getStatusBadge(company.kycStatus)}</TableCell>
                        <TableCell>
                          {new Date(company.createdAt).toLocaleDateString('no-NO')}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {company.kycStatus === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleVerifyCompany(company.id, "verified")}
                                  disabled={verifyCompanyMutation.isPending}
                                >
                                  Godkjenn
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleVerifyCompany(company.id, "rejected")}
                                  disabled={verifyCompanyMutation.isPending}
                                >
                                  Avvis
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
