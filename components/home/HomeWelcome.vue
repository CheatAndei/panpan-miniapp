<template>
  <view class="welcome">
    <view class="welcome-paper" aria-hidden="true">
      <view class="paper-hole"></view>
      <view class="paper-hole"></view>
      <view class="paper-hole"></view>
    </view>
    <view class="brand-icon" aria-hidden="true">
      <pp-icon name="brand" :size="128" decorative />
    </view>
    <text class="brand-name">{{ brand }}</text>
    <text class="brand-sub">课堂记录与家校反馈助手</text>
    <text class="brand-desc">课表、签到与反馈，轻松记在一起</text>
    <button class="login-btn" :disabled="loading" aria-label="微信登录" @tap="$emit('login')">
      {{ loading ? '登录中...' : '微信登录' }}
    </button>
    <button
      class="repair-login-btn"
      :disabled="loading"
      aria-label="切换身份或修复登录"
      @tap="$emit('repair')"
    >
      切换身份 / 登录修复
    </button>
    <text class="welcome-note">首次登录默认为家长身份</text>
  </view>
</template>

<script setup>
defineProps({
  brand: { type: String, default: '番番记录' },
  loading: { type: Boolean, default: false },
});

defineEmits(['login', 'repair']);
</script>

<style scoped>
.welcome {
  position: relative;
  min-height: calc(100vh - 100rpx);
  padding: 148rpx 58rpx 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  text-align: center;
}

.welcome-paper {
  position: absolute;
  top: 74rpx;
  left: 50%;
  width: min(640rpx, calc(100% - 48rpx));
  height: 510rpx;
  border: 1rpx solid var(--border);
  border-radius: 24rpx 12rpx 24rpx 12rpx;
  background-color: #FFFFFF;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 55rpx,
    rgba(82, 124, 201, .08) 56rpx,
    rgba(82, 124, 201, .08) 57rpx
  );
  box-shadow: var(--shadow);
  transform: translateX(-50%) rotate(-1deg);
}

.welcome-paper::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 54rpx;
  width: 2rpx;
  background: rgba(233, 133, 119, .3);
}

.paper-hole {
  position: absolute;
  left: 18rpx;
  width: 16rpx;
  height: 16rpx;
  border: 1rpx solid #C8D8EA;
  border-radius: 50%;
  background: var(--page-bg);
}

.paper-hole:nth-child(1) { top: 62rpx; }
.paper-hole:nth-child(2) { top: 242rpx; }
.paper-hole:nth-child(3) { bottom: 62rpx; }

.brand-icon,
.brand-name,
.brand-sub,
.brand-desc,
.login-btn,
.repair-login-btn,
.welcome-note {
  position: relative;
  z-index: 1;
}

.brand-icon {
  width: 128rpx;
  height: 128rpx;
  margin-bottom: 28rpx;
  filter: drop-shadow(0 14rpx 24rpx rgba(49, 94, 168, .15));
  animation: welcome-enter var(--motion-slow) var(--ease-out) both;
}

.brand-name {
  color: var(--ink);
  font-size: 54rpx;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 7rpx;
  animation: welcome-enter var(--motion-slow) 40ms var(--ease-out) both;
}

.brand-sub {
  margin-top: 20rpx;
  color: var(--text-secondary);
  font-size: 31rpx;
  font-weight: 650;
  line-height: 1.45;
}

.brand-desc {
  margin: 12rpx 0 52rpx;
  color: var(--text-muted);
  font-size: 25rpx;
  line-height: 1.6;
}

.login-btn,
.repair-login-btn {
  width: 100%;
  max-width: 540rpx;
  margin-right: auto;
  margin-left: auto;
  box-sizing: border-box;
  font-weight: 700;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.login-btn {
  min-height: 112rpx;
  padding: 22rpx 30rpx;
  border-radius: 16rpx;
  background: var(--primary-strong);
  color: #FFFFFF;
  font-size: 31rpx;
  box-shadow: 0 14rpx 30rpx rgba(49, 94, 168, .18);
}

.repair-login-btn {
  min-height: 96rpx;
  margin-top: 18rpx;
  border: 1rpx solid #BCD0EC;
  border-radius: 16rpx;
  background: #FFFFFF;
  color: var(--primary-strong);
  font-size: 27rpx;
}

.login-btn::after,
.repair-login-btn::after {
  border: 0;
}

.login-btn:active,
.repair-login-btn:active {
  transform: scale(.98);
  opacity: .86;
}

.welcome-note {
  margin-top: 24rpx;
  color: var(--faint);
  font-size: 23rpx;
}

@keyframes welcome-enter {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 340px) {
  .welcome {
    padding-right: 42rpx;
    padding-left: 42rpx;
  }

  .brand-name {
    font-size: 48rpx;
  }

  .brand-sub {
    font-size: 28rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .brand-icon,
  .brand-name,
  .login-btn,
  .repair-login-btn {
    animation: none !important;
    transition: none !important;
  }

  .login-btn:active,
  .repair-login-btn:active {
    transform: none;
  }
}
</style>
