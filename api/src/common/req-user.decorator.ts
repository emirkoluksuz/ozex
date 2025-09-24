// src/common/req-user.decorator.ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

function pickUserId(u: any): string | null {
  return u?.id ?? u?.sub ?? u?.userId ?? u?.uid ?? null;
}

export const ReqUser = createParamDecorator((key: string | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const u = req.user || {};
  return key ? u?.[key] : u;
});

// ✅ Kullanımı kolay alias
export const ReqUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return pickUserId(req.user);
});
