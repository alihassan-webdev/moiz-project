export const AUTH_KEY = "app:auth" as const;

export type AuthState = {
  email: string;
  loggedInAt: number;
};

export function isLoggedIn(): boolean {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    return typeof parsed?.email === "string" && !!parsed.email;
  } catch {
    return false;
  }
}

export function getUser(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function login(email: string) {
  const state: AuthState = { email, loggedInAt: Date.now() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  dispatchAuthChanged();
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  dispatchAuthChanged();
}

function dispatchAuthChanged() {
  try {
    window.dispatchEvent(new Event("auth-changed"));
  } catch {}
}
