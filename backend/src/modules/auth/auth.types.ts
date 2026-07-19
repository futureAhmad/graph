export type UserRole = "admin" | "user";

export interface AuthenticatedUser {
  userId: number;
  username: string;
  displayName: string;
  role: UserRole;
  isApproved: boolean;
}

export interface AuthenticatedRequest {
  headers: {
    cookie?: string;
  };
  user?: AuthenticatedUser;
}
