import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/**
 * 开发环境：应用启动（含 TypeORM synchronize）完成后，
 * 将当前 SQLite 库完整导出为项目根目录 `sys.sql`（结构 + 数据）。
 */
@Injectable()
export class DevSqliteBackupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevSqliteBackupService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV !== 'development') return;
    if (process.env.DEV_SQLITE_BACKUP === 'false') {
      this.logger.debug('已跳过 sys.sql 备份（DEV_SQLITE_BACKUP=false）');
      return;
    }

    const opts = this.dataSource.options as {
      type?: string;
      database?: string;
    };
    const type = opts.type;
    if (type !== 'better-sqlite3' && type !== 'sqlite') {
      this.logger.debug(`当前驱动为 ${type}，跳过 SQLite → sys.sql 备份`);
      return;
    }

    const dbFile = opts.database;
    if (!dbFile || typeof dbFile !== 'string') {
      this.logger.warn('未配置 SQLite database 路径，跳过 sys.sql 备份');
      return;
    }

    const absDb = path.isAbsolute(dbFile)
      ? dbFile
      : path.resolve(process.cwd(), dbFile);
    if (!fs.existsSync(absDb)) {
      this.logger.warn(`SQLite 文件不存在，跳过备份: ${absDb}`);
      return;
    }

    const outPath = path.resolve(process.cwd(), 'sys.sql');
    try {
      const sql = dumpSqliteToSql(absDb);
      fs.writeFileSync(outPath, sql, 'utf8');
      this.logger.log(`已备份当前数据库 → ${outPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`备份 sys.sql 失败: ${msg}`);
    }
  }
}

function quoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`;
  }
  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** 只读打开 DB，导出可再执行的 SQLite SQL 文本 */
export function dumpSqliteToSql(dbPath: string): string {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const lines: string[] = [
      '-- ServerExchange auto dump (development startup)',
      `-- source: ${dbPath.replace(/\\/g, '/')}`,
      `-- generatedAt: ${new Date().toISOString()}`,
      'PRAGMA foreign_keys=OFF;',
      'BEGIN TRANSACTION;',
    ];

    const objects = db
      .prepare(
        `SELECT type, name, sql FROM sqlite_master
         WHERE sql IS NOT NULL
           AND name NOT LIKE 'sqlite_%'
         ORDER BY
           CASE type
             WHEN 'table' THEN 1
             WHEN 'index' THEN 2
             WHEN 'trigger' THEN 3
             WHEN 'view' THEN 4
             ELSE 5
           END,
           name`,
      )
      .all() as Array<{ type: string; name: string; sql: string }>;

    for (const obj of objects) {
      if (obj.type === 'table') {
        lines.push('');
        lines.push(`DROP TABLE IF EXISTS ${quoteIdent(obj.name)};`);
        lines.push(`${obj.sql};`);

        const cols = (
          db.prepare(`PRAGMA table_info(${quoteIdent(obj.name)})`).all() as Array<{
            name: string;
          }>
        ).map((c) => c.name);
        if (cols.length === 0) continue;

        const colList = cols.map(quoteIdent).join(', ');
        const selectSql = `SELECT * FROM ${quoteIdent(obj.name)}`;
        const rows = db.prepare(selectSql).all() as Record<string, unknown>[];
        for (const row of rows) {
          const values = cols.map((c) => sqlLiteral(row[c])).join(', ');
          lines.push(
            `INSERT INTO ${quoteIdent(obj.name)} (${colList}) VALUES (${values});`,
          );
        }
      } else {
        // index / trigger / view：先 DROP 再 CREATE（sql 已是完整 CREATE 语句）
        lines.push('');
        if (obj.type === 'index') {
          lines.push(`DROP INDEX IF EXISTS ${quoteIdent(obj.name)};`);
        } else if (obj.type === 'trigger') {
          lines.push(`DROP TRIGGER IF EXISTS ${quoteIdent(obj.name)};`);
        } else if (obj.type === 'view') {
          lines.push(`DROP VIEW IF EXISTS ${quoteIdent(obj.name)};`);
        }
        lines.push(`${obj.sql};`);
      }
    }

    lines.push('COMMIT;');
    lines.push('PRAGMA foreign_keys=ON;');
    lines.push('');
    return lines.join('\n');
  } finally {
    db.close();
  }
}
