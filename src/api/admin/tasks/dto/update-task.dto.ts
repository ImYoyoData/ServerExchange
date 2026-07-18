import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateTaskCronSchema = z.object({
  /**
   * 对 cron 类型：传 Cron 表达式字符串
   * 对 interval/timeout 类型：传数字（会被 coerce 成字符串存库）
   */
  cron: z.coerce.string().min(1, 'cron不能为空'),
  /**
   * 备注（DB 字段为 description）
   * 前端命名：remark
   */
  remark: z.string().optional().default(''),
  enabled: z.boolean().describe('是否启用'),
});

export class UpdateTaskDto extends createZodDto(UpdateTaskCronSchema) {}
