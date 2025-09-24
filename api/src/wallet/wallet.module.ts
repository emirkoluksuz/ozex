// src/wallet/wallet.module.ts
import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "./wallet.service";
import { FundingService } from "./funding.service";
import { WalletController } from "./wallet.controller";
import { AdminWalletController } from "./admin.controller";
import { PriceModule } from "../price/price.module"; // 👈 EK

@Module({
  imports: [PriceModule], // 👈 EK
  controllers: [WalletController, AdminWalletController],
  providers: [PrismaService, WalletService, FundingService],
  exports: [WalletService, FundingService],
})
export class WalletModule {}
