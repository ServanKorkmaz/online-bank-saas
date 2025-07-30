import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export interface AuthUser extends User {
  company?: any;
  authMethod?: string;
  isBankIDAuth?: boolean;
  personnummer?: string;
  lastLogin?: Date;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
