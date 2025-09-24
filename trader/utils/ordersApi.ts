import { http } from "@/lib/http";

export type OpenOrderReq = {
  symbolKey: string;              // örn "XAUUSD" | "BTCUSDT"
  side: "BUY" | "SELL";
  type: "MARKET";
  qtyLot: number;
  tpPrice?: number;
  slPrice?: number;
};

export async function openOrder(body: OpenOrderReq, idem?: string) {
  const { data } = await http.post("/orders", body, {
    headers: idem ? { "X-Idempotency-Key": idem } : undefined,
  });
  return data; // { order: {...} }
}

export async function listOrders(status?: "OPEN"|"CLOSED") {
  const { data } = await http.get("/orders", { params: status ? { status } : {} });
  return data; // { orders: [...] }
}

export async function closeOrder(orderId: string, priceHint?: number) {
  const { data } = await http.post(`/orders/${orderId}/close`, priceHint ? { priceHint } : {});
  return data; // { order: {...} }
}
