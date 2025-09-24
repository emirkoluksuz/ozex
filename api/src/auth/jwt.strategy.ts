// src/auth/jwt.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

type JwtPayload = {
  sub: string;
  email?: string;
  roles?: string[];
  username?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(cfg: ConfigService) {
    // secret'ı önce güvenli şekilde alalım
    const secret = cfg.get<string>("JWT_ACCESS_SECRET");
    if (!secret) {
      // derin hata ayıklama için net mesaj
      throw new Error("Missing JWT_ACCESS_SECRET in environment.");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret, // <-- artık string garanti
      // passReqToCallback: false  // (opsiyonel) varsayılan zaten false
    });
  }

  async validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      username: payload.username,
    };
  }
}
