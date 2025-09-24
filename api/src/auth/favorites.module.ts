import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { FavoritesService } from "./favorites.service";
import { FavoritesController } from "./favorites.controller";

@Module({
  imports: [PrismaModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
