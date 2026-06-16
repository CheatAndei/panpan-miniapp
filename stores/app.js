import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useStore = defineStore('app', () => {
  const token = ref(uni.getStorageSync('token') || '');
  const user = ref(null);

  function setToken(t) { token.value = t; uni.setStorageSync('token', t); }
  function setUser(u) { user.value = u; uni.setStorageSync('user', JSON.stringify(u)); }
  function logout() { token.value = ''; user.value = null; uni.clearStorageSync(); uni.reLaunch({ url: '/pages/index/index' }); }

  return { token, user, setToken, setUser, logout };
});
