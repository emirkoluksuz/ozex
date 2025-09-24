import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";

import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    ConfigModule,
    // (Opsiyonel ama önerilir) Passport varsayılan strateji: "jwt"
    PassportModule.register({ defaultStrategy: "jwt" }),

    // Jwt yalnız burada ve global:
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET")!,
        // signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL', '10m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy], // ⬅️ JwtStrategy eklendi
  exports: [AuthService],
})
export class AuthModule {}
