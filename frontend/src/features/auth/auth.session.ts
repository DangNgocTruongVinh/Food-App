import type { QueryClient } from "@tanstack/react-query";
import type { AuthResponse, User } from "../../types";
import { clearAuthSession, saveAuthSession, saveStoredUser } from "./auth.storage";

export function acceptAuthSession(queryClient: QueryClient, session: AuthResponse, remember = true) {
  queryClient.clear();
  saveAuthSession(session, remember);
  return session.user;
}

export function endAuthSession(queryClient: QueryClient) {
  queryClient.clear();
  clearAuthSession();
}

export function updateAuthUser(user: User) {
  saveStoredUser(user);
  return user;
}
