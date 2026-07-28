<template>
  <view class="page-shell">
    <view class="page-hero">
      <text class="eyebrow">家校沟通</text>
      <view class="hero-title-row">
        <view class="title-icon tone-coral"><pp-icon name="message" :size="34" motion="pop" /></view>
        <text class="hero-title">反馈记录</text>
      </view>
      <text class="hero-desc">你提出的问题和老师回复都会留在这里。</text>
    </view>
    <pp-state v-if="loading" type="loading" title="正在读取反馈记录" />
    <pp-state v-else-if="!feedbacks.length" title="暂无反馈记录" description="在首页“反馈建议”中可以直接告诉老师。" />
    <view v-else class="timeline">
      <view v-for="item in feedbacks" :key="item.id" class="record-card">
        <view class="record-top">
          <view :class="['status',item.status]"><pp-icon :name="item.status==='approved'?'check':'message'" :size="22" /><text>{{ statusText(item.status) }}</text></view>
          <view class="date"><pp-icon name="calendar" :size="22" /><text>{{ formatDate(item.created_at) }}</text></view>
        </view>
        <view class="label"><pp-icon name="user" :size="22" /><text>我的反馈</text></view>
        <text class="content">{{ item.content }}</text>
        <view v-if="item.reply" class="reply">
          <view class="reply-label"><pp-icon name="message" :size="24" /><text>老师回复</text></view>
          <text class="reply-content">{{ item.reply }}</text>
        </view>
        <view v-else class="waiting"><pp-icon name="bell" :size="24" /><text>老师查看后会在这里回复</text></view>
      </view>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api';
import { toastError } from '@/utils/ui';

export default {
  data(){return{studentId:0,feedbacks:[],loading:false};},
  onLoad(options){this.studentId=Number(options.student_id||uni.getStorageSync('activeChildId'));},
  onShow(){this.loadData();},
  async onPullDownRefresh(){try{await this.loadData();}finally{uni.stopPullDownRefresh();}},
  methods:{
    statusText(status){return status==='approved'?'老师已回复':status==='rejected'?'已处理':'等待回复';},
    formatDate(value){return String(value||'').replace('T',' ').slice(0,16);},
    async loadData(){
      if(!this.studentId)return;
      this.loading=true;
      try{
        const data=await api.get('/leaves/feedback/history?student_id='+this.studentId+'&limit=50');
        this.feedbacks=data.feedbacks||[];
      }catch(error){toastError(error,'反馈记录加载失败');}
      finally{this.loading=false;}
    }
  }
};
</script>

<style scoped>
.page-shell {
  --panpan-green: #20B486;
  --panpan-green-strong: #15946D;
  --panpan-sprout: #20B486;
  --panpan-coral: #FF7468;
  --panpan-leaf: #15946D;
  --panpan-paper: #F8FCF9;
  --panpan-ink: #26352F;
  --panpan-muted: #5A6A62;
  min-height: 100vh;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  background: var(--panpan-paper);
}
.page-hero {
  padding: 38rpx 32rpx 30rpx;
  border-bottom: 1rpx solid #D4E9DC;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(32, 180, 134, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 74%, #E7F8F1 100%);
  animation: opinions-enter var(--motion-slow) var(--ease-out) both;
}
.eyebrow { display: inline-flex; padding: 5rpx 12rpx; border-radius: 7rpx; background: #E7F8F1; color: var(--panpan-green-strong); font-size: 20rpx; font-weight: 720; letter-spacing: 0; }
.hero-title-row { display: flex; align-items: center; gap: 12rpx; margin-top: 9rpx; }
.title-icon { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; }
.title-icon.tone-coral { background: #FFF0EE; }
.hero-title { color: var(--panpan-ink); font-size: 40rpx; font-weight: 790; }
.hero-title-row::after { content: ''; width: 52rpx; height: 6rpx; flex: none; border-radius: 3rpx; background: var(--panpan-sprout); }
.hero-desc { display: block; max-width: 590rpx; margin-top: 10rpx; color: var(--panpan-muted); font-size: 24rpx; line-height: 1.58; }
.timeline { padding: 18rpx 24rpx; }

.record-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 14rpx;
  padding: 23rpx 24rpx;
  border: 1rpx solid #CFE6D8;
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 20rpx rgba(36, 48, 41, .06);
  animation: opinion-card-enter var(--motion-slow) var(--ease-out) both;
}

.record-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6rpx;
  background: var(--panpan-green);
}

.record-top { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.status { display: flex; align-items: center; gap: 5rpx; padding: 5rpx 12rpx; border-radius: 8rpx; background: #E7F8F1; color: #15946D; font-size: 21rpx; font-weight: 700; }
.status.approved { background: #E7F8F1; color: var(--panpan-green-strong); }
.status.rejected { background: #FFF0EE; color: #D94B45; }
.date { display: flex; align-items: center; gap: 5rpx; color: #5A6A62; font-size: 21rpx; font-variant-numeric: tabular-nums; }
.label { display: flex; align-items: center; gap: 5rpx; margin-top: 16rpx; color: var(--panpan-muted); font-size: 21rpx; font-weight: 650; }
.content { display: block; margin-top: 5rpx; color: var(--panpan-ink); font-size: 27rpx; line-height: 1.68; }
.reply { margin-top: 17rpx; padding: 16rpx; border: 1rpx solid rgba(32, 180, 134, .22); border-left: 5rpx solid var(--panpan-leaf); border-radius: 10rpx; background: #E7F8F1; }
.reply-label { display: flex; align-items: center; gap: 6rpx; color: #15946D; font-size: 21rpx; font-weight: 750; }
.reply-content { display: block; margin-top: 6rpx; color: #5A6A62; font-size: 25rpx; line-height: 1.62; }
.waiting { display: flex; align-items: center; gap: 7rpx; margin-top: 15rpx; padding: 11rpx 13rpx; border-left: 5rpx solid var(--panpan-coral); border-radius: 8rpx; background: #FFF2F0; color: #D94B45; font-size: 21rpx; }

@keyframes opinions-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes opinion-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .page-hero,
  .record-card { animation: none; }
}
</style>
