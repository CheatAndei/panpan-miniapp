// 后端 API 地址
const API_BASE_URL = 'http://localhost:3000/api';

export const BASE = API_BASE_URL.replace(/\/$/, '');
export const ASSET_BASE = BASE.replace(/\/api$/, '');

export default BASE;
