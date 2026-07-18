import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GenerateCodeDtoSchema = z.object({
  /** sys_code_table_config.table_name */
  tableName: z.string().min(1, 'tableName 不能为空'),
  /**
   * 可选：强制指定模板包，覆盖 code-table 中保存的 templateName；
   * 不传则优先用配置里的 templateName，无效或空则用 templates 下第一个目录
   */
  templateName: z
    .string()
    .optional()
    .transform((v) => (v == null || v.trim() === '' ? undefined : v.trim()))
    .refine(
      (v) => v === undefined || /^[a-zA-Z0-9_-]+$/.test(v),
      'templateName 仅允许字母、数字、下划线、短横线',
    ),
  /**
   * 可选；传给 web.api 模板的 apiPathPrefix，默认用 code-table 的 moduleName
   */
  apiPathPrefix: z
    .string()
    .optional()
    .transform((v) => (v == null || v.trim() === '' ? undefined : v.trim())),
});

export class GenerateCodeDto extends createZodDto(GenerateCodeDtoSchema) {}
