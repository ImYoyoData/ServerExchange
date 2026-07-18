import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RevokeAccessTokenSessionSchema = z.object({
  userId: z.coerce.number().int().positive().describe('用户ID'),
  jti: z.string().min(1, 'jti不能为空').describe('accessToken 的 jti'),
});

export class RevokeAccessTokenSessionDto extends createZodDto(
  RevokeAccessTokenSessionSchema,
) {}
