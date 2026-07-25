import { createContext, useContext } from "react";

export type UserSession = {
  id: number | string;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  roles: string[] | Record<string, string>;
};

type AuthContextType = {
  user: UserSession | null;
  setUser: (u: UserSession | null) => void;
  loading: boolean;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  loading: true,
  logout: async () => {},
});

export function useSession() {
  return useContext(AuthContext);
}

export function getUserRoles(user: UserSession | null): string[] {
  if (!user || !user.roles) return [];
  const raw = Array.isArray(user.roles) ? user.roles : Object.values(user.roles);
  return raw
    .map((r: any) => (typeof r === "string" ? r : r?.name ?? ""))
    .filter(Boolean);
}

export function useIsAdmin(): boolean {
  const { user } = useSession();
  const roles = getUserRoles(user);
  return roles.includes("super_admin") || roles.includes("admin");
}

export function useCanEditFinancials(): boolean {
  const { user } = useSession();
  const roles = getUserRoles(user);
  return (
    roles.includes("super_admin") ||
    roles.includes("admin") ||
    roles.includes("user")
  );
}
