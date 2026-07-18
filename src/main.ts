import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrintSwaggerUrl, SwaggerUi } from './common/utils/swagger.config';
import { Logger } from './common/utils/log4js.config';

async function bootstrap() {
  const logger = new Logger('ServerExchange');
  const port = global.CONFIG.httpPort;
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // 缓存日志第三方日志库需要
  });
  app.useLogger(app.get(Logger));
  // 启用关闭钩子 - 监听 SIGTERM, SIGINT 等信号
  app.enableShutdownHooks();

  // 设置全局前缀
  app.setGlobalPrefix(process.env.API_PREFIX ?? '/', {
    exclude: [''], // 排除根目录的 app 控制器的
  }); // 如 /api 这会自动在所有路由前添加 /api
  SwaggerUi(app, port);
  // 监听端口
  await app.listen(port, () => {
    logger.log(`🚀 应用启动成功，Pid: ${process.pid}`);
    logger.debug(`📄 主页:     http://localhost:${port}/`);
    PrintSwaggerUrl(port);
  });
}
void bootstrap();
