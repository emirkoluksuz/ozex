import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PrismaModule } from "../prisma/prisma.module";
import { PriceModule } from "../price/price.module";

@Module({
  imports: [
    PrismaModule,  // OrdersService prisma kullanıyor
    PriceModule,   // canlı fiyat/contractSize/kaldıraç hesapları için
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
