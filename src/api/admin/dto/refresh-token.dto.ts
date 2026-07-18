import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .trim()
    .min(1, 'refreshToken不能为空')
    .describe('刷新令牌'),
});

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
