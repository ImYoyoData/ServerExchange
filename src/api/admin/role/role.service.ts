import { Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '../entities/role.entity';
import { DataSource, EntityManager, Like, Repository } from 'typeorm';
import { QueryRoleDto } from './dto/query-role.dto';
import { RoleMenu } from '../menu/entities/role-menu.entity';
import { Menu } from '../menu/entities/menu.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(RoleMenu)
    private readonly roleMenuRepository: Repository<RoleMenu>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly dataSource: DataSource,
  ) {}
  async getRoleList(queryRoleDto: QueryRoleDto) {
    const {
      code = '',
      name = '',
      status = '',
      page = 1,
      pageSize = 10,
    } = queryRoleDto;

    // 构建 where 条件
    const where: any = {};

    if (code) {
      where.code = Like(`%${code}%`);
    }

    if (name) {
      where.name = Like(`%${name}%`);
    }

    if (status !== '') {
      where.status = status;
    }

    // 分页查询，直接在查询时转换时间字段
    const skip = (page - 1) * pageSize;

    const queryBuilder = this.roleRepository
      .createQueryBuilder('role')
      .select([
        'role.id',
        'role.name',
        'role.code',
        'role.status',
        'role.remark',
        'UNIX_TIMESTAMP(role.createdAt) * 1000 as createTime',
        'UNIX_TIMESTAMP(role.updatedAt) * 1000 as updateTime',
      ]);

    // 添加查询条件
    if (code) {
      queryBuilder.andWhere('role.code LIKE :code', { code: `%${code}%` });
    }

    if (name) {
      queryBuilder.andWhere('role.name LIKE :name', { name: `%${name}%` });
    }

    if (status !== '') {
      queryBuilder.andWhere('role.status = :status', { status });
    }

    // 获取总数
    const total = await queryBuilder.getCount();

    // 执行分页查询
    const list = await queryBuilder
      .orderBy('role.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getRawMany();

    // 格式化返回的数据，将字符串转换为数字
    const formattedList = list.map((item) => ({
      id: Number(item.role_id),
      name: item.role_name,
      code: item.role_code,
      status: Number(item.role_status),
      remark: item.role_remark || '',
      createTime: Number(item.createTime),
      updateTime: Number(item.updateTime),
    }));

    return {
      list: formattedList,
      total,
      pageSize: Number(pageSize),
      currentPage: Number(page),
    };
  }

  async getRoleMenu() {
    // 3. 查询菜单
    const menus = await this.menuRepository
      .createQueryBuilder('menu')
      .select(['menu.parentId', 'menu.id', 'menu.menuType', 'menu.title'])
      .andWhere('menu.menuType IN (0, 1, 2,3)')
      .getMany();

    // 4. 返回结果
    return menus.map((menu) => ({
      parentId: menu.parentId,
      id: menu.id,
      menuType: menu.menuType,
      title: menu.title,
    }));
  }

  async roleMenuIds(roleId: number) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new Error('角色不存在！');
    }
    if (role.code === 'admin') {
      // 返回所有菜单 管理员
      return await this.roleMenuRepository.find({
        select: ['menuId'],
      });
    }
    return await this.roleMenuRepository.find({
      where: { roleId },
      select: ['menuId'],
    });
  }

  async updateRoleMenuIds(roleId: number, menuIds: number[]) {
    // 判断roleid的code是不是admin
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new Error('角色不存在！');
    }
    if (role.code === 'admin') {
      throw new Error('管理员角色修改是没有意义的！');
    }
    // 使用事务管理器
    await this.dataSource.transaction(async (manager: EntityManager) => {
      // 删除原有的角色菜单关联
      await manager.delete(RoleMenu, { roleId });

      // 如果有新的菜单ID，插入新的关联
      if (menuIds.length > 0) {
        const roleMenus = menuIds.map((menuId) => ({ roleId, menuId }));
        await manager.insert(RoleMenu, roleMenus);
      }
    });
  }

  async create(createRoleDto: CreateRoleDto) {
    return await this.roleRepository.save(createRoleDto);
  }

  async update(updateRoleDto: UpdateRoleDto) {
    const role = await this.roleRepository.findOne({
      where: { id: updateRoleDto.id },
    });
    if (role && role.code === 'admin') {
      throw new Error('管理员角色不能修改');
    }
    return await this.roleRepository.save(updateRoleDto);
  }

  async remove(id: number) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (role && role.code === 'admin') {
      throw new Error('管理员角色不能删除');
    }
    return await this.roleRepository.delete(id);
  }
}
