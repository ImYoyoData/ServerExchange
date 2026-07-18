import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DictService } from './dict.service';
import { CreateDictDto } from './dto/create-dict.dto';
import { UpdateDictDto } from './dto/update-dict.dto';
import { QueryDictDto } from './dto/query-dict.dto';
import { CreateDictItemDto } from './dto/create-dict-item.dto';
import { UpdateDictItemDto } from './dto/update-dict-item.dto';
import { QueryDictItemDto } from './dto/query-dict-item.dto';
import { QueryDictTreeDto } from './dto/query-dict-tree.dto';
import { QueryDictTreesDto } from './dto/query-dict-trees.dto';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Permissions } from '../decorators/permissions.decorator';

@ApiTags('字典管理')
@Controller('admin/dict')
export class DictController {
  constructor(private readonly dictService: DictService) {}

  /**
   * 字典分页查询
   */
  @Permissions('dict:list')
  @Get('page')
  @ApiOperation({ summary: '字典分页查询' })
  async pageDict(@Query() queryDto: QueryDictDto) {
    try {
      return BusinessPass(await this.dictService.pageDict(queryDto));
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'pageDict失败'),
      );
    }
  }

  /**
   * 字典列表
   */
  @Permissions('dict:list')
  @Get()
  @ApiOperation({ summary: '字典列表' })
  async listDict(@Query() queryDto: QueryDictDto) {
    try {
      return BusinessPass(await this.dictService.listDict(queryDto));
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'listDict失败'),
      );
    }
  }

  /**
   * 字典保存
   */
  @Permissions('dict:btn:add')
  @Post()
  @ApiOperation({ summary: '字典保存' })
  async saveDict(@Body() createDictDto: CreateDictDto) {
    try {
      const data = await this.dictService.saveDict(createDictDto);
      return BusinessPass(data as Record<string, any>);
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'saveDict失败'),
      );
    }
  }

  /**
   * 字典更新
   */
  @Permissions('dict:btn:update')
  @Put()
  @ApiOperation({ summary: '字典更新' })
  async updateDict(@Body() updateDictDto: UpdateDictDto) {
    try {
      return BusinessPass(await this.dictService.updateDict(updateDictDto));
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'updateDict失败'),
      );
    }
  }

  /**
   * 清除字典树 Redis 缓存
   */
  @Permissions('dict:btn:update')
  @Post('cache/clear')
  @ApiOperation({ summary: '清除字典树 Redis 缓存' })
  async clearDictCache() {
    try {
      return BusinessPass(
        await this.dictService.clearAllDictTreeCache(),
        '字典缓存已清除',
      );
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'clearDictCache失败'),
      );
    }
  }

  /**
   * 字典删除
   */
  @Permissions('dict:btn:delete')
  @Delete(':id')
  @ApiOperation({ summary: '字典删除' })
  async delDict(@Param('id') id: string) {
    try {
      return BusinessPass(await this.dictService.delDict(id));
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'delDict失败'),
      );
    }
  }

  /**
   * 字典项分页查询
   */
  @Permissions('dict:list')
  @Get('item/page')
  @ApiOperation({ summary: '字典项分页查询' })
  async pageDictItem(@Query() queryDto: QueryDictItemDto) {
    try {
      return BusinessPass(await this.dictService.pageDictItem(queryDto));
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'pageDictItem失败'),
      );
    }
  }

  /**
   * 字典项列表（包含嵌套，最多5层）
   */
  @Permissions('dict:list')
  @Get('item')
  @ApiOperation({ summary: '字典项列表（包含嵌套，最多5层）' })
  async listDictItem(@Query() queryDto: QueryDictItemDto) {
    try {
      return BusinessPass(await this.dictService.listDictItem(queryDto));
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'listDictItem失败'),
      );
    }
  }

  /**
   * 字典项保存
   */
  @Permissions('dict:btn:add')
  @Post('item')
  @ApiOperation({ summary: '字典项保存' })
  async saveDictItem(@Body() createDictItemDto: CreateDictItemDto) {
    try {
      const data = await this.dictService.saveDictItem(createDictItemDto);
      return BusinessPass(data as Record<string, any>);
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'saveDictItem失败'),
      );
    }
  }

  /**
   * 字典项更新
   */
  @Permissions('dict:btn:update')
  @Put('item')
  @ApiOperation({ summary: '字典项更新' })
  async updateDictItem(@Body() updateDictItemDto: UpdateDictItemDto) {
    try {
      return BusinessPass(
        await this.dictService.updateDictItem(updateDictItemDto),
      );
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'updateDictItem失败'),
      );
    }
  }

  /**
   * 字典项删除
   */
  @Permissions('dict:btn:delete')
  @Delete('item/:id')
  @ApiOperation({ summary: '字典项删除' })
  async delDictItem(@Param('id') id: string) {
    try {
      return BusinessPass(await this.dictService.delDictItem(id));
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'delDictItem失败'),
      );
    }
  }

  // 下面的不需要权限

  /**
   * 频繁调用的树形查询：
   * - 入参：sys_dict.code
   * - 出参：{ value, label, children? }，最大返回 5 层
   * - 若当前节点没有嵌套 code（嵌套选择已移除），则不返回 children 字段
   */
  @Get('tree')
  @ApiOperation({
    summary:
      '频繁调用的树形查询：- 入参：sys_dict.code - 出参：{ value, label, children? }，最大返回 5 层 - 若当前节点没有嵌套 code（嵌套选择已移除），则不返回 children 字段',
  })
  async getDictTree(@Query() queryDto: QueryDictTreeDto) {
    try {
      const data = await this.dictService.getDictTree(queryDto);
      return BusinessPass(data);
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'getDictTree失败'),
      );
    }
  }

  /**
   * 批量树形查询（高频）：
   * - 入参：sys_dict.code 列表
   * - 出参：{ [code]: [{ value, label, children? }, ...] }
   */
  @Post('trees')
  @ApiOperation({
    summary:
      '批量树形查询（高频）：- 入参：sys_dict.code 列表 - 出参：{ [code]: [{ value, label, children? }, ...] }',
  })
  async getDictTrees(@Body() body: QueryDictTreesDto) {
    try {
      return BusinessPass(await this.dictService.getDictTrees(body));
    } catch (error: any) {
      throw new BusinessRejectedException(
        String(error?.message ?? 'getDictTrees失败'),
      );
    }
  }
}
