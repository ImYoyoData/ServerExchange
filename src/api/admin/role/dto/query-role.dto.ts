import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const QueryRoleSchema = z
  .object({
    code: z.string().max(20).describe('角色编码'),
    name: z.string().max(20).describe('角色名称'),
    status: z.coerce.string().max(100).describe('角色状态 0:禁用 1:启用'),
    page: z.coerce.number().default(1).describe('页码'),
    pageSize: z.coerce.number().max(100).default(10).describe('每页数量'),
  })
  .partial();

export class QueryRoleDto extends createZodDto(QueryRoleSchema) {}
