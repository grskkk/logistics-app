import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "session";
const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

const PASSWORD = process.env.AUTH_PASSWORD ?? "";
// Secret for signing session tokens. Falls back to a value derived from the
// password so a single env var is enough to get started, but set AUTH_SECRET
// explicitly in production so sessions survive a password change.
const SECRET =
  process.env.AUTH_SECRET ||
  crypto.createHash("sha256").update("logistics:" + PASSWORD).digest("hex");

/** Auth is only enforced when a shared password has been configured. */
export const authEnabled = PASSWORD.length > 0;

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

/** Create a signed token of the form `<expiryMs>.<signature>`. */
function createToken(): string {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${sign(exp)}`;
}

/** Return true only for a well-formed, correctly-signed, unexpired token. */
function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(exp);
  // Constant-time compare; guard against length mismatch which throws.
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expMs = Number(exp);
  return Number.isFinite(expMs) && expMs > Date.now();
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

/** True if the incoming request carries a valid session cookie. */
export function isAuthenticated(req: Request): boolean {
  const cookies = parseCookies(req.headers.cookie);
  return verifyToken(cookies[COOKIE_NAME]);
}

function isHttps(req: Request): boolean {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

function setSessionCookie(req: Request, res: Response): void {
  res.cookie(COOKIE_NAME, createToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(req),
    maxAge: SESSION_MS,
    path: "/",
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/**
 * Verify the shared password (constant-time) and, on success, issue a session
 * cookie. Returns whether login succeeded.
 */
export function login(req: Request, res: Response, password: unknown): boolean {
  if (!authEnabled) return false;
  if (typeof password !== "string") return false;
  const a = Buffer.from(password);
  const b = Buffer.from(PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (ok) setSessionCookie(req, res);
  return ok;
}

export function logout(res: Response): void {
  clearSessionCookie(res);
}

/** Express guard: blocks requests without a valid session (no-op if disabled). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled || isAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
}
