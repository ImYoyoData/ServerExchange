import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Query,
  Post,
  Delete,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { ApiTags } from '@nestjs/swagger';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import { Permissions } from '../decorators';

@Controller('admin/tasks')
@ApiTags('计划任务')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * 全部任务分页查询（支持：名称搜索、启用筛选、上次执行时间范围）
   * 默认排序：有效(isValid) -> 启用 -> 上次执行时间倒序
   */
  @Permissions('tasks:list')
  @Get()
  async page(@Query() query: QueryTasksDto) {
    return BusinessPass(await this.tasksService.pageTasks(query));
  }

  /**
   * 查询单个任务详情
   */
  @Permissions('tasks:list')
  @Get(':name')
  async findOne(@Param('name') name: string) {
    const task = await this.tasksService.getTaskByName(name);
    if (!task) {
      throw new BusinessRejectedException(`任务 ${name} 不存在`, 7000);
    }
    return BusinessPass(task);
  }

  /**
   * 修改指定任务：只允许改 cron/备注/是否启用（不能改 name/taskType）
   * 入参使用 sys_task.id；内部会 id -> name -> 更新
   */
  @Permissions('tasks:btn:update')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return BusinessPass(
      await this.tasksService.updateCronJobById(id, updateTaskDto),
    );
  }

  /**
   * 手动执行指定任务一次
   */
  @Permissions('tasks:btn:execute')
  @Post(':id/execute')
  async executeOnce(@Param('id') id: string) {
    return BusinessPass(
      await this.tasksService.executeTaskOnceById(id),
      '执行成功',
    );
  }

  /**
   * 删除指定任务（仅允许删除无效任务）
   */
  @Permissions('tasks:btn:delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return BusinessPass(await this.tasksService.deleteTaskById(id), '删除成功');
  }
}
