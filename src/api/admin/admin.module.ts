import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { APP_GUARD } from '@nestjs/core';
import { AdminGuard } from './guards/admin.guard';
import { Admin } from './entities/admin.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { MenuModule } from './menu/menu.module';
import { RoleModule } from './role/role.module';
import { Menu } from './menu/entities/menu.entity';
import { RoleMenu } from './menu/entities/role-menu.entity';
import { AgentModule } from './agent/agent.module';
import { DictModule } from './dict/dict.module';
import { TasksModule } from './tasks/tasks.module';
import { UtilsModule } from './utils/utils.module';
import { MessageModule } from './message/message.module';
import { GeneratorModule } from './generator/generator.module';
import { FileModule } from './file/file.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, Role, Menu, RoleMenu]),
    MenuModule,
    RoleModule,
    AgentModule,
    DictModule,
    TasksModule,
    UtilsModule,
    MessageModule,
    GeneratorModule,
    FileModule,
  ],
  providers: [
    AdminService,
    {
      provide: APP_GUARD,
      useClass: AdminGuard, // 后台admin用户JWT验证  只会限制这里imports的模块哈哈
    },
  ],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
