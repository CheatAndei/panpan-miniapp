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

function executeRequest(method, path, data, options = {}) {
  const { handleUnauthorized = true } = options;
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
        if (res.statusCode === 401 && handleUnauthorized) clearExpiredSession();
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

function request(method, path, data, options = {}) {
  if (method !== 'GET') return executeRequest(method, path, data, options);

  const key = `${path}|${JSON.stringify(data || null)}|${JSON.stringify(options || null)}`;
  if (inFlightGets.has(key)) return inFlightGets.get(key);

  const task = executeRequest(method, path, data, options).finally(() => inFlightGets.delete(key));
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

function downloadPrivateByFileApi(fileUrl) {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url: fileUrl,
      header: authHeader(),
      success: (res) => {
        if (res.statusCode === 401) clearExpiredSession();
        if (res.statusCode !== 200 || !res.tempFilePath) return reject({ error: '私有文件下载失败' });
        resolve(res.tempFilePath);
      },
      fail: (err) => reject(friendlyNetworkError(err, '私有文件下载失败'))
    });
  });
}

function responseHeader(headers, name) {
  const target = String(name || '').toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => String(key).toLowerCase() === target);
  return entry ? String(entry[1] || '') : '';
}

function privateImageExtension(headers) {
  const type = responseHeader(headers, 'content-type').toLowerCase();
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  return '.jpg';
}

function downloadPrivateByRequest(fileUrl) {
  const fs = uni.getFileSystemManager && uni.getFileSystemManager();
  const userDataPath = (typeof wx !== 'undefined' && wx.env && wx.env.USER_DATA_PATH)
    || (uni.env && uni.env.USER_DATA_PATH)
    || '';
  if (!fs || !userDataPath) return Promise.reject({ error: '当前环境无法读取私有照片' });

  return new Promise((resolve, reject) => {
    uni.request({
      url: fileUrl,
      method: 'GET',
      timeout: 15000,
      header: authHeader(),
      responseType: 'arraybuffer',
      success: (res) => {
        if (res.statusCode === 401) clearExpiredSession();
        if (res.statusCode !== 200 || !res.data) {
          const message = res.statusCode === 404 ? '照片文件不存在，请让家长重新提交' : '私有照片读取失败';
          return reject({ error: message, statusCode: res.statusCode });
        }
        const filePath = `${userDataPath}/panpan-private-${Date.now()}-${Math.random().toString(16).slice(2)}${privateImageExtension(res.header)}`;
        fs.writeFile({
          filePath,
          data: res.data,
          success: () => resolve(filePath),
          fail: (err) => reject(friendlyNetworkError(err, '私有照片写入失败'))
        });
      },
      fail: (err) => reject(friendlyNetworkError(err, '私有照片读取失败'))
    });
  });
}

export async function downloadPrivateFile(url) {
  const fileUrl = assetUrl(url);
  try {
    // 真机只需配置 request 合法域名即可工作，避免 downloadFile 域名配置遗漏导致整页照片不可读。
    return await downloadPrivateByRequest(fileUrl);
  } catch (requestError) {
    try { return await downloadPrivateByFileApi(fileUrl); }
    catch { throw requestError; }
  }
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

export function openRemoteDocument(url, fileType = 'docx') {
  const fileUrl = assetUrl(url);
  const normalizedType = ['pdf', 'doc', 'docx'].includes(String(fileType).toLowerCase()) ? String(fileType).toLowerCase() : 'docx';
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url: fileUrl,
      header: authHeader(),
      success: (res) => {
        if (res.statusCode === 401) clearExpiredSession();
        if (res.statusCode !== 200 || !res.tempFilePath) return reject({ error: '试卷下载失败' });
        uni.openDocument({ filePath: res.tempFilePath, fileType: normalizedType, showMenu: true, success: resolve, fail: reject });
      },
      fail: (err) => reject(friendlyNetworkError(err, '试卷下载失败')),
    });
  });
}

export const api = {
  get(path, data, options) { return request('GET', path, data, options); },
  post(path, data, options) { return request('POST', path, data, options); },
  put(path, data, options) { return request('PUT', path, data, options); },
  del(path, options) { return request('DELETE', path, undefined, options); },
  upload(path, filePath, name) { return uploadFile(path, filePath, name); },
  downloadPrivate(url) { return downloadPrivateFile(url); },
  assetUrl,
  openPdf(url) { return openPdfDocument(url); },
  openDocument(url, fileType) { return openRemoteDocument(url, fileType); }
};
