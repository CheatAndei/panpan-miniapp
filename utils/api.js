import { BASE, ASSET_BASE } from './config';

const inFlightGets = new Map();
let redirectingToLogin = false;

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  return BASE + normalizedPath;
}

function authHeader() {
  const token = uni.getStorageSync('token');
  if (token) redirectingToLogin = false;
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function clearExpiredSession() {
  const hadSession = Boolean(uni.getStorageSync('token'));
  uni.removeStorageSync('token');
  uni.removeStorageSync('user');
  uni.removeStorageSync('activeChildId');
  if (!hadSession || redirectingToLogin) return;

  redirectingToLogin = true;
  uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
  setTimeout(() => {
    uni.reLaunch({
      url: '/pages/index/index',
      complete: () => { redirectingToLogin = false; }
    });
  }, 350);
}

function executeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: buildUrl(path),
      method,
      data,
      timeout: 15000,
      header: authHeader(),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }
        const error = res.data || { error: '请求失败' };
        error.statusCode = res.statusCode;
        if (res.statusCode === 401) clearExpiredSession();
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

function request(method, path, data) {
  if (method !== 'GET') return executeRequest(method, path, data);

  const key = `${path}|${JSON.stringify(data || null)}`;
  if (inFlightGets.has(key)) return inFlightGets.get(key);

  const task = executeRequest(method, path, data).finally(() => inFlightGets.delete(key));
  inFlightGets.set(key, task);
  return task;
}

function friendlyNetworkError(err, fallback) {
  const message = err?.errMsg || err?.message || fallback;
  const error = { error: message, message, statusCode: 0 };
  if (/url not in domain list|domain list|合法域名/i.test(message)) {
    error.error = '接口域名未加入微信小程序合法域名，请配置 https://panpan.xpytt.com';
  } else if (/timeout/i.test(message)) {
    error.error = '请求超时，请检查网络或后端服务';
  } else if (/fail/i.test(message)) {
    error.error = '无法连接后端服务，请检查网络和接口域名';
  }
  return error;
}

export function assetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  return ASSET_BASE + (url.startsWith('/') ? url : '/' + url);
}

function inferMimeType(filePath, name) {
  const text = String(filePath || '').toLowerCase();
  if (name === 'pdf' || /\.pdf($|\?)/.test(text)) return 'application/pdf';
  if (/\.png($|\?)/.test(text)) return 'image/png';
  if (/\.webp($|\?)/.test(text)) return 'image/webp';
  return 'image/jpeg';
}

function fileNameFromPath(filePath, name) {
  const fallback = name === 'pdf' ? 'note.pdf' : 'image.jpg';
  return String(filePath || '').split(/[\\/]/).pop() || fallback;
}

function readFileAsBase64(filePath) {
  return new Promise((resolve, reject) => {
    const fs = uni.getFileSystemManager && uni.getFileSystemManager();
    if (!fs) return reject({ error: '当前环境不支持读取本地文件' });
    fs.readFile({ filePath, encoding: 'base64', success: (res) => resolve(res.data), fail: reject });
  });
}

async function uploadAsBase64(path, filePath, name) {
  const base64 = await readFileAsBase64(filePath);
  return request('POST', path, {
    base64,
    fileName: fileNameFromPath(filePath, name),
    mimeType: inferMimeType(filePath, name)
  });
}

export function uploadFile(path, filePath, name = 'file') {
  if (uni.getFileSystemManager) return uploadAsBase64(path, filePath, name);
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
            if (res.statusCode === 401) clearExpiredSession();
            reject(error);
          }
        } catch (err) {
          reject(err);
        }
      },
      fail(err) {
        reject(friendlyNetworkError(err, '上传失败'));
      }
    });
  });
}

function openLocalPdf(filePath) {
  return new Promise((resolve, reject) => {
    uni.openDocument({ filePath, fileType: 'pdf', showMenu: true, success: resolve, fail: reject });
  });
}

function downloadAndOpenPdf(fileUrl) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url: fileUrl,
      header: authHeader(),
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) return reject({ error: 'PDF 下载失败' });
        openLocalPdf(res.tempFilePath).then(resolve, reject);
      },
      fail: (err) => reject(friendlyNetworkError(err, 'PDF 下载失败'))
    });
  });
}

export function openPdfDocument(url) {
  const fileUrl = assetUrl(url);
  const fs = uni.getFileSystemManager && uni.getFileSystemManager();
  const userDataPath = (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH)
    || (uni.env && uni.env.USER_DATA_PATH)
    || '';
  if (!fs || !userDataPath) return downloadAndOpenPdf(fileUrl);

  return new Promise((resolve, reject) => {
    const fallback = () => downloadAndOpenPdf(fileUrl).then(resolve, reject);
    uni.request({
      url: fileUrl,
      method: 'GET',
      header: authHeader(),
      responseType: 'arraybuffer',
      success: (res) => {
        if (res.statusCode !== 200 || !res.data) return fallback();
        const filePath = `${userDataPath}/panpan-note-${Date.now()}.pdf`;
        fs.writeFile({
          filePath,
          data: res.data,
          success: () => openLocalPdf(filePath).then(resolve, fallback),
          fail: fallback
        });
      },
      fail: fallback
    });
  });
}

export const api = {
  get(path, data) { return request('GET', path, data); },
  post(path, data) { return request('POST', path, data); },
  put(path, data) { return request('PUT', path, data); },
  del(path) { return request('DELETE', path); },
  upload(path, filePath, name) { return uploadFile(path, filePath, name); },
  assetUrl,
  openPdf(url) { return openPdfDocument(url); }
};
