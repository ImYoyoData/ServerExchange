import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateMenuSchema = z.object({
  parentId: z.number().int().min(0, '父菜单ID必须为非负整数'),
  id: z.number().int().min(1, '菜单ID必须为正整数').optional(),
  menuType: z
    .number()
    .int()
    .min(0)
    .max(3, '菜单类型必须是0-3的整数')
    .describe('菜单类型（0代表菜单、1代表iframe、2代表外链、3代表按钮）'),
  title: z.string().min(1, '菜单标题不能为空'),
  name: z.string().optional(),
  path: z.string().optional(),
  component: z.string().optional(),
  rank: z.number().int().optional().describe('菜单排序'),
  redirect: z.string().optional(),
  icon: z.string().optional(),
  extraIcon: z.string().optional(),
  enterTransition: z.string().optional(),
  leaveTransition: z.string().optional(),
  activePath: z.string().optional(),
  auths: z.string().optional(),
  frameSrc: z.string().optional(),
  frameLoading: z.boolean().optional(),
  keepAlive: z.boolean().optional(),
  hiddenTag: z.boolean().optional(),
  fixedTag: z.boolean().optional(),
  showLink: z.boolean().optional(),
  showParent: z.boolean().optional(),
});

export class CreateMenuDto extends createZodDto(CreateMenuSchema) {}
