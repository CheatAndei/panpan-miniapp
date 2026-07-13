<template>
  <view class="homework-brief">
    <view class="brief-rail"></view>
    <view class="brief-main">
      <view class="brief-head">
        <view class="brief-icon"><pp-icon name="clipboard" :size="38" /></view>
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
  min-height: 190rpx;
  margin: 22rpx 24rpx;
  overflow: hidden;
  border: 1rpx solid #E8DFC8;
  border-radius: 24rpx;
  background: linear-gradient(145deg, #FFFDF7 0%, #FFF9EA 100%);
  box-shadow: 0 12rpx 30rpx rgba(102, 80, 30, .07);
}
.brief-rail { width: 10rpx; flex-shrink: 0; background: linear-gradient(180deg, #E5B85B, #C98C32); }
.brief-main { flex: 1; min-width: 0; padding: 26rpx 28rpx 24rpx; }
.brief-head { display: flex; align-items: center; min-height: 64rpx; }
.brief-icon { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 19rpx; background: #EAF3EF; }
.brief-heading { flex: 1; min-width: 0; margin-left: 16rpx; }
.brief-kicker { display: block; color: #9A6A22; font-size: 20rpx; font-weight: 650; letter-spacing: 2rpx; }
.brief-title { display: block; margin-top: 1rpx; color: #2A3935; font-size: 30rpx; font-weight: 760; }
.brief-date { margin-left: 14rpx; padding: 7rpx 12rpx; flex-shrink: 0; border-radius: 10rpx; background: rgba(229, 184, 91, .15); color: #8C652A; font-size: 21rpx; }
.brief-rule { height: 1rpx; margin: 18rpx 0 15rpx; background: repeating-linear-gradient(90deg, #DCCBA5 0, #DCCBA5 10rpx, transparent 10rpx, transparent 20rpx); }
.brief-content { display: block; color: #3F4D49; font-size: 28rpx; font-weight: 520; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.brief-empty-title { display: block; color: #5F6B67; font-size: 26rpx; font-weight: 620; line-height: 1.6; }
.brief-empty-copy { display: block; margin-top: 3rpx; color: #929C98; font-size: 22rpx; line-height: 1.6; }
.brief-class { display: block; margin-top: 14rpx; color: #9A7A43; font-size: 21rpx; }
</style>
