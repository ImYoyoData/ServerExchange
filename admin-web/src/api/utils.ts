// 目前访问的模拟数据
// 开发的时候 使用代理 3500  但是需要 /api/xxx
export const baseUrlApi = (url: string) =>
  process.env.NODE_ENV === "development"
    ? `/api/${url}/`
    : `http://127.0.0.1:3000/api/${url}/`;
