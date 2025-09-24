// src/price/price.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PriceService } from './price.service';
import { PriceGateway } from './price.gateway';
import { PriceAdminController } from './price.admin.controller';
import { PricePublicController } from './price.public.controller';
import { TvPricesController } from './tv-prices.controller';

@Module({
  imports: [ConfigModule],
  providers: [PriceService, PriceGateway],
  controllers: [PriceAdminController, PricePublicController, TvPricesController],
  exports: [PriceService], // ✅ Wallet tarafında kullanıyoruz
})
export class PriceModule {}
