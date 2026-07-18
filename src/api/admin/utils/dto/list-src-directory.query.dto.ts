import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const ListSrcDirectoryQuerySchema = z.object({
  /**
   * 仅目录路径（相对 `src`），不要带文件名。
   * 例：`/api/users/entities/user`
   */
  path: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? '/' : v),
    z.string(),
  ),
  /** 可选：只返回名称中包含该字符串的条目（不区分大小写） */
  match: z.string().optional(),
  /**
   * 可选：仅文件名，如 `user.entity.ts`（不能含 `/`、`\`、`..`）。
   * 若传入，则 `isExist` 表示「path 对应目录 + 该文件」是否作为**文件**存在。
   */
  fileName: z.string().optional(),
});

export class ListSrcDirectoryQueryDto extends createZodDto(
  ListSrcDirectoryQuerySchema,
) {}
