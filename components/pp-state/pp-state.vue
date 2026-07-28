<template>
  <view
    :class="['pp-state', `pp-state--${normalizedType}`]"
    :role="normalizedType === 'error' ? 'alert' : 'status'"
    :aria-live="normalizedType === 'error' ? 'assertive' : 'polite'"
  >
    <view class="pp-state__accent" aria-hidden="true"></view>
    <view class="pp-state__mark" aria-hidden="true">
      <view v-if="normalizedType === 'loading'" class="pp-state__spinner"></view>
      <pp-icon v-else :name="iconName" :size="52" decorative />
    </view>
    <text class="pp-state__title">{{ title }}</text>
    <text v-if="description" class="pp-state__description">{{ description }}</text>
    <button v-if="actionText" class="pp-state__action" @tap="$emit('action')">{{ actionText }}</button>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  type: { type: String, default: 'empty' },
  title: { type: String, default: '暂无内容' },
  description: { type: String, default: '' },
  actionText: { type: String, default: '' }
});

defineEmits(['action']);

const STATE_TYPES = Object.freeze(['empty', 'loading', 'error', 'success']);
const normalizedType = computed(() => STATE_TYPES.includes(props.type) ? props.type : 'empty');
const iconName = computed(() => ({
  empty: 'book',
  error: 'report',
  success: 'check'
})[normalizedType.value] || 'book');
</script>

<style scoped>
.pp-state {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-height: 300rpx;
  overflow: hidden;
  padding: 54rpx 34rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1rpx solid var(--border, #DDE7F2);
  border-radius: 22rpx;
  background: var(--surface, #FFFFFF);
  box-shadow: 0 8rpx 24rpx rgba(49, 94, 168, .06);
  text-align: center;
}

.pp-state__accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 7rpx;
  background: var(--primary, #527CC9);
}

.pp-state__mark {
  width: 94rpx;
  height: 94rpx;
  margin-bottom: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #D4E3FA;
  border-radius: 24rpx;
  background: var(--primary-soft, #EAF2FF);
}

.pp-state__title {
  color: var(--ink, #24324A);
  font-size: 29rpx;
  font-weight: 720;
  line-height: 1.45;
}

.pp-state__description {
  max-width: 500rpx;
  margin-top: 9rpx;
  color: var(--text-secondary, #5C6C84);
  font-size: 25rpx;
  line-height: 1.65;
}

.pp-state__action {
  min-width: 232rpx;
  min-height: 112rpx;
  margin-top: 26rpx;
  padding: 14rpx 32rpx;
  border: 1rpx solid var(--primary-strong, #315EA8);
  border-radius: 14rpx;
  background: var(--primary-strong, #315EA8);
  color: #FFFFFF;
  font-size: 26rpx;
  font-weight: 680;
  line-height: 1.4;
  transition: transform 120ms ease, opacity 120ms ease;
}

.pp-state__action::after {
  border: 0;
}

.pp-state__action:active {
  opacity: .88;
  transform: scale(.975);
}

.pp-state__action:focus-visible {
  outline: 4rpx solid rgba(82, 124, 201, .28);
  outline-offset: 3rpx;
}

.pp-state__spinner {
  width: 42rpx;
  height: 42rpx;
  border: 4rpx solid rgba(82, 124, 201, .18);
  border-top-color: var(--primary-strong, #315EA8);
  border-radius: 50%;
  animation: pp-state-spin .75s linear infinite;
}

.pp-state--loading {
  background: #F8FBFF;
}

.pp-state--loading .pp-state__accent {
  background: var(--primary-strong, #315EA8);
}

.pp-state--error {
  border-color: #F1D4CF;
  background: #FFFAF9;
}

.pp-state--error .pp-state__accent {
  background: var(--coral, #E98577);
}

.pp-state--error .pp-state__mark {
  border-color: #F3D1CB;
  background: var(--coral-soft, #FFF0ED);
}

.pp-state--error .pp-state__action {
  border-color: #B95D52;
  background: #B95D52;
}

.pp-state--success {
  border-color: #CFEAE3;
  background: #F8FCFB;
}

.pp-state--success .pp-state__accent {
  background: var(--accent, #65BFA8);
}

.pp-state--success .pp-state__mark {
  border-color: #CBEADF;
  background: var(--accent-soft, #E9F8F3);
}

@keyframes pp-state-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pp-state__action {
    transition: none;
  }

  .pp-state__action:active {
    transform: none;
  }

  .pp-state__spinner {
    animation: none;
  }
}
</style>
