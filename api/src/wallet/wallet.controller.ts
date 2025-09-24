// src/wallet/wallet.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { FundingService } from "./funding.service";
import {
  fundingRequestSchema,
  type FundingRequestDto,
  FundingRequestDtoDoc,
} from "./dto";
import type { Request, Response } from "express";
import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiHeader,
  ApiResponse,
} from "@nestjs/swagger";
import { ApiAuthUser } from "../common/swagger/auth.decorators";

@ApiTags("Wallet")
@ApiAuthUser()
@Controller("api")
export class WalletController {
  constructor(
    private wallets: WalletService,
    private funding: FundingService,
  ) {}

  @Get("wallet/balance")
  @ApiOperation({ summary: "Cüzdan özeti (balance, equity, margin, freeMargin, marginLevel). ETag destekli." })
  @ApiHeader({
    name: "If-None-Match",
    required: false,
    description: "Önceki ETag değerini gönderirsen 304 Not Modified dönebilir.",
  })
  @ApiOkResponse({ description: "Güncel cüzdan özeti" })
  @ApiResponse({ status: 304, description: "Değişiklik yok (ETag eşleşti)." })
  async balance(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req as any).user?.userId ?? (req as any).user?.sub;
    if (!userId) throw new UnauthorizedException("Missing user");

    const overview = await this.wallets.getOverview(userId);

    // ETag'e equity/margin değişimini de kat → canlı fiyat değiştiğinde de farklı olsun
    const etag = `"w:${userId}:${overview.etagSalt}:${overview.updatedAt.getTime()}"`;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("ETag", etag);

    const inm = req.headers["if-none-match"];
    if (inm && inm === etag) {
      res.status(304).end();
      return;
    }

    return {
      balanceUSD: overview.balanceUSD,
      balanceText: overview.balanceUSD.toFixed(2),
      updatedAt: overview.updatedAt.toISOString(),

      // 👇 MetricsRow’un bekledikleri
      marginUsd: overview.marginUsd,
      freeMarginUsd: overview.freeMarginUsd,
      assetValue: overview.assetValue,   // = equity = balance + unrealizedPnL
      marginLevel: overview.marginLevel, // %
    };
  }

  @Post("wallet/funding")
  @ApiOperation({ summary: "Para yatır/çek talebi oluştur" })
  @ApiBody({ type: FundingRequestDtoDoc })
  @ApiOkResponse({ description: "Funding isteği oluşturuldu." })
  async createFunding(@Req() req: Request, @Body() body: unknown) {
    const userId = (req as any).user?.userId ?? (req as any).user?.sub;
    if (!userId) throw new UnauthorizedException("Missing user");

    const input: FundingRequestDto = fundingRequestSchema.parse(body);
    const fr = await this.funding.createRequest(
      userId,
      input.type,
      String(input.amount),
      input.reference,
    );
    return { request: fr };
  }

  @Get("wallet/funding")
  @ApiOperation({ summary: "Kullanıcının funding taleplerini listele" })
  @ApiOkResponse({ description: "Kullanıcının funding talepleri." })
  async myFunding(@Req() req: Request) {
    const userId = (req as any).user?.userId ?? (req as any).user?.sub;
    if (!userId) throw new UnauthorizedException("Missing user");

    const items = await this.funding.listMine(userId);
    return { items };
  }
}
