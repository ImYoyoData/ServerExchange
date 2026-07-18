// utils/ms-utils.ts (修正版)

export type TimeUnit =
  | 'years'
  | 'year'
  | 'yrs'
  | 'yr'
  | 'y'
  | 'weeks'
  | 'week'
  | 'w'
  | 'days'
  | 'day'
  | 'd'
  | 'hours'
  | 'hour'
  | 'hrs'
  | 'hr'
  | 'h'
  | 'minutes'
  | 'minute'
  | 'mins'
  | 'min'
  | 'm'
  | 'seconds'
  | 'second'
  | 'secs'
  | 'sec'
  | 's'
  | 'milliseconds'
  | 'millisecond'
  | 'msecs'
  | 'msec'
  | 'ms';

export type TimeString =
  | `${number}${TimeUnit}`
  | `${number} ${TimeUnit}`
  | string; // 支持组合格式

export type ExpiresIn = TimeString | number;

interface FormatOptions {
  long?: boolean;
  compact?: boolean;
}

// 短单位到长单位的映射
const SHORT_TO_LONG: { [key: string]: { singular: string; plural: string } } = {
  ms: { singular: 'millisecond', plural: 'milliseconds' },
  s: { singular: 'second', plural: 'seconds' },
  m: { singular: 'minute', plural: 'minutes' },
  h: { singular: 'hour', plural: 'hours' },
  d: { singular: 'day', plural: 'days' },
  w: { singular: 'week', plural: 'weeks' },
  y: { singular: 'year', plural: 'years' },
};

// 时间单位到毫秒的映射
const UNIT_MAP: { [key: string]: number } = {
  // 年
  years: 31557600000, // 365.25天
  year: 31557600000,
  yrs: 31557600000,
  yr: 31557600000,
  y: 31557600000,

  // 周
  weeks: 604800000, // 7天
  week: 604800000,
  w: 604800000,

  // 天
  days: 86400000, // 24小时
  day: 86400000,
  d: 86400000,

  // 小时
  hours: 3600000, // 60分钟
  hour: 3600000,
  hrs: 3600000,
  hr: 3600000,
  h: 3600000,

  // 分钟
  minutes: 60000, // 60秒
  minute: 60000,
  mins: 60000,
  min: 60000,
  m: 60000,

  // 秒
  seconds: 1000,
  second: 1000,
  secs: 1000,
  sec: 1000,
  s: 1000,

  // 毫秒
  milliseconds: 1,
  millisecond: 1,
  msecs: 1,
  msec: 1,
  ms: 1,
};

export class MsUtils {
  /**
   * 解析时间字符串为毫秒
   */
  static parse(str: TimeString | number): number {
    if (typeof str === 'number') {
      return str;
    }

    if (typeof str !== 'string') {
      throw new TypeError('Expected a string or number');
    }

    str = str.trim();

    // 如果是纯数字，直接返回
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10);
    }

    // 处理组合格式，如 "1d 2h 3m 4s"
    if (str.includes(' ')) {
      return str
        .split(/\s+/)
        .map((part) => this.parseSingle(part))
        .reduce((sum, val) => sum + val, 0);
    }

    return this.parseSingle(str);
  }

  /**
   * 解析单个时间单位
   */
  private static parseSingle(str: string): number {
    const match = str.match(/^(\d*\.?\d+)\s*([a-z]+)$/i);
    if (!match) {
      throw new Error(`Invalid time format: ${str}`);
    }

    const [, numStr, unit] = match;
    const num = parseFloat(numStr);
    const lowerUnit = unit.toLowerCase();

    if (!UNIT_MAP[lowerUnit]) {
      throw new Error(`Unknown time unit: ${unit}`);
    }

    return num * UNIT_MAP[lowerUnit];
  }

  /**
   * 将毫秒格式化为可读字符串
   */
  static format(ms: number, options: FormatOptions = {}): string {
    if (typeof ms !== 'number') {
      throw new TypeError('Expected a number');
    }

    const { long = false, compact = false } = options;
    const absMs = Math.abs(ms);

    if (long) {
      return this.formatLong(absMs, ms >= 0);
    }

    return this.formatShort(absMs, ms >= 0, compact);
  }

  /**
   * 长格式格式化
   */
  private static formatLong(ms: number, positive: boolean): string {
    const prefix = positive ? '' : '-';

    if (ms < 1000) {
      return `${prefix}${ms} ${ms === 1 ? 'millisecond' : 'milliseconds'}`;
    }

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${prefix}${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${prefix}${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${prefix}${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${prefix}${days} ${days === 1 ? 'day' : 'days'}`;
    }

    const weeks = Math.floor(days / 7);
    if (weeks < 52) {
      return `${prefix}${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    }

    const years = Math.floor(days / 365.25);
    return `${prefix}${years} ${years === 1 ? 'year' : 'years'}`;
  }

  /**
   * 短格式格式化
   */
  private static formatShort(
    ms: number,
    positive: boolean,
    compact: boolean,
  ): string {
    const prefix = positive ? '' : '-';

    if (ms < 1000) {
      return `${prefix}${ms}ms`;
    }

    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${prefix}${this.round(seconds)}${compact ? '' : 's'}`;
    }

    const minutes = seconds / 60;
    if (minutes < 60) {
      return `${prefix}${this.round(minutes)}${compact ? '' : 'm'}`;
    }

    const hours = minutes / 60;
    if (hours < 24) {
      return `${prefix}${this.round(hours)}${compact ? '' : 'h'}`;
    }

    const days = hours / 24;
    if (days < 7) {
      return `${prefix}${this.round(days)}${compact ? '' : 'd'}`;
    }

    const weeks = days / 7;
    if (weeks < 52) {
      return `${prefix}${this.round(weeks)}${compact ? '' : 'w'}`;
    }

    const years = days / 365.25;
    return `${prefix}${this.round(years)}${compact ? '' : 'y'}`;
  }

  /**
   * 四舍五入保留一位小数
   */
  private static round(num: number): number {
    return Math.round(num * 10) / 10;
  }

  /**
   * 获取短单位的全称
   */
  static getLongUnit(shortUnit: string, count: number = 1): string {
    const unitInfo = SHORT_TO_LONG[shortUnit.toLowerCase()] as
      | {
          singular: string;
          plural: string;
        }
      | undefined;
    if (!unitInfo) {
      return shortUnit;
    }
    return count === 1 ? unitInfo.singular : unitInfo.plural;
  }

  /**
   * 解析 JWT expiresIn 格式
   */
  static parseExpiresIn(expiresIn: ExpiresIn): number {
    return this.parse(expiresIn);
  }

  /**
   * 转换为秒
   */
  static toSeconds(time: ExpiresIn): number {
    const ms = this.parse(time);
    return Math.floor(ms / 1000);
  }

  /**
   * 转换为分钟
   */
  static toMinutes(time: ExpiresIn): number {
    const ms = this.parse(time);
    return Math.floor(ms / 60000);
  }

  /**
   * 转换为小时
   */
  static toHours(time: ExpiresIn): number {
    const ms = this.parse(time);
    return Math.floor(ms / 3600000);
  }

  /**
   * 转换为天数
   */
  static toDays(time: ExpiresIn): number {
    const ms = this.parse(time);
    return Math.floor(ms / 86400000);
  }

  /**
   * 验证时间字符串是否有效
   */
  static isValid(str: string): boolean {
    try {
      this.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前时间戳加上指定时间后的值
   */
  static fromNow(time: ExpiresIn): number {
    const ms = this.parse(time);
    return Date.now() + ms;
  }

  /**
   * 获取 Date 对象
   */
  static dateFromNow(time: ExpiresIn): Date {
    return new Date(this.fromNow(time));
  }
}

// 导出函数版本
export const ms = (str: TimeString | number): number => MsUtils.parse(str);
ms.format = MsUtils.format.bind(MsUtils) as typeof MsUtils.format;
ms.parse = MsUtils.parse.bind(MsUtils) as typeof MsUtils.parse;
ms.toSeconds = MsUtils.toSeconds.bind(MsUtils) as typeof MsUtils.toSeconds;
ms.toMinutes = MsUtils.toMinutes.bind(MsUtils) as typeof MsUtils.toMinutes;
ms.toHours = MsUtils.toHours.bind(MsUtils) as typeof MsUtils.toHours;
ms.toDays = MsUtils.toDays.bind(MsUtils) as typeof MsUtils.toDays;
ms.isValid = MsUtils.isValid.bind(MsUtils) as typeof MsUtils.isValid;
ms.fromNow = MsUtils.fromNow.bind(MsUtils) as typeof MsUtils.fromNow;
ms.dateFromNow = MsUtils.dateFromNow.bind(MsUtils);
ms.getLongUnit = MsUtils.getLongUnit.bind(MsUtils);

// 默认导出
export default ms;
