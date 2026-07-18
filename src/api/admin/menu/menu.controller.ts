import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import { ApiTags } from '@nestjs/swagger';
import { convertToPureRoutes } from './utils/render-menu';
import { type AuthenticatedRequest } from '../types/request.types';
import { Permissions } from '../decorators/permissions.decorator';

@Controller('admin/menu')
@ApiTags('后台菜单')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // 获取菜单列表管理的
  @Permissions('menu:list') // 需要menu:list权限
  @Get()
  async menuList() {
    return BusinessPass(await this.menuService.getMenuAllList());
  }

  @Permissions('menu:btn:add')
  @Post()
  async addMenu(@Body() createMenuDto: CreateMenuDto) {
    return BusinessPass(await this.menuService.addUpdateMenu(createMenuDto));
  }

  @Permissions('menu:btn:update')
  @Put()
  async updateMenu(@Body() updateMenuDto: UpdateMenuDto) {
    return BusinessPass(await this.menuService.addUpdateMenu(updateMenuDto));
  }

  @Permissions('menu:btn:delete')
  @Delete(':id')
  async deleteMenu(@Param('id') id: string) {
    const ids = String(id)
      .split(',')
      .filter((item: string) => /^\d+$/.test(item))
      .map(Number);

    if (ids.length < 1) throw new BusinessRejectedException('参数错误');
    const result = await this.menuService.deleteMenu(ids);
    if (!result.affected || result.affected <= 0)
      throw new BusinessRejectedException('删除失败');
    return BusinessPass(null, '删除成功');
  }

  // 渲染菜单列表
  @Get('getAsyncRoutes')
  async getAsyncRoutes(@Req() req: AuthenticatedRequest) {
    const menus = await this.menuService.getUserRoleMenu(
      req.user.roleIds,
      req.user.roles,
    );
    return BusinessPass(convertToPureRoutes(menus));
  }
}
