"use client";
import { useEffect, useRef, useState } from "react";

function readLS<T>(key: string, initial: T): T {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  } catch {
    return initial;
  }
}

export function useLocalStorage<T>(key: string, initial: T) {
  const keyRef = useRef(key);
  const [value, setValue] = useState<T>(() => readLS(key, initial));

  // Key değiştiğinde LS'den yeniden oku
  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setValue(readLS(key, initial));
    }
  }, [key, initial]);

  // Value değişince LS'ye yaz
  useEffect(() => {
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {}
  }, [value]);

  // Diğer tablarda yapılan değişiklikleri dinle
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyRef.current && e.newValue) {
        try {
          setValue(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [value, setValue] as const;
}
