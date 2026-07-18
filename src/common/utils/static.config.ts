import { ServeStaticModule } from '@nestjs/serve-static';
import type { ServerResponse } from 'http';
import { join } from 'path';
import fs from 'fs';
import {
  getAppPublicDomain,
  normalizePublicOrigin,
} from './domain.util';

const isLocalOrigin = (origin: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
  /^https?:\/\/\[::1\](:\d+)?$/i.test(origin);

const isAllowedStaticOrigin = (origin?: string) => {
  const o = normalizePublicOrigin(origin);
  if (!o) return false;
  if (isLocalOrigin(o)) return true;

  const domain = getAppPublicDomain();
  return Boolean(domain) && o === domain;
};

type HeaderOrigin = string | string[] | undefined;
type ResponseWithReqHeaders = {
  req?: {
    headers?: {
      origin?: HeaderOrigin;
    };
  };
};

const getOriginFromRes = (res: unknown): string | undefined => {
  const originVal = (res as ResponseWithReqHeaders)?.req?.headers?.origin;
  const origin = Array.isArray(originVal) ? originVal[0] : originVal;
  return typeof origin === 'string' ? origin : undefined;
};

// 静态文件服务路径
const getPath = (...pathArr: string[]) => {
  const pathStr = pathArr.reduce(
    (prevPath, curPath) => {
      const isPath = join(__dirname, '../..', curPath);
      if (fs.existsSync(isPath)) prevPath = isPath;
      return prevPath;
    },
    join(__dirname, '../..', 'public'),
  );
  return pathStr;
};

export const getStaticConfigs = () => [
  ServeStaticModule.forRootAsync({
    useFactory: () => {
      return [
        {
          rootPath: getPath('../public', '../../public'), // 添加多个可存在的静态文件服务路径
          serveRoot: '/',
          exclude: ['/api/*'],
          serveStaticOptions: {
            setHeaders: (res: ServerResponse, filePath: string) => {
              // 仅对上传目录资源放开跨域，避免影响其它静态资源策略
              if (filePath.replace(/\\/g, '/').includes('/uploads/')) {
                const origin = normalizePublicOrigin(getOriginFromRes(res));
                if (isAllowedStaticOrigin(origin)) {
                  res.setHeader('Access-Control-Allow-Origin', origin);
                  res.setHeader('Vary', 'Origin');
                  res.setHeader(
                    'Access-Control-Allow-Methods',
                    'GET,HEAD,OPTIONS',
                  );
                  res.setHeader(
                    'Access-Control-Allow-Headers',
                    'Content-Type, Range',
                  );
                }
              }
            },
          },
        },
      ];
    },
  }),
];
