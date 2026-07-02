// 后端 API 地址
// 微信小程序真机调试时手机无法访问 localhost，因此统一走远程 API。
// 如需调试本地后端，设置环境变量 VITE_API_BASE_URL=http://localhost:3000/api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://panpan.xpytt.com/api';

export const BASE = API_BASE_URL.replace(/\/$/, '');
export const ASSET_BASE = BASE.replace(/\/api$/, '');

export default BASE;
