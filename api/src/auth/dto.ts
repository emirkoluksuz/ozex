// src/auth/dto.ts
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { createZodDto } from "nestjs-zod";

extendZodWithOpenApi(z);

// Ad / Soyad -> yalnızca harfler ve boşluk
const nameRegex = /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/;
// Telefon -> 05XXXXXXXXX
const phoneRegex = /^05\d{9}$/;
// Şifre -> min 1 küçük, 1 büyük, 1 rakam, min 6 karakter
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

// Kullanıcı adı: TR/EN harfler, rakamlar ve tüm noktalama işaretleri; boşluk YOK
// \p{P} = Unicode punctuation; 'u' flag şart.
const usernameRegex = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9\p{P}]+$/u;

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .regex(nameRegex, "Geçersiz ad")
      .openapi({ example: "Ahmet" }),
    lastName: z
      .string()
      .trim()
      .regex(nameRegex, "Geçersiz soyad")
      .openapi({ example: "Yılmaz" }),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "Telefon 05XXXXXXXXX formatında olmalı")
      .openapi({ example: "05301234567", description: "05XXXXXXXXX" }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Geçersiz e-posta")
      .openapi({ example: "ahmet@example.com" }),
    username: z
      .string()
      .trim()
      .min(3, "Kullanıcı adı en az 3 karakter olmalı")
      .max(32, "Kullanıcı adı 32 karakteri geçemez")
      .regex(
        usernameRegex,
        "Kullanıcı adı harf, rakam ve noktalama işaretleri içerebilir (boşluk yok)"
      )
      .openapi({ example: "ahmet.yilmaz" }),
    password: z
      .string()
      .regex(
        passwordRegex,
        "Şifre en az 1 küçük, 1 büyük, 1 sayı içermeli ve 6+ karakter olmalı"
      )
      .openapi({ example: "Sifre123" }),
  })
  .describe("Kullanıcı kayıt DTO'su");

export type RegisterDto = z.infer<typeof registerSchema>;
export class RegisterDtoDoc extends createZodDto(registerSchema) {}

export const loginSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .openapi({
        example: "ahmet.yilmaz",
        description: "E-posta veya kullanıcı adı",
      }),
    password: z.string().openapi({ example: "Sifre123" }),
    remember: z.boolean().optional().openapi({ example: true }),
  })
  .describe("Kullanıcı giriş DTO'su (email veya username)");

export type LoginDto = z.infer<typeof loginSchema>;
export class LoginDtoDoc extends createZodDto(loginSchema) {}
