<template>
  <view class="welcome">
    <view class="welcome-topline">
      <view class="welcome-brand">
        <view class="brand-seal" aria-hidden="true">
          <pp-icon name="brand" :size="54" motion="breathe" decorative />
        </view>
        <text>{{ brand }}</text>
      </view>
      <text class="welcome-code">FANFAN / 01</text>
    </view>

    <view class="welcome-hero">
      <view class="hero-copy">
        <text class="hero-kicker">潘潘老师 · 数学学习记录</text>
        <text class="brand-name">把今天的数学，<br />清楚地记下来</text>
        <text class="brand-sub">每一次认真练习、订正和进步，都值得被看见。</text>
      </view>
      <view class="record-visual" aria-hidden="true">
        <view class="record-sheet sheet-back">
          <view class="sheet-rule"></view>
          <view class="sheet-rule short"></view>
        </view>
        <view class="record-sheet sheet-front">
          <view class="sheet-index">07 / 28</view>
          <view class="sheet-mark"><pp-icon name="check" :size="48" motion="pop" :delay="430" decorative /></view>
          <view class="sheet-title"></view>
          <view class="sheet-copy"></view>
          <view class="sheet-copy short"></view>
          <view class="sheet-accent"></view>
        </view>
      </view>
    </view>

    <view class="welcome-signals" aria-label="学习记录内容">
      <view class="signal-item">
        <view class="signal-icon blue"><pp-icon name="calendar" :size="34" motion="pop" :delay="240" decorative /></view>
        <text>今日练习</text>
      </view>
      <view class="signal-item">
        <view class="signal-icon mint"><pp-icon name="pencil" :size="34" motion="pop" :delay="300" decorative /></view>
        <text>作业批改</text>
      </view>
      <view class="signal-item">
        <view class="signal-icon yellow"><pp-icon name="trophy" :size="34" motion="shine" :delay="360" decorative /></view>
        <text>成长记录</text>
      </view>
    </view>

    <view class="welcome-actions">
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
      <text class="welcome-note">首次登录默认进入家长端</text>
    </view>
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
  min-height: calc(100vh - 100rpx);
  padding: 36rpx 32rpx 64rpx;
  box-sizing: border-box;
  overflow: hidden;
  background:
    repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(32, 180, 134, .035) 64rpx 65rpx),
    var(--page-bg);
}

.welcome-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64rpx;
}

.welcome-brand {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 780;
}

.brand-seal {
  width: 54rpx;
  height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-code {
  color: var(--accent-strong);
  font-size: 19rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.welcome-hero {
  position: relative;
  min-height: 512rpx;
  margin: 28rpx -32rpx 0;
  padding: 54rpx 38rpx 44rpx;
  overflow: hidden;
  box-sizing: border-box;
  border-top: 1rpx solid #BCE8D9;
  border-bottom: 8rpx solid var(--primary);
  background: #FFFFFF;
  animation: welcome-enter var(--motion-slow) var(--ease-out) both;
}

.welcome-hero::before {
  content: '';
  position: absolute;
  top: 0;
  right: 42rpx;
  width: 150rpx;
  height: 12rpx;
  background: var(--primary);
}

.welcome-hero::after {
  content: '';
  position: absolute;
  top: 0;
  right: 192rpx;
  width: 54rpx;
  height: 12rpx;
  background: var(--coral);
}

.hero-copy {
  position: relative;
  z-index: 2;
  max-width: 580rpx;
}

.hero-kicker {
  display: block;
  color: var(--primary-strong);
  font-size: 21rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.brand-name {
  display: block;
  margin-top: 20rpx;
  color: var(--ink);
  font-size: 59rpx;
  font-weight: 850;
  line-height: 1.18;
  letter-spacing: 0;
}

.brand-sub {
  display: block;
  max-width: 470rpx;
  margin-top: 22rpx;
  color: var(--text-secondary);
  font-size: 26rpx;
  line-height: 1.65;
}

.record-visual {
  position: absolute;
  z-index: 1;
  right: 30rpx;
  bottom: 34rpx;
  width: 242rpx;
  height: 244rpx;
}

.record-sheet {
  position: absolute;
  width: 188rpx;
  height: 220rpx;
  box-sizing: border-box;
  border: 1rpx solid #9EDAC6;
  border-radius: 10rpx;
  background: #FFFFFF;
  box-shadow: 0 12rpx 26rpx rgba(36, 48, 41, .1);
}

.sheet-back {
  right: 36rpx;
  bottom: 6rpx;
  padding: 30rpx 24rpx;
  transform: rotate(-9deg);
  animation: sheet-back-enter 480ms 120ms var(--ease-out) both;
}

.sheet-front {
  right: 2rpx;
  bottom: 0;
  padding: 18rpx;
  transform: rotate(4deg);
  animation: sheet-front-enter 480ms 180ms var(--ease-out) both;
}

.sheet-rule,
.sheet-title,
.sheet-copy {
  height: 8rpx;
  border-radius: 4rpx;
  background: #DCEBE3;
}

.sheet-rule + .sheet-rule { margin-top: 18rpx; }
.sheet-rule.short,
.sheet-copy.short { width: 58%; }
.sheet-index { color: var(--accent-strong); font-size: 17rpx; font-weight: 760; }
.sheet-mark {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20rpx 0 18rpx;
  border-radius: 50%;
  background: var(--primary-soft);
  animation: sheet-mark-pop 420ms 430ms var(--ease-out) both;
}
.sheet-title { width: 76%; height: 10rpx; background: #9EDAC6; }
.sheet-copy { width: 100%; margin-top: 14rpx; }
.sheet-accent {
  position: absolute;
  right: 14rpx;
  bottom: 14rpx;
  width: 44rpx;
  height: 8rpx;
  background: var(--coral);
}

.welcome-signals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 28rpx;
}

.signal-item {
  min-width: 0;
  min-height: 94rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  padding: 10rpx 6rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: #FFFFFF;
  color: var(--text-secondary);
  font-size: 22rpx;
  font-weight: 650;
  animation: signal-enter 340ms var(--ease-out) both;
}

.signal-item:nth-child(1) {
  border-color: #BCE8D9;
  background: #F7FCF9;
  animation-delay: 220ms;
}

.signal-item:nth-child(2) {
  border-color: #BCE8D9;
  background: #F7FCF9;
  animation-delay: 280ms;
}

.signal-item:nth-child(3) {
  border-color: #BCE8D9;
  background: #F7FCF9;
  animation-delay: 340ms;
}

.signal-icon {
  width: 50rpx;
  height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
}

.signal-icon.blue,
.signal-icon.yellow { background: var(--primary-soft); color: var(--primary-strong); }
.signal-icon.mint { background: var(--coral-soft); color: var(--danger); }

.welcome-actions {
  margin-top: 34rpx;
  text-align: center;
}

.login-btn,
.repair-login-btn {
  width: 100%;
  min-height: 86rpx;
  margin: 0;
  border-radius: var(--r-sm);
  padding: 14rpx 24rpx;
  line-height: 1.35;
  font-weight: 720;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.login-btn {
  background: var(--primary-strong);
  color: #FFFFFF;
  font-size: 30rpx;
  box-shadow: 0 12rpx 26rpx rgba(21, 148, 109, .18);
}

.repair-login-btn {
  min-height: 78rpx;
  margin-top: 14rpx;
  border: 1rpx solid #9EDAC6;
  background: #FFFFFF;
  color: var(--primary-strong);
  font-size: 26rpx;
}

.login-btn::after,
.repair-login-btn::after { border: 0; }
.login-btn:active,
.repair-login-btn:active { transform: scale(var(--tap-scale)); opacity: .88; }

.welcome-note {
  display: block;
  margin-top: 20rpx;
  color: var(--faint);
  font-size: 22rpx;
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

@keyframes sheet-back-enter {
  from { opacity: 0; transform: translate(18rpx, 18rpx) rotate(-4deg); }
  to { opacity: 1; transform: translate(0, 0) rotate(-9deg); }
}

@keyframes sheet-front-enter {
  from { opacity: 0; transform: translate(22rpx, 22rpx) rotate(0deg); }
  to { opacity: 1; transform: translate(0, 0) rotate(4deg); }
}

@keyframes sheet-mark-pop {
  0% { opacity: 0; transform: scale(.72); }
  70% { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes signal-enter {
  from { opacity: 0; transform: translateY(10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 340px) {
  .welcome { padding-right: 24rpx; padding-left: 24rpx; }
  .welcome-hero { margin-right: -24rpx; margin-left: -24rpx; padding-right: 28rpx; padding-left: 28rpx; }
  .brand-name { font-size: 50rpx; }
  .record-visual { right: 12rpx; opacity: .56; }
  .hero-copy { max-width: 490rpx; }
}

@media (prefers-reduced-motion: reduce) {
  .welcome-hero,
  .sheet-back,
  .sheet-front,
  .sheet-mark,
  .signal-item,
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
