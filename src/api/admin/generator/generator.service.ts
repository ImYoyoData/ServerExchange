import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import * as ejs from 'ejs';
import { CodeTableConfig } from './entities/code-table.entity';
import { CodeFieldConfig } from './entities/code-field.entity';
import type { SaveCodeTableDto } from './dto/save-code-table.dto';
import type {
  GeneratedFile,
  GeneratedFileCategory,
  GeneratorField,
  GeneratorTable,
  GeneratorTableSummary,
} from './generator.types';

/** 数据库表元信息（表名 + 表备注） */
export type GeneratorDbTableRow = {
  name: string;
  comment: string;
};

/** 数据库列元信息（真实查库） */
export type GeneratorDbColumnRow = {
  /** 列名 */
  name: string;
  /** 逻辑类型名（如 varchar、int、jsonb） */
  dataType: string;
  /** 库里的完整类型串（如 varchar(255)、int unsigned）— PG 下与 dataType 接近 */
  columnType: string;
  /** 字符最大长度；数值型多为 null，请看 numericPrecision */
  length: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  comment: string;
  primaryKey: boolean;
  nullable: boolean;
  ordinalPosition: number;
  defaultValue: string | null;
};

@Injectable()
export class GeneratorService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CodeTableConfig)
    private readonly codeTableRepo: Repository<CodeTableConfig>,
    @InjectRepository(CodeFieldConfig)
    private readonly codeFieldRepo: Repository<CodeFieldConfig>,
  ) {}

  /**
   * 模板根目录：src/api/admin/generator/templates（相对 process.cwd()）
   */
  getTemplatesRoot(): string {
    return join(process.cwd(), 'src', 'api', 'admin', 'generator', 'templates');
  }

  /**
   * templates/ 下一级子目录名列表（每个目录即一套模板包，如 element-plus-curd）
   */
  listTemplateNames(): string[] {
    const root = this.getTemplatesRoot();
    if (!existsSync(root)) {
      return [];
    }
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  }

  /**
   * 按表名渲染模板：有 code-table 行则用其字段与 templateName；无行则用库表元数据拼默认配置，模板取第一个包。
   * @param templateOverride 非空时强制使用该模板包（须存在于 templates/ 下）
   */
  async generateCodeFiles(
    tableName: string,
    apiPathPrefix?: string,
    templateOverride?: string,
  ): Promise<GeneratedFile[]> {
    const tname = this.assertSafeTableName(tableName.trim());
    const names = this.listTemplateNames();

    const row = await this.codeTableRepo.findOne({
      where: { tableName: tname },
    });

    let config: GeneratorTable;
    if (row) {
      const full = await this.getCodeTableWithFieldsByTableName(tname);
      if (!full) {
        throw new Error(`读取表「${tname}」的 code-table 配置失败`);
      }
      config = full;
    } else {
      config = await this.buildDefaultGeneratorTableFromDatabase(tname);
    }

    let resolvedTpl: string;
    const ov = (templateOverride ?? '').trim();
    if (ov) {
      resolvedTpl = this.resolveTemplateNameOrThrow(ov);
    } else if (row) {
      const stored = (row.templateName ?? '').trim();
      resolvedTpl =
        stored && names.includes(stored)
          ? stored
          : this.firstTemplateName(names);
    } else {
      resolvedTpl = this.firstTemplateName(names);
    }

    return this.renderTemplatePackage(resolvedTpl, config, apiPathPrefix);
  }

  /** templates 目录排序后的第一个子目录名；无可用包时抛错 */
  private firstTemplateName(names: string[]): string {
    const head = names[0];
    if (head === undefined) {
      throw new Error('templates 目录下没有可用的模板包');
    }
    return head;
  }

  /** 空串或未传 → 第一个模板包；非空须存在 */
  private resolveTemplateNameOrFirst(raw: string | undefined): string {
    const names = this.listTemplateNames();
    const s = (raw ?? '').trim();
    if (!s) {
      return this.firstTemplateName(names);
    }
    return this.resolveTemplateNameOrThrow(s);
  }

  private resolveTemplateNameOrThrow(name: string): string {
    const safe = this.assertSafeTemplateName(name);
    const names = this.listTemplateNames();
    if (!names.includes(safe)) {
      throw new Error(`模板包不存在：${safe}`);
    }
    return safe;
  }

  private async renderTemplatePackage(
    templateName: string,
    config: GeneratorTable,
    apiPathPrefix?: string,
  ): Promise<GeneratedFile[]> {
    const safeTpl = this.assertSafeTemplateName(templateName);
    const tplDir = join(this.getTemplatesRoot(), safeTpl);
    if (!existsSync(tplDir)) {
      throw new Error(`模板包不存在：${safeTpl}`);
    }

    const kebab = config.tableName.replace(/_/g, '-');
    const modulePath = config.moduleName
      .replace(/^\/+|\/+$/g, '')
      .replace(/\/+/g, '/');

    const prefix =
      (apiPathPrefix ?? '').trim().replace(/^\/+|\/+$/g, '') ||
      modulePath ||
      config.moduleName;

    const locals: GeneratorTable & {
      apiPathPrefix: string;
      fields: GeneratorField[];
    } = {
      ...config,
      apiPathPrefix: prefix,
      fields: config.fields,
    };

    const outputs: Array<{
      templateFile: string;
      outPath: string;
      category: GeneratedFileCategory;
    }> = [
      {
        templateFile: 'templates.dto.ejs',
        outPath: `server/dto/${kebab}.dto.ts`,
        category: 'nest-backend',
      },
      {
        templateFile: 'templates.service.ejs',
        outPath: `server/${kebab}.service.ts`,
        category: 'nest-backend',
      },
      {
        templateFile: 'templates.module.ejs',
        outPath: `server/${kebab}.module.ts`,
        category: 'nest-backend',
      },
      {
        templateFile: 'templates.constroller.ejs',
        outPath: `server/${kebab}.controller.ts`,
        category: 'nest-backend',
      },
      {
        templateFile: 'templates.web.api.ejs',
        outPath: `src/api/${kebab}.ts`,
        category: 'web-ts',
      },
      {
        templateFile: 'templates.web.vue.ejs',
        outPath: `src/views/${modulePath}/${kebab}.vue`,
        category: 'web-vue',
      },
      {
        templateFile: 'templates.web.vue.form.ejs',
        outPath: `src/views/${modulePath}/${kebab}-form.vue`,
        category: 'web-vue',
      },
    ];

    const files: GeneratedFile[] = [];

    for (const o of outputs) {
      const abs = join(tplDir, o.templateFile);
      if (!existsSync(abs)) {
        continue;
      }
      const code = await this.renderEjsFile(abs, locals, {
        async: false,
        root: tplDir,
      });
      files.push({
        path: o.outPath.replace(/\\/g, '/'),
        code: String(code),
        category: o.category,
      });
    }

    if (files.length === 0) {
      throw new Error(`模板包「${safeTpl}」内未找到可渲染的 .ejs 文件`);
    }

    return files;
  }

  /**
   * 无 code-table 配置时：用真实库表列元数据生成 GeneratorTable（类名/模块名为约定默认值）
   */
  private async buildDefaultGeneratorTableFromDatabase(
    tableName: string,
  ): Promise<GeneratorTable> {
    const columns = await this.listTableColumns(tableName);
    if (columns.length === 0) {
      throw new Error(`数据表「${tableName}」不存在或无法读取列信息`);
    }

    const tables = await this.listDatabaseTables();
    const meta = tables.find((t) => t.name === tableName);
    const tableComment = (meta?.comment ?? '').trim();
    const kebab = tableName.replace(/_/g, '-');

    return {
      tableName,
      tableComment,
      className: this.tableNameToClassName(tableName),
      moduleName: `admin/${kebab}`,
      fields: columns.map((c) => this.dbColumnToGeneratorField(c)),
    };
  }

  private tableNameToClassName(tableName: string): string {
    return tableName
      .split('_')
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join('');
  }

  private dbColumnToGeneratorField(col: GeneratorDbColumnRow): GeneratorField {
    const lowerName = col.name.toLowerCase();
    const tsType = this.inferTsTypeFromDbColumn(col);
    const dateLike =
      tsType === 'date' ||
      tsType === 'datetime' ||
      String(tsType).includes('timestamp');
    const isSimpleIdPk = col.primaryKey && lowerName === 'id';

    const formComponent = dateLike
      ? ('date' as GeneratorField['formComponent'])
      : ('input' as GeneratorField['formComponent']);
    const queryComponent = formComponent;

    const base: GeneratorField = {
      name: col.name,
      dbType: (col.columnType || col.dataType || '').trim() || col.dataType,
      tsType,
      isPrimary: col.primaryKey,
      isNullable: col.nullable,
      isInsert: !isSimpleIdPk,
      isUpdate: !isSimpleIdPk,
      isList: true,
      isQuery: true,
      queryOperator: dateLike ? 'between' : '=',
      queryComponent,
      formComponent,
    };

    if (col.length != null) {
      base.length = col.length;
    }
    const comment = (col.comment ?? '').trim();
    if (comment) {
      base.comment = comment;
    }

    return base;
  }

  private inferTsTypeFromDbColumn(col: GeneratorDbColumnRow): string {
    const dt = (col.dataType || '').toLowerCase();
    const ct = (col.columnType || '').toLowerCase();

    if (
      dt === 'bool' ||
      dt === 'boolean' ||
      ct === 'tinyint(1)' ||
      ct === 'bit(1)'
    ) {
      return 'boolean';
    }
    if (
      dt.includes('int') ||
      dt === 'decimal' ||
      dt === 'numeric' ||
      dt === 'float' ||
      dt === 'double' ||
      dt.includes('double') ||
      dt === 'real' ||
      dt === 'money' ||
      dt === 'smallmoney'
    ) {
      return dt.includes('bigint') ? 'bigint' : 'number';
    }
    if (dt.includes('timestamp') || dt.includes('datetime')) {
      return 'datetime';
    }
    if (dt === 'date') {
      return 'date';
    }
    if (dt.startsWith('time')) {
      return 'string';
    }
    if (dt === 'json' || dt === 'jsonb') {
      return 'string';
    }
    return 'string';
  }

  private assertSafeTemplateName(name: string): string {
    const s = name.trim();
    if (!s) {
      throw new Error('模板名称不能为空');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(s)) {
      throw new Error('模板名称仅允许字母、数字、下划线、短横线');
    }
    return s;
  }

  private renderEjsFile(
    path: string,
    data: ejs.Data,
    options?: ejs.Options,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ejs.renderFile(path, data, options ?? {}, (err, str) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(String(str));
      });
    });
  }

  /**
   * 列出当前连接数据库中所有「基表」的名称与表备注
   * 支持：MySQL / MariaDB、PostgreSQL、SQLite（含 better-sqlite3）
   */
  async listDatabaseTables(): Promise<GeneratorDbTableRow[]> {
    const type = this.dataSource.options.type as string;

    if (type === 'mysql' || type === 'mariadb') {
      return this.listMysqlTables();
    }
    if (type === 'postgres') {
      return this.listPostgresTables();
    }
    if (type === 'sqlite' || type === 'better-sqlite3') {
      return this.listSqliteTables();
    }

    throw new Error(
      `暂不支持的驱动：${type}（已支持 mysql、mariadb、postgres、sqlite、better-sqlite3）`,
    );
  }

  /**
   * 列出数据库表并融合 code-table 配置字段（className/moduleName/templateName）。
   * 无配置时仅返回 tableName/tableComment。
   */
  async listDatabaseTablesWithConfig(): Promise<GeneratorTableSummary[]> {
    const tables = await this.listDatabaseTables();
    const configs = await this.codeTableRepo.find();
    const configMap = new Map(configs.map((c) => [c.tableName, c]));

    return tables.map((t) => {
      const cfg = configMap.get(t.name);
      if (!cfg) {
        return {
          tableName: t.name,
          tableComment: t.comment,
        };
      }

      const out: GeneratorTableSummary = {
        tableName: t.name,
        tableComment: (cfg.tableComment ?? '').trim(),
        className: cfg.className,
        moduleName: cfg.moduleName,
      };

      const tpl = (cfg.templateName ?? '').trim();
      if (tpl) {
        out.templateName = tpl;
      }
      return out;
    });
  }

  /**
   * 按表名查询所有列元数据（主键、类型、长度、备注等），直接查系统表/元数据
   */
  async listTableColumns(tableName: string): Promise<GeneratorDbColumnRow[]> {
    const name = this.assertSafeTableName(tableName);
    const type = this.dataSource.options.type as string;

    if (type === 'mysql' || type === 'mariadb') {
      return this.listMysqlColumns(name);
    }
    if (type === 'postgres') {
      return this.listPostgresColumns(name);
    }
    if (type === 'sqlite' || type === 'better-sqlite3') {
      return this.listSqliteColumns(name);
    }

    throw new Error(
      `暂不支持的驱动：${type}（已支持 mysql、mariadb、postgres、sqlite、better-sqlite3）`,
    );
  }

  /**
   * 按「业务表名」查询 sys_code_table_config 及其下 sys_code_field_config。
   * 无配置或表名为空时返回 null。
   */
  async getCodeTableWithFieldsByTableName(
    tableName: string,
  ): Promise<GeneratorTable | null> {
    const name = tableName?.trim() ?? '';
    if (!name) {
      return null;
    }

    const table = await this.codeTableRepo.findOne({
      where: { tableName: name },
    });

    if (!table) {
      return null;
    }

    const fieldEntities = await this.codeFieldRepo.find({
      where: { tableConfig: { id: table.id } },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });

    const tpl = (table.templateName ?? '').trim();

    return {
      tableName: table.tableName,
      tableComment: (table.tableComment ?? '').trim(),
      className: table.className,
      moduleName: table.moduleName,
      ...(tpl ? { templateName: tpl } : {}),
      fields: fieldEntities.map((f) => this.toGeneratorField(f)),
    };
  }

  /**
   * 保存代码生成表配置：按 tableName 唯一键，不存在则插入，存在则更新表头并全量替换字段行。
   */
  async upsertCodeTableWithFields(
    dto: SaveCodeTableDto,
  ): Promise<GeneratorTable> {
    const tableName = dto.tableName.trim();
    if (!tableName) {
      throw new Error('表名不能为空');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let table = await queryRunner.manager.findOne(CodeTableConfig, {
        where: { tableName },
      });

      const tableComment = (dto.tableComment ?? '').trim();
      const className = dto.className.trim();
      const moduleName = dto.moduleName.trim();

      if (!table) {
        table = queryRunner.manager.create(CodeTableConfig, {
          tableName,
          tableComment,
          className,
          moduleName,
          templateName: this.resolveTemplateNameOrFirst(dto.templateName),
        });
        await queryRunner.manager.save(table);
      } else {
        table.tableComment = tableComment;
        table.className = className;
        table.moduleName = moduleName;
        if (dto.templateName !== undefined) {
          table.templateName = this.resolveTemplateNameOrFirst(
            dto.templateName,
          );
        }
        await queryRunner.manager.save(table);
      }

      await queryRunner.manager.delete(CodeFieldConfig, {
        tableConfig: { id: table.id },
      });

      const fields = dto.fields ?? [];
      for (let i = 0; i < fields.length; i++) {
        const row = fields[i];
        const field = new CodeFieldConfig();
        field.tableConfig = table;
        field.fieldName = row.name.trim();
        field.dbType = row.dbType.trim();
        field.tsType = row.tsType.trim();
        field.fieldLength = row.length ?? null;
        field.fieldComment = (row.comment ?? '').trim() || null;
        field.isNullable = false;
        field.isUnique = false;
        field.defaultValue = null;
        field.isInsert = row.isInsert;
        field.isUpdate = row.isUpdate;
        field.isList = row.isList;
        field.isQuery = row.isQuery;
        field.isMultiSelect = row.isMultiSelect ?? false;
        field.queryOperator = row.queryOperator;
        field.queryComponent = row.queryComponent;
        field.formComponent = row.formComponent ?? 'input';
        field.dictCode = row.dictCode?.trim() ? row.dictCode.trim() : null;
        field.sortOrder = i;
        await queryRunner.manager.save(field);
      }

      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }

    const saved = await this.getCodeTableWithFieldsByTableName(tableName);
    if (!saved) {
      throw new Error('保存后读取配置失败');
    }
    return saved;
  }

  /** 实体字段 → 与前端约定的 GeneratorField（可省略空可选项） */
  private toGeneratorField(f: CodeFieldConfig): GeneratorField {
    const out: GeneratorField = {
      name: f.fieldName,
      dbType: f.dbType,
      tsType: f.tsType,
      isInsert: f.isInsert,
      isUpdate: f.isUpdate,
      isList: f.isList,
      isQuery: f.isQuery,
      ...(f.isMultiSelect ? { isMultiSelect: true as const } : {}),
      queryOperator: f.queryOperator as GeneratorField['queryOperator'],
      queryComponent: f.queryComponent as GeneratorField['queryComponent'],
      formComponent: f.formComponent as GeneratorField['formComponent'],
    };
    if (f.fieldLength != null) {
      out.length = f.fieldLength;
    }
    const comment = (f.fieldComment ?? '').trim();
    if (comment) {
      out.comment = comment;
    }
    const dict = f.dictCode?.trim();
    if (dict) {
      out.dictCode = dict;
    }
    return out;
  }

  /**
   * 仅允许常见标识符字符，避免拼接/PRAGMA 注入
   *（若需中文表名等，可再放宽正则）
   */
  private assertSafeTableName(raw: string): string {
    const name = raw?.trim() ?? '';
    if (!name) {
      throw new Error('表名不能为空');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error('表名仅允许字母、数字、下划线');
    }
    return name;
  }

  private async listMysqlTables(): Promise<GeneratorDbTableRow[]> {
    const rows = await this.dataSource.query<
      { tableName: string; tableComment: string | null }[]
    >(
      `SELECT TABLE_NAME AS tableName, TABLE_COMMENT AS tableComment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME ASC`,
    );

    return rows.map((r) => ({
      name: r.tableName,
      comment: (r.tableComment ?? '').trim(),
    }));
  }

  /**
   * PostgreSQL：当前 schema 下普通表/分区父表 + pg_description 表级注释
   */
  private async listPostgresTables(): Promise<GeneratorDbTableRow[]> {
    const schema = this.getPostgresSchema();

    const rows = await this.dataSource.query<
      { tableName: string; tableComment: string | null }[]
    >(
      `SELECT
         c.relname AS "tableName",
         COALESCE(
           (SELECT d.description::text
            FROM pg_catalog.pg_description d
            WHERE d.objoid = c.oid AND d.objsubid = 0
            LIMIT 1),
           ''
         ) AS "tableComment"
       FROM pg_catalog.pg_class c
       INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1
         AND c.relkind IN ('r', 'p')
         AND NOT c.relispartition
       ORDER BY c.relname ASC`,
      [schema],
    );

    return rows.map((r) => ({
      name: r.tableName,
      comment: (r.tableComment ?? '').trim(),
    }));
  }

  private getPostgresSchema(): string {
    const o = this.dataSource.options as { schema?: string };
    return (o.schema ?? 'public').trim() || 'public';
  }

  /**
   * SQLite：无标准「表备注」，comment 固定为空字符串
   */
  private async listSqliteTables(): Promise<GeneratorDbTableRow[]> {
    const rows = await this.dataSource.query<{ tableName: string }[]>(
      `SELECT name AS tableName
       FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
       ORDER BY name ASC`,
    );

    return rows.map((r) => ({
      name: r.tableName,
      comment: '',
    }));
  }

  private async listMysqlColumns(
    tableName: string,
  ): Promise<GeneratorDbColumnRow[]> {
    const rows = await this.dataSource.query<
      {
        columnName: string;
        dataType: string;
        columnType: string;
        charMaxLength: number | null;
        numericPrecision: number | null;
        numericScale: number | null;
        columnComment: string | null;
        columnKey: string | null;
        isNullable: string;
        ordinalPosition: number;
        columnDefault: string | null;
      }[]
    >(
      `SELECT
         COLUMN_NAME AS columnName,
         DATA_TYPE AS dataType,
         COLUMN_TYPE AS columnType,
         CHARACTER_MAXIMUM_LENGTH AS charMaxLength,
         NUMERIC_PRECISION AS numericPrecision,
         NUMERIC_SCALE AS numericScale,
         COLUMN_COMMENT AS columnComment,
         COLUMN_KEY AS columnKey,
         IS_NULLABLE AS isNullable,
         ORDINAL_POSITION AS ordinalPosition,
         COLUMN_DEFAULT AS columnDefault
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION ASC`,
      [tableName],
    );

    return rows.map((r) => ({
      name: r.columnName,
      dataType: r.dataType,
      columnType: r.columnType,
      length: r.charMaxLength,
      numericPrecision: r.numericPrecision,
      numericScale: r.numericScale,
      comment: (r.columnComment ?? '').trim(),
      primaryKey: r.columnKey === 'PRI',
      nullable: r.isNullable === 'YES',
      ordinalPosition: r.ordinalPosition,
      defaultValue: r.columnDefault === null ? null : String(r.columnDefault),
    }));
  }

  private async listPostgresColumns(
    tableName: string,
  ): Promise<GeneratorDbColumnRow[]> {
    const schema = this.getPostgresSchema();

    const rows = await this.dataSource.query<
      {
        ordinalPosition: number;
        columnName: string;
        dataType: string;
        udtName: string;
        charMaxLength: number | null;
        numericPrecision: number | null;
        numericScale: number | null;
        isNullable: string;
        columnDefault: string | null;
        isPrimaryKey: boolean;
        columnComment: string | null;
      }[]
    >(
      `SELECT
         cols.ordinal_position AS "ordinalPosition",
         cols.column_name AS "columnName",
         cols.data_type AS "dataType",
         cols.udt_name AS "udtName",
         cols.character_maximum_length AS "charMaxLength",
         cols.numeric_precision AS "numericPrecision",
         cols.numeric_scale AS "numericScale",
         cols.is_nullable AS "isNullable",
         cols.column_default AS "columnDefault",
         (pk.column_name IS NOT NULL) AS "isPrimaryKey",
         COALESCE(d.description, '') AS "columnComment"
       FROM information_schema.columns cols
       LEFT JOIN (
         SELECT kcu.column_name AS column_name
         FROM information_schema.table_constraints tc
         INNER JOIN information_schema.key_column_usage kcu
           ON tc.constraint_schema = kcu.constraint_schema
          AND tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
         WHERE tc.table_schema = $1
           AND tc.table_name = $2
           AND tc.constraint_type = 'PRIMARY KEY'
       ) pk ON pk.column_name = cols.column_name
       LEFT JOIN pg_catalog.pg_namespace pn
         ON pn.nspname = cols.table_schema
       LEFT JOIN pg_catalog.pg_class pc
         ON pc.relnamespace = pn.oid AND pc.relname = cols.table_name
       LEFT JOIN pg_catalog.pg_description d
         ON d.objoid = pc.oid
        AND d.objsubid = cols.ordinal_position
       WHERE cols.table_schema = $1
         AND cols.table_name = $2
       ORDER BY cols.ordinal_position ASC`,
      [schema, tableName],
    );

    return rows.map((r) => ({
      name: r.columnName,
      dataType: r.dataType,
      columnType: r.udtName || r.dataType,
      length: r.charMaxLength,
      numericPrecision: r.numericPrecision,
      numericScale: r.numericScale,
      comment: (r.columnComment ?? '').trim(),
      primaryKey: Boolean(r.isPrimaryKey),
      nullable: r.isNullable === 'YES',
      ordinalPosition: r.ordinalPosition,
      defaultValue: r.columnDefault === null ? null : String(r.columnDefault),
    }));
  }

  private async listSqliteColumns(
    tableName: string,
  ): Promise<GeneratorDbColumnRow[]> {
    // pragma_table_info 支持参数绑定（sqlite3 驱动）
    const rows = await this.dataSource.query<
      {
        cid: number;
        name: string;
        type: string;
        notNull: number;
        dfltValue: string | null;
        pk: number;
      }[]
    >(
      `SELECT cid, name, type, "notnull" AS "notNull", dflt_value AS "dfltValue", pk
       FROM pragma_table_info(?)`,
      [tableName],
    );

    return rows.map((r) => ({
      name: r.name,
      dataType: (r.type ?? '').trim() || 'text',
      columnType: (r.type ?? '').trim() || 'text',
      length: null,
      numericPrecision: null,
      numericScale: null,
      comment: '',
      primaryKey: r.pk === 1,
      nullable: r.notNull === 0,
      ordinalPosition: r.cid + 1,
      defaultValue: r.dfltValue === null ? null : String(r.dfltValue),
    }));
  }
}
