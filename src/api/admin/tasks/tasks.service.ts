import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, Interval, SchedulerRegistry, Timeout } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { BusinessRejectedException } from 'src/common/exceptions';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { DataSource, In, Repository } from 'typeorm';
import { SysTask } from './entities/task.entity';

type CronJobInfo = {
  name: string;
  isActive: boolean;
  source: string | number;
  lastExecution: string;
  setTime?: (expression: string | number) => void;
};

type TaskDto = {
  id: number;
  name: string;
  cron: string;
  remark: string;
  enabled: boolean;
  isValid: boolean;
  taskType: string;
  lastExecuteTime: string | null;
  lastExecuteStatus: number;
  isManualExecute: boolean;
};

@Injectable()
export class TasksService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TasksService.name);
  private readonly taskRepository: Repository<SysTask>;
  private readonly manualExecutingTaskNames = new Set<string>();
  private readonly cronTickCallbacksRegistered = new Set<string>();

  /**
   * cron 的 CronJob.setTime 需要传入 CronTime 实例。
   * 由于项目并未把 `cron` 作为直接依赖，这里从现有 job.cronTime 的构造器动态生成，
   * 避免 `import { CronTime } from 'cron'` 的模块解析失败。
   */
  private buildCronTimeFromJob(job: any, cronExpr: string): unknown | null {
    try {
      const ctor = job?.cronTime?.constructor;
      if (typeof ctor !== 'function') return null;
      return new ctor(cronExpr);
    } catch {
      return null;
    }
  }

  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly dataSource: DataSource,
  ) {
    this.taskRepository = this.dataSource.getRepository(SysTask);
  }

  async onApplicationBootstrap() {
    await this.syncCronJobsToDBAndApply();
  }

  getCronJob(name: string): CronJobInfo | null {
    try {
      const job = this.schedulerRegistry.getCronJob(
        name,
      ) as unknown as CronJobInfo;
      return this.jobToJobInfo(job);
    } catch (error) {
      this.logger.error(`获取任务 ${name} 失败: ${error.message}`);
      return null;
    }
  }

  async updateCronJob(name: string, updateTaskDto: UpdateTaskDto) {
    try {
      const job = this.schedulerRegistry.getCronJob(name) as any;

      // 运行时：只允许改 cron/enabled（不改 name/taskType）
      if (typeof job.setTime === 'function') {
        const cronTime = this.buildCronTimeFromJob(job, updateTaskDto.cron);
        if (!cronTime) {
          throw new BusinessRejectedException(
            `cron表达式不合法：${updateTaskDto.cron}`,
            7003,
          );
        }
        job.setTime(cronTime);
      }
      if (updateTaskDto.enabled === true) {
        if (typeof job.start === 'function') job.start();
      } else {
        if (typeof job.stop === 'function') job.stop();
      }

      // 数据库：只更新 cron/备注/是否启用，并确保 isValid=true
      const existing = await this.taskRepository.findOne({
        where: { name },
        loadEagerRelations: false,
      });
      if (!existing) {
        throw new BusinessRejectedException(`任务 ${name} 不存在`, 7000);
      }

      existing.cron = updateTaskDto.cron;
      existing.description = updateTaskDto.remark ?? '';
      existing.enabled = updateTaskDto.enabled;
      existing.isValid = true;

      await this.taskRepository.save(existing);
      return this.taskToDto(existing);
    } catch (error) {
      const rawMsg = String(error?.message ?? error ?? 'updateCronJob失败');
      const msg = rawMsg.includes('No Cron Job')
        ? `任务 ${name} 未注册为可执行 Cron Job`
        : rawMsg;
      this.logger.error(`更新任务 ${name} 失败: ${msg}`);
      throw new BusinessRejectedException(msg, 7000);
    }
  }

  /**
   * 兼容前端传入 sys_task.id：先解析出 name，再复用 updateCronJob(name, dto)
   */
  async updateCronJobById(id: string, updateTaskDto: UpdateTaskDto) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) {
      throw new BusinessRejectedException('任务 id 参数错误', 7000);
    }

    const task = await this.taskRepository.findOne({
      where: { id: numId },
      loadEagerRelations: false,
    });

    if (!task) {
      throw new BusinessRejectedException('任务不存在', 7000);
    }

    const taskType = (task.taskType || 'cron').toLowerCase();

    // cron：动态修改周期 + enabled
    if (taskType === 'cron') {
      return this.updateCronJob(task.name, updateTaskDto);
    }

    // interval/timeout：当前运行时无法拿到 handler 来重建定时器周期；
    // 这里保证数据库同步，并在 enabled=false 时停止已挂载的定时器。
    task.cron = updateTaskDto.cron;
    task.description = updateTaskDto.remark ?? '';
    task.enabled = updateTaskDto.enabled;
    task.isValid = true;
    await this.taskRepository.save(task);

    if (task.enabled === false) {
      try {
        if (taskType === 'interval') {
          if (this.schedulerRegistry.doesExist('interval', task.name)) {
            this.schedulerRegistry.deleteInterval(task.name);
          }
        }
        if (taskType === 'timeout') {
          if (this.schedulerRegistry.doesExist('timeout', task.name)) {
            this.schedulerRegistry.deleteTimeout(task.name);
          }
        }
      } catch (e: any) {
        // 停止失败不影响数据库已更新
        this.logger.error(`停止任务 ${task.name} 失败: ${e?.message || e}`);
      }
    }

    return this.taskToDto(task);
  }

  private taskToDto(task: SysTask): TaskDto {
    return {
      id: task.id,
      name: task.name,
      cron: task.cron,
      remark: task.description ?? '',
      enabled: task.enabled,
      isValid: task.isValid,
      taskType: task.taskType,
      lastExecuteTime: task.lastExecuteTime
        ? dayjs(task.lastExecuteTime).format('YYYY-MM-DD HH:mm:ss')
        : null,
      lastExecuteStatus: task.lastExecuteStatus,
      isManualExecute: task.isManualExecute,
    };
  }

  /**
   * 获取全部任务（分页 + 名称搜索 + 启用筛选 + 上次执行时间范围）
   * 默认排序：
   * - 有效的(is_valid=true)在上
   * - 启用的(enabled=true)在上
   * - 上次执行时间(last_execute_time)倒序
   */
  async pageTasks(queryDto: QueryTasksDto): Promise<{
    list: TaskDto[];
    total: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
  }> {
    const page = Number(queryDto.page) || 1;
    const pageSize = Number(queryDto.pageSize) || 10;
    const name = String(queryDto.name ?? '').trim();

    const qb = this.taskRepository.createQueryBuilder('t');
    if (name) qb.andWhere('t.name LIKE :name', { name: `%${name}%` });

    if (typeof queryDto.enabled === 'boolean') {
      qb.andWhere('t.enabled = :enabled', { enabled: queryDto.enabled });
    }

    const beginStr = queryDto.lastExecuteTimeBegin;
    const endStr = queryDto.lastExecuteTimeEnd;
    const begin = beginStr ? new Date(beginStr.replace(' ', 'T')) : undefined;
    const end = endStr ? new Date(endStr.replace(' ', 'T')) : undefined;

    if (begin && end) {
      qb.andWhere('t.lastExecuteTime BETWEEN :begin AND :end', {
        begin,
        end,
      });
    } else if (begin) {
      qb.andWhere('t.lastExecuteTime >= :begin', { begin });
    } else if (end) {
      qb.andWhere('t.lastExecuteTime <= :end', { end });
    }

    qb.orderBy('t.isValid', 'DESC')
      .addOrderBy('t.enabled', 'DESC')
      .addOrderBy('t.lastExecuteTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await qb.getManyAndCount();

    return {
      list: list.map((t) => this.taskToDto(t)),
      total,
      pageSize,
      currentPage: page,
      totalPages: Math.ceil(total / pageSize) || 0,
    };
  }

  async getTaskByName(name: string): Promise<TaskDto | null> {
    const task = await this.taskRepository.findOne({
      where: { name },
      loadEagerRelations: false,
    });
    return task ? this.taskToDto(task) : null;
  }

  async getTaskById(id: number): Promise<TaskDto | null> {
    const task = await this.taskRepository.findOne({
      where: { id },
      loadEagerRelations: false,
    });
    return task ? this.taskToDto(task) : null;
  }

  /**
   * 手动执行：触发一次 cron job，并把 last_execute_time / is_manual_execute 等字段写回数据库。
   */
  async executeTaskOnce(name: string): Promise<TaskDto> {
    let job: any;
    try {
      job = this.schedulerRegistry.getCronJob(name);
    } catch (error) {
      const msg = `任务 ${name} 未注册为可执行 Cron Job`;
      this.logger.error(`执行任务失败: ${msg}`);
      throw new BusinessRejectedException(msg, 7002);
    }

    this.manualExecutingTaskNames.add(name);
    try {
      await job.fireOnTick();
      // 仅修正执行状态；lastExecuteTime/isManualExecute 由 tick 回调维护
      await this.taskRepository.update(
        { name },
        { lastExecuteStatus: 1, isManualExecute: true },
      );
    } catch (error) {
      await this.taskRepository.update(
        { name },
        { lastExecuteStatus: 0, isManualExecute: true },
      );
      const rawMsg = String(error?.message ?? error ?? 'executeTaskOnce失败');
      const msg = rawMsg.includes('No Cron Job')
        ? `任务 ${name} 未注册为可执行 Cron Job`
        : rawMsg;
      throw new BusinessRejectedException(msg, 7001);
    } finally {
      this.manualExecutingTaskNames.delete(name);
    }

    const updated = await this.getTaskByName(name);
    if (!updated) {
      throw new BusinessRejectedException(`任务 ${name} 不存在`, 7000);
    }
    return updated;
  }

  /**
   * 手动执行：按 sys_task.id 执行一次
   */
  async executeTaskOnceById(id: string): Promise<TaskDto> {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) {
      throw new BusinessRejectedException('任务 id 参数错误', 7000);
    }

    const task = await this.taskRepository.findOne({
      where: { id: numId },
      loadEagerRelations: false,
    });
    if (!task) {
      throw new BusinessRejectedException('任务不存在', 7000);
    }

    const taskType = (task.taskType || 'cron').toLowerCase();

    if (taskType !== 'cron') {
      throw new BusinessRejectedException(
        '只有 cron 类型任务支持手动执行',
        7004,
      );
    }

    // 复用原执行逻辑（内部会处理未注册 Cron Job 的情况）
    return this.executeTaskOnce(task.name);
  }

  /**
   * 删除任务：仅允许删除 isValid=false 的无效任务
   */
  async deleteTaskById(id: string) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) {
      throw new BusinessRejectedException('任务 id 参数错误', 7000);
    }

    const task = await this.taskRepository.findOne({
      where: { id: numId },
      loadEagerRelations: false,
    });
    if (!task) {
      throw new BusinessRejectedException('任务不存在', 7000);
    }

    if (task.isValid === true) {
      throw new BusinessRejectedException('仅允许删除无效任务', 7005);
    }

    await this.taskRepository.delete(task.id);
    return { id: task.id };
  }

  // 获取所有 Cron 任务
  getAllCronJobs(): Array<CronJobInfo> {
    try {
      const jobArr: Array<CronJobInfo> = [];
      const cronJobs = this.schedulerRegistry.getCronJobs();
      const cronObj = Object.fromEntries(cronJobs);
      for (const jobName in cronObj) {
        const job = cronObj[jobName] as unknown as CronJobInfo;
        jobArr.push(this.jobToJobInfo(job));
      }
      return jobArr;
    } catch {
      return [];
    }
  }

  private jobToJobInfo(job: any): CronJobInfo {
    return {
      name: job.name, // 任务名称
      isActive: job._isActive, // 是否激活
      source: job.cronTime.source, // 任务表达式
      lastExecution: dayjs(job.lastExecution as Date).format(
        'YYYY-MM-DD HH:mm:ss',
      ), // 上次执行时间
    };
  }

  /**
   * 启动时把代码里已注册的 Cron 任务同步到 `sys_task`，并把表中的 enabled/cron
   * 应用到运行时调度器里。
   *
   * 规则：
   * - 如果 sys_task 存在该 name：只把 is_valid 设为 true（不改 enabled/cron）。
   * - 如果 sys_task 不存在该 name：新增一条，并使用运行时的 cron/enabled 作为初始值。
   */
  private async syncCronJobsToDBAndApply() {
    // 启动先全量置为无效，后续再按当前进程实际加载到的任务逐个置回有效
    await this.taskRepository
      .createQueryBuilder()
      .update(SysTask)
      .set({ isValid: false })
      .where('1 = 1')
      .execute();

    const cronJobs = this.schedulerRegistry.getCronJobs();
    const cronObj = Object.fromEntries(cronJobs);
    const jobNames = Object.keys(cronObj);
    if (jobNames.length > 0) {
      // 1) 同步 sys_task：不存在则新增；存在则仅 isValid -> true
      const existingTasks = await this.taskRepository.find({
        where: { name: In(jobNames) },
        loadEagerRelations: false,
      });
      const existingByName = new Map<string, SysTask>();
      for (const t of existingTasks) existingByName.set(t.name, t);

      for (const jobName of jobNames) {
        const job = cronObj[jobName] as any;
        const info = this.jobToJobInfo(job);
        const runtimeName =
          typeof job?.name === 'string' && job.name.trim()
            ? job.name.trim()
            : jobName;
        const existing = existingByName.get(runtimeName);

        // 给该 cron job 添加 tick 回调：更新 sys_task 的 last_execute_time / 手动执行标记
        if (
          !this.cronTickCallbacksRegistered.has(jobName) &&
          job &&
          typeof job.addCallback === 'function'
        ) {
          this.cronTickCallbacksRegistered.add(jobName);
          job.addCallback(async () => {
            const now = new Date();
            const isManual = this.manualExecutingTaskNames.has(jobName);
            try {
              await this.taskRepository.update(
                { name: jobName },
                {
                  lastExecuteTime: now,
                  isManualExecute: isManual,
                  lastExecuteStatus: 1,
                },
              );
            } catch (e: any) {
              this.logger.error(
                `写回任务 ${jobName} 执行记录失败: ${e?.message || e}`,
              );
            }
          });
        }

        if (!existing) {
          await this.taskRepository.save({
            name: runtimeName,
            description: '',
            cron:
              typeof info.source === 'string'
                ? info.source
                : String(info.source ?? ''),
            params: null,
            enabled: info.isActive,
            taskType: 'cron',
            isValid: true,
          });
          continue;
        }

        if (existing.isValid !== true) {
          await this.taskRepository.update(
            { id: existing.id },
            { isValid: true },
          );
        }
      }

      // 2) 按 sys_task 的 enabled/cron 应用到运行时
      const tasksAfter = await this.taskRepository.find({
        where: { name: In(jobNames) },
        loadEagerRelations: false,
      });
      const taskByName = new Map<string, SysTask>();
      for (const t of tasksAfter) taskByName.set(t.name, t);

      for (const jobName of jobNames) {
        const job = cronObj[jobName] as any;
        const runtimeName =
          typeof job?.name === 'string' && job.name.trim()
            ? job.name.trim()
            : jobName;
        const task = taskByName.get(runtimeName);
        if (!task) continue;

        // cron
        const cron = String(task.cron ?? '').trim();
        if (cron && typeof job.setTime === 'function') {
          try {
            const cronTime = this.buildCronTimeFromJob(job, cron);
            if (cronTime) job.setTime(cronTime);
          } catch (e: any) {
            this.logger.error(
              `设置任务 ${jobName} cron 失败: ${e?.message || e}`,
            );
          }
        }

        // enabled
        try {
          if (task.enabled === true) {
            if (typeof job.start === 'function') job.start();
          } else {
            if (typeof job.stop === 'function') job.stop();
          }
        } catch (e: any) {
          this.logger.error(
            `设置任务 ${jobName} enabled 失败: ${e?.message || e}`,
          );
        }
      }
    }

    // interval/timeout：仅做 DB -> isValid / enabled 反向停掉定时器
    // （无法动态重建定时器周期，因为 SchedulerRegistry 拿不到 handler）
    const intervalNames = this.schedulerRegistry.getIntervals();
    if (intervalNames.length > 0) {
      const intervalTasks = await this.taskRepository.find({
        where: { name: In(intervalNames) },
        loadEagerRelations: false,
      });
      const intervalByName = new Map<string, SysTask>();
      for (const t of intervalTasks) intervalByName.set(t.name, t);

      for (const intervalName of intervalNames) {
        const existing = intervalByName.get(intervalName);
        if (!existing) {
          await this.taskRepository.save({
            name: intervalName,
            description: '',
            cron: '0',
            params: null,
            enabled: true,
            taskType: 'interval',
            isValid: true,
          });
          continue;
        }
        if (existing.isValid !== true) {
          await this.taskRepository.update(
            { id: existing.id },
            { isValid: true },
          );
        }
        if (existing.enabled === false) {
          try {
            if (this.schedulerRegistry.doesExist('interval', intervalName)) {
              this.schedulerRegistry.deleteInterval(intervalName);
            }
          } catch (e: any) {
            this.logger.error(
              `停止 interval 任务 ${intervalName} 失败: ${e?.message || e}`,
            );
          }
        }
      }
    }

    const timeoutNames = this.schedulerRegistry.getTimeouts();
    if (timeoutNames.length > 0) {
      const timeoutTasks = await this.taskRepository.find({
        where: { name: In(timeoutNames) },
        loadEagerRelations: false,
      });
      const timeoutByName = new Map<string, SysTask>();
      for (const t of timeoutTasks) timeoutByName.set(t.name, t);

      for (const timeoutName of timeoutNames) {
        const existing = timeoutByName.get(timeoutName);
        if (!existing) {
          await this.taskRepository.save({
            name: timeoutName,
            description: '',
            cron: '0',
            params: null,
            enabled: true,
            taskType: 'timeout',
            isValid: true,
          });
          continue;
        }
        if (existing.isValid !== true) {
          await this.taskRepository.update(
            { id: existing.id },
            { isValid: true },
          );
        }
        if (existing.enabled === false) {
          try {
            if (this.schedulerRegistry.doesExist('timeout', timeoutName)) {
              this.schedulerRegistry.deleteTimeout(timeoutName);
            }
          } catch (e: any) {
            this.logger.error(
              `停止 timeout 任务 ${timeoutName} 失败: ${e?.message || e}`,
            );
          }
        }
      }
    }
  }

  @Cron('*/5 * * * * *', {
    name: '测试任务',
    disabled: true,
  })
  testTasks() {
    console.log('测试任务执行了');
  }

  // @Cron('*/5 * * * * *', {
  //   name: '测试任务22',
  //   disabled: true,
  // })
  // testTasks22() {
  //   console.log('测试任务22执行了');
  // }

  // @Timeout('测试任务2', 2000)
  // testTasks2() {
  //   console.log('测试任务2执行了');
  // }

  // @Interval('测试任务3', 2000)
  // testTasks3() {
  //   console.log('测试任务3执行了');
  // }
}
