// src/auth/auth.controller.ts
import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { AuthService } from "./auth.service";
import {
  registerSchema,
  loginSchema,
  type RegisterDto,
  type LoginDto,
  RegisterDtoDoc,
  LoginDtoDoc,
} from "./dto";
import type { Request, Response } from "express";
import { JwtService } from "@nestjs/jwt";
import { Public } from "../common/public.decorator";

// Cookie utils
import {
  getRefreshCookieOptions,
  getUiCookieOptions,
  clearRefreshCookieOptions,
  clearUiCookieOptions,
} from "../common/cookies";

// Swagger
import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiCookieAuth,
} from "@nestjs/swagger";

@ApiTags("Auth")
@Controller("api/auth")
export class AuthController {
  constructor(private auth: AuthService, private jwt: JwtService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Kayıt ol" })
  @ApiBody({ type: RegisterDtoDoc })
  @ApiOkResponse({ description: "Kullanıcı kaydı başarıyla oluşturuldu." })
  async register(@Body() body: unknown) {
    const input: RegisterDto = registerSchema.parse(body);
    return this.auth.register(input);
  }

  @Public()
  @HttpCode(200)
  @Post("login")
  @ApiOperation({ summary: "Giriş yap (access döner, refresh cookie olarak yazılır)" })
  @ApiBody({ type: LoginDtoDoc })
  @ApiOkResponse({ description: "Giriş başarılı; access token ve kullanıcı bilgisi döner." })
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    console.log('=== LOGIN DEBUG ===');
    console.log('Environment COOKIE_DOMAIN:', process.env.COOKIE_DOMAIN);
    console.log('Environment NODE_ENV:', process.env.NODE_ENV);
    
    const input: LoginDto = loginSchema.parse(body);
    const { accessToken, refreshToken, remember } = await this.auth.login(
      input,
      req.headers["user-agent"],
      req.ip,
    );

    const cookieOptions = getRefreshCookieOptions(remember);
    console.log('Setting RT cookie with options:', cookieOptions);
    res.cookie("rt", refreshToken, cookieOptions);
    res.cookie("li", "1", getUiCookieOptions(remember));

    const payload = await this.jwt.verifyAsync<{ sub: string }>(accessToken, {
      secret: process.env.JWT_ACCESS_SECRET!,
    });
    const user = await this.auth.me(payload.sub);

    console.log('LOGIN SUCCESS - RT token length:', refreshToken.length);
    return { accessToken, user };
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Access token yenile (refresh cookie ile)" })
  @ApiCookieAuth("rt")
  @ApiOkResponse({ description: "Yeni access token ve kullanıcı bilgisi döner (cookie gerekli)." })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    console.log('=== REFRESH DEBUG ===');
    console.log('Environment COOKIE_DOMAIN:', process.env.COOKIE_DOMAIN);
    console.log('Request cookies:', req.cookies);
    console.log('Request headers cookie:', req.headers.cookie);
    console.log('Request origin:', req.headers.origin);
    console.log('Request host:', req.headers.host);
    
    const rt = req.cookies?.rt as string | undefined;
    if (!rt) {
      console.log('❌ NO REFRESH TOKEN FOUND');
      return { accessToken: null, user: null };
    }

    console.log('✅ RT token exists, length:', rt.length);

    try {
      const { accessToken, refreshToken, remember } = await this.auth.refresh(rt);

      const cookieOptions = getRefreshCookieOptions(remember);
      console.log('Setting new RT cookie with options:', cookieOptions);
      res.cookie("rt", refreshToken, cookieOptions);
      res.cookie("li", "1", getUiCookieOptions(remember));

      const payload = await this.jwt.verifyAsync<{ sub: string }>(accessToken, {
        secret: process.env.JWT_ACCESS_SECRET!,
      });
      const user = await this.auth.me(payload.sub);

      console.log('REFRESH SUCCESS - New RT token length:', refreshToken.length);
      return { accessToken, user };
    } catch (error) {
      console.log('❌ REFRESH ERROR:', error.message);
      return { accessToken: null, user: null };
    }
  }

  @Public()
  @HttpCode(200)
  @Post("logout")
  @ApiOperation({ summary: "Çıkış yap (refresh oturumlarını revoke eder)" })
  @ApiCookieAuth('rt')
  @ApiOkResponse({ description: "Çıkış başarılı." })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.rt as string | undefined;
    await this.auth.logout(rt, req.ip, req.headers["user-agent"]);
    res.clearCookie("rt", clearRefreshCookieOptions);
    res.clearCookie("li", clearUiCookieOptions);
    return { ok: true };
  }

  @Get("me")
  @ApiOperation({ summary: "Me (aktif kullanıcı bilgisi)" })
  @ApiBearerAuth()
  @ApiOkResponse({ description: "Aktif kullanıcının temel bilgileri." })
  async me(@Req() req: any) {
    return this.auth.me(req.user.userId);
  }
}