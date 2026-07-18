import { Injectable } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';
import { BusinessRejectedException } from 'src/common/exceptions';
import { RoleMenu } from './entities/role-menu.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu) private readonly menuRepository: Repository<Menu>,
    @InjectRepository(RoleMenu)
    private readonly roleMenuRepository: Repository<RoleMenu>,
  ) {}

  // 获取用户角色的菜单列表
  async getUserRoleMenu(roleIds: number[], roles: string[]) {
    if (!roles.includes('admin')) {
      return await this.menuRepository.find({
        where: {
          id: In(
            await this.roleMenuRepository
              .find({
                select: ['menuId'],
                where: {
                  roleId: In(roleIds),
                },
              })
              .then((res) => res.map((item) => item.menuId)),
          ),
        },
        order: {
          rank: 'ASC',
        },
      });
    } else {
      // admin 用户 获取所有菜单列表
      return await this.menuRepository.find({
        order: {
          rank: 'ASC',
        },
      });
    }
  }

  async getMenuAllList() {
    // 获取所有菜单列表
    return await this.menuRepository.find({
      order: {
        rank: 'ASC',
      },
    });
  }

  async addUpdateMenu(createMenuDto: CreateMenuDto) {
    if (createMenuDto.path) {
      const existingMenu = await this.menuRepository.findOneBy({
        parentId: createMenuDto.parentId,
        path: createMenuDto.path, // 或者其他具体的path值
        id: Not(createMenuDto.id || 0),
      });
      if (existingMenu) {
        throw new BusinessRejectedException('相同路径的菜单已存在');
      }
    }
    if (createMenuDto.auths) {
      // 这个是管理员权限不能设置的
      if (/^\*:.*$/.test(createMenuDto.auths)) {
        throw new BusinessRejectedException('*:*:* 权限禁止');
      }
      const existingMenu = await this.menuRepository.findOneBy({
        parentId: createMenuDto.parentId,
        auths: createMenuDto.auths, // 或者其他具体的path值
        id: Not(createMenuDto.id || 0),
      });
      if (existingMenu) {
        throw new BusinessRejectedException('相同权限的菜单已存在');
      }
    }

    return await this.menuRepository.save(createMenuDto);
  }

  async deleteMenu(id: Array<number>) {
    return await this.menuRepository.delete({ id: In(id) });
  }
}
