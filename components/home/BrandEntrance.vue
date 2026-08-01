<template>
  <view class="brand-entrance" :class="{ 'is-leaving': leaving }" aria-live="polite">
    <view class="entrance-frame">
      <view class="entrance-topline">
        <view class="entrance-brand">
          <view class="brand-mark"><pp-icon name="brand" :size="52" decorative /></view>
          <text>{{ brand }}</text>
        </view>
        <text class="entrance-code">FANFAN / 01</text>
      </view>

      <view class="entrance-copy">
        <text class="entrance-kicker">{{ mode === 'new' ? 'HELLO, NEW FAMILY' : 'WELCOME BACK' }}</text>
        <text class="entrance-title">{{ mode === 'new' ? '初次见面' : phrase }}</text>
        <text class="entrance-subtitle">
          {{ mode === 'new' ? '正在准备你的学习记录' : '欢迎回来，今天也一起稳稳向前' }}
        </text>
      </view>

      <view class="entrance-visual" aria-hidden="true">
        <view class="sky-shape">
          <view class="eye eye-left"></view>
          <view class="eye eye-right"></view>
          <view class="smile"></view>
        </view>
        <view class="pink-dot"></view>
        <view class="yellow-card">
          <view class="yellow-check"><pp-icon name="check" :size="38" decorative /></view>
        </view>
      </view>

      <view class="loading-line">
        <view class="loading-dots" aria-hidden="true">
          <view></view><view></view><view></view>
        </view>
        <text>{{ loadingText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  brand: { type: String, default: '番番记录' },
  mode: { type: String, default: 'returning' },
  phrase: { type: String, default: '持之以恒' },
  loadingText: { type: String, default: '正在同步学习记录' },
  leaving: { type: Boolean, default: false },
});
</script>

<style scoped>
.brand-entrance {
  position: fixed;
  z-index: 9999;
  inset: 0;
  overflow: hidden;
  color: #050505;
  background: #FFFFFF;
  animation: entrance-in 220ms var(--ease-out) both;
}
.brand-entrance.is-leaving { animation: entrance-out 240ms var(--ease-out) both; }
.entrance-frame {
  position: relative;
  min-height: 100vh;
  padding: 46rpx 38rpx calc(48rpx + env(safe-area-inset-bottom));
  border: 20rpx solid #99DEF4;
  box-sizing: border-box;
  background: #FFFFFF;
}
.entrance-frame::before,
.entrance-frame::after {
  position: absolute;
  content: '';
  pointer-events: none;
}
.entrance-frame::before {
  top: 22rpx;
  right: 22rpx;
  width: 130rpx;
  height: 18rpx;
  background: #F79BC0;
}
.entrance-frame::after {
  right: 32rpx;
  bottom: 110rpx;
  width: 82rpx;
  height: 18rpx;
  background: #FFF48A;
}
.entrance-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 58rpx;
}
.entrance-brand { display: flex; align-items: center; gap: 12rpx; font-size: 28rpx; font-weight: 850; }
.brand-mark {
  width: 54rpx;
  height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #050505;
  background: #99DEF4;
}
.entrance-code { font-size: 19rpx; font-weight: 850; letter-spacing: 1rpx; }
.entrance-copy { position: relative; z-index: 2; margin-top: 104rpx; }
.entrance-kicker {
  display: inline-block;
  padding: 7rpx 14rpx;
  color: #050505;
  background: #F79BC0;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}
.entrance-title {
  display: block;
  max-width: 620rpx;
  margin-top: 22rpx;
  font-size: 68rpx;
  font-weight: 950;
  line-height: 1.1;
  letter-spacing: -2rpx;
}
.entrance-subtitle { display: block; margin-top: 22rpx; color: #50545B; font-size: 27rpx; line-height: 1.55; }
.entrance-visual { position: relative; height: 430rpx; margin-top: 22rpx; }
.sky-shape {
  position: absolute;
  left: 18rpx;
  top: 38rpx;
  width: 430rpx;
  height: 300rpx;
  border: 5rpx solid #050505;
  border-radius: 46% 54% 42% 58% / 58% 40% 60% 42%;
  background: #99DEF4;
  transform: rotate(-4deg);
  animation: mascot-breathe 1.4s ease-in-out infinite alternate;
}
.eye { position: absolute; top: 92rpx; width: 34rpx; height: 48rpx; border-radius: 50%; background: #050505; }
.eye-left { left: 128rpx; }
.eye-right { left: 222rpx; }
.smile { position: absolute; left: 157rpx; top: 176rpx; width: 108rpx; height: 46rpx; border-bottom: 6rpx solid #050505; border-radius: 50%; }
.pink-dot {
  position: absolute;
  right: 18rpx;
  bottom: 40rpx;
  width: 128rpx;
  height: 128rpx;
  border: 5rpx solid #050505;
  border-radius: 50%;
  background: #F79BC0;
}
.yellow-card {
  position: absolute;
  right: 20rpx;
  top: 8rpx;
  width: 138rpx;
  height: 168rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 5rpx solid #050505;
  background: #FFF48A;
  transform: rotate(7deg);
}
.yellow-check { color: #050505; }
.loading-line {
  position: absolute;
  right: 38rpx;
  bottom: calc(46rpx + env(safe-area-inset-bottom));
  left: 38rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding-top: 22rpx;
  border-top: 6rpx solid #050505;
  font-size: 24rpx;
  font-weight: 720;
}
.loading-dots { display: flex; gap: 7rpx; }
.loading-dots view { width: 12rpx; height: 12rpx; border-radius: 50%; background: #050505; animation: dot-pulse .9s ease-in-out infinite; }
.loading-dots view:nth-child(2) { background: #F79BC0; animation-delay: 120ms; }
.loading-dots view:nth-child(3) { background: #99DEF4; animation-delay: 240ms; }
@keyframes entrance-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes entrance-out { to { opacity: 0; transform: translateY(-22rpx); } }
@keyframes mascot-breathe { to { transform: rotate(-2deg) translateY(-8rpx); } }
@keyframes dot-pulse { 0%, 100% { transform: scale(.72); opacity: .45; } 50% { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .brand-entrance,
  .brand-entrance.is-leaving,
  .sky-shape,
  .loading-dots view { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
</style>
