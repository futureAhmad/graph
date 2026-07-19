import { apiClient } from "@/lib/api";
import type { AuthUser, LoginResult } from "./auth.types";

export function getCurrentUser() {
  return apiClient<AuthUser | null>("/auth/me");
}

export function loginUser(username: string, password: string) {
  return apiClient<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function requestAccess(username: string, password: string) {
  return apiClient<{ message: string }>("/auth/request-access", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function logoutUser() {
  return apiClient<{ ok: true }>("/auth/logout", { method: "POST" });
}
