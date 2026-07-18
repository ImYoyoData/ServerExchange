import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DeleteFilesSchema = z.object({
  ids: z
    .array(z.coerce.number().int().positive())
    .min(1, { message: 'ids 不能为空' })
    .describe('文件 ID 列表'),
  removeDiskFile: z.coerce
    .boolean()
    .optional()
    .default(false)
    .describe('是否同时删除磁盘物理文件'),
});

export class DeleteFilesDto extends createZodDto(DeleteFilesSchema) {}
