// src/api/admin/role/entities/role-menu.entity.ts
import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
  Column,
} from 'typeorm';
import { Role } from '../../entities/role.entity';
import { Menu } from 'src/api/admin/menu/entities/menu.entity';

@Entity('sys_role_menu')
@Unique(['role', 'menu'])
export class RoleMenu {
  @PrimaryColumn({ comment: '角色ID' })
  roleId: number;

  @PrimaryColumn({ comment: '菜单ID' })
  menuId: number;

  @CreateDateColumn({ comment: '授权时间' })
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => Role, (role) => role.id, { onDelete: 'CASCADE' })
  role: Role;

  @ManyToOne(() => Menu, (menu) => menu.id, { onDelete: 'CASCADE' })
  menu: Menu;
}
