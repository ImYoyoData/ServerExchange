import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Controller('users')
@ApiTags('用户管理')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Post()
  @ApiOperation({
    summary: '创建用户',
    description: '创建新用户账户，需要管理员权限',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: '查询所有用户',
    description: '返回所有用户账户列表，需要管理员权限',
  })
  async findAll() {
    // const databaseHost = this.configService.get<string>('DB_TYPE','mysql'); // 获取环境变量的数据库类型
    await this.redis.set('key', JSON.stringify('value'), 'EX', 60);
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: '根据ID查询用户',
    description: '创建新用户账户，需要管理员权限',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '更新用户',
    description: '更新指定用户账户信息，需要管理员权限',
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '删除用户',
    description: '删除指定用户账户，需要管理员权限',
  })
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
