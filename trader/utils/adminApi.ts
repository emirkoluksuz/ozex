// src/utils/adminApi.ts
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "ozex_admin_key_7f2c2b9b1a8e4c6d2f10"; // sadece lokal test

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": ADMIN_KEY, // AdminApiKeyGuard için
        ...(options.headers || {}),
      },
      credentials: "include",
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.message) msg = j.message;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }

    return res.json();
  } catch (err) {
    console.error("[adminApi] fetch error:", err, "→ URL:", `${API}${path}`);
    throw err;
  }
}

// Bekleyen talepler
export function adminListPending() {
  return request<{ items: any[] }>("/api/admin/funding/pending");
}

// Approve / Reject
export function adminAct(id: string, approve: boolean, adminNote?: string) {
  return request(`/api/admin/funding/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ approve, adminNote }),
  });
}

// (Opsiyonel) Tekil reconcile
export function adminReconcile(id: string) {
  return request(`/api/admin/funding/${id}/reconcile`, { method: "PATCH" });
}

// (Opsiyonel) Toplu reconcile
export function adminReconcileAll() {
  return request(`/api/admin/funding/reconcile-all`, { method: "PATCH" });
}

// (Opsiyonel) Manuel bakiye düzeltme
export function adminAdjust(userId: string, amount: number, note?: string) {
  return request(`/api/admin/wallet/adjust`, {
    method: "PATCH",
    body: JSON.stringify({ userId, amount, note }),
  });
}
