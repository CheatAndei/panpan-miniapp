import { api } from './api';

/**
 * 微信登录流程封装
 */
export function doLogin() {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        try {
          if (!loginRes.code) throw new Error('微信登录失败');
          const data = await api.post('/auth/login', { code: loginRes.code });
          if (!data?.token || !data?.user) throw new Error('登录信息不完整，请稍后重试');

          uni.setStorageSync('token', data.token);
          uni.setStorageSync('user', JSON.stringify(data.user));

          resolve(data.user);
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
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
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
  uni.removeStorageSync('token');
  uni.removeStorageSync('user');
  uni.removeStorageSync('activeChildId');
  uni.reLaunch({ url: '/pages/index/index' });
}
