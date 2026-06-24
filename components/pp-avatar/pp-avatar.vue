<template>
  <view class="pp-avatar" :style="avatarStyle">
    <text class="pp-avatar__initial" :style="textStyle">{{ initial }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue';

// 品牌安全配色（蓝 / 琥珀浅 / 绿 / 天蓝 / 暖 / 中性灰），不含粉紫，符合 PRODUCT.md。
const PALETTE = ['#EBF0F7', '#FEF5E7', '#F0FFF4', '#EBF8FF', '#FFF7E6', '#EDF2F7'];

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: [Number, String], default: 96 } // rpx
});

const initial = computed(() => {
  const n = (props.name || '').trim();
  if (!n) return '学';
  return /[a-zA-Z]/.test(n[0]) ? n[0].toUpperCase() : n[0];
});

// 按名字哈希取色，保证同一学生颜色稳定。
const bg = computed(() => {
  const n = (props.name || '').trim() || '学';
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
});

const px = computed(() => (typeof props.size === 'number' ? props.size : parseInt(props.size) || 96));
const avatarStyle = computed(() => ({ width: px.value + 'rpx', height: px.value + 'rpx', background: bg.value }));
const textStyle = computed(() => ({ fontSize: Math.round(px.value * 0.42) + 'rpx' }));
</script>

<style scoped>
.pp-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(26,54,93,.12), inset 0 0 0 2rpx rgba(255,255,255,.55);
}
.pp-avatar__initial {
  font-weight: 700;
  color: #1A365D;
  line-height: 1;
}
</style>
