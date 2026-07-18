/**
 * 去掉模型常见的 Markdown 代码块围栏（三个反引号 + 可选语言标签），得到纯源码文本。
 */
export function stripMarkdownCodeFence(raw: string): string {
  let s = raw.trim();
  const open = /^```(?:typescript|ts|tsx|javascript|js)?\s*\r?\n?/i;

  for (let i = 0; i < 3; i++) {
    const before = s;
    if (open.test(s)) {
      s = s.replace(open, '');
    }
    s = s.replace(/\r?\n```\s*$/i, '');
    s = s.replace(/```\s*$/i, '');
    s = s.trim();
    if (s === before) {
      break;
    }
  }

  return s;
}
