import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const SaveSrcFileDtoSchema = z.object({
  /**
   * 相对于项目 `src` 目录的路径，例如 `api/user/entity/km.entity.ts`
   * 也可传以 `/` 开头的形式，会自动去掉前导斜杠。
   */
  relativePath: z.string().min(1, 'relativePath 不能为空'),
  /** 要写入的 TS 源码全文 */
  content: z.string(),
});

export class SaveSrcFileDto extends createZodDto(SaveSrcFileDtoSchema) {}
