<template>
  <image class="pp-icon" :src="`/static/icons/${name}.svg`" :style="iconStyle" mode="aspectFit" />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 44 }
});

const iconStyle = computed(() => {
  const size = typeof props.size === 'number' ? props.size : parseInt(props.size, 10) || 44;
  return { width: `${size}rpx`, height: `${size}rpx` };
});
</script>

<style scoped>
.pp-icon { display: block; flex-shrink: 0; }
</style>
