<template>
  <view :class="['mastery-broadcast',{ leaving }]" role="status" aria-live="polite" @tap="beginExit">
    <text class="broadcast-badge">全服捷报</text>
    <view class="broadcast-window">
      <text class="broadcast-message">{{ broadcast.message }}</text>
    </view>
  </view>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  broadcast: { type: Object, required: true },
});
const emit = defineEmits(['complete']);

const leaving = ref(false);
let exitTimer = null;
let completeTimer = null;
let finished = false;

function clearTimers() {
  if (exitTimer) clearTimeout(exitTimer);
  if (completeTimer) clearTimeout(completeTimer);
  exitTimer = null;
  completeTimer = null;
}

function finish() {
  if (finished) return;
  finished = true;
  clearTimers();
  emit('complete', props.broadcast);
}

function beginExit() {
  if (finished || leaving.value) return;
  leaving.value = true;
  completeTimer = setTimeout(finish, 220);
}

function start() {
  clearTimers();
  finished = false;
  leaving.value = false;
  exitTimer = setTimeout(beginExit, 4400);
}

watch(() => props.broadcast?.id, start, { immediate: true });
onBeforeUnmount(clearTimers);
</script>

<style scoped>
.mastery-broadcast {
  position: fixed;
  z-index: 80;
  top: calc(18rpx + env(safe-area-inset-top));
  left: 18rpx;
  right: 18rpx;
  display: flex;
  align-items: center;
  height: 78rpx;
  overflow: hidden;
  border: 3rpx solid #f6c445;
  background: #080808;
  box-shadow: 8rpx 8rpx 0 rgba(246, 196, 69, .34);
  color: #fff8e8;
  transition: opacity 220ms ease-out, transform 220ms ease-out;
}
.mastery-broadcast.leaving {
  opacity: 0;
  transform: translateY(-8rpx);
}
.broadcast-badge {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  align-self: stretch;
  flex: none;
  padding: 0 20rpx;
  background: #f6c445;
  color: #080808;
  font-size: 21rpx;
  font-weight: 950;
  letter-spacing: 2rpx;
}
.broadcast-window { flex: 1; min-width: 0; overflow: hidden; }
.broadcast-message {
  display: inline-block;
  min-width: max-content;
  padding-left: 100%;
  color: #fff8e8;
  font-size: 24rpx;
  font-weight: 850;
  white-space: nowrap;
  animation: mastery-marquee 4.4s linear both;
  will-change: transform;
}
@keyframes mastery-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}
@media (prefers-reduced-motion: reduce) {
  .mastery-broadcast { transition-duration: 120ms; }
  .mastery-broadcast.leaving { transform: none; }
  .broadcast-message {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 0 16rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    animation: none;
  }
}
</style>
