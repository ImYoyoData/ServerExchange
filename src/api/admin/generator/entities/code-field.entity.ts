import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CodeTableConfig } from './code-table.entity';

@Entity('sys_code_field_config')
export class CodeFieldConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CodeTableConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'table_id' })
  tableConfig: CodeTableConfig;

  @Column({
    name: 'field_name',
    type: 'varchar',
    length: 100,
    comment: '字段名',
  })
  fieldName: string;

  @Column({
    name: 'db_type',
    type: 'varchar',
    length: 50,
    comment: '数据库类型',
  })
  dbType: string;

  @Column({
    name: 'ts_type',
    type: 'varchar',
    length: 50,
    comment: 'TypeScript类型',
  })
  tsType: string;

  @Column({
    name: 'field_length',
    type: 'int',
    nullable: true,
    comment: '字段长度',
  })
  fieldLength: number | null;

  @Column({
    name: 'field_comment',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '字段注释',
  })
  fieldComment: string | null;

  @Column({
    name: 'is_nullable',
    type: 'boolean',
    default: false,
    comment: '是否可空',
  })
  isNullable: boolean;

  @Column({
    name: 'is_unique',
    type: 'boolean',
    default: false,
    comment: '是否唯一',
  })
  isUnique: boolean;

  @Column({
    name: 'default_value',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '默认值',
  })
  defaultValue: string | null;

  @Column({
    name: 'is_insert',
    type: 'boolean',
    default: true,
    comment: '是否插入字段',
  })
  isInsert: boolean;

  @Column({
    name: 'is_update',
    type: 'boolean',
    default: true,
    comment: '是否更新字段',
  })
  isUpdate: boolean;

  @Column({
    name: 'is_list',
    type: 'boolean',
    default: true,
    comment: '是否列表显示',
  })
  isList: boolean;

  @Column({
    name: 'is_query',
    type: 'boolean',
    default: false,
    comment: '是否查询字段',
  })
  isQuery: boolean;

  @Column({
    name: 'is_multi_select',
    type: 'boolean',
    default: false,
    comment:
      '是否多选（表单/查询值为数组；查询用 IN；常用于 select 多选，或与 checkbox 查询一致）',
  })
  isMultiSelect: boolean;

  @Column({
    name: 'query_operator',
    type: 'varchar',
    length: 20,
    default: '=',
    comment: '查询操作符',
  })
  queryOperator: string;

  @Column({
    name: 'query_component',
    type: 'varchar',
    length: 50,
    default: 'input',
    comment: '查询组件',
  })
  queryComponent: string;

  @Column({
    name: 'form_component',
    type: 'varchar',
    length: 50,
    default: 'input',
    comment: '表单组件',
  })
  formComponent: string;

  @Column({
    name: 'dict_code',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '字典编码',
  })
  dictCode: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '排序' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;
}
