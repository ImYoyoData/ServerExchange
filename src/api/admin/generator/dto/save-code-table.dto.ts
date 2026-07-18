import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import { QUERY_COMPONENTS, QUERY_OPERATORS } from '../generator.types';

const queryOperatorZod = z.enum(QUERY_OPERATORS, {
  message: `queryOperator 必须是：${QUERY_OPERATORS.join('、')}`,
});

const queryComponentZod = z.enum(QUERY_COMPONENTS, {
  message: `queryComponent 必须是：${QUERY_COMPONENTS.join('、')}`,
});

const CodeFieldItemSchema = z.object({
  name: z.string().min(1, '字段名不能为空'),
  dbType: z.string().min(1, 'dbType 不能为空'),
  tsType: z.string().min(1, 'tsType 不能为空'),
  length: z
    .union([z.number().int(), z.null()])
    .optional()
    .transform((v) => (v == null ? undefined : v)),
  comment: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v == null ? undefined : v)),
  isInsert: z.boolean({ message: 'isInsert 必须为布尔值' }),
  isUpdate: z.boolean({ message: 'isUpdate 必须为布尔值' }),
  isList: z.boolean({ message: 'isList 必须为布尔值' }),
  isQuery: z.boolean({ message: 'isQuery 必须为布尔值' }),
  isMultiSelect: z.coerce.boolean().optional().default(false),
  queryOperator: queryOperatorZod,
  queryComponent: queryComponentZod,
  formComponent: queryComponentZod.optional().default('input'),
  dictCode: z
    .union([z.string().max(100, 'dictCode 最长 100'), z.null()])
    .optional()
    .transform((v) => (v == null || v === '' ? undefined : v)),
});

export const SaveCodeTableDtoSchema = z.object({
  tableName: z.string().min(1, '表名不能为空'),
  tableComment: z.string().optional().default(''),
  className: z.string().min(1, '类名不能为空'),
  moduleName: z.string().min(1, '模块名不能为空'),
  /** 模板包名（templates 子目录）；不传或空则保存为当前目录下第一个模板包 */
  templateName: z.string().max(200).optional(),
  fields: z.array(CodeFieldItemSchema).optional().default([]),
});

export class SaveCodeTableDto extends createZodDto(SaveCodeTableDtoSchema) {}
