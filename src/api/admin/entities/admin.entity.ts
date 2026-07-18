// src/entities/admin.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('sys_admin')
export class Admin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    comment: '用户名',
    unique: true,
  })
  username: string;

  @Column({
    comment: '密码哈希',
  })
  password: string;

  @Column({
    comment: '头像_文件id',
    nullable: true,
  })
  avatar: number;

  @Column({
    comment: '昵称',
    nullable: true,
  })
  nickname: string;

  @Column({
    comment: '手机号码',
    nullable: true,
  })
  phone: string;

  @Column({
    comment: '电子邮箱',
    nullable: true,
  })
  email: string;

  @Column({
    comment: '最后登录时间',
    nullable: true,
  })
  lastLoginAt: Date;

  @Column({
    comment: '最后登录IP',
    nullable: true,
  })
  lastLoginIp: string;

  @Column({
    comment: '用户状态 0:禁用 1:正常',
    default: true,
  })
  status: boolean;

  @Column({
    comment: '性别 1:女 0:男',
    nullable: true,
  })
  sex: number;

  @Column({
    comment: '用户备注',
    default: '',
  })
  remark: string;

  @Column({
    comment: '是否超级管理员',
    default: false,
  })
  isSuperAdmin: boolean;

  // ✅ 修复：明确指定 Role 实体
  @ManyToMany(() => Role, { eager: true })
  @JoinTable({
    name: 'sys_admin_roles',
    joinColumn: { name: 'admin_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  @CreateDateColumn({
    comment: '创建时间',
  })
  createdAt: Date;

  @UpdateDateColumn({
    comment: '更新时间',
  })
  updatedAt: Date;
}
