<template>
  <view class="maintenance-page">
    <view class="paper-card">
      <view class="brand-mark"><pp-icon name="brand" :size="24" motion="shine" /><text>番番记录</text></view>
      <view :class="['status-icon',{checking}]"><pp-icon name="lightbulb" :size="40" :motion="checking ? 'ring' : 'breathe'" /></view>
      <view class="title"><pp-icon name="pencil" :size="30" /><text>{{ status.title || '系统升级维护中' }}</text></view>
      <text class="message">{{ status.message || defaultMessage }}</text>
      <view v-if="status.estimated_restore_at" class="eta">
        <view class="eta-label"><pp-icon name="calendar" :size="24" /><text>预计恢复</text></view>
        <text class="eta-value">{{ status.estimated_restore_at }}</text>
      </view>
      <button class="retry-btn" :disabled="checking" @tap="checkStatus">
        <pp-icon name="search" :size="28" /><text>{{ checking ? '正在检查...' : '检查是否恢复' }}</text>
      </button>
      <view class="care"><pp-icon name="check" :size="24" /><text>学习记录已妥善保存，请放心。</text></view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api';

export default {
  data() {
    return {
      checking: false,
      status: uni.getStorageSync('systemMaintenance') || {},
      defaultMessage: '正在升级题库、批改和反馈功能，数据已安全备份。完成后即可正常使用，请稍后再试。',
    };
  },
  onShow() { this.checkStatus(); },
  methods: {
    async checkStatus() {
      if (this.checking) return;
      this.checking = true;
      try {
        this.status = await api.get('/system/status', null, { handleUnauthorized: false, timeout: 6000 });
        uni.setStorageSync('systemMaintenance', this.status);
        if (!this.status.maintenance) {
          uni.reLaunch({ url: '/pages/index/index' });
        }
      } catch (error) {
        uni.showToast({ title: '暂时无法连接，请稍后重试', icon: 'none' });
      } finally {
        this.checking = false;
      }
    },
  },
};
</script>

<style scoped>
.maintenance-page {
  --panpan-green: #527CC9;
  --panpan-green-strong: #315EA8;
  --panpan-sprout: #527CC9;
  --panpan-coral: #E98577;
  --panpan-leaf: #315EA8;
  --panpan-paper: #F6FAFF;
  --panpan-ink: #24324A;
  --panpan-muted: #5C6C84;
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 52rpx 32rpx calc(52rpx + env(safe-area-inset-bottom));
  background-color: var(--panpan-paper);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(82, 124, 201, .055) 64rpx 65rpx
  );
}

.paper-card {
  width: 100%;
  box-sizing: border-box;
  padding: 34rpx 30rpx 30rpx;
  border: 1rpx solid #D9E5F3;
  border-top: 7rpx solid var(--panpan-sprout);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: 0 14rpx 30rpx rgba(36, 50, 74, .08);
  text-align: center;
  animation: maintenance-enter var(--motion-slow) var(--ease-out) both;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 7rpx 16rpx;
  border: 1rpx solid rgba(82, 124, 201, .3);
  border-radius: 8rpx;
  background: #EAF2FF;
  color: var(--panpan-green-strong);
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 0;
}

.status-icon {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 24rpx auto 18rpx;
  border: 2rpx solid var(--panpan-green);
  border-radius: 14rpx;
  background: #EAF2FF;
}

.status-icon.checking {
  animation: turn 1.1s linear infinite;
}

.title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  color: var(--panpan-ink);
  font-size: 38rpx;
  font-weight: 780;
  letter-spacing: 0;
}

.message {
  display: block;
  margin-top: 16rpx;
  color: var(--panpan-muted);
  font-size: 25rpx;
  line-height: 1.7;
}

.eta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 22rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid rgba(82, 124, 201, .28);
  border-left: 5rpx solid var(--panpan-leaf);
  border-radius: 10rpx;
  background: #EAF2FF;
}

.eta-label { display: flex; align-items: center; gap: 6rpx; color: var(--panpan-muted); font-size: 23rpx; }
.eta-value { color: #315EA8; font-size: 24rpx; font-weight: 700; }

.retry-btn {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin: 26rpx 0 0;
  border-radius: 12rpx;
  background: var(--panpan-green-strong);
  color: #FFFFFF;
  font-size: 27rpx;
  font-weight: 700;
  box-shadow: 0 9rpx 20rpx rgba(49, 94, 168, .2);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.retry-btn:active { transform: scale(var(--tap-scale)); }
.retry-btn[disabled] { background: #C9DAF0; opacity: .7; box-shadow: none; }
.retry-btn::after { border: 0; }
.care { display: flex; align-items: center; justify-content: center; gap: 6rpx; margin-top: 18rpx; color: var(--panpan-muted); font-size: 22rpx; }

@keyframes turn { to { transform: rotate(360deg); } }
@keyframes maintenance-enter {
  from { opacity: 0; transform: translateY(18rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .paper-card { animation: none; }
  .retry-btn { transition: none; }
  .status-icon.checking { animation-duration: 1.8s; }
}
</style>
