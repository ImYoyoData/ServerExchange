import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('sys_dict')
export class Dict {
  @PrimaryGeneratedColumn({
    comment: '主键id',
  })
  id: number;

  @Column({
    comment: '字典编码',
    length: 200,
    unique: true,
  })
  code: string;

  @Column({
    comment: '字典名称',
    length: 200,
  })
  name: string;

  @Column({
    comment: '字典描述',
    nullable: true,
    length: 200,
  })
  description: string;

  @Column({
    comment: '字典状态 0:禁用 1:启用',
    default: true,
    type: 'boolean',
  })
  status: boolean;

  @CreateDateColumn({
    comment: '创建时间',
  })
  createdAt: Date;
}

@Entity('sys_dict_data')
@Unique('UQ_sys_dict_data_parentId_value', ['parentId', 'value'])
export class DictData {
  @PrimaryGeneratedColumn({
    comment: '主键id',
  })
  id: number;

  @Index()
  @Column({
    comment: '父亲级Id',
    type: 'int',
  })
  parentId: number;

  @Column({
    comment: '字典名称',
    length: 200,
  })
  name: string;

  @Column({
    comment: '字典值（同一 parentId 下唯一，不同 parentId 可相同）',
    length: 200,
  })
  value: string;

  @Column({
    comment: '字典描述',
    nullable: true,
    length: 200,
  })
  description: string;

  @Column({
    comment: '标签类型',
    length: 50,
    default: 'default',
  })
  tagType: string;

  //   可选其他父字段编码作为嵌套子节点
  @Column({
    comment: '嵌套字典id',
    nullable: true,
    type: 'int',
  })
  dictId: number;

  @Column({
    comment: '字典排序',
    default: 0,
    type: 'int',
  })
  sort: number;

  @Column({
    comment: '字典状态 0:禁用 1:启用',
    default: true,
    type: 'boolean',
  })
  status: boolean;

  @Column({
    comment: '更新者',
    nullable: true,
    length: 200,
  })
  updatedBy: string;

  @Column({
    comment: '创建者',
    nullable: true,
    length: 200,
  })
  createdBy: string;

  @Column({
    comment: '更新时间',
    nullable: true,
  })
  updatedAt: Date;

  @CreateDateColumn({
    comment: '创建时间',
  })
  createdAt: Date;
}
