// src/wallet/funding.service.ts
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FundingStatus, FundingType } from "@prisma/client";
import { WalletService } from "./wallet.service";
import { Decimal } from "decimal.js"; // ✅ Prisma.Decimal yerine

@Injectable()
export class FundingService {
  constructor(private prisma: PrismaService, private wallets: WalletService) {}

  async createRequest(
    userId: string,
    type: FundingType,
    amount: string,
    reference?: string
  ) {
    const dec = new Decimal(amount); // ✅
    if (dec.lte(0)) throw new BadRequestException("Miktar 0'dan büyük olmalı");

    return this.prisma.fundingRequest.create({
      data: { userId, type, amount: dec, reference }, // Prisma Decimal alanına Decimal verilebilir
      select: {
        id: true,
        userId: true,
        type: true,
        amount: true,
        status: true,
        reference: true,
        adminNote: true,
        createdAt: true,
        processedAt: true,
      },
    });
  }

  async listMine(userId: string) {
    return this.prisma.fundingRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        amount: true,
        status: true,
        reference: true,
        adminNote: true,
        createdAt: true,
        processedAt: true,
      },
    });
  }

  // --- Admin tarafı ---
  async listPending() {
    return this.prisma.fundingRequest.findMany({
      where: { status: FundingStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        type: true,
        amount: true,
        reference: true,
        createdAt: true,
        status: true,
      },
    });
  }

  /**
   * Talebi onayla / red et (atomik).
   * - Yarış koşullarına dayanıklı: yalnızca PENDING satırı updateMany ile güncellenir.
   * - APPROVED ise aynı DB transaction içinde Wallet + Transaction güncellenir/oluşturulur.
   * - Idempotensi: WalletService, fundingRequestId'yi idempotencyKey olarak kullanır.
   */
  async actOnRequest(id: string, approve: boolean, adminNote?: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1) Yalnızca PENDING → APPROVED/REJECTED
      const updated = await tx.fundingRequest.updateMany({
        where: { id, status: FundingStatus.PENDING },
        data: {
          status: approve ? FundingStatus.APPROVED : FundingStatus.REJECTED,
          adminNote,
          processedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        const exists = await tx.fundingRequest.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("Talep bulunamadı");
        throw new BadRequestException("Talep zaten işlenmiş");
      }

      // 2) Güncel talebi çek
      const fr = await tx.fundingRequest.findUnique({ where: { id } });
      if (!fr) throw new NotFoundException("Talep bulunamadı");

      // 3) Onaylandıysa cüzdan işlemini uygula (idempotent)
      if (approve) {
        if (fr.type === FundingType.DEPOSIT) {
          await this.wallets.applyApprovedDeposit(
            fr.userId,
            fr.amount.toString(),
            fr.id,
            tx
          );
        } else {
          await this.wallets.applyApprovedWithdraw(
            fr.userId,
            fr.amount.toString(),
            fr.id,
            tx
          );
        }
      }

      return fr;
    });
  }
}
