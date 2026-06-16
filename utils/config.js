// 后端 API 地址
// Vite/uni-app 构建时可用 VITE_API_BASE_URL 覆盖。
const env = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const API_BASE_URL = env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const BASE = API_BASE_URL.replace(/\/$/, '');
export const ASSET_BASE = BASE.replace(/\/api$/, '');

export default BASE;
