// src/app.controller.ts
import { Controller, Get, Redirect } from '@nestjs/common';
import { Public } from './common/public.decorator';

@Public()
@Controller()
export class AppController {
  @Get()
  @Redirect(process.env.NODE_ENV !== 'production' ? '/docs' : '/health', 302)
  root() {
    return;
  }
}
