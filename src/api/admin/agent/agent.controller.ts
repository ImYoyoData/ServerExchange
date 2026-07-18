import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Post,
  Query,
  Res,
  Sse,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';
import { GenerateTypeormEntityDto } from './dto/generate-typeorm-entity.dto';
import { Public } from '../decorators';
import { BusinessPass, BusinessRejectedException } from 'src/common/exceptions';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Permissions } from '../decorators';

@ApiTags('AI智能体')
@Controller('admin/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * TypeORM 实体 Agent：智能对话 + 按需生成实体代码
   */
  @Permissions('generate:typeorm:generate')
  @Post('typeorm-entity')
  @ApiOperation({
    summary: 'TypeORM 实体 Agent：对话澄清 + 按需生成/校验实体 TS 代码',
  })
  @HttpCode(HttpStatus.OK)
  async generateTypeormEntity(@Body() body: GenerateTypeormEntityDto) {
    try {
      const result = await this.agentService.generateTypeormEntityTs(
        body.message,
        body.userContext,
      );
      return BusinessPass({
        kind: result.kind,
        message: result.message,
        code: result.code,
        attempts: result.attempts,
        validationReason: result.validationReason,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BusinessRejectedException(msg || '生成 TypeORM 实体失败');
    }
  }

  /**
   * TypeORM 实体 Agent 流式输出（SSE）
   */
  @Permissions('generate:typeorm:generate')
  @Post('typeorm-entity/stream')
  @ApiOperation({
    summary: 'TypeORM 实体 Agent 流式输出（SSE）',
  })
  @HttpCode(HttpStatus.OK)
  async streamTypeormEntity(
    @Body() body: GenerateTypeormEntityDto,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const flush = (res as Response & { flushHeaders?: () => void })
      .flushHeaders;
    if (typeof flush === 'function') {
      flush.call(res);
    }

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      for await (const event of this.agentService.streamTypeormEntityTs(
        body.message,
        body.userContext,
      )) {
        writeEvent(event as Record<string, unknown>);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      writeEvent({ type: 'error', message });
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  }

  /**
   * 一次性返回完整回复（JSON）
   */
  @Post('chat')
  @ApiOperation({ summary: '一次性返回完整回复（JSON）' })
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: AgentChatDto) {
    try {
      return BusinessPass(await this.agentService.chatOnce(body.message));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BusinessRejectedException(msg || 'AI对话失败');
    }
  }

  /**
   * SSE 流式对话（OpenAI Chat Completions SSE 格式）
   * Content-Type: text/event-stream
   * 每条事件均为：data: { ...chat.completion.chunk... }
   * 结束标志：data: [DONE]
   */
  @Public()
  @Post('chat/stream')
  @ApiOperation({ summary: 'SSE 流式对话（OpenAI 兼容接口）' })
  @HttpCode(HttpStatus.OK)
  async chatStream(
    @Body() body: AgentChatDto,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const flush = (res as Response & { flushHeaders?: () => void })
      .flushHeaders;

    if (typeof flush === 'function') {
      flush.call(res);
    }

    const completionId = `chatcmpl-${randomUUID().replace(/-/g, '')}`;
    const created = Math.floor(Date.now() / 1000);
    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    const baseChunk = {
      id: completionId,
      object: 'chat.completion.chunk',
      created,
      model,
    };
    const writeChunk = (
      delta: Record<string, unknown>,
      finishReason: 'stop' | null,
    ) => {
      const payload = {
        ...baseChunk,
        choices: [{ index: 0, delta, finishReason }],
      };
      const openAiPayload = JSON.stringify(payload).replace(
        /"finishReason":/g,
        '"finish_reason":',
      );
      res.write(`data: ${openAiPayload}\n\n`);
    };

    try {
      // 首包先发送 role（与 OpenAI 行为保持一致）
      writeChunk({ role: 'assistant' }, null);
      for await (const text of this.agentService.streamChat(body.message)) {
        writeChunk({ content: text }, null);
      }
      writeChunk({}, 'stop');
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(
        `data: ${JSON.stringify({
          error: {
            message,
            type: 'server_error',
            code: null,
          },
        })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
    } finally {
      res.end();
    }
  }

  /**
   * Nest 内置 SSE 示例：{@link Sse} + {@link Observable}<{@link MessageEvent}>。
   * Nest 会设置 `Content-Type: text/event-stream` 并按 SSE 规范写出每条事件的 `data:` 字段。
   *
   * 说明：浏览器原生 `EventSource` 只支持 **GET** 且不好带自定义 Body，故用 Query `message` 传参；
   * 长文本或需鉴权 Header 时仍建议用上面的 `POST chat/stream` + `fetch` 读流。
   *
   * 前端示例：`new EventSource('/api/admin/agent/chat/sse?message=' + encodeURIComponent('你好'))`
   * 监听：`es.onmessage = (e) => JSON.parse(e.data)`
   */
  @Sse('chat/sse')
  @ApiOperation({
    summary:
      'Nest 内置 SSE 示例：{@link Sse} + {@link Observable}<{@link MessageEvent}>。',
  })
  chatSse(@Query('message') message?: string): Observable<MessageEvent> {
    const trimmed = (message ?? '').trim();
    if (!trimmed) {
      return of({
        data: JSON.stringify({
          type: 'error',
          message: '缺少 query 参数 message',
        }),
      });
    }
    return this.agentService.streamChatSse(trimmed);
  }
}
