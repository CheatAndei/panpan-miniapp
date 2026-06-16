import { defineStore } from 'pinia';
import { api } from '@/utils/api';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    token: '',
    students: [],
    classes: [],
    schedules: [],
    loading: false
  }),

  getters: {
    isTeacher: (state) => state.user?.role === 'teacher',
    isParent: (state) => state.user?.role === 'parent',
    isLoggedIn: (state) => !!state.token
  },

  actions: {
    loadFromStorage() {
      const token = uni.getStorageSync('token');
      const user = uni.getStorageSync('user');
      if (token) this.token = token;
      if (user) this.user = JSON.parse(user);
    },

    async fetchStudents() {
      this.loading = true;
      try {
        const res = await api.get('/students');
        this.students = res.students || [];
      } catch (e) {
        console.error('fetchStudents error:', e);
      } finally {
        this.loading = false;
      }
    },

    async fetchClasses() {
      this.loading = true;
      try {
        const res = await api.get('/classes');
        this.classes = res.classes || [];
      } catch (e) {
        console.error('fetchClasses error:', e);
      } finally {
        this.loading = false;
      }
    },

    async fetchSchedules() {
      this.loading = true;
      try {
        const res = await api.get('/schedules');
        this.schedules = res.schedules || [];
      } catch (e) {
        console.error('fetchSchedules error:', e);
      } finally {
        this.loading = false;
      }
    }
  }
});
