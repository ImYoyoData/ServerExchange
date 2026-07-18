// src/entities/role.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sys_role')
export class Role {
  @PrimaryGeneratedColumn({
    comment: '角色编号',
  })
  id: number;

  @Column({
    comment: '角色名称',
    unique: true,
  })
  name: string;

  @Column({
    comment: '角色标识（程序中使用）',
    unique: true,
  })
  code: string;

  @Column({
    comment: '角色描述',
    default: '',
  })
  remark: string;

  @Column({
    comment: '角色状态 0:禁用 1:启用',
    default: true,
  })
  status: boolean;

  @Column({
    comment: '创建人',
    default: '',
  })
  createdBy: string;

  @Column({
    comment: '更新人',
    default: '',
  })
  updatedBy: string;

  @CreateDateColumn({
    comment: '创建时间',
  })
  createdAt: Date;

  @UpdateDateColumn({
    comment: '更新时间',
  })
  updatedAt: Date;
}
