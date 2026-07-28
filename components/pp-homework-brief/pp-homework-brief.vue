<template>
  <view class="homework-brief">
    <view class="brief-rail"></view>
    <view class="brief-main">
      <view class="brief-head">
        <view class="brief-icon"><pp-icon name="clipboard" :size="38" motion="breathe" /></view>
        <view class="brief-heading">
          <text class="brief-kicker">专属清单</text>
          <text class="brief-title">今日课后任务</text>
        </view>
        <text class="brief-date">{{ date || '待更新' }}</text>
      </view>
      <view class="brief-rule"></view>
      <text v-if="content" class="brief-content">{{ content }}</text>
      <view v-else class="brief-empty">
        <text class="brief-empty-title">老师还没有布置本讲作业</text>
        <text class="brief-empty-copy">有新任务时会在这里单独显示</text>
      </view>
      <text v-if="className" class="brief-class">{{ className }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  content: { type: String, default: '' },
  date: { type: String, default: '' },
  className: { type: String, default: '' }
});
</script>

<style scoped>
.homework-brief {
  position: relative;
  display: flex;
  margin: 22rpx 24rpx;
  overflow: hidden;
  border: 1rpx solid #DDE7F2;
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: 0 5rpx 16rpx rgba(36, 50, 74, .055);
}
.brief-rail { width: 10rpx; flex-shrink: 0; background: #527CC9; }
.brief-main { flex: 1; min-width: 0; padding: 22rpx 24rpx 20rpx; }
.brief-head { display: flex; align-items: center; min-height: 64rpx; }
.brief-icon { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 12rpx; background: #EAF2FF; color: #315EA8; }
.brief-heading { flex: 1; min-width: 0; margin-left: 16rpx; }
.brief-kicker { display: block; color: #315EA8; font-size: 20rpx; font-weight: 680; letter-spacing: 0; }
.brief-title { display: block; margin-top: 1rpx; color: #24324A; font-size: 30rpx; font-weight: 760; }
.brief-date { margin-left: 14rpx; padding: 7rpx 12rpx; flex-shrink: 0; border-radius: 8rpx; background: #EAF2FF; color: #315EA8; font-size: 21rpx; }
.brief-rule { height: 2rpx; margin: 16rpx 0 13rpx; background: repeating-linear-gradient(90deg, #527CC9 0, #527CC9 12rpx, transparent 12rpx, transparent 23rpx); }
.brief-content { display: block; color: #24324A; font-size: 28rpx; font-weight: 520; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.brief-empty-title { display: block; color: #5C6C84; font-size: 26rpx; font-weight: 620; line-height: 1.6; }
.brief-empty-copy { display: block; margin-top: 3rpx; color: #5C6C84; font-size: 22rpx; line-height: 1.6; }
.brief-class { display: block; margin-top: 14rpx; color: #315EA8; font-size: 21rpx; }
</style>
