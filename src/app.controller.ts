import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './api/admin/decorators';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle() // 跳过限流
@Controller()
@ApiTags('应用')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: '获取应用欢迎信息',
    description: '返回应用欢迎信息',
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
