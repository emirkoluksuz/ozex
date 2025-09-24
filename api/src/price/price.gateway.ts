// src/price/price.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
  import { Server, Socket } from 'socket.io';
import { PriceService } from './price.service';

// CORS origin'lerini .env'den oku (virgül veya regex destekli CORS_ORIGIN ile hizalı kalsın)
function parseWsOrigins(): (string | RegExp)[] {
  const raw = process.env.CORS_ORIGIN;
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (!raw) return defaults;
  return Array.from(
    new Set([
      ...defaults,
      ...raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((v) => (v.startsWith('^') ? new RegExp(v) : v)),
    ]),
  );
}

@WebSocketGateway({
  namespace: '/prices',
  cors: {
    origin: parseWsOrigins(),
    credentials: true,
  },
})
export class PriceGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly log = new Logger(PriceGateway.name);

  @WebSocketServer()
  server!: Server;

  private unsubscribe?: () => void;

  constructor(private readonly prices: PriceService) {}

  afterInit() {
    // Çift aboneliği önle
    this.unsubscribe?.();

    this.unsubscribe = this.prices.onChange((state) => {
      try {
        if (!this.server) {
          this.log.warn('server not ready yet, dropping price:update');
          return;
        }

        // changeDaily PriceService’ten geliyor; eski kodda change24h kullandıysan da destekle
        const anyState = state as any;
        const changePct =
          (typeof anyState.change24h === 'number' ? anyState.change24h : undefined) ??
          (typeof anyState.changeDaily === 'number' ? anyState.changeDaily : 0);

        // ✅ leverage'i garanti et (state.leverage varsa onu, yoksa servisten al)
        const leverage =
          (typeof (anyState as any).leverage === 'number' && (anyState as any).leverage > 0)
            ? (anyState as any).leverage
            : this.prices.getLeverage(state.symbol);

        this.server.emit('price:update', {
          symbol: state.symbol,
          price: state.current, // FE 'price' bekliyorsa uyumlu
          mode: state.mode,
          lastLive: state.lastLive,
          changeDaily: changePct, // yeni isim
          change24h: changePct,   // geriye dönük uyumluluk
          leverage,               // ✅ yeni alan
        });
      } catch (err: any) {
        this.log.error(`WS emit error: ${err?.message ?? err}`);
      }
    });

    this.log.log('PriceGateway subscription set');
  }

  handleDisconnect(_client: Socket) {
    // client bazlı temizlik gerekmiyor
  }

  onModuleDestroy() {
    if (this.unsubscribe) {
      try {
        this.unsubscribe();
      } finally {
        this.unsubscribe = undefined;
      }
    }
    this.log.log('PriceGateway unsubscribed');
  }
}
