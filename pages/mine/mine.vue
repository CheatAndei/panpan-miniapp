<template>
  <view class="page">
    <!-- 用户信息 -->
    <view class="card user-card">
      <image :src="user.avatar_url || '/static/default-avatar.png'" class="u-avatar" />
      <view class="u-name">{{ user.nickname || '未设置昵称' }}</view>
      <view :class="['u-role', user.role === 'teacher' ? 'role-teacher' : 'role-parent']">
        {{ user.role === 'teacher' ? '👨‍🏫 老师' : '👨‍👩‍👧 家长' }}
      </view>
      <button class="btn-outline small mt-20" @tap="editProfile">编辑资料</button>
    </view>

    <!-- 统计（老师） -->
    <view v-if="store.isTeacher" class="card">
      <view class="section-title">数据概览</view>
      <view class="stats">
        <view class="stat-item">
          <text class="stat-num">{{ store.students.length }}</text>
          <text class="stat-label">学生</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ store.classes.length }}</text>
          <text class="stat-label">学习小组</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ store.schedules.length }}</text>
          <text class="stat-label">学习安排/周</text>
        </view>
      </view>
    </view>

    <!-- 已绑定孩子（家长） -->
    <view v-if="store.isParent && store.students.length > 0" class="card">
      <view class="section-title">我的孩子</view>
      <view v-for="s in store.students" :key="s.id" class="stu-item" @tap="goPage('/pages/student/student?id=' + s.id)">
        <text>{{ s.name }}</text>
        <text class="arrow">›</text>
      </view>
      <button class="btn-outline mt-20" @tap="goPage('/pages/bind/bind')">绑定更多孩子</button>
    </view>

    <!-- 意见反馈 -->
    <view class="card">
      <view class="section-title">设置</view>
      <view class="setting-item" @tap="logout">
        <text>退出登录</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="version">v1.0.0 · 教培助手</view>
  </view>
</template>

<script>
import { useUserStore } from '@/stores/user';
import { logout, getUser } from '@/utils/auth';

export default {
  data() { return { user: {} }; },
  computed: { store: () => useUserStore() },
  onShow() { this.user = getUser() || {}; },
  methods: {
    goPage(url) { uni.navigateTo({ url }); },
    editProfile() { uni.navigateTo({ url: '/pages/login/login' }); },
    logout() {
      uni.showModal({
        title: '退出登录',
        content: '确定退出？',
        success: (res) => { if (res.confirm) logout(); }
      });
    }
  }
};
</script>

<style scoped>
.page { padding-bottom: 40rpx; }
.user-card { text-align: center; padding: 40rpx; }
.u-avatar { width: 120rpx; height: 120rpx; border-radius: 50%; margin-bottom: 20rpx; }
.u-name { font-size: 36rpx; font-weight: bold; margin-bottom: 10rpx; }
.u-role { font-size: 24rpx; padding: 6rpx 20rpx; border-radius: 20rpx; display: inline-block; }
.role-teacher { background: #E8F4FD; color: #4A90D9; }
.role-parent { background: #FFF7E6; color: #FA8C16; }
.section-title { font-size: 32rpx; font-weight: 600; margin-bottom: 20rpx; }
.stats { display: flex; justify-content: space-around; }
.stat-item { text-align: center; }
.stat-num { font-size: 48rpx; font-weight: bold; color: #4A90D9; display: block; }
.stat-label { font-size: 24rpx; color: #999; margin-top: 6rpx; }
.stu-item { display: flex; justify-content: space-between; padding: 16rpx 0; font-size: 28rpx; border-bottom: 1rpx solid #f0f0f0; }
.stu-item:last-child { border-bottom: none; }
.setting-item { display: flex; justify-content: space-between; padding: 20rpx 0; font-size: 28rpx; }
.arrow { font-size: 36rpx; color: #ccc; }
.version { text-align: center; color: #ccc; font-size: 24rpx; padding: 40rpx; }
</style>
