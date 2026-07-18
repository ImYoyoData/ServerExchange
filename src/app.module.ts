import { Module } from '@nestjs/common';
import { APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { ConfigModule } from '@nestjs/config';
import json5ConfigFactory from './common/utils/json5.config';
import { FirstErrorInterceptor } from './common/utils/first-error.interceptor';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { getDatabaseModules } from './common/utils/database.config';
import { UsersModule } from './api/users/users.module';
import {
  getThrottleProviders,
  getThrottlerModule,
} from './common/utils/throttle.config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './api/admin/admin.module';
import { getResponseInterceptor } from './common/interceptors/response.interceptor';
import { getStaticConfigs } from './common/utils/static.config';
import { getRedisModules } from './common/utils/redis.config';
import { Log4jsModule } from './common/utils/log4js.config';

@Module({
  imports: [
    // 全局配置模块（最先加载）
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，所有地方都能用
      // 自动根据 NODE_ENV 加载对应文件，如果没设置 NODE_ENV 则默认为 development local 优先级高
      envFilePath: ['.env.local', '.env'],
      load: [json5ConfigFactory],
    }),
    // 日志模块
    Log4jsModule.forRoot(),
    // 限流中间件
    ...getThrottlerModule(),

    // 静态文件服务
    ...getStaticConfigs(),
    // redis加载
    ...getRedisModules(),
    // 关系型数据库加载
    ...getDatabaseModules(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as any,
      },
    }),
    // 计划任务模块
    ScheduleModule.forRoot(),
    UsersModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    // 条件性地注册全局限流守卫
    ...getThrottleProviders(),
    AppService,
    // 添加全局验证管道
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    // 添加全局序列化拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: FirstErrorInterceptor,
    },

    // 全局响应拦截器
    ...getResponseInterceptor(),
  ],
})
export class AppModule {}
