import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { Role } from '../entities/role.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleMenu } from '../menu/entities/role-menu.entity';
import { Menu } from '../menu/entities/menu.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Menu, RoleMenu])],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RoleModule {}
