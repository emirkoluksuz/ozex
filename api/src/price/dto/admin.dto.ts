// src/price/dto/admin.dto.ts
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class DriftToTargetDto {
  @IsString() symbol!: string;

  @Type(() => Number)
  @IsNumber()
  target!: number;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  intervalSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  tickSize?: number;
}

export class DriftBackToLiveDto {
  @IsString() symbol!: string;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  intervalSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  tickSize?: number;
}
