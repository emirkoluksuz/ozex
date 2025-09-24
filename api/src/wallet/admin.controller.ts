// src/wallet/admin.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { FundingService } from "./funding.service";
import { WalletService } from "./wallet.service";
import { AdminApiKeyGuard } from "../common/admin-api-key.guard";
import {
  adminFundingActionSchema,
  adminAdjustSchema,
  type AdminFundingActionDto,
  type AdminAdjustDto,
  AdminFundingActionDtoDoc,
  AdminAdjustDtoDoc,
} from "./dto";
import { Public } from "../common/public.decorator";

// Swagger
import { ApiTags, ApiOkResponse, ApiOperation, ApiBody } from "@nestjs/swagger";
import { ApiAuthAdmin } from "../common/swagger/auth.decorators";

@Public() // JWT guard'ını atla; sadece AdminApiKeyGuard devrede
@UseGuards(AdminApiKeyGuard)
@ApiTags("AdminWallet")
@ApiAuthAdmin() // Swagger: X-Admin-Key header + admin-key security tek satır
@Controller("api/admin")
export class AdminWalletController {
  constructor(
    private readonly funding: FundingService,
    private readonly wallets: WalletService,
  ) {}

  /** Bekleyen tüm funding talepleri */
  @Get("funding/pending")
  @ApiOperation({ summary: "Bekleyen funding taleplerini listele" })
  @ApiOkResponse({ description: "Bekleyen talepler başarıyla listelendi." })
  async pending() {
    return { items: await this.funding.listPending() };
  }

  /** Tek bir funding talebini onayla / reddet */
  @Patch("funding/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Funding talebini onayla / reddet" })
  @ApiBody({ type: AdminFundingActionDtoDoc })
  @ApiOkResponse({ description: "İşlem başarıyla uygulandı." })
  async act(@Param("id") id: string, @Body() body: unknown) {
    const input: AdminFundingActionDto = adminFundingActionSchema.parse(body);
    const request = await this.funding.actOnRequest(
      id,
      input.approve,
      input.adminNote,
    );
    return { ok: true, request };
  }

  /** Admin manuel bakiye düzeltmesi */
  @Patch("wallet/adjust")
  @HttpCode(200)
  @ApiOperation({ summary: "Manuel bakiye düzeltmesi uygula" })
  @ApiBody({ type: AdminAdjustDtoDoc })
  @ApiOkResponse({ description: "Bakiye başarıyla güncellendi." })
  async adjust(@Body() body: unknown) {
    const input: AdminAdjustDto = adminAdjustSchema.parse(body);
    const balance = await this.wallets.adminAdjust(
      input.userId,
      String(input.amount),
      input.note,
    );
    return { ok: true, balance };
  }
}
