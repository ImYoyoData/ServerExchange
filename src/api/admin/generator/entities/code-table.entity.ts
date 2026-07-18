import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sys_code_table_config')
export class CodeTableConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'table_name',
    type: 'varchar',
    unique: true,
    length: 200,
    comment: '表名',
  })
  tableName: string;

  @Column({
    name: 'table_comment',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '表注释',
  })
  tableComment: string;

  @Column({
    name: 'class_name',
    type: 'varchar',
    length: 200,
    comment: '实体类名',
  })
  className: string;

  @Column({
    name: 'module_name',
    type: 'varchar',
    length: 200,
    comment: '所属模块名',
  })
  moduleName: string;

  /** 对应 templates/ 下子目录名；空则生成代码时回退为目录中第一个模板包 */
  @Column({
    name: 'template_name',
    type: 'varchar',
    length: 200,
    nullable: true,
    comment: '模版名称',
  })
  templateName: string | null;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;
}
