"use client";
import { useEffect, useState } from "react";

function readKey() {
  if (typeof window === "undefined") return "anon";
  return localStorage.getItem("auth_user_ns") || "anon";
}

/**
 * userKey = "u_123", "alice@example.com" ya da "anon"
 * Aynı sekmede değişiklikleri yakalamak için:
 *  - window focus/visibility değişiminde yeniden okur
 *  - storage (diğer sekmeler) olayını dinler
 *  - custom "auth_user_ns_changed" eventini dinler
 */
export function useUserKey() {
  const [userKey, setUserKey] = useState<string>(() => readKey());

  useEffect(() => {
    const refresh = () => setUserKey(readKey());

    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth_user_ns") refresh();
    };

    window.addEventListener("storage", onStorage);     // diğer sekmeler
    window.addEventListener("focus", refresh);         // aynı sekme, sayfaya dönünce
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("auth_user_ns_changed", refresh); // aynı sekme, manuel tetikleme

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("auth_user_ns_changed", refresh);
    };
  }, []);

  return userKey;
}
