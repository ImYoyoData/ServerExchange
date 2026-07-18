/** 消息类型：1-通知、2-消息 */
export const MESSAGE_TYPE = {
  NOTICE: 1,
  MESSAGE: 2,
} as const;

export type MessageTypeValue = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

export const MESSAGE_TYPE_VALUES = [
  MESSAGE_TYPE.NOTICE,
  MESSAGE_TYPE.MESSAGE,
] as const;
