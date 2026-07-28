<template>
  <view class="homework-notice-mask" role="dialog" aria-modal="true" aria-label="作业批改完成提醒">
    <view class="homework-notice-card">
      <view class="notice-tab"><text>作业反馈</text></view>
      <view class="homework-notice-mark" aria-hidden="true">批</view>
      <text class="homework-notice-kicker">批改进度 · 已完成</text>
      <text class="homework-notice-title">{{ notice.student_name }}的《{{ notice.title }}》已批改完成</text>
      <text v-if="count > 1" class="homework-notice-more">另有 {{ count - 1 }} 份新作业反馈，可在作业记录中查看</text>
      <text v-else class="homework-notice-more">老师的批改和评语已经准备好了</text>
      <view class="homework-notice-actions">
        <button
          class="homework-notice-later"
          :disabled="handling"
          aria-label="知道了并关闭作业提醒"
          @tap="$emit('dismiss')"
        >
          知道了
        </button>
        <button
          class="homework-notice-open"
          :disabled="handling"
          aria-label="查看已批改作业"
          @tap="$emit('open')"
        >
          {{ handling ? '处理中…' : '查看作业' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  notice: { type: Object, required: true },
  count: { type: Number, default: 1 },
  handling: { type: Boolean, default: false },
});

defineEmits(['dismiss', 'open']);
</script>

<style scoped>
.homework-notice-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 36rpx 24rpx calc(36rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: rgba(36, 50, 74, .46);
  animation: notice-mask-enter var(--motion-base) ease-out both;
}

.homework-notice-card {
  position: relative;
  width: 100%;
  max-width: 680rpx;
  max-height: calc(100vh - 120rpx);
  padding: 62rpx 38rpx 34rpx;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1rpx solid #E8D79E;
  border-radius: 24rpx 12rpx 24rpx 12rpx;
  background-color: #FFFDF5;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 53rpx,
    rgba(244, 199, 91, .13) 54rpx,
    rgba(244, 199, 91, .13) 55rpx
  );
  box-shadow: 0 26rpx 80rpx rgba(36, 50, 74, .25);
  animation: notice-card-enter 280ms var(--ease-out) both;
}

.homework-notice-card::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 28rpx;
  width: 2rpx;
  background: rgba(233, 133, 119, .3);
}

.notice-tab {
  position: absolute;
  top: 0;
  right: 30rpx;
  padding: 10rpx 18rpx 12rpx;
  border-radius: 0 0 10rpx 10rpx;
  background: var(--gold);
  color: #594311;
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}

.homework-notice-mark {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #BFD2ED;
  border-radius: 18rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 32rpx;
  font-weight: 850;
}

.homework-notice-kicker,
.homework-notice-title,
.homework-notice-more {
  position: relative;
  display: block;
}

.homework-notice-kicker {
  margin-top: 20rpx;
  color: #8A681E;
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.homework-notice-title {
  max-width: 540rpx;
  margin-top: 12rpx;
  color: var(--ink);
  font-size: 35rpx;
  font-weight: 820;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.homework-notice-more {
  margin-top: 16rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.homework-notice-actions {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1.45fr;
  gap: 16rpx;
  margin-top: 32rpx;
}

.homework-notice-actions button {
  min-height: 112rpx;
  margin: 0;
  border-radius: 16rpx;
  font-size: 27rpx;
  font-weight: 760;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.homework-notice-actions button::after {
  border: 0;
}

.homework-notice-actions button:active {
  transform: scale(.98);
  opacity: .86;
}

.homework-notice-later {
  border: 1rpx solid #C9D6E6;
  background: rgba(255, 255, 255, .84);
  color: var(--text-secondary);
}

.homework-notice-open {
  background: var(--primary-strong);
  color: #FFFFFF;
  box-shadow: 0 12rpx 26rpx rgba(49, 94, 168, .18);
}

@keyframes notice-mask-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes notice-card-enter {
  from {
    opacity: 0;
    transform: translateY(44rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 340px) {
  .homework-notice-card {
    padding-right: 30rpx;
    padding-left: 34rpx;
  }

  .homework-notice-title {
    font-size: 32rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .homework-notice-mask,
  .homework-notice-card,
  .homework-notice-actions button {
    animation: none !important;
    transition: none !important;
  }

  .homework-notice-actions button:active {
    transform: none;
  }
}
</style>
