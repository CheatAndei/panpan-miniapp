import { api } from './api';

/**
 * 微信登录流程封装
 */
const USER_STORAGE_KEYS = ['id', 'nickname', 'avatar_url', 'role', 'roles'];

export function sanitizeUser(value) {
  const source = value && typeof value === 'object' ? value : {};
  const clean = {};
  for (const key of USER_STORAGE_KEYS) {
    if (source[key] !== undefined) clean[key] = source[key];
  }
  clean.roles = Array.isArray(clean.roles)
    ? [...new Set(clean.roles.filter((role) => role === 'parent' || role === 'teacher'))]
    : (clean.role ? [clean.role] : []);
  return clean;
}

export function saveUser(value) {
  const clean = sanitizeUser(value);
  uni.setStorageSync('user', JSON.stringify(clean));
  return clean;
}

export function clearLocalSession() {
  uni.removeStorageSync('token');
  uni.removeStorageSync('user');
  uni.removeStorageSync('activeChildId');
}

export function doLogin(options = {}) {
  return new Promise((resolve, reject) => {
    const previousUser = getUser();
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        try {
          if (!loginRes.code) throw new Error('微信登录失败');
          const data = await api.post('/auth/login', {
            code: loginRes.code,
            prefer_role: options.preferRole,
          });
          if (!data?.token || !data?.user) throw new Error('登录信息不完整，请稍后重试');

          const user = sanitizeUser(data.user);
          if (previousUser?.id && user.id && String(previousUser.id) !== String(user.id)) {
            uni.removeStorageSync('activeChildId');
          }
          uni.setStorageSync('token', data.token);
          saveUser(user);

          resolve(user);
        } catch (err) {
          reject(err);
        }
      },
      fail(err) {
        reject({
          error: err?.errMsg || '微信登录失败，请重新打开小程序',
          message: err?.errMsg || '微信登录失败，请重新打开小程序'
        });
      }
    });
  });
}

export function getUser() {
  const raw = uni.getStorageSync('user');
  if (!raw) return null;
  try {
    const clean = sanitizeUser(typeof raw === 'string' ? JSON.parse(raw) : raw);
    saveUser(clean);
    return clean;
  }
  catch {
    uni.removeStorageSync('user');
    return null;
  }
}

export function isTeacher() {
  const user = getUser();
  return user?.role === 'teacher';
}

export function logout() {
  clearLocalSession();
  uni.reLaunch({ url: '/pages/index/index' });
}
