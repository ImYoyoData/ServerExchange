import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('sys_message')
export class SysMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', comment: '关联 sys_admin 表的 id' })
  userId: number;

  /**
   * 同一次发送（群发 / 多选用户）共用同一 UUID，便于按批次软删
   */
  @Column({
    name: 'send_batch_id',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: '同一次发送批次 ID（UUID）',
  })
  sendBatchId: string | null;

  @Column({ type: 'int', comment: '消息类型：1-通知、2-消息' })
  type: number;

  @Column({ type: 'boolean', comment: '状态：false-未读、true-已读' })
  status: boolean;

  @Column({ type: 'varchar', length: 255, comment: '消息标题' })
  title: string;

  @Column({ type: 'text', comment: '消息内容' })
  content: string;

  @Column({
    name: 'redirect_url',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '点击跳转路径',
  })
  redirectUrl: string | null;

  @Column({
    name: 'read_at',
    type: 'datetime',
    nullable: true,
    comment: '已读时间',
  })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', comment: '发送时间' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
