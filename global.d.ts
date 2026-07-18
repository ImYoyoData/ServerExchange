// 从 json5.config.ts 导入类型
import { ConfigType } from './src/common/utils/json5.config';

// 扩展 NodeJS 的 Global 接口
declare global {
  var CONFIG: ConfigType;
}

export {};
