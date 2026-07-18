import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GenerateTypeormEntityDtoSchema = z.object({
  /** 表结构 / 字段等业务需求描述 */
  message: z.string().min(1, 'message 不能为空'),
  /** 可选：用户昵称、部门、租户等，供 prepare 节点拼进上文 */
  userContext: z.string().optional(),
});

export class GenerateTypeormEntityDto extends createZodDto(
  GenerateTypeormEntityDtoSchema,
) {}
