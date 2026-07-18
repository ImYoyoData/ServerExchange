import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MessageService } from './message.service';
import { QueryMessagePageDto } from './dto/query-message-page.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { QueryMyMessageDto } from './dto/query-my-message.dto';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import { AdminOnly } from '../decorators';
import { type AuthenticatedRequest } from '../types/request.types';
import { Permissions } from '../decorators';

@ApiTags('站内消息')
@Controller('admin/message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  /**
   * 管理端：分页列表（关键词搜标题+内容、已读状态、类型、接收用户）
   */
  @Permissions('message:list')
  @Get('page')
  @ApiOperation({ summary: '消息分页（管理）' })
  async page(@Query() query: QueryMessagePageDto) {
    return BusinessPass(await this.messageService.pageMessages(query));
  }

  /**
   * 新增：userId（0/单人/数组）与 roleIds（按角色）可单独或同时使用，**并集**去重后每人一行。响应含 sendBatchId。
   */
  @Permissions('message:btn:add')
  @Post()
  @ApiOperation({ summary: '新增消息（管理）' })
  async create(@Body() body: CreateMessageDto) {
    return BusinessPass(await this.messageService.createMessage(body));
  }

  /**
   * 编辑：可改 title、content（至少一项）；接收用户、已读不可在此修改
   */
  @Permissions('message:btn:update')
  @Put()
  @ApiOperation({ summary: '编辑消息-标题与内容（管理）' })
  async update(@Body() body: UpdateMessageDto) {
    return BusinessPass(await this.messageService.updateMessage(body));
  }

  /**
   * 按批次软删：同一次发送（userId 为数组或 0）产生的多条记录可一次删光
   */
  @Permissions('message:btn:delete')
  @Delete('batch/:sendBatchId')
  @ApiOperation({ summary: '按发送批次软删除（管理）' })
  async removeBatch(@Param('sendBatchId') sendBatchId: string) {
    return BusinessPass(
      await this.messageService.softDeleteMessageBatch(sendBatchId),
    );
  }

  /**
   * 软删除单条（只删这一行，不影响同批次其他用户）
   */
  @Permissions('message:btn:delete')
  @Delete(':id')
  @ApiOperation({ summary: '删除单条消息-软删除（管理）' })
  async remove(@Param('id') id: string) {
    const num = Number(id);
    if (!Number.isInteger(num) || num < 1) {
      throw new BusinessRejectedException('参数错误');
    }
    return BusinessPass(await this.messageService.softDeleteMessage(num));
  }

  /**
   * 当前用户收件箱：分页（默认50）、可选类型、发送时间倒序、未读数（与类型筛选一致）
   */
  @Get('inbox')
  @ApiOperation({ summary: '我的消息列表' })
  async inbox(
    @Query() query: QueryMyMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return BusinessPass(
      await this.messageService.pageMyMessages(req.user.id, query),
    );
  }

  /**
   * 当前用户将消息标为已读
   */
  @Patch('inbox/read/:id')
  @ApiOperation({ summary: '标记单条消息已读' })
  async markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const num = Number(id);
    if (!Number.isInteger(num) || num < 1) {
      throw new BusinessRejectedException('参数错误');
    }
    return BusinessPass(
      await this.messageService.markAsReadForUser(num, req.user.id),
    );
  }
}
