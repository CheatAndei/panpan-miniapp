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
  margin: 16rpx 0 0;
  overflow: hidden;
  border: 1rpx solid var(--border);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}
.brief-rail { width: 7rpx; flex-shrink: 0; background: var(--primary); }
.brief-main { flex: 1; min-width: 0; padding: 18rpx 21rpx 17rpx; }
.brief-head { display: flex; align-items: center; min-height: 58rpx; }
.brief-icon { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1rpx solid #D1DFF0; border-radius: 12rpx; background: var(--primary-soft); color: var(--primary-strong); }
.brief-heading { flex: 1; min-width: 0; margin-left: 14rpx; }
.brief-kicker { display: block; color: var(--primary-strong); font-size: 18rpx; font-weight: 700; letter-spacing: 0; }
.brief-title { display: block; margin-top: 1rpx; color: var(--ink); font-size: 28rpx; font-weight: 760; }
.brief-date { margin-left: 12rpx; padding: 6rpx 10rpx; flex-shrink: 0; border-radius: 8rpx; background: var(--primary-soft); color: var(--primary-strong); font-size: 19rpx; }
.brief-rule { height: 1rpx; margin: 14rpx 0 11rpx; background: repeating-linear-gradient(90deg, var(--primary) 0, var(--primary) 12rpx, transparent 12rpx, transparent 23rpx); opacity: .72; }
.brief-content { display: block; color: var(--ink); font-size: 26rpx; font-weight: 540; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.brief-empty-title { display: block; color: var(--text-secondary); font-size: 25rpx; font-weight: 620; line-height: 1.6; }
.brief-empty-copy { display: block; margin-top: 3rpx; color: var(--text-muted); font-size: 21rpx; line-height: 1.6; }
.brief-class { display: block; margin-top: 11rpx; color: var(--primary-strong); font-size: 20rpx; }
</style>
