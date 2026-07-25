<template>
  <view class="page-shell">
    <view class="page-hero">
      <text class="eyebrow">家校沟通</text>
      <text class="hero-title">反馈记录</text>
      <text class="hero-desc">你提出的问题和老师回复都会留在这里。</text>
    </view>
    <pp-state v-if="loading" type="loading" title="正在读取反馈记录" />
    <pp-state v-else-if="!feedbacks.length" title="暂无反馈记录" description="在首页“反馈建议”中可以直接告诉老师。" />
    <view v-else class="timeline">
      <view v-for="item in feedbacks" :key="item.id" class="record-card">
        <view class="record-top">
          <text :class="['status',item.status]">{{ statusText(item.status) }}</text>
          <text class="date">{{ formatDate(item.created_at) }}</text>
        </view>
        <text class="label">我的反馈</text>
        <text class="content">{{ item.content }}</text>
        <view v-if="item.reply" class="reply">
          <text class="reply-label">老师回复</text>
          <text class="reply-content">{{ item.reply }}</text>
        </view>
        <text v-else class="waiting">老师查看后会在这里回复</text>
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
.page-shell{padding-bottom:calc(50rpx + env(safe-area-inset-bottom))}
.page-hero{padding:48rpx 34rpx 38rpx}.hero-title{display:block;margin-top:9rpx;color:var(--ink);font-size:43rpx;font-weight:790}
.hero-desc{display:block;margin-top:9rpx;color:var(--text-muted);font-size:25rpx}
.timeline{padding:20rpx 24rpx}.record-card{margin-bottom:18rpx;padding:26rpx;border:1rpx solid var(--border);border-radius:22rpx;background:#fff;box-shadow:var(--shadow-sm)}
.record-top{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.status{padding:5rpx 13rpx;border-radius:9rpx;background:var(--warning-soft);color:var(--warning);font-size:21rpx;font-weight:700}
.status.approved{background:var(--accent-soft);color:var(--accent-strong)}.status.rejected{background:var(--surface-muted);color:var(--text-muted)}
.date{color:var(--faint);font-size:21rpx}.label{display:block;margin-top:18rpx;color:var(--text-muted);font-size:22rpx;font-weight:650}
.content{display:block;margin-top:6rpx;color:var(--ink);font-size:28rpx;line-height:1.7}.reply{margin-top:20rpx;padding:18rpx;border-radius:15rpx;background:var(--accent-soft)}
.reply-label{display:block;color:var(--accent-strong);font-size:22rpx;font-weight:750}.reply-content{display:block;margin-top:7rpx;color:#315A52;font-size:26rpx;line-height:1.65}
.waiting{display:block;margin-top:17rpx;color:var(--faint);font-size:22rpx}
</style>
