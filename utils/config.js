// 后端 API 地址
// 开发环境走本地，生产环境走 HTTPS 已备案域名（微信小程序硬性要求）。
// dev:mp 时 import.meta.env.DEV === true，build:mp 时为 false，自动切换。
const DEV_BASE = 'http://localhost:3000/api';

// TODO(上线前必填): 替换为你已在「微信公众平台 → 开发 → 服务器域名」配置且已 ICP 备案的 HTTPS 域名。
// 例如 'https://api.你的域名.com/api'。未填会导致生产环境请求失败。
const PROD_BASE = 'https://api.example.com/api';

const isDev = import.meta.env.DEV;
const API_BASE_URL = isDev ? DEV_BASE : PROD_BASE;

export const BASE = API_BASE_URL.replace(/\/$/, '');
export const ASSET_BASE = BASE.replace(/\/api$/, '');

export default BASE;
