// logger.ts
import { configure, getLogger } from 'log4js';
import { join } from 'path';
import {
  Injectable,
  LoggerService,
  DynamicModule,
  Global,
  Module,
} from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';

/** 文件名中的日期早于「今天」且大小为 0 的日切日志（.log）删除，不占位到「下一天」 */
const DAILY_LOG_DATE_IN_NAME = /\.(\d{4}-\d{2}-\d{2})\.log$/;

function todayYyyyMmDd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function purgeEmptyHistoricalDailyLogs(logDirsToScan: string[]) {
  const today = todayYyyyMmDd();
  for (const dir of logDirsToScan) {
    if (!existsSync(dir)) continue;
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const m = name.match(DAILY_LOG_DATE_IN_NAME);
      if (!m) continue;
      const fileDate = m[1];
      if (fileDate >= today) continue;
      const full = join(dir, name);
      try {
        if (statSync(full).size === 0) {
          unlinkSync(full);
        }
      } catch {
        // 忽略占用或竞态
      }
    }
  }
}

// 1. 创建日志目录
const logDirs = [
  join(process.cwd(), 'logs/error'),
  join(process.cwd(), 'logs/info'),
];

logDirs.forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// 获取应用名称（与 process.env.APP_NAME 一致，未设置时用默认值）
const APP_NAME = process.env.APP_NAME || 'NestJS';
/** 进程号（模块加载时固定，与日志 pattern 中 P 一致） */
const PID = process.pid;

// 2. 配置 log4js
// 文件格式: [A] P - H      T  [C] N
// 控制台: 两段 pattern 高亮（前缀+级别、正文）按 T 的级别着色；橙色 [%c] 不参与
// 通过 getLogger(上下文名) 使 %c 为控制器/模块名（未声明的 category 会克隆 default）
configure({
  appenders: {
    console: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: `%[[${APP_NAME}] ${PID} - %d{yyyy/MM/dd hh:mm:ss.SSS}      %p%]  \x1b[33m[%c]\x1b[0m  %[%m%]`,
      },
    },
    errorFile: {
      type: 'dateFile',
      filename: join(process.cwd(), 'logs/error/error.log'),
      pattern: 'yyyy-MM-dd',
      alwaysIncludePattern: true,
      keepFileExt: true,
      compress: true,
      numBackups: 60,
      removeOldLogs: true,
      layout: {
        type: 'pattern',
        pattern: `[${APP_NAME}] ${PID} - %d{yyyy/MM/dd hh:mm:ss.SSS}      %p [%c] %m`,
      },
    },
    infoFile: {
      type: 'dateFile',
      filename: join(process.cwd(), 'logs/info/info.log'),
      pattern: 'yyyy-MM-dd',
      alwaysIncludePattern: true,
      keepFileExt: true,
      compress: true,
      numBackups: 30,
      removeOldLogs: true,
      layout: {
        type: 'pattern',
        pattern: `[${APP_NAME}] ${PID} - %d{yyyy/MM/dd hh:mm:ss.SSS}      %p [%c] %m`,
      },
    },
    infoToFile: {
      type: 'logLevelFilter',
      appender: 'infoFile',
      level: 'info',
      maxLevel: 'warn',
    },
    errorToFile: {
      type: 'logLevelFilter',
      appender: 'errorFile',
      level: 'error',
    },
  },
  categories: {
    default: {
      appenders: ['console', 'infoToFile', 'errorToFile'],
      level: 'trace',
    },
  },
  pm2: false,
});

purgeEmptyHistoricalDailyLogs(logDirs);
// 长期运行进程跨天后清理空日文件（streamroller 仍可能预先创建 0 字节文件）
const EMPTY_LOG_PURGE_MS = 6 * 60 * 60 * 1000;
void setInterval(
  () => purgeEmptyHistoricalDailyLogs(logDirs),
  EMPTY_LOG_PURGE_MS,
);

// 3. 实现 LoggerService
@Injectable()
export class Logger implements LoggerService {
  private context: string = '';

  constructor(context?: string) {
    this.context = context || '';
  }

  /** 使用上下文名作为 log4js category，供布局中的 %c 输出 */
  private catLogger() {
    return getLogger(this.context || APP_NAME);
  }

  log(message: any, ...optionalParams: any[]) {
    const formattedMessage = this.formatMessage(message, optionalParams);
    this.catLogger().info(formattedMessage);
  }

  error(message: any, ...optionalParams: any[]) {
    const formattedMessage = this.formatMessage(message, optionalParams);
    this.catLogger().error(formattedMessage);
  }

  warn(message: any, ...optionalParams: any[]) {
    const formattedMessage = this.formatMessage(message, optionalParams);
    this.catLogger().warn(formattedMessage);
  }

  debug(message: any, ...optionalParams: any[]) {
    const formattedMessage = this.formatMessage(message, optionalParams);
    this.catLogger().debug(formattedMessage);
  }

  verbose(message: any, ...optionalParams: any[]) {
    const formattedMessage = this.formatMessage(message, optionalParams);
    this.catLogger().trace(formattedMessage);
  }

  setContext(context: string) {
    this.context = context;
  }

  // 静态方法，用于创建带上下文的实例
  static create(context: string): Logger {
    return new Logger(context);
  }

  private formatMessage(message: any, optionalParams: any[]): string {
    if (optionalParams.length === 0) {
      return this.stringifyMessage(message);
    }

    const formattedParams = optionalParams.map((param) =>
      this.stringifyMessage(param),
    );
    return `${this.stringifyMessage(message)} ${formattedParams.join(' ')}`;
  }

  private stringifyMessage(message: any): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return `${message.message}\n${message.stack}`;
    }

    try {
      return JSON.stringify(message, null, 2);
    } catch {
      return String(message);
    }
  }
}

// 4. 创建 Log4jsModule
@Global()
@Module({
  providers: [
    {
      provide: Logger,
      useFactory: () => {
        return new Logger();
      },
    },
  ],
  exports: [Logger],
})
export class Log4jsModule {
  static forRoot(): DynamicModule {
    return {
      module: Log4jsModule,
      global: true,
    };
  }
}
