import { apiClient } from "@/lib/api";
import type { AuthUser } from "@/features/auth/auth.types";

export type UserFormPayload = {
  username: string;
  displayName: string;
  password: string;
  role: "admin" | "user";
  isApproved: boolean;
};

export function listUsers() {
  return apiClient<AuthUser[]>("/users");
}

export function createUser(payload: UserFormPayload) {
  return apiClient<AuthUser>("/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateUser(userId: number, payload: Partial<UserFormPayload>) {
  return apiClient<AuthUser>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteUser(userId: number) {
  return apiClient<{ deleted: true }>(`/users/${userId}`, { method: "DELETE" });
}
