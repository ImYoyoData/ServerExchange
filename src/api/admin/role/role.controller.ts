import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../decorators';

@ApiTags('角色管理')
@Controller('admin/role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Permissions('role:list')
  @Get()
  async getRoleList(@Query() queryRoleDto: QueryRoleDto) {
    return BusinessPass(await this.roleService.getRoleList(queryRoleDto));
  }

  @Permissions('role:list')
  @Get('roleMenu')
  async getRoleMenu() {
    return BusinessPass(await this.roleService.getRoleMenu());
  }

  @Permissions('role:list')
  @Get('roleMenuIds/:id')
  async getRoleMenuIds(@Param('id') id: string) {
    if (isNaN(+id)) {
      throw new BusinessRejectedException('id必须是数字');
    }
    try {
      const listObj = await this.roleService.roleMenuIds(+id);
      return BusinessPass(listObj.map((item) => item.menuId));
    } catch (error: any) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  @Permissions('role:btn:update')
  @Put('roleMenuIds/:id')
  async updateRoleMenuIds(
    @Param('id') id: string,
    @Body() roleMenuIds: number[],
  ) {
    if (isNaN(+id)) {
      throw new BusinessRejectedException('id必须是数字');
    }
    try {
      await this.roleService.updateRoleMenuIds(+id, roleMenuIds);
      return BusinessPass('ok');
    } catch (error: any) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  @Permissions('role:btn:add')
  @Post()
  async create(@Body() createRoleDto: CreateRoleDto) {
    try {
      return BusinessPass(await this.roleService.create(createRoleDto));
    } catch (error: any) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  @Permissions('role:btn:update')
  @Put()
  async update(@Body() updateRoleDto: UpdateRoleDto) {
    try {
      return BusinessPass(await this.roleService.update(updateRoleDto));
    } catch (error: any) {
      throw new BusinessRejectedException(error.message as string);
    }
  }

  @Permissions('role:btn:delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    // 判断id是不是number
    if (isNaN(+id)) {
      throw new BusinessRejectedException('id必须是数字');
    }
    try {
      return BusinessPass(await this.roleService.remove(+id));
    } catch (error: any) {
      throw new BusinessRejectedException(error.message as string);
    }
  }
}
