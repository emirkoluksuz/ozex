import { http } from "@/lib/http";

export async function fetchFavorites(): Promise<string[]> {
  try {
    const { data } = await http.get<{ symbols: string[] }>("/api/user/favorites");
    return Array.isArray(data?.symbols) ? data.symbols : [];
  } catch {
    return [];
  }
}

export async function saveFavorites(symbols: string[]): Promise<void> {
  try {
    await http.put("/api/user/favorites", { symbols });
  } catch {
    // sessiz geç; debounce sonraki denemede tekrar dener
  }
}
