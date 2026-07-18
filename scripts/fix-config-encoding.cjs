const fs = require('fs');

function w(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  const buf = fs.readFileSync(file);
  const ok = buf.includes(Buffer.from('\u5bb9\u5668', 'utf8'));
  console.log(file, 'utf8-ok=', ok);
}

const header =
  '//  \u5bb9\u5668\u8bbf\u95ee\u5bbf\u4e3b\u673a\n' +
  '//  windows \u53ef\u4ee5\u7528 host.docker.internal\n' +
  '//  linux \u53ef\u4ee5\u7528 172.17.0.1\n' +
  '//  \u5982\u679c linux \u4e5f\u60f3\u7528 host.docker.internal  \u4f60\u53ef\u4ee5\u8bbe\u7f6e\u7f51\u7edc\u6620\u5c04\u7f51\u5173\u5b9e\u73b0\n';

const cache = [
  '  // \u672c\u5730\u5185\u5b58 + \u6587\u4ef6\u7f13\u5b58\uff08\u66ff\u4ee3 Redis\uff1b\u5355\u673a\u90e8\u7f72\uff09',
  '  cache: {',
  '    open: true,',
  '    memory: {',
  '      ttlMs: 0,',
  '      lruSize: 5000,',
  '    },',
  '    file: {',
  "      filename: './.cache/kv.json',",
  '      writeDelayMs: 100,',
  '      expiredCheckDelayMs: 86400000,',
  '    },',
  '  },',
].join('\n');

const db = [
  '  // \u6570\u636e\u5e93\u914d\u7f6e',
  '  database: {',
  '    // \u9ed8\u8ba4\u4f7f\u7528 SQLite\uff0c\u4fbf\u4e8e\u5355\u673a\u5206\u53d1\uff1b\u7ed3\u6784/\u79cd\u5b50\u6765\u81ea sys.sql \u5bfc\u5165',
  '    default: {',
  '      open: true,',
  "      type: 'sqlite',",
  "      database: './data/app.db',",
  '      // \u4f7f\u7528 sys.sql \u5bfc\u5165\u7684\u7ed3\u6784\uff0c\u907f\u514d TypeORM synchronize \u6539\u8868',
  '      synchronize: false,',
  '    },',
  '    // MySQL\uff08\u53ef\u9009\uff09',
  '    mysql: {',
  '      open: false,',
  "      type: 'mysql',",
  "      host: '127.0.0.1',",
  '      port: 3306,',
  "      username: 'yoyo',",
  "      password: '123456',",
  "      database: 'test',",
  '      pool: {',
  '        max: 30,',
  '        min: 3,',
  '        idleTimeoutMillis: 60000,',
  '        connectionTimeoutMillis: 5000,',
  '      },',
  '    },',
  '    pg1: {',
  '      open: false,',
  "      type: 'postgres',",
  "      host: '127.0.0.1',",
  '      port: 5432,',
  "      username: 'yoyo',",
  "      password: '123456',",
  "      database: 'test',",
  '    },',
  '  },',
  '}',
].join('\n');

w(
  'config.development.json5',
  header +
    '{\n' +
    '  httpPort: 3500, // http\u76d1\u542c\u7aef\u53e3\n' +
    '  // AI Agent\uff08TypeORM \u5b9e\u4f53\u751f\u6210\u3001\u5bf9\u8bdd\u7b49\uff09\n' +
    '  // provider: openai\uff08Chat Completions\uff09| anthropic\uff08Messages API\uff09\n' +
    '  // jinaKey \u53ef\u9009\uff1a\u7528\u4e8e searchWeb / fetchWebPage \u63d0\u5347\u7f51\u7edc\u68c0\u7d22\u914d\u989d\n' +
    '  // \u771f\u5b9e\u5bc6\u94a5\u8bf7\u5199\u5728 config.development.local.json5\uff08\u4f18\u5148\u7ea7\u66f4\u9ad8\uff09\n' +
    '  agent: {\n' +
    "    provider: 'openai',\n" +
    "    url: 'https://api.siliconflow.cn/v1',\n" +
    "    key: 'sk-xxxxxxxxxxx',\n" +
    "    model: 'deepseek-ai/DeepSeek-V3',\n" +
    '  },\n' +
    cache +
    '\n' +
    db +
    '\n',
);

w(
  'config.development.local.json5',
  header +
    '{\n' +
    '  httpPort: 3500, // http\u76d1\u542c\u7aef\u53e3\n' +
    '  // AI Agent\uff08TypeORM \u5b9e\u4f53\u751f\u6210\u3001\u5bf9\u8bdd\u7b49\uff09\n' +
    '  // provider: openai | anthropic\n' +
    '  agent: {\n' +
    "    provider: 'openai',\n" +
    "    url: 'https://api.siliconflow.cn/v1',\n" +
    "    key: 'sk-pmuteplmbocgkprrqjtrbpcabtbbpyzqksefuzdfiwgvjubk',\n" +
    "    model: 'deepseek-ai/DeepSeek-V3',\n" +
    '  },\n' +
    cache +
    '\n' +
    db +
    '\n',
);

w(
  'config.production.json5',
  header +
    '{\n' +
    '  httpPort: 8080, // http\u76d1\u542c\u7aef\u53e3 \u4fee\u6539\u8fd9\u91cc\u522b\u5fd8\u8bb0docker\u91cc\u9762\u7684\u4e86\n' +
    '  // AI Agent\uff08TypeORM \u5b9e\u4f53\u751f\u6210\u3001\u5bf9\u8bdd\u7b49\uff09\n' +
    '  // provider: openai | anthropic\n' +
    '  // \u751f\u4ea7\u5bc6\u94a5\u8bf7\u5199\u5728 config.production.local.json5\n' +
    '  agent: {\n' +
    "    provider: 'openai',\n" +
    "    url: 'https://api.siliconflow.cn/v1',\n" +
    "    key: 'sk-xxxxxxxxxxx',\n" +
    "    model: 'deepseek-ai/DeepSeek-V3',\n" +
    '  },\n' +
    cache +
    '\n' +
    db +
    '\n',
);

w(
  'config.production.local.json5',
  header +
    '{\n' +
    '  httpPort: 8080, // http\u76d1\u542c\u7aef\u53e3 \u4fee\u6539\u8fd9\u91cc\u522b\u5fd8\u8bb0docker\u91cc\u9762\u7684\u4e86\n' +
    '  // AI Agent\uff08TypeORM \u5b9e\u4f53\u751f\u6210\u3001\u5bf9\u8bdd\u7b49\uff09\n' +
    '  // provider: openai | anthropic\n' +
    '  agent: {\n' +
    "    provider: 'openai',\n" +
    "    url: 'https://api.siliconflow.cn/v1',\n" +
    "    key: 'sk-xxxxxxxxxxx',\n" +
    "    model: 'deepseek-ai/DeepSeek-V3',\n" +
    '  },\n' +
    cache +
    '\n' +
    db +
    '\n',
);
