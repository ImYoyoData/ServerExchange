import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    comment: '用户名',
    unique: true,
  })
  name: string;

  @Column({
    comment: '电子邮箱',
    default: '',
  })
  email: string;

  @Column({
    comment: '用户密码',
  })
  password: string;

  @Column({
    comment: '是否禁用',
    default: false,
  })
  isBanned: boolean;

  @CreateDateColumn({
    comment: '创建时间',
  })
  createdAt: Date;
}
