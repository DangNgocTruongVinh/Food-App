import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import * as authApi from "../features/auth/auth.api";
import { acceptAuthSession, endAuthSession, updateAuthUser } from "../features/auth/auth.session";
import { getStoredUser, saveRememberLoginPreference } from "../features/auth/auth.storage";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null; login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>; logout: () => void;
  syncUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(getStoredUser);
  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: async (email, password, remember = true) => {
      setUser(acceptAuthSession(queryClient, await authApi.login({ email, password }), remember));
      saveRememberLoginPreference(remember);
    },
    register: async (name, email, password) => setUser(acceptAuthSession(queryClient, await authApi.register({ name, email, password }))),
    logout: () => {
      endAuthSession(queryClient);
      setUser(null);
      navigate("/login", { replace: true });
    },
    syncUser: (nextUser) => setUser(updateAuthUser(nextUser)),
  }), [navigate, queryClient, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth phải được dùng trong AuthProvider");
  return value;
}
