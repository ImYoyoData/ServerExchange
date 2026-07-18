import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('sys_file')
export class SysFile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, comment: '文件名' })
  fileName: string;

  @Column({ type: 'varchar', length: 500, comment: '文件路径' })
  filePath: string;

  @Column({ type: 'varchar', length: 100, comment: '文件类型/扩展名' })
  fileType: string;

  @Column({ type: 'bigint', comment: '文件大小(字节)' })
  fileSize: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '文件哈希值',
  })
  fileHash: string;

  @Column({
    type: 'int',
    nullable: true,
    comment: '上传用户ID',
  })
  uploadUserId: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '上传用户名称',
  })
  uploadUserName: string;

  @Column({
    type: 'varchar',
    length: 50,
    comment: '业务模块标识 用于分组',
  })
  module: string;

  @Column({ type: 'boolean', default: true, comment: '是否有效(软删除)' })
  isActive: boolean;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true, comment: '删除时间' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;
}
