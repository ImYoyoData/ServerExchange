import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysTask } from './entities/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SysTask])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
