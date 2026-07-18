import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { GeneratorService } from './generator.service';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { SaveCodeTableDto } from './dto/save-code-table.dto';
import { GenerateCodeDto } from './dto/generate-code.dto';
import { Permissions } from '../decorators';

@ApiTags('代码生成器')
@Controller('admin/generator')
export class GeneratorController {
  constructor(private readonly generatorService: GeneratorService) {}

  /**
   * 返回当前数据库中所有表名称与表备注
   *（MySQL/MariaDB、PostgreSQL 有备注；SQLite 无表备注时 comment 为空）
   */
  @Permissions('generator:list')
  @Get('tables')
  @ApiOperation({
    summary:
      '列出当前数据库所有表名与表备注，并按表名融合 code-table 的 className/moduleName/templateName',
  })
  @HttpCode(HttpStatus.OK)
  async listTables() {
    try {
      const tables = await this.generatorService.listDatabaseTablesWithConfig();
      return BusinessPass({ tables });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BusinessRejectedException(msg || '获取数据库表列表失败');
    }
  }

  /**
   * 按业务表名查询代码生成器表配置（sys_code_table_config）及全部字段配置子级（sys_code_field_config）
   */
  @Permissions('generator:list')
  @Get('code-table')
  @ApiOperation({
    summary:
      '按表名查询 code-table 配置及字段列表（扁平结构）；无配置或表名为空时 data 为 null',
  })
  @ApiQuery({
    name: 'table',
    required: true,
    description: '业务表名，对应 CodeTableConfig.tableName（唯一）',
  })
  @HttpCode(HttpStatus.OK)
  async getCodeTableWithFields(@Query('table') table: string) {
    try {
      const data =
        await this.generatorService.getCodeTableWithFieldsByTableName(table);
      return BusinessPass(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BusinessRejectedException(msg || '获取代码生成表配置失败');
    }
  }

  /**
   * 保存代码生成器表配置：按 tableName 不存在则新增，存在则更新；字段列表全量覆盖
   */
  @Permissions('generator:btn:save')
  @Post('code-table')
  @ApiOperation({
    summary:
      '保存 code-table 配置（upsert）；存在则更新表头并替换全部字段行，返回与 GET 相同的扁平结构',
  })
  @ApiBody({ type: SaveCodeTableDto })
  @HttpCode(HttpStatus.OK)
  async saveCodeTableWithFields(@Body() body: SaveCodeTableDto) {
    try {
      const data = await this.generatorService.upsertCodeTableWithFields(body);
      return BusinessPass(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BusinessRejectedException(msg || '保存代码生成表配置失败');
    }
  }

  /**
   * 按表名查询该表所有列的真实元数据（类型、长度、备注、主键等）
   */
  @Permissions('generator:list')
  @Get('columns')
  @ApiOperation({
    summary:
      '按表名查询列信息（mysql/mariadb/postgres/sqlite，真实查系统表/PRAGMA）',
  })
  @ApiQuery({
    name: 'table',
    required: true,
    description: '表名（仅字母数字下划线）',
  })
  @HttpCode(HttpStatus.OK)
  async listColumns(@Query('table') table: string) {
    try {
      const columns = await this.generatorService.listTableColumns(table);
      return BusinessPass({ columns });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BusinessRejectedException(msg || '获取表字段信息失败');
    }
  }

  /**
   * templates/ 下一级目录名：一套模板一个文件夹（如 element-plus-curd）
   */
  @Permissions('generator:list')
  @Get('templates')
  @ApiOperation({
    summary: '列出 generator/templates 下的模板包名称（子目录名）',
  })
  @HttpCode(HttpStatus.OK)
  listTemplateNames() {
    try {
      const names = this.generatorService.listTemplateNames();
      return BusinessPass({
        names,
        rootHint: 'src/api/admin/generator/templates',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BusinessRejectedException(msg || '获取模板列表失败');
    }
  }

  /**
   * 根据 code-table 中保存的模板名（及字段配置）渲染代码；无配置时按库表元数据生成默认字段并采用第一个模板包
   */
  @Permissions('generator:btn:generate')
  @Post('generate')
  @ApiOperation({
    summary:
      '按表名生成代码：优先用 code-table.templateName 与字段；无行则用库表列+首套模板；可选 body.templateName 强制模板包；web.api 为 ts，web.vue 为 Vue3 SFC',
  })
  @ApiBody({ type: GenerateCodeDto })
  @HttpCode(HttpStatus.OK)
  async generateCode(@Body() body: GenerateCodeDto) {
    try {
      const files = await this.generatorService.generateCodeFiles(
        body.tableName,
        body.apiPathPrefix,
        body.templateName,
      );
      return BusinessPass({ files });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BusinessRejectedException(msg || '代码生成失败');
    }
  }
}
