import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useStore = defineStore('app', () => {
  const token = ref(uni.getStorageSync('token') || '');
  let initialUser = null;
  try {
    const stored = uni.getStorageSync('user');
    initialUser = stored ? (typeof stored === 'string' ? JSON.parse(stored) : stored) : null;
  } catch {
    uni.removeStorageSync('user');
  }
  const user = ref(initialUser);

  function setToken(t) { token.value = t; uni.setStorageSync('token', t); }
  function setUser(u) { user.value = u; uni.setStorageSync('user', JSON.stringify(u)); }
  function logout() {
    token.value = '';
    user.value = null;
    uni.removeStorageSync('token');
    uni.removeStorageSync('user');
    uni.removeStorageSync('activeChildId');
    uni.reLaunch({ url: '/pages/index/index' });
  }

  return { token, user, setToken, setUser, logout };
});
