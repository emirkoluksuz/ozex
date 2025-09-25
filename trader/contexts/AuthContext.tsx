// trader/contexts/AuthContext.tsx
"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { http, setAccessToken } from "@/lib/http";

type User = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function bootstrap() {
    try {
      // 1) Refresh (rt cookie’den)
      const r = await http.post("/api/auth/refresh", {});
      const token = r?.data?.accessToken ?? null;
      setAccessToken(token);

      // 2) Me
      if (token) {
        const me = await http.get("/api/auth/me");
        setUser(me?.data ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await http.post("/api/auth/login", { identifier, password });
    const token = res?.data?.accessToken ?? null;
    setAccessToken(token);
    if (token) {
      const me = await http.get("/api/auth/me");
      setUser(me?.data ?? null);
    } else {
      setUser(null);
    }
  };

  const logout = async () => {
    try { await http.post("/api/auth/logout", {}); } catch {}
    setAccessToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}
