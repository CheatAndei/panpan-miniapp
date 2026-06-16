/**
 * 登录流程封装
 */
export function doLogin() {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        try {
          const { api } = require('./api');
          const data = await api.post('/auth/login', { code: loginRes.code });

          uni.setStorageSync('token', data.token);
          uni.setStorageSync('user', JSON.stringify(data.user));

          resolve(data.user);
        } catch (err) {
          reject(err);
        }
      },
      fail: reject
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
