// trader/lib/http.ts
import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.fonborsa.com";

export const http = axios.create({
  baseURL,
  withCredentials: true, // rt cookie için şart
});

// Basit token deposu (runtime)
let accessToken: string | null = null;
export function setAccessToken(t: string | null) {
  accessToken = t;
  if (t) {
    try { localStorage.setItem("accessToken", t); } catch {}
  } else {
    try { localStorage.removeItem("accessToken"); } catch {}
  }
}
export function getAccessToken() {
  if (accessToken) return accessToken;
  try {
    const t = localStorage.getItem("accessToken");
    accessToken = t;
    return t;
  } catch {}
  return null;
}

// İstek interceptor: Bearer ekle
http.interceptors.request.use((cfg) => {
  const t = getAccessToken();
  if (t) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});

// 401 yakala → 1 kez refresh dene → isteği tekrar et
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  try {
    const res = await http.post("/api/auth/refresh", {}, { withCredentials: true });
    const t = res?.data?.accessToken ?? null;
    setAccessToken(t);
    return t;
  } catch {
    setAccessToken(null);
    return null;
  }
}

http.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error?.config;
    const status = error?.response?.status;

    if (status === 401 && cfg && !cfg.__isRetried) {
      cfg.__isRetried = true;

      refreshing = refreshing ?? doRefresh();
      const newToken = await refreshing.finally(() => (refreshing = null));

      if (newToken) {
        cfg.headers = cfg.headers ?? {};
        cfg.headers.Authorization = `Bearer ${newToken}`;
        return http(cfg); // isteği tekrar et
      }
    }

    return Promise.reject(error);
  }
);
