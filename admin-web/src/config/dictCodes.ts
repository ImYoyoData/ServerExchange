/**
 * 需要预加载到本地缓存的字典编码列表（用于 GetDict 同步读取）
 * 用于 InitDict 预加载字典树
 */
export default [
  /** 系统消息状态（字典名称/展示用：系统消息状态） */
  "sys_message_status",
  /** 系统消息类型（字典名称/展示用：系统消息类型） */
  "sys_message_type"
] as Array<string | number>;
