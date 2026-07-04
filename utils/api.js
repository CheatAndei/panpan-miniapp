import { BASE, ASSET_BASE } from './config';

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  return BASE + normalizedPath;
}

function authHeader() {
  const token = uni.getStorageSync('token');
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: buildUrl(path),
      method,
      data,
      header: authHeader(),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }
        const error = res.data || { error: '请求失败' };
        error.statusCode = res.statusCode;
        if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.removeStorageSync('user');
          uni.removeStorageSync('activeChildId');
        }
        reject(error);
      },
      fail(err) {
        const message = err?.errMsg || '网络请求失败';
        const error = { error: message, message, statusCode: 0 };
        if (/url not in domain list|domain list|合法域名/i.test(message)) {
          error.error = '接口域名未加入微信小程序合法域名，请配置 https://panpan.xpytt.com';
        } else if (/timeout/i.test(message)) {
          error.error = '请求超时，请检查网络或后端服务';
        } else if (/fail/i.test(message)) {
          error.error = '无法连接后端服务，请检查网络和接口域名';
        }
        reject(error);
      }
    });
  });
}

export function assetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return ASSET_BASE + (url.startsWith('/') ? url : '/' + url);
}

export function uploadFile(path, filePath, name = 'file') {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: buildUrl(path),
      filePath,
      name,
      header: authHeader(),
      success(res) {
        try {
          const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data || {});
          else {
            const error = data || { error: '上传失败' };
            error.statusCode = res.statusCode;
            if (res.statusCode === 401) {
              uni.removeStorageSync('token');
              uni.removeStorageSync('user');
              uni.removeStorageSync('activeChildId');
            }
            reject(error);
          }
        } catch (err) {
          reject(err);
        }
      },
      fail: reject
    });
  });
}

export const api = {
  get(path, data) { return request('GET', path, data); },
  post(path, data) { return request('POST', path, data); },
  put(path, data) { return request('PUT', path, data); },
  del(path) { return request('DELETE', path); },
  upload(path, filePath, name) { return uploadFile(path, filePath, name); },
  assetUrl
};
