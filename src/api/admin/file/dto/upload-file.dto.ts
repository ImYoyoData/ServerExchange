import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UploadFileSchema = z.object({
  module: z.string().min(1, 'module 不能为空').max(50, 'module 长度不能超过50'),
  uploadUserId: z.coerce.number().int().positive().optional(),
  uploadUserName: z.string().max(100).optional(),
});

export class UploadFileDto extends createZodDto(UploadFileSchema) {}
