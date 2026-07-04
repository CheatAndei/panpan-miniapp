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
  return raw ? JSON.parse(raw) : null;
}

export function isTeacher() {
  const user = getUser();
  return user?.role === 'teacher';
}

export function logout() {
  uni.removeStorageSync('token');
  uni.removeStorageSync('user');
  uni.reLaunch({ url: '/pages/index/index' });
}
