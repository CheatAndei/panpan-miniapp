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
      fail: reject
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
