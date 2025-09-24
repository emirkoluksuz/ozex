// src/wallet/admin.service.ts (örnek)
import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FundingStatus, FundingType, TxType } from "@prisma/client";

@Injectable()
export class AdminWalletService {
  constructor(private prisma: PrismaService) {}

  async approveFunding(id: string, adminNote?: string) {
    return this.prisma.$transaction(async (tx) => {
      const fr = await tx.fundingRequest.findUnique({ where: { id } , include: { user: true }});
      if (!fr) throw new NotFoundException("Funding request not found");
      if (fr.status !== FundingStatus.PENDING) {
        throw new BadRequestException("Funding request is not pending");
      }

      // Kullanıcının cüzdanını getir/oluştur
      let wallet = await tx.wallet.findUnique({ where: { userId: fr.userId }});
      if (!wallet) {
        wallet = await tx.wallet.create({ data: { userId: fr.userId, balance: 0 }});
      }

      // Tutar işareti
      const sign = fr.type === FundingType.DEPOSIT ? 1 : -1;
      const delta = (Number(fr.amount) * sign); // Decimal → Number

      const newBalance = Number(wallet.balance) + delta;
      if (newBalance < 0) throw new BadRequestException("Insufficient wallet balance");

      // Cüzdanı güncelle
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // Transaction kaydı
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: fr.type === FundingType.DEPOSIT ? TxType.DEPOSIT : TxType.WITHDRAW,
          amount: delta,                 // + veya -
          balanceAfter: newBalance,
          note: fr.reference ?? undefined,
          meta: { fundingRequestId: fr.id },
        },
      });

      // FundingRequest’i onayla
      const approved = await tx.fundingRequest.update({
        where: { id: fr.id },
        data: {
          status: FundingStatus.APPROVED,
          processedAt: new Date(),
          adminNote: adminNote ?? null,
        },
      });

      return { ok: true, approved, wallet: updated };
    });
  }

  async rejectFunding(id: string, adminNote?: string) {
    const fr = await this.prisma.fundingRequest.findUnique({ where: { id } });
    if (!fr) throw new NotFoundException("Funding request not found");
    if (fr.status !== "PENDING") throw new BadRequestException("Not pending");

    return this.prisma.fundingRequest.update({
      where: { id },
      data: { status: "REJECTED", processedAt: new Date(), adminNote: adminNote ?? null },
    });
  }
}
