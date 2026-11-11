import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import * as authApi from "../features/auth/auth.api";
import { acceptAuthSession, endAuthSession, updateAuthUser } from "../features/auth/auth.session";
import { getStoredUser, saveRememberLoginPreference } from "../features/auth/auth.storage";
import type { User } from "../types";

type AuthContextValue = {
  // login/register trả người dùng vừa đăng nhập để chọn trang mở tiếp theo vai trò (postLoginPath).
  user: User | null; login: (email: string, password: string, remember?: boolean) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>; logout: () => void;
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
      const signedIn = acceptAuthSession(queryClient, await authApi.login({ email, password, remember }), remember);
      setUser(signedIn);
      saveRememberLoginPreference(remember);
      return signedIn;
    },
    register: async (name, email, password) => {
      const signedIn = acceptAuthSession(queryClient, await authApi.register({ name, email, password }));
      setUser(signedIn);
      return signedIn;
    },
    logout: () => {
      // Thu hồi refresh token phía server (cookie gửi kèm tự động); lỗi mạng không chặn việc đăng xuất ở máy này.
      void authApi.logout().catch(() => undefined);
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
