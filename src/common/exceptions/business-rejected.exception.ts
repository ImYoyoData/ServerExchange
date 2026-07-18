// common/exceptions/business-rejected.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务拒绝异常
 * 返回 HTTP 400，但用错误码表示业务失败
 * 适用于前端希望统一处理 400 响应的场景
 * BusinessRejectedException
 */
export class BusinessRejectedException extends HttpException {
  constructor(
    message: string,
    code: string | number = 'BUSINESS_REJECTED',
    data?: Record<string, any>,
  ) {
    const response = {
      success: false, // 表示业务失败
      code, // 业务错误码
      message, // 错误信息
      data: null, // 无数据
      ...data, // 额外元数据
      timestamp: Date.now(),
    };

    // 返回 HTTP 400，但内容表示业务失败  你前端是200 也可以这里设置
    super(response, HttpStatus.BAD_REQUEST);
  }
}

// 包装成功参数规则
export const BusinessPass = (
  data?: Record<string, any> | null | string | number,
  message: string = '操作成功',
  code: string | number = 200,
) => {
  return {
    success: true, // 表示业务成功
    code, // 业务成功码
    message, // 成功信息
    data, // 无数据
    timestamp: Date.now(),
  };
};
