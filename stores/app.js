import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getUser, saveUser } from '@/utils/auth';

export const useStore = defineStore('app', () => {
  const token = ref(uni.getStorageSync('token') || '');
  const initialUser = getUser();
  const user = ref(initialUser);

  function setToken(t) { token.value = t; uni.setStorageSync('token', t); }
  function setUser(u) { user.value = saveUser(u); }
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
