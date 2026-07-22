<template>
  <view class="reader" :class="{'reader-zoom':mode==='zoom'}">
    <view class="reader-toolbar">
      <view>
        <text class="reader-label">题图阅读</text>
        <text class="reader-hint">{{ mode==='zoom' ? '可左右滑动，点击图片还能双指缩放' : '完整显示题目，点击可放大' }}</text>
      </view>
      <view class="reader-modes" role="tablist" aria-label="题图显示方式">
        <button :class="['reader-mode',{active:mode==='fit'}]" @tap.stop="setMode('fit')">适应屏幕</button>
        <button :class="['reader-mode',{active:mode==='zoom'}]" @tap.stop="setMode('zoom')">放大阅读</button>
      </view>
    </view>

    <view v-if="loading" class="reader-state reader-loading">
      <view class="reader-skeleton"></view>
      <text>正在读取题图</text>
    </view>
    <view v-else-if="error || !src" class="reader-state reader-error">
      <text class="reader-error-title">题图暂时无法显示</text>
      <text class="reader-error-copy">请检查网络后重试；仍有问题可使用题目报错。</text>
      <button class="reader-retry" @tap.stop="$emit('retry')">重新读取</button>
    </view>
    <scroll-view v-else class="reader-scroll" scroll-x :show-scrollbar="false" :enhanced="true">
      <image
        :class="['reader-image',mode]"
        :src="src"
        mode="widthFix"
        :aria-label="alt"
        @tap="preview"
        @error="$emit('image-error',$event)"
      />
    </scroll-view>
    <text v-if="!loading && !error && src" class="reader-preview-tip" @tap="preview">点击题图进入大图，支持双指缩放</text>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const props=defineProps({
  src:{type:String,default:''},
  loading:{type:Boolean,default:false},
  error:{type:Boolean,default:false},
  alt:{type:String,default:'数学题目图片'},
  storageKey:{type:String,default:'panpan_question_reader_mode'},
});
defineEmits(['retry','image-error']);

const saved=String(uni.getStorageSync(props.storageKey)||'');
const mode=ref(saved==='zoom'?'zoom':'fit');

function setMode(next){
  if(next!=='fit'&&next!=='zoom')return;
  mode.value=next;
  uni.setStorageSync(props.storageKey,next);
}
function preview(){
  if(props.src)uni.previewImage({urls:[props.src],current:props.src});
}
</script>

<style scoped>
.reader{margin-top:20rpx;padding:16rpx;border:1rpx solid #D8E5E1;border-radius:18rpx;background:#F7FAF8;overflow:hidden}.reader-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-bottom:14rpx}.reader-label,.reader-hint{display:block}.reader-label{color:#183A36;font-size:23rpx;font-weight:760}.reader-hint{max-width:340rpx;margin-top:3rpx;color:#71817C;font-size:18rpx;line-height:1.4}.reader-modes{display:flex;flex:none;padding:4rpx;border-radius:11rpx;background:#E7EFEC}.reader-mode{min-height:52rpx;margin:0;padding:0 12rpx;border-radius:8rpx;background:transparent;color:#647671;font-size:19rpx;font-weight:650;line-height:52rpx}.reader-mode::after,.reader-retry::after{border:0}.reader-mode.active{background:#fff;color:#1E6557;box-shadow:0 3rpx 9rpx rgba(24,58,54,.08)}.reader-mode:active,.reader-retry:active{transform:scale(.97)}.reader-scroll{width:100%;border-radius:13rpx;background:#fff;white-space:nowrap}.reader-image{display:block;min-height:150rpx;border-radius:12rpx;background:#fff;transition:width .2s ease}.reader-image.fit{width:100%}.reader-image.zoom{width:165%;max-width:none}.reader-state{min-height:250rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:13rpx;background:#fff;color:#71817C;font-size:21rpx}.reader-skeleton{width:86%;height:145rpx;margin-bottom:16rpx;border-radius:12rpx;background:linear-gradient(100deg,#EDF3F1 20%,#F8FBFA 40%,#EDF3F1 60%);background-size:200% 100%;animation:reader-shimmer 1.2s linear infinite}.reader-error{padding:26rpx;text-align:center;background:#FFF9F6}.reader-error-title{color:#8D4942;font-size:24rpx;font-weight:740}.reader-error-copy{max-width:480rpx;margin-top:6rpx;color:#8B6B67;font-size:20rpx;line-height:1.5}.reader-retry{min-height:58rpx;margin:16rpx 0 0;padding:0 22rpx;border:1rpx solid #D8B8B3;border-radius:10rpx;background:#fff;color:#8D4942;font-size:21rpx;line-height:58rpx}.reader-preview-tip{display:block;padding:13rpx 4rpx 2rpx;color:#46766B;font-size:19rpx;text-align:center}.reader-preview-tip:active{opacity:.65}@keyframes reader-shimmer{to{background-position:-200% 0}}@media(max-width:360px){.reader-toolbar{align-items:flex-start;flex-direction:column}.reader-modes{width:100%}.reader-mode{flex:1}.reader-hint{max-width:none}}
</style>
