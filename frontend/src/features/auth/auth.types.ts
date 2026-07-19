export type AuthUser = {
  userId: number;
  username: string;
  displayName: string;
  role: "admin" | "user";
  isApproved: boolean;
};

export type LoginResult = AuthUser | { message: string };
