const BASE = "/api";

// Emitted whenever the API rejects a request with 401, so the app can drop
// back to the login screen.
export const AUTH_EVENT = "auth:unauthorized";

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT));
    throw new Error("Not authenticated");
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  return handle<T>(res);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", credentials: "include" });
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT));
    throw new Error("Not authenticated");
  }
  if (!res.ok) throw new Error(await res.text());
}

// --- Auth ---
async function me(): Promise<{ authenticated: boolean; authEnabled: boolean }> {
  const res = await fetch(`${BASE}/me`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to check auth");
  return res.json();
}

async function login(password: string): Promise<void> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(msg.error ?? "Login failed");
  }
}

async function logout(): Promise<void> {
  await fetch(`${BASE}/logout`, { method: "POST", credentials: "include" });
}

export const api = { get, post, put, del, me, login, logout };
