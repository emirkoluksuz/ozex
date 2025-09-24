// src/common/cookies.ts
import type { CookieOptions } from "express";

const isProd = process.env.NODE_ENV === "production";
const domainEnv = process.env.COOKIE_DOMAIN?.trim() || undefined;

export function getRefreshCookieOptions(remember: boolean): CookieOptions {
  const base: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax", // Development'ta lax kullan
    path: "/",  // Sadece "/api/auth" yerine "/" kullan
    domain: domainEnv,
  };
  
  console.log('getRefreshCookieOptions called with:');
  console.log('  remember:', remember);
  console.log('  isProd:', isProd);
  console.log('  domainEnv:', domainEnv);
  console.log('  base options:', base);
  
  const result = remember
    ? { ...base, maxAge: 1000 * 60 * 60 * 24 * 30 }
    : base;
    
  console.log('  final options:', result);
  return result;
}

export function getUiCookieOptions(remember: boolean): CookieOptions {
  const base: CookieOptions = {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    domain: domainEnv,
  };
  
  return remember
    ? { ...base, maxAge: 1000 * 60 * 60 * 24 * 30 }
    : base;
}

export const clearRefreshCookieOptions: CookieOptions = {
  path: "/",  // path'i "/" yap
  domain: domainEnv,
};

export const clearUiCookieOptions: CookieOptions = {
  path: "/",
  domain: domainEnv,
};