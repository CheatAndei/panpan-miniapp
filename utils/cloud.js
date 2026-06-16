import { api } from './api';

// 兼容旧调用：action 形式不再走微信云函数。
export default async function cloudReq(path, data = {}) {
  return api.post(path, data);
}
