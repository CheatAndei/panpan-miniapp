<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">请假</view>
    <text class="hero-title">请假申请</text>
    <view class="gold-rule"></view>
  </view>

  <view class="card">
    <view class="field">
      <text class="label">学生</text>
      <text class="value">{{ childName }}</text>
    </view>
    <view class="field">
      <text class="label">请假日期</text>
      <picker mode="date" :value="form.date" @change="e=>form.date=e.detail.value">
        <view class="picker">{{ form.date || '选择日期' }}</view>
      </picker>
    </view>
    <view class="field">
      <text class="label">请假原因</text>
      <textarea v-model="form.reason" class="textarea" placeholder="请填写请假原因" :maxlength="200" />
    </view>
    <button class="btn-primary" @tap="submit" :disabled="!form.reason">提交申请</button>
  </view>

  <!-- 请假记录 -->
  <view class="card" v-if="leaves.length>0">
    <text class="section-title">请假记录</text>
    <view v-for="l in leaves" :key="l.id" class="leave-item">
      <view class="l-hd">
        <text class="l-date">{{ l.class_date }}</text>
        <text :class="['l-status',l.status]">{{ statusMap[l.status] }}</text>
      </view>
      <text class="l-reason">{{ l.reason }}</text>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { toastSuccess, toastError, logError } from '@/utils/ui';
export default {
  data(){return{
    childId:null,childName:'',hasPending:false,form:{date:new Date().toISOString().slice(0,10),reason:''},
    leaves:[],statusMap:{pending:'待审批',approved:'已批准',rejected:'已拒绝'}
  };},
  onLoad(opt){this.childId=opt.child_id;this.loadData();},
  methods:{
    async loadData(){
      try{
        let stu;
        if(this.childId){
          stu=await api.get('/students/'+this.childId);
          this.childName=stu.student?.name||'';
        }else{
          const r=await api.get('/bind/student');
          stu=r;this.childName=r.student?.name||'';
        }
        const lv=await api.get('/leaves');
        this.leaves=(lv.leaves||[]).filter(l=>!this.childId||l.student_id===parseInt(this.childId));
        this.hasPending=this.leaves.some(l=>l.status==='pending');
      }catch(e){logError('parentLeave.loadData',e);}
    },
    async submit(){
      if(this.hasPending) return uni.showToast({title:'有待审批的请假',icon:'none'});
      try{
        const sid=this.childId||(await api.get('/bind/student')).student?.id;
        await api.post('/leaves',{student_id:sid,class_date:this.form.date,reason:this.form.reason});
        toastSuccess('已提交');
        this.form.reason='';this.hasPending=true;this.loadData();
      }catch(e){toastError(e,'提交失败');}
    }
  }
};
</script>

<style scoped>
.page{padding-bottom:60rpx}
.hero{padding:40rpx 32rpx 30rpx;background:var(--card);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero .gold-rule{margin:14rpx 0}
.hero-title{font-size:38rpx;font-weight:700;color:var(--ink)}
.field{margin-bottom:24rpx}
.label{font-size:28rpx;color:#4A5568;display:block;margin-bottom:8rpx}
.value{font-size:30rpx;color:#1A365D;font-weight:600}
.picker{background:#F7F8FA;border-radius:10rpx;padding:20rpx;font-size:28rpx}
.textarea{border:1rpx solid #E2E8F0;border-radius:10rpx;padding:18rpx;font-size:28rpx;width:100%;min-height:150rpx;box-sizing:border-box}
.btn-primary{background:#1A365D;color:#fff;border-radius:12rpx;padding:24rpx;font-size:30rpx;border:none;width:100%;margin-top:12rpx;font-weight:600}
.btn-primary[disabled]{opacity:.4}
.section-title{font-size:28rpx;font-weight:700;color:#1A365D;margin-bottom:16rpx}
.fb-header{margin-bottom:16rpx}
.fb-hint{font-size:24rpx;color:#A0AEC0}
.leave-item{padding:16rpx 0;border-bottom:1rpx solid #F0F0F0}
.leave-item:last-child{border-bottom:none}
.l-hd{display:flex;justify-content:space-between;align-items:center}
.l-date{font-size:26rpx;color:#4A5568}
.l-status{font-size:24rpx;padding:4rpx 12rpx;border-radius:6rpx}
.l-status.pending{background:#FFFFF0;color:#975A16}
.l-status.approved{background:#F0FFF4;color:#276749}
.l-status.rejected{background:#FFF5F5;color:#C53030}
.l-reason{font-size:28rpx;color:#4A5568;margin-top:8rpx}
.btn-outline{border:1px solid #1A365D;color:#1A365D;background:#fff;border-radius:10rpx;padding:20rpx;font-size:28rpx;width:100%;margin-top:12rpx;font-weight:600}
.btn-outline[disabled]{opacity:.4}
</style>
