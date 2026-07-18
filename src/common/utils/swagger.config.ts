import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { normalizePublicOrigin } from './domain.util';

const logger = new Logger('SwaggerUi');

/**
 * 打印 Swagger 文档 URL
 * @param port 应用端口
 */
export const PrintSwaggerUrl = (port: string | number) => {
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.SWAGGER_ENABLED !== 'true'
  ) {
    // 非开发环境且未开启swagger文档生产环境开关 则不生成文档
    return;
  }
  logger.log(`📄 API文档:  http://localhost:${port}/docs`);
  logger.log(`📄 JSON文档: http://localhost:${port}/docs/json`);
};

// 文档生成器
export const SwaggerUi = (
  app: INestApplication<any>,
  port: string | number,
) => {
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.SWAGGER_ENABLED !== 'true'
  ) {
    // 非开发环境且未开启swagger文档生产环境开关 则不生成文档
    logger.log('非开发环境且未开启swagger文档生产环境开关 则不生成文档');
    return;
  }
  const config = new DocumentBuilder()
    .setTitle(`${process.env.APP_NAME} API 文档`)
    .setDescription('辅助开发的 API 文档')
    .setVersion(process.env.VERSION ?? '1.0')
    .addServer('http://localhost:' + port, 'DEV')
    .addServer(normalizePublicOrigin(process.env.DOMAIN ?? ''), 'PROD')
    .addTag('Yoyo')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
    })
    .build();
  const documentFactory = SwaggerModule.createDocument(app, config);
  // 关键步骤：清理文档以适配 Zod
  cleanupOpenApiDoc(documentFactory);
  SwaggerModule.setup('docs', app, documentFactory, {
    jsonDocumentUrl: 'docs/json',
    swaggerOptions: {
      persistAuthorization: true, // 保持认证状态
    },
  });
};
