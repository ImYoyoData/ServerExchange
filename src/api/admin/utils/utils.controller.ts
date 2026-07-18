import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UtilsService } from './utils.service';
import { SaveSrcFileDto } from './dto/save-src-file.dto';
import { ListSrcDirectoryQueryDto } from './dto/list-src-directory.query.dto';
import { DevelopmentOnlyGuard } from '../guards/development-only.guard';
import { BusinessPass } from 'src/common/exceptions';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminOnly } from '../decorators';

/**
 * 开发辅助接口：整类由 DevelopmentOnlyGuard 保护，生产环境不可用。
 * 路由需带 `admin/` 以走后台 AdminGuard（JWT）。
 */
@ApiTags('开发辅助工具')
@Controller('admin/utils')
@UseGuards(DevelopmentOnlyGuard)
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  /**
   * 列举 `src` 下指定目录内的**子目录**（最多 50 条，不含文件）。
   *
   * - `path`：**仅目录**，不要带文件名。例：`/api/users/entities/user`
   * - `fileName`：可选，仅文件名，例：`user.entity.ts`。若传则 `isExist` **只表示**「该目录下此文件是否存在」
   * - **路径前缀**：若某段不存在（如 `/api/us`），则在上一级下列出名称以该段开头的子目录
   * - `match`：可选，在子目录结果上再按名称「包含」过滤（忽略大小写）
   */
  @AdminOnly()
  @Get('src-list')
  @ApiOperation({
    summary:
      '列举 src 下子目录；path 仅目录；可选 fileName 校验文件是否存在（isExist）。',
  })
  @HttpCode(HttpStatus.OK)
  async listSrcDirectory(@Query() query: ListSrcDirectoryQueryDto) {
    const result = await this.utilsService.listSrcDirectory(
      query.path ?? '/',
      query.match,
      query.fileName,
    );
    return BusinessPass(result);
  }

  /**
   * 在 `src` 下创建 TS 文件（仅当文件尚不存在时写入）。
   *
   * - `relativePath`：相对 `src`，例如 `api/user/entity/km.entity.ts`（与 `/api/user/entity/km.entity.ts` 等价，会去掉前导 `/`）
   * - 禁止 `..`、禁止解析到 `src` 之外；仅允许 `.ts` / `.tsx`
   */
  @AdminOnly()
  @Post('save-src-file')
  @ApiOperation({
    summary: '在 `src` 下创建 TS 文件（仅当文件尚不存在时写入）。',
  })
  @HttpCode(HttpStatus.OK)
  async saveSrcFile(@Body() body: SaveSrcFileDto) {
    const result = await this.utilsService.saveSrcFileIfNotExists(
      body.relativePath,
      body.content,
    );
    return BusinessPass(result);
  }
}
