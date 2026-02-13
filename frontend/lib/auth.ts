/**
 * Auth utilities - token storage and API helpers.
 */
import {
  getAuthLoginUrl,
  getAuthRegisterUrl,
  getAuthMeUrl,
} from "./api";

const TOKEN_KEY = "architectai_token";

export interface User {
  id: number;
  email: string;
  username: string | null;
  plan: string;
  diagrams_this_month: number;
  tokens_used_this_month: number;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  // Clear chat messages and user ID when logging out
  localStorage.removeItem("contextMessages");
  localStorage.removeItem("lastUserId");
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(getAuthLoginUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseApiError(data, "Login failed"));
  }
  return { token: data.access_token };
}

function parseApiError(data: unknown, fallback = "Request failed"): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length > 0) {
      const first = d[0] as { msg?: string; loc?: unknown[] };
      return first.msg || JSON.stringify(first);
    }
  }
  return fallback;
}

export async function register(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(getAuthRegisterUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseApiError(data, "Registration failed"));
  }
  return { token: data.access_token };
}

export async function fetchUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(getAuthMeUrl(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Get the GitHub OAuth authorization URL from the backend.
 */
export async function getGithubLoginUrl(): Promise<string> {
  const { getGithubAuthorizeUrl } = await import("./api");
  const res = await fetch(getGithubAuthorizeUrl());
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to get auth URL");
  return data.url;
}

/**
 * Exchange GitHub code for ArchitectAI token.
 */
export async function loginWithGithubCode(code: string): Promise<{ token: string }> {
  const { getGithubCallbackUrl } = await import("./api");
  const res = await fetch(getGithubCallbackUrl(code));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseApiError(data, "GitHub login failed"));
  }
  return { token: data.access_token };
}
