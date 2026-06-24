<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">审批</view>
    <text class="hero-title">请假审批</text>
    <view class="gold-rule"></view>
  </view>

  <view class="tabs">
    <text :class="['tab',{on:filter==='pending'}]" @tap="filter='pending'">待审批 ({{ pending.length }})</text>
    <text :class="['tab',{on:filter==='all'}]" @tap="filter='all'">全部</text>
  </view>

  <view v-if="loading" class="loading">加载中…</view>
  <view v-else-if="filtered.length===0" class="card"><view class="empty">暂无请假</view></view>

  <view v-for="l in filtered" :key="l.id" class="card leave-card">
    <view class="l-top">
      <text class="l-name">{{ l.student_name }}</text>
      <text :class="['l-tag',l.status]">{{ statusMap[l.status] }}</text>
    </view>
    <text class="l-date">{{ l.class_date }}</text>
    <text class="l-reason">{{ l.reason }}</text>
    <view v-if="l.reply" class="l-reply">回复：{{ l.reply }}</view>

    <view v-if="l.status==='pending'" class="l-actions">
      <button class="btn-approve" @tap="handle(l.id,'approved')">批准</button>
      <button class="btn-reject" @tap="handle(l.id,'rejected')">拒绝</button>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { toastSuccess, toastError, logError } from '@/utils/ui';
export default {
  data(){return{
    leaves:[],filter:'pending',loading:false,
    statusMap:{pending:'待审批',approved:'已批准',rejected:'已拒绝'}
  };},
  computed:{
    pending(){return this.leaves.filter(l=>l.status==='pending');},
    filtered(){return this.filter==='pending'?this.pending:this.leaves;}
  },
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      this.loading=true;
      try{
        const data=await api.get('/leaves');
        this.leaves=data.leaves||[];
      }catch(e){logError('teacherLeaves.loadData',e);}
      finally{this.loading=false;}
    },
    async handle(id,status){
      try{
        await api.put('/leaves/'+id,{status,reply:status==='approved'?'收到，好好休息':'好的'});
        toastSuccess(status==='approved'?'已批准':'已拒绝');
        this.loadData();
      }catch(e){toastError(e,'操作失败');}
    }
  }
};
</script>

<style scoped>
.page{padding-bottom:80rpx}
.hero{padding:40rpx 32rpx 30rpx;background:var(--card);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero .gold-rule{margin:14rpx 0}
.hero-title{font-size:38rpx;font-weight:700;color:var(--ink)}
.tabs{display:flex;padding:16rpx 30rpx;background:#fff;gap:32rpx;border-bottom:1rpx solid #ECE8E0}
.tab{font-size:28rpx;color:#8A929B;padding-bottom:8rpx}
.tab.on{color:#202733;font-weight:700;border-bottom:3rpx solid #202733}
.leave-card{margin-bottom:8rpx}
.l-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8rpx}
.l-name{font-size:30rpx;font-weight:700;color:#202733}
.l-tag{font-size:24rpx;padding:4rpx 14rpx;border-radius:6rpx}
.l-tag.pending{background:#F7F2E5;color:#7B5B36}
.l-tag.approved{background:#EEF5EF;color:#3F7A5B}
.l-tag.rejected{background:#F7EDEA;color:#9F4E43}
.l-date{font-size:24rpx;color:#8A929B;margin-bottom:8rpx}
.l-reason{font-size:28rpx;color:#46515C;line-height:1.6}
.l-reply{font-size:24rpx;color:#A57945;margin-top:8rpx;background:#F7F1E7;padding:10rpx 14rpx;border-radius:8rpx}
.l-actions{display:flex;gap:16rpx;margin-top:16rpx}
.btn-approve{flex:1;background:#3F8B65;color:#fff;border:none;border-radius:10rpx;padding:18rpx;font-size:28rpx;font-weight:600}
.btn-reject{flex:1;background:#B85C4E;color:#fff;border:none;border-radius:10rpx;padding:18rpx;font-size:28rpx;font-weight:600}
.empty{text-align:center;color:#C3C1BA;padding:40rpx;font-size:28rpx}
</style>
