<template>
  <view class="homework-notice-mask" role="dialog" aria-modal="true" aria-label="作业批改完成提醒">
    <view class="homework-notice-card">
      <view class="notice-tab"><text>作业反馈</text></view>
      <view class="homework-notice-mark">
        <pp-icon name="check" :size="38" motion="pop" label="批改完成" :decorative="false" />
      </view>
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
  background: rgba(5, 5, 5, .38);
  animation: notice-mask-enter var(--motion-base) ease-out both;
}

.homework-notice-card {
  position: relative;
  width: 100%;
  max-width: 680rpx;
  max-height: calc(100vh - 120rpx);
  padding: 58rpx 34rpx 30rpx;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1rpx solid #D9E5F3;
  border-radius: 16rpx;
  background-color: #F7FCFE;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 53rpx,
    rgba(153, 222, 244, .075) 54rpx,
    rgba(153, 222, 244, .075) 55rpx
  );
  box-shadow: 0 24rpx 64rpx rgba(5, 5, 5, .18);
  animation: notice-card-enter 280ms var(--ease-out) both;
}

.homework-notice-card::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 28rpx;
  width: 2rpx;
  background: rgba(247, 155, 192, .42);
}

.notice-tab {
  position: absolute;
  top: 0;
  right: 30rpx;
  padding: 10rpx 18rpx 12rpx;
  border-radius: 0 0 10rpx 10rpx;
  background: #0B789A;
  color: #FFFFFF;
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.homework-notice-mark {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #C7DDE4;
  border-radius: 14rpx;
  background: #E5F8FE;
  color: #050505;
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
  color: #050505;
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.homework-notice-title {
  max-width: 540rpx;
  margin-top: 12rpx;
  color: #050505;
  font-size: 35rpx;
  font-weight: 820;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.homework-notice-more {
  margin-top: 16rpx;
  color: #50545B;
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
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 12rpx;
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
  border: 1rpx solid #C7DDE4;
  background: #FFFFFF;
  color: #050505;
}

.homework-notice-open {
  background: #050505;
  color: #FFFFFF;
  box-shadow: 0 10rpx 22rpx rgba(5, 5, 5, .2);
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
