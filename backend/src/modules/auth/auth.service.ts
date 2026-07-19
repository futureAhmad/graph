import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PostgresService } from "../postgres/postgres.service";
import { CreateUserDto, LoginDto, UpdateUserDto } from "./dto/auth.dto";
import { AuthenticatedRequest, AuthenticatedUser } from "./auth.types";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "sid";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;
const DEFAULT_SESSION_SECRET = "local-dev-session-secret-change-me";

type UserRow = {
  user_id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: "admin" | "user";
  is_approved: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly postgres: PostgresService,
    private readonly config: ConfigService
  ) {}

  async login(dto: LoginDto): Promise<{ user: AuthenticatedUser; cookie: string } | { message: string }> {
    const username = normalizeUsername(dto.username);
    const user = await this.findUserByUsername(username);
    if (!user) {
      const firstUser = await this.createFirstUser(dto);
      if (firstUser) {
        const authenticatedUser = toAuthenticatedUser(firstUser);
        const sessionToken = createSessionToken(authenticatedUser, this.sessionSecret());
        return {
          user: authenticatedUser,
          cookie: buildSessionCookie(sessionToken, SESSION_MAX_AGE_SECONDS)
        };
      }
      throw new UnauthorizedException("User does not exist. Request access first.");
    }

    if (!user.is_approved) {
      throw new ForbiddenException("Your account is waiting for admin approval.");
    }

    if (!(await verifyPassword(dto.password, user.password_hash))) {
      throw new UnauthorizedException("Password is wrong.");
    }

    const authenticatedUser = toAuthenticatedUser(user);
    const sessionToken = createSessionToken(authenticatedUser, this.sessionSecret());

    return {
      user: authenticatedUser,
      cookie: buildSessionCookie(sessionToken, SESSION_MAX_AGE_SECONDS)
    };
  }

  async requestAccess(dto: LoginDto): Promise<{ message: string }> {
    const username = normalizeUsername(dto.username);
    const existing = await this.findUserByUsername(username);
    if (existing?.is_approved) {
      return { message: "This account already exists. Please sign in." };
    }
    if (existing && !existing.is_approved) {
      return { message: "Your access request is under review by admins." };
    }

    const passwordHash = await hashPassword(dto.password);
    await this.postgres.query(
      `
      INSERT INTO app_user (username, display_name, password_hash, role, is_approved)
      VALUES ($1, $2, $3, 'user', false)
      ON CONFLICT (username) DO NOTHING
      `,
      [username, username, passwordHash]
    );
    return { message: "Access request sent to admins for approval." };
  }

  logout(): { cookie: string } {
    return { cookie: buildSessionCookie("", 0) };
  }

  async currentUser(request: AuthenticatedRequest): Promise<AuthenticatedUser | null> {
    const sessionToken = getCookie(request, SESSION_COOKIE);
    if (!sessionToken) {
      return null;
    }

    const session = verifySessionToken(sessionToken, this.sessionSecret());
    if (!session) {
      return null;
    }

    const user = await this.getUserRow(session.userId);
    if (!user.is_approved) {
      return null;
    }
    return toAuthenticatedUser(user);
  }

  async requireUser(request: AuthenticatedRequest): Promise<AuthenticatedUser> {
    const user = await this.currentUser(request);
    if (!user) {
      throw new UnauthorizedException("Login required.");
    }
    return user;
  }

  async requireAdmin(request: AuthenticatedRequest): Promise<AuthenticatedUser> {
    const user = await this.requireUser(request);
    if (user.role !== "admin") {
      throw new ForbiddenException("Admin access required.");
    }
    return user;
  }

  async listUsers(): Promise<AuthenticatedUser[]> {
    const result = await this.postgres.query<UserRow>(
      `
      SELECT user_id::text, username, display_name, password_hash, role, is_approved
      FROM app_user
      ORDER BY is_approved, role, username
      `
    );
    return result.rows.map(toAuthenticatedUser);
  }

  async createUser(dto: CreateUserDto): Promise<AuthenticatedUser> {
    const passwordHash = await hashPassword(dto.password);
    const result = await this.postgres.query<UserRow>(
      `
      INSERT INTO app_user (username, display_name, password_hash, role, is_approved)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id::text, username, display_name, password_hash, role, is_approved
      `,
      [normalizeUsername(dto.username), dto.displayName.trim(), passwordHash, dto.role, dto.isApproved ?? true]
    );
    return toAuthenticatedUser(result.rows[0]);
  }

  async updateUser(userId: number, dto: UpdateUserDto): Promise<AuthenticatedUser> {
    const existing = await this.getUserRow(userId);
    const passwordHash = dto.password ? await hashPassword(dto.password) : existing.password_hash;
    const result = await this.postgres.query<UserRow>(
      `
      UPDATE app_user
      SET display_name = $2,
          role = $3,
          password_hash = $4,
          is_approved = $5,
          updated_at = now()
      WHERE user_id = $1
      RETURNING user_id::text, username, display_name, password_hash, role, is_approved
      `,
      [
        userId,
        dto.displayName?.trim() || existing.display_name,
        dto.role ?? existing.role,
        passwordHash,
        dto.isApproved ?? existing.is_approved
      ]
    );
    return toAuthenticatedUser(result.rows[0]);
  }

  async deleteUser(userId: number, currentUserId: number): Promise<{ deleted: true }> {
    if (userId === currentUserId) {
      throw new ForbiddenException("You cannot delete your own account.");
    }
    await this.postgres.query("DELETE FROM app_user WHERE user_id = $1", [userId]);
    return { deleted: true };
  }

  private async createFirstUser(dto: LoginDto): Promise<UserRow | null> {
    const result = await this.postgres.query<{ count: string }>("SELECT count(*)::text AS count FROM app_user");
    const isFirstUser = Number(result.rows[0]?.count ?? 0) === 0;
    if (!isFirstUser) {
      return null;
    }
    const username = normalizeUsername(dto.username);
    const passwordHash = await hashPassword(dto.password);
    const created = await this.postgres.query<UserRow>(
      `
      INSERT INTO app_user (username, display_name, password_hash, role, is_approved)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO NOTHING
      RETURNING user_id::text, username, display_name, password_hash, role, is_approved
      `,
      [username, username, passwordHash, isFirstUser ? "admin" : "user", isFirstUser]
    );
    const user = created.rows[0] ?? (await this.findUserByUsername(username));
    return user;
  }

  private sessionSecret(): string {
    return this.config.get<string>("AUTH_SESSION_SECRET", DEFAULT_SESSION_SECRET);
  }

  private async findUserByUsername(username: string): Promise<UserRow | null> {
    const result = await this.postgres.query<UserRow>(
      `
      SELECT user_id::text, username, display_name, password_hash, role, is_approved
      FROM app_user
      WHERE username = $1
      `,
      [normalizeUsername(username)]
    );
    return result.rows[0] ?? null;
  }

  private async getUserRow(userId: number): Promise<UserRow> {
    const result = await this.postgres.query<UserRow>(
      `
      SELECT user_id::text, username, display_name, password_hash, role, is_approved
      FROM app_user
      WHERE user_id = $1
      `,
      [userId]
    );
    if (!result.rows[0]) {
      throw new UnauthorizedException("User not found.");
    }
    return result.rows[0];
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function toAuthenticatedUser(row: UserRow): AuthenticatedUser {
  return {
    userId: Number(row.user_id),
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isApproved: row.is_approved
  };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

type SessionPayload = {
  userId: number;
  exp: number;
};

function createSessionToken(user: AuthenticatedUser, secret: string): string {
  const payload: SessionPayload = {
    userId: user.userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

function verifySessionToken(token: string, secret: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!Number.isInteger(payload.userId) || !Number.isInteger(payload.exp)) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function buildSessionCookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function getCookie(request: AuthenticatedRequest, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
