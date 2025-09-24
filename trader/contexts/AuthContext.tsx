// src/contexts/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { http, setAccessToken } from "@/lib/http";

type User = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: string;
};

type RegisterInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  password: string;
};

type LogoutOpts = { signal?: AbortSignal };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string, remember?: boolean) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: (opts?: LogoutOpts) => Promise<void>;
  refresh: () => Promise<void>;
  getAccessToken: () => string | null;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

/* Yardımcılar */
function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function withTimeout<T>(p: Promise<T>, ms = 4000, onAbort?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, rej) => {
    timer = setTimeout(() => {
      try {
        onAbort?.();
      } catch {}
      rej(new Error("timeout"));
    }, ms);
  });
  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* Provider */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Access token sadece hafızada
  const accessRef = useRef<string | null>(null);

  // Cross-tab sync
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bcRef.current = new BroadcastChannel("auth");
    }
    const onBC = (e: MessageEvent) => {
      if (e.data === "logout") {
        setAccessToken(null);
        accessRef.current = null;
        setUser(null);
      }
    };
    bcRef.current?.addEventListener("message", onBC);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth:logout") {
        setAccessToken(null);
        accessRef.current = null;
        setUser(null);
      }
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

    return () => {
      bcRef.current?.removeEventListener("message", onBC);
      bcRef.current?.close();
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }, []);

  /* API helpers */
  const fetchMe = useCallback(async () => {
    try {
      const { data } = await http.get<User | null>("/api/auth/me", { withCredentials: true });
      setUser(data ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  // /api/auth/refresh → { accessToken, user }
  const refresh = useCallback(async () => {
    const ac = new AbortController();
    try {
      const req = http.post<{ accessToken: string | null; user: User | null }>(
        "/api/auth/refresh",
        {},
        { signal: ac.signal, withCredentials: true }
      );
      const { accessToken, user } = await withTimeout(req.then((r) => r.data), 4000, () =>
        ac.abort()
      );
      if (accessToken) {
        setAccessToken(accessToken);
        accessRef.current = accessToken;
        setUser(user ?? null);
      } else {
        setAccessToken(null);
        accessRef.current = null;
        setUser(null);
      }
    } catch {
      setAccessToken(null);
      accessRef.current = null;
      setUser(null);
    }
  }, []);

  // İlk açılış: sadece refresh dene; maksimum 5sn sonra loading kapat
  useEffect(() => {
    let mounted = true;
    const hardStop = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    (async () => {
      try {
        await refresh();
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(hardStop);
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(hardStop);
    };
  }, [refresh]);

  const login = async (identifier: string, password: string, remember: boolean = true) => {
    const { data } = await http.post<{ accessToken: string; user: User }>(
      "/api/auth/login",
      { identifier, password, remember },
      { withCredentials: true }
    );
    setAccessToken(data.accessToken);
    accessRef.current = data.accessToken;
    setUser(data.user);
  };

  const register = async (input: RegisterInput) => {
    await http.post("/api/auth/register", input, { withCredentials: true });
    await login(input.email, input.password, true);
  };

  const logout = async (opts?: LogoutOpts) => {
    try {
      await http
        .post("/api/auth/logout", {}, { signal: opts?.signal, withCredentials: true })
        .catch(() => {});
    } finally {
      setAccessToken(null);
      accessRef.current = null;
      setUser(null);
      bcRef.current?.postMessage("logout");
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("auth:logout", String(Date.now()));
        }
      } catch {}
    }
  };

  const getAccessToken = () => accessRef.current;

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, getAccessToken }}>
      {children}
    </Ctx.Provider>
  );
}

/* Hook */
export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
