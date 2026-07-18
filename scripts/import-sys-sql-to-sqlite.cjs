/**
 * 将 MySQL 导出的 sys.sql（只读参考）转换为 SQLite 并导入到本地库。
 * 用法: node scripts/import-sys-sql-to-sqlite.cjs [dbPath]
 * 默认 db: ./data/app.db
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const root = path.resolve(__dirname, '..');
const sysSqlPath = path.join(root, 'sys.sql');
const dbPath = path.resolve(
  process.argv[2] || path.join(root, 'data', 'app.db'),
);

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

/**
 * 将单条 MySQL CREATE TABLE 转为 SQLite。
 */
function convertCreateTable(stmt) {
  const m = stmt.match(
    /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*)\)\s*$/i,
  );
  if (!m) return stmt;

  const table = m[1];
  let body = m[2];

  body = body
    .replace(/\s+CHARACTER\s+SET\s+\w+/gi, '')
    .replace(/\s+COLLATE\s+\w+/gi, '')
    .replace(/\s+COMMENT\s+'([^'\\]|\\.)*'/gi, '')
    .replace(/\s+COMMENT\s+"([^"\\]|\\.)*"/gi, '')
    .replace(/\s+USING\s+BTREE/gi, '')
    .replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP(?:\(\d+\))?/gi, '')
    .replace(/\bCURRENT_TIMESTAMP\(\d+\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bdatetime\(\d+\)/gi, 'TEXT')
    .replace(/\bdatetime\b/gi, 'TEXT')
    .replace(/\btimestamp\(\d+\)/gi, 'TEXT')
    .replace(/\btimestamp\b/gi, 'TEXT')
    .replace(/\bvarchar\(\d+\)/gi, 'TEXT')
    .replace(/\bchar\(\d+\)/gi, 'TEXT')
    .replace(/\blongtext\b/gi, 'TEXT')
    .replace(/\bmediumtext\b/gi, 'TEXT')
    .replace(/\btext\b/gi, 'TEXT')
    .replace(/\btinyint\(\d+\)/gi, 'INTEGER')
    .replace(/\bsmallint\(\d+\)/gi, 'INTEGER')
    .replace(/\bmediumint\(\d+\)/gi, 'INTEGER')
    .replace(/\bbigint\(\d+\)/gi, 'INTEGER')
    .replace(/\bint\(\d+\)/gi, 'INTEGER')
    .replace(/\bdouble(?:\(\d+,\d+\))?/gi, 'REAL')
    .replace(/\bfloat(?:\(\d+,\d+\))?/gi, 'REAL')
    .replace(/\bdecimal\(\d+,\d+\)/gi, 'REAL')
    .replace(/\s+AUTO_INCREMENT\b/gi, '');

  // 拆分顶层逗号（忽略括号内）
  const parts = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  const columns = [];
  const tableConstraints = [];
  const indexes = [];
  let pkCols = [];

  for (const part of parts) {
    const uniqueIdx = part.match(
      /^UNIQUE\s+INDEX\s+`?(\w+)`?\s*\((.+)\)\s*$/i,
    );
    if (uniqueIdx) {
      indexes.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS \`${uniqueIdx[1]}\` ON \`${table}\` (${uniqueIdx[2]});`,
      );
      continue;
    }
    const idx = part.match(/^INDEX\s+`?(\w+)`?\s*\((.+)\)\s*$/i);
    if (idx) {
      indexes.push(
        `CREATE INDEX IF NOT EXISTS \`${idx[1]}\` ON \`${table}\` (${idx[2]});`,
      );
      continue;
    }
    const keyIdx = part.match(/^KEY\s+`?(\w+)`?\s*\((.+)\)\s*$/i);
    if (keyIdx) {
      indexes.push(
        `CREATE INDEX IF NOT EXISTS \`${keyIdx[1]}\` ON \`${table}\` (${keyIdx[2]});`,
      );
      continue;
    }

    const pk = part.match(/^PRIMARY\s+KEY\s*\((.+)\)\s*$/i);
    if (pk) {
      pkCols = pk[1]
        .split(',')
        .map((s) => s.replace(/`/g, '').trim())
        .filter(Boolean);
      tableConstraints.push(part);
      continue;
    }

    if (/^(CONSTRAINT|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(part)) {
      // UNIQUE INDEX 已处理；裸 UNIQUE (cols) 保留
      tableConstraints.push(
        part.replace(/^UNIQUE\s+INDEX\s+`?\w+`?/i, 'UNIQUE'),
      );
      continue;
    }

    columns.push(part);
  }

  // 单列 INTEGER 主键 → AUTOINCREMENT
  if (pkCols.length === 1) {
    const pkName = pkCols[0];
    const colIdx = columns.findIndex((c) => {
      const cm = c.match(/^`?(\w+)`?/);
      return cm && cm[1] === pkName;
    });
    if (colIdx >= 0 && /\bINTEGER\b/i.test(columns[colIdx])) {
      let col = columns[colIdx];
      col = col.replace(/\bNOT\s+NULL\b/gi, '');
      if (!/\bPRIMARY\s+KEY\b/i.test(col)) {
        col = col.replace(/\bINTEGER\b/i, 'INTEGER PRIMARY KEY AUTOINCREMENT');
      } else if (!/\bAUTOINCREMENT\b/i.test(col)) {
        col = col.replace(/\bPRIMARY\s+KEY\b/i, 'PRIMARY KEY AUTOINCREMENT');
      }
      columns[colIdx] = col.trim().replace(/\s+/g, ' ');
      // 去掉表级 PRIMARY KEY
      for (let i = tableConstraints.length - 1; i >= 0; i--) {
        if (/^PRIMARY\s+KEY\b/i.test(tableConstraints[i])) {
          tableConstraints.splice(i, 1);
        }
      }
    }
  }

  const all = [...columns, ...tableConstraints].filter(Boolean);
  const create = `CREATE TABLE IF NOT EXISTS \`${table}\` (\n  ${all.join(',\n  ')}\n);`;
  return { create, indexes };
}

function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const prev = sql[i - 1];
    if (ch === "'" && !inDouble && !inBacktick && prev !== '\\') {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && !inBacktick && prev !== '\\') {
      inDouble = !inDouble;
    } else if (ch === '`' && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
    }
    if (ch === ';' && !inSingle && !inDouble && !inBacktick) {
      const s = cur.trim();
      if (s) stmts.push(s);
      cur = '';
      continue;
    }
    cur += ch;
  }
  const last = cur.trim();
  if (last) stmts.push(last);
  return stmts;
}

function convertMysqlDump(raw) {
  let sql = stripComments(raw);
  sql = sql
    .replace(/SET\s+NAMES\s+[^;]+;/gi, '')
    .replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*0\s*;/gi, 'PRAGMA foreign_keys = OFF;')
    .replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*1\s*;/gi, 'PRAGMA foreign_keys = ON;')
    .replace(/\s*ENGINE\s*=\s*\w+[^;]*/gi, '')
    .replace(/\s*ROW_FORMAT\s*=\s*\w+/gi, '')
    .replace(/\s*AUTO_INCREMENT\s*=\s*\d+/gi, '')
    .replace(/\s*DEFAULT\s+CHARSET\s*=\s*\w+/gi, '')
    .replace(/\s*COLLATE\s*=\s*\w+/gi, '');

  const out = [];
  const deferredIndexes = [];

  for (const stmt of splitStatements(sql)) {
    if (/^CREATE\s+TABLE\b/i.test(stmt)) {
      const converted = convertCreateTable(stmt);
      if (typeof converted === 'string') {
        out.push(converted);
      } else {
        out.push(converted.create);
        deferredIndexes.push(...converted.indexes);
      }
      continue;
    }
    if (/^DROP\s+TABLE\b/i.test(stmt)) {
      out.push(stmt.replace(/DROP\s+TABLE\s+IF\s+EXISTS/i, 'DROP TABLE IF EXISTS'));
      continue;
    }
    if (/^INSERT\s+INTO\b/i.test(stmt)) {
      out.push(stmt);
      continue;
    }
    if (/^PRAGMA\b/i.test(stmt)) {
      out.push(stmt);
      continue;
    }
    // 跳过其它 MySQL 专有语句
  }

  return [...out, ...deferredIndexes];
}

function main() {
  if (!fs.existsSync(sysSqlPath)) {
    console.error('未找到 sys.sql:', sysSqlPath);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const raw = fs.readFileSync(sysSqlPath, 'utf8');
  const statements = convertMysqlDump(raw);
  console.log(`已转换 ${statements.length} 条语句，导入到 ${dbPath}`);

  const db = new Database(dbPath);
  db.pragma('foreign_keys = OFF');
  const tx = db.transaction((stmts) => {
    for (const s of stmts) {
      try {
        db.exec(s);
      } catch (e) {
        console.error('执行失败:', s.slice(0, 200));
        throw e;
      }
    }
  });
  tx(statements);
  db.pragma('foreign_keys = ON');

  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .all()
    .map((r) => r.name);
  console.log('表:', tables.join(', '));
  for (const t of tables) {
    const n = db.prepare(`SELECT COUNT(*) AS c FROM \`${t}\``).get().c;
    console.log(`  ${t}: ${n} rows`);
  }
  db.close();
  console.log('导入完成');
}

main();
