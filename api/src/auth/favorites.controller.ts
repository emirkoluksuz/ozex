// src/auth/favorites.controller.ts
import { Controller, Get, Put, Body, UseGuards, Logger, UnauthorizedException } from "@nestjs/common";
import { FavoritesService } from "./favorites.service";
import { UpdateFavoritesDto } from "./dto/update-favorites.dto";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { ReqUserId } from "../common/req-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("/api/user/favorites")
export class FavoritesController {
  private readonly log = new Logger(FavoritesController.name);
  constructor(private readonly svc: FavoritesService) {}

  @Get()
  async list(@ReqUserId() userId: string | null) {
    if (!userId) throw new UnauthorizedException("Missing user id in token");
    this.log.debug(`GET /favorites user=${userId}`);
    const symbols = await this.svc.get(userId);
    return { symbols };
  }

  @Put()
  async update(@ReqUserId() userId: string | null, @Body() dto: UpdateFavoritesDto) {
    if (!userId) throw new UnauthorizedException("Missing user id in token");
    this.log.debug(`PUT /favorites user=${userId} body=${JSON.stringify(dto)}`);
    return this.svc.set(userId, dto.symbols);
  }
}
