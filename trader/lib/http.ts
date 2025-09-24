// /lib/http.ts
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

/** ----------------------------
 *  Base URL (SSR-safe)
 *  ---------------------------- */
function resolveBaseURL() {
  // Öncelik: public env
  const env = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE;
  if (env && env.trim()) return env.replace(/\/+$/, "");

  // Browser'da host'tan türet (dev fallback)
  if (typeof window !== "undefined") {
    const u = new URL(window.location.href);

    // Production domain kontrolü
    if (u.hostname.includes("fonborsa.com")) {
      return `${u.protocol}//api.fonborsa.com`;
    }

    // Dev ortamı için subdomain mantığı
    const parts = u.hostname.split(".");
    if (parts.length > 1) {
      // subdomain varsa ana domain'i al ve api ekle
      const mainDomain = parts.slice(-2).join(".");
      return `${u.protocol}//api.${mainDomain}`;
    }

    // Localhost için port kontrolü
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return `${u.protocol}//${u.hostname}:4000`;
    }
  }

  // En son çare: localhost
  return "http://localhost:4000";
}
const baseURL = resolveBaseURL();

/** ----------------------------
 *  Access token state + yayıncı
 *  ---------------------------- */
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<(t: string | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token ?? null;
  if (token) {
    http.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete http.defaults.headers.common["Authorization"];
  }
  for (const l of listeners) l(accessToken);
}
export function getAccessToken() {
  return accessToken;
}
export function onAccessTokenChange(cb: (t: string | null) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function clearAuth() {
  setAccessToken(null);
}

/** ----------------------------
 *  Axios instance
 *  ---------------------------- */
export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true, // ✅ refresh cookie'leri taşımak için şart
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

/** Küçük yardımcılar */
function cryptoRandom(): string {
  try {
    const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2);
}

// Promise'a timeout uygula (abort destekli)
async function withTimeout<T>(p: Promise<T>, ms = 4000, onAbort?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const to = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      try {
        onAbort?.();
      } catch {}
      rej(new Error("timeout"));
    }, ms);
  });
  try {
    return await Promise.race([p, to]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** ----------------------------
 *  İlk açılışta sessiz refresh (opsiyonel)
 *  ---------------------------- */
export async function initAuth(): Promise<void> {
  try {
    const token = await doRefresh();
    setAccessToken(token);
  } catch {
    setAccessToken(null);
  }
}

/** ----------------------------
 *  Tek kanaldan refresh (kilitli)
 *  ---------------------------- */
async function doRefresh(): Promise<string | null> {
  if (!refreshing) {
    const ac = new AbortController();
    console.log('Starting refresh request to:', `${baseURL}/api/auth/refresh`); // Debug
    
    refreshing = withTimeout(
      // ✅ Aynı http instance'ını kullan (cookies için)
      http
        .post("/api/auth/refresh", {}, { signal: ac.signal })
        .then(({ data }) => {
          console.log('Refresh success:', data); // Debug
          return (data as { accessToken?: string | null })?.accessToken ?? null;
        })
        .catch((error) => {
          console.log('Refresh failed:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            cookies: document.cookie // Debug - tüm cookie'leri göster
          });
          return null;
        }),
      4000,
      () => ac.abort()
    );
  }
  const token = await refreshing;
  refreshing = null;
  setAccessToken(token);
  return token;
}

/** ----------------------------
 *  Interceptors
 *  ---------------------------- */
http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  cfg.headers = cfg.headers ?? {};
  (cfg.headers as Record<string, string>)["X-Request-Id"] ||= cryptoRandom();

  // Access token varsa ekle (default'a rağmen garanti)
  if (accessToken && !(cfg.headers as Record<string, string>)["Authorization"]) {
    (cfg.headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
  }
  return cfg;
});

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    // İptal/timeout durumlarını aynen ilet (UI bunu kendi yönetir)
    if (error.code === "ERR_CANCELED" || error.message === "timeout") {
      throw error;
    }

    const status = error.response?.status;
    const original = (error.config || {}) as RetriableConfig;
    const url = String(original.url || "");

    // Auth uçlarında retry yapma
    const isAuthPath =
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/refresh") ||
      url.includes("/api/auth/logout");

    if (status === 401 && !original._retried && !isAuthPath) {
      original._retried = true;

      const newToken = await doRefresh();
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>)["Authorization"] = `Bearer ${newToken}`;
        // method/body korunarak yeniden dene
        return http.request(original);
      }
      clearAuth(); // refresh başarısız → oturum kapalı say
    }

    throw error;
  }
);

export default http;