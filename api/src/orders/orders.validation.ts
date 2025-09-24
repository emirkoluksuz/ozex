import { z } from "zod";

export const CreateOrderSchema = z.object({
  instrumentKey: z.string().min(3),
  side: z.enum(["BUY", "SELL"]),
  type: z.literal("MARKET").default("MARKET"),
  qtyLot: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  tpPrice: z.union([z.string(), z.number()]).optional().transform((v) => v == null ? undefined : Number(v)),
  slPrice: z.union([z.string(), z.number()]).optional().transform((v) => v == null ? undefined : Number(v)),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const CloseOrderSchema = z.object({
  id: z.string().min(10),
});
