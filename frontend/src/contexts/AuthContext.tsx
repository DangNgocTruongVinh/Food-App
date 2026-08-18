import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { api } from "../api/client";
import type { AuthResponse, User } from "../types";

type AuthContextValue = {
  user: User | null; login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>; logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("nutriplan_user");
    return saved ? JSON.parse(saved) : null;
  });
  const acceptAuth = ({ token, user: nextUser }: AuthResponse) => {
    localStorage.setItem("nutriplan_token", token);
    localStorage.setItem("nutriplan_user", JSON.stringify(nextUser));
    setUser(nextUser);
  };
  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: async (email, password) => acceptAuth((await api.post<AuthResponse>("/auth/login", { email, password })).data),
    register: async (name, email, password) => acceptAuth((await api.post<AuthResponse>("/auth/register", { name, email, password })).data),
    logout: () => { localStorage.removeItem("nutriplan_token"); localStorage.removeItem("nutriplan_user"); setUser(null); },
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth phải được dùng trong AuthProvider");
  return value;
}
