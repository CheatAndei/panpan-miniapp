<template>
  <view :class="['pp-state', `pp-state--${type}`]">
    <view class="pp-state__mark">
      <view v-if="type === 'loading'" class="pp-state__spinner"></view>
      <pp-icon v-else :name="iconName" :size="52" />
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

const iconName = computed(() => props.type === 'error' ? 'bell' : 'book');
</script>

<style scoped>
.pp-state { padding: 58rpx 34rpx; display: flex; flex-direction: column; align-items: center; text-align: center; }
.pp-state__mark { width: 92rpx; height: 92rpx; border-radius: 28rpx; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; margin-bottom: 22rpx; }
.pp-state--error .pp-state__mark { background: var(--danger-soft); }
.pp-state__title { color: var(--ink); font-size: 29rpx; font-weight: 700; }
.pp-state__description { max-width: 480rpx; margin-top: 8rpx; color: var(--text-muted); font-size: 25rpx; line-height: 1.65; }
.pp-state__action { min-width: 220rpx; min-height: 76rpx; margin-top: 24rpx; padding: 14rpx 28rpx; border: 1rpx solid #BFD2CC; border-radius: 14rpx; background: #FFFFFF; color: var(--primary); font-size: 26rpx; font-weight: 650; }
.pp-state__spinner { width: 42rpx; height: 42rpx; border: 4rpx solid rgba(47, 125, 107, .16); border-top-color: var(--accent); border-radius: 50%; animation: pp-state-spin .75s linear infinite; }
@keyframes pp-state-spin { to { transform: rotate(360deg); } }
</style>
