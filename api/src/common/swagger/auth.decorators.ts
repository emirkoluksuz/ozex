import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

/** Kullanıcı JWT gerektiren endpointler için tek satır */
export function ApiAuthUser() {
  return applyDecorators(
    ApiBearerAuth(), // 'bearer' scheme
    ApiUnauthorizedResponse({ description: 'Missing/invalid bearer token' }),
    ApiForbiddenResponse({ description: 'Forbidden' }),
  );
}

/** Admin key gerektiren endpointler için tek satır */
export function ApiAuthAdmin(desc = 'Admin API anahtarı (X-Admin-Key).') {
  return applyDecorators(
    ApiSecurity('admin-key'), // DocumentBuilder'daki scheme adı
    ApiHeader({
      name: 'X-Admin-Key',
      required: true,
      description: desc,
    }),
    ApiUnauthorizedResponse({ description: 'Missing/invalid admin key' }),
    ApiForbiddenResponse({ description: 'Forbidden' }),
  );
}

/**
 * Kullanıcı JWT **veya** Admin Key kabul eden endpointler için.
 * Swagger'da iki ayrı security requirement üretir (OR mantığı).
 */
export function ApiAuthUserOrAdmin() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiSecurity('admin-key')
  );
}
