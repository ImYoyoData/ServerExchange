import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sys_task')
export class SysTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, comment: '任务名称' })
  name: string;

  @Column({ type: 'varchar', length: 200, comment: '任务描述' })
  description: string;

  @Column({ type: 'varchar', length: 200, comment: 'cron表达式' })
  cron: string;

  @Column({ type: 'json', nullable: true, comment: '任务参数' })
  params: any;

  @Column({ type: 'boolean', default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({
    type: 'datetime',
    nullable: true,
    name: 'last_execute_time',
    comment: '上次执行时间',
  })
  lastExecuteTime: Date;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_manual_execute',
    comment: '上次执行是手动执行？',
  })
  isManualExecute: boolean;

  @Column({
    type: 'boolean',
    default: 2, // 2:未执行
    name: 'last_execute_status',
    comment: '上次执行状态 0:失败 1:成功 2:未执行',
  })
  lastExecuteStatus: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'cron',
    name: 'task_type',
    comment: '任务类型',
  })
  taskType: string;

  @Column({
    type: 'boolean',
    default: false,
    name: 'is_valid',
    comment: '任务是否有效',
  })
  isValid: boolean;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;
}
