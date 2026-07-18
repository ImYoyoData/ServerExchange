import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
// src\api\admin\menu\entities\menu.entity.ts
/**
 * 菜单实体类
 */
@Entity('sys_menu')
export class Menu {
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  @Column({ type: 'int', default: 0, comment: '父级菜单ID，0表示根菜单' })
  parentId: number;

  @Column({ type: 'int', comment: '菜单类型：0=菜单 1=iframe 2=外链 3=按钮' })
  menuType: number;

  @Column({
    type: 'varchar',
    length: 100,
    comment: '菜单标题（支持国际化key）',
  })
  title: string;

  @Column({ type: 'varchar', length: 100, comment: '路由名称' })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '路由路径' })
  path: string;

  @Column({ type: 'varchar', length: 200, default: '', comment: '组件路径' })
  component: string;

  @Column({ type: 'int', nullable: true, comment: '排序（数字越小越靠前）' })
  rank: number;

  @Column({ type: 'varchar', length: 200, default: '', comment: '重定向路径' })
  redirect: string;

  @Column({ type: 'varchar', length: 100, default: '', comment: '菜单图标' })
  icon: string;

  @Column({ type: 'varchar', length: 100, default: '', comment: '额外图标' })
  extraIcon: string;

  @Column({
    type: 'varchar',
    length: 100,
    default: '',
    comment: '进入页面动画',
  })
  enterTransition: string;

  @Column({
    type: 'varchar',
    length: 100,
    default: '',
    comment: '离开页面动画',
  })
  leaveTransition: string;

  @Column({
    type: 'varchar',
    length: 200,
    default: '',
    comment: '激活菜单路径',
  })
  activePath: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: false, // 明确设置为NOT NULL
    comment: '按钮级别权限标识',
  })
  auths: string;

  @Column({
    type: 'varchar',
    length: 500,
    default: '',
    comment: 'iframe地址（menuType=1时有效）',
  })
  frameSrc: string;

  @Column({ type: 'boolean', default: true, comment: 'iframe加载状态' })
  frameLoading: boolean;

  @Column({
    type: 'boolean',
    default: false,
    comment: '是否缓存（keep-alive）',
  })
  keepAlive: boolean;

  @Column({ type: 'boolean', default: false, comment: '是否隐藏标签页' })
  hiddenTag: boolean;

  @Column({ type: 'boolean', default: false, comment: '是否固定标签页' })
  fixedTag: boolean;

  @Column({ type: 'boolean', default: true, comment: '是否显示菜单' })
  showLink: boolean;

  @Column({ type: 'boolean', default: false, comment: '是否显示父级菜单' })
  showParent: boolean;
}
