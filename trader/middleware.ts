// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_PAGES = new Set(["/login", "/register", "/forgot"]);

function normalizePath(p: string) {
  // /login/ → /login
  return p.endsWith("/") && p !== "/" ? p.slice(0, -1) : p;
}

function safeNext(nextRaw: string | null | undefined) {
  const n = typeof nextRaw === "string" ? nextRaw : "/";
  // Yalnızca aynı origin içinde kalan, / ile başlayan yolları kabul et
  if (!n.startsWith("/")) return "/";
  // Login’e geri dönen hedefleri ana sayfaya çevir (loop kır)
  if (n === "/login" || n.startsWith("/login?")) return "/";
  return n;
}

export function middleware(req: NextRequest) {
  // Sadece okuma isteklerinde çalışsın
  if (!["GET", "HEAD"].includes(req.method)) {
    return NextResponse.next();
  }

  const url = req.nextUrl;
  const pathname = normalizePath(url.pathname);
  const li = req.cookies.get("li")?.value === "1"; // login flag (edge okunabilir)

  // /login, /register, /forgot
  if (AUTH_PAGES.has(pathname)) {
    if (li) {
      // Girişliyse ana sayfaya gönder
      const to = url.clone();
      to.pathname = "/";
      to.search = "";
      return NextResponse.redirect(to);
    }
    // Girişli değilse auth sayfasını göstereceğiz; döngüye karşı next'i temizle
    const next = safeNext(url.searchParams.get("next"));
    if (next !== url.searchParams.get("next")) {
      const to = url.clone();
      to.searchParams.set("next", next);
      // yalnızca değişiklik varsa redirect et (gereksiz yönlendirme yapma)
      return url.toString() !== to.toString() ? NextResponse.redirect(to) : NextResponse.next();
    }
    return NextResponse.next();
  }

  // /logout → girişli değilse /login?next={geldiği yer}
  if (pathname === "/logout" && !li) {
    const to = url.clone();
    to.pathname = "/login";
    to.search = "";
    const n = url.pathname + (url.search || "");
    to.searchParams.set("next", safeNext(n));
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
}

export const config = {
  // trailing-slash ve alt-path varyasyonlarını da kapsa
  matcher: [
    "/login",
    "/login/(.*)",
    "/register",
    "/register/(.*)",
    "/forgot",
    "/forgot/(.*)",
    "/logout",
    "/logout/(.*)",
  ],
};
