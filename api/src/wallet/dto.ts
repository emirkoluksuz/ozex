// src/wallet/dto.ts
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { createZodDto } from "nestjs-zod";

extendZodWithOpenApi(z);

// Ortak amount validator
export const amountStr = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d{1,8})?$/.test(v), "Geçersiz miktar")
  .openapi({ example: "100.50", description: "Ondalıklı sayı, max 8 basamak" });

/**
 * Kullanıcı funding request DTO
 */
export const fundingRequestSchema = z
  .object({
    type: z.enum(["DEPOSIT", "WITHDRAW"]).openapi({
      example: "DEPOSIT",
      description: "İşlem tipi: yatırma veya çekme",
    }),
    amount: amountStr,
    reference: z
      .string()
      .trim()
      .max(200)
      .optional()
      .openapi({ example: "Banka EFT referansı", description: "Opsiyonel açıklama" }),
  })
  .describe("Funding Request DTO");

export type FundingRequestDto = z.infer<typeof fundingRequestSchema>;
export class FundingRequestDtoDoc extends createZodDto(fundingRequestSchema) {}

/**
 * Admin tarafından funding action DTO
 */
export const adminFundingActionSchema = z
  .object({
    approve: z.boolean().openapi({ example: true }),
    adminNote: z
      .string()
      .trim()
      .max(300)
      .optional()
      .openapi({ example: "Belgeler doğrulandı", description: "Opsiyonel admin açıklaması" }),
  })
  .describe("Admin Funding Action DTO");

export type AdminFundingActionDto = z.infer<typeof adminFundingActionSchema>;
export class AdminFundingActionDtoDoc extends createZodDto(adminFundingActionSchema) {}

/**
 * Admin tarafından manuel bakiye düzeltme DTO
 */
export const adminAdjustSchema = z
  .object({
    userId: z.string().trim().openapi({ example: "ckv123abc456", description: "Hedef kullanıcı ID" }),
    amount: amountStr.openapi({
      example: "-50.00",
      description: "Pozitif ekler, negatif düşer",
    }),
    note: z.string().trim().max(200).optional().openapi({ example: "Manuel düzeltme" }),
  })
  .describe("Admin Wallet Adjust DTO");

export type AdminAdjustDto = z.infer<typeof adminAdjustSchema>;
export class AdminAdjustDtoDoc extends createZodDto(adminAdjustSchema) {}
