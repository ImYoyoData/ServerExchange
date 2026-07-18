import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MESSAGE_TYPE_VALUES } from '../message.constants';

/** `0` | 单个 id | 多个 id：每人库表一行（兼容字符串 "0"） */
const UserIdInputSchema = z.preprocess(
  (val) => {
    if (val === '0' || val === 0) return 0;
    return val;
  },
  z.union([
    z.literal(0),
    z.coerce.number().int().positive(),
    z
      .array(z.coerce.number().int().positive())
      .min(1, '至少指定一个用户')
      .describe('多个用户 ID'),
  ]),
);

export const CreateMessageSchema = z
  .object({
    /**
     * 接收用户（可选）：`0` = 全体管理员；正整数 = 单人；数组 = 多用户。
     * 可与 `roleIds` 同时传，**取并集**去重。
     */
    userId: UserIdInputSchema.optional().describe(
      '用户ID：0=全部 / 数字=单人 / 数组=多人',
    ),
    /**
     * 按角色群发：拥有**任意**一个指定角色的管理员都会收到（每人一行）。
     * 可与 `userId` 同时传，取并集。
     */
    roleIds: z
      .array(z.coerce.number().int().positive())
      .optional()
      .describe('角色 ID 列表'),
    title: z.string().min(1, '标题不能为空').max(255).describe('标题'),
    content: z.string().min(1, '内容不能为空').describe('内容'),
    type: z.coerce
      .number()
      .int()
      .refine((v) => (MESSAGE_TYPE_VALUES as readonly number[]).includes(v), {
        message: '消息类型无效，应为 1（通知）或 2（消息）',
      })
      .describe('类型：1-通知、2-消息'),
    redirectUrl: z
      .string()
      .max(255)
      .optional()
      .nullable()
      .describe('跳转路径，可选'),
  })
  .refine(
    (d) =>
      d.userId !== undefined ||
      (Array.isArray(d.roleIds) && d.roleIds.length > 0),
    {
      message: '请指定 userId，或传入非空的 roleIds',
      path: ['userId'],
    },
  );

export class CreateMessageDto extends createZodDto(CreateMessageSchema) {}
