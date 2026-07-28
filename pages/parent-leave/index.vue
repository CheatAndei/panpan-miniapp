<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">请假</view>
    <text class="hero-title">请假申请</text>
    <text class="hero-sub">提前告诉老师，安排更从容</text>
  </view>

  <view v-if="loading && !childName" class="state-card"><pp-state type="loading" title="正在读取请假信息" /></view>
  <view v-else class="card form-card">
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
      <textarea v-model="form.reason" class="textarea" placeholder="例如：身体不适，需要休息一天" :maxlength="200" />
      <text class="count-hint num">{{ form.reason.length }}/200</text>
    </view>
    <view v-if="hasPending" class="pending-hint">已有一条请假等待老师审批</view>
    <button class="btn-primary" @tap="submit" :disabled="!form.reason.trim() || submitting || hasPending">{{ submitting ? '提交中...' : '提交申请' }}</button>
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

function localDateString(){
  const date=new Date();
  const pad=(n)=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

export default {
  data(){return{
    childId:null,childName:'',hasPending:false,form:{date:localDateString(),reason:''},
    leaves:[],loading:false,submitting:false,statusMap:{pending:'待审批',approved:'已批准',rejected:'已拒绝'}
  };},
  onLoad(opt){this.childId=opt.child_id;this.loadData();},
  methods:{
    async loadData(){
      this.loading=true;
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
      finally{this.loading=false;}
    },
    async submit(){
      if(this.hasPending) return uni.showToast({title:'有待审批的请假',icon:'none'});
      if(this.submitting||!this.form.reason.trim())return;
      this.submitting=true;
      try{
        const sid=this.childId||(await api.get('/bind/student')).student?.id;
        await api.post('/leaves',{student_id:sid,class_date:this.form.date,reason:this.form.reason.trim()});
        toastSuccess('已提交');
        this.form.reason='';this.hasPending=true;await this.loadData();
      }catch(e){toastError(e,'提交失败');}
      finally{this.submitting=false;}
    }
  }
};
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: calc(60rpx + env(safe-area-inset-bottom)); background: var(--page-bg); }

.hero {
  position: relative;
  overflow: hidden;
  padding: 46rpx 34rpx 36rpx;
  border-bottom: 1rpx solid var(--hairline);
  background:
    linear-gradient(rgba(82, 124, 201, .045) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(82, 124, 201, .045) 1rpx, transparent 1rpx),
    linear-gradient(150deg, #FFFFFF, var(--primary-soft));
  background-size: 40rpx 40rpx, 40rpx 40rpx, auto;
  animation: leave-enter var(--motion-slow) var(--ease-out) both;
}

.hero::after {
  content: '';
  position: absolute;
  right: 36rpx;
  top: 36rpx;
  width: 56rpx;
  height: 56rpx;
  border-radius: 17rpx;
  background: var(--warning-soft);
  box-shadow: inset 0 0 0 7rpx rgba(244, 199, 91, .42);
}

.hero .eyebrow { color: var(--primary-strong); }
.hero-title { display: block; margin-top: 8rpx; color: var(--ink); font-size: 40rpx; font-weight: 760; }
.hero-sub { display: block; margin-top: 4rpx; color: var(--text-muted); font-size: 24rpx; }
.state-card { margin: 22rpx 24rpx; border: 1rpx solid var(--border); border-radius: var(--r); background: var(--surface); box-shadow: var(--shadow-sm); }
.form-card { padding: 32rpx; animation: leave-card-enter var(--motion-slow) var(--ease-out) both; }
.field { margin-bottom: 24rpx; }
.label { display: block; margin-bottom: 10rpx; color: var(--text-secondary); font-size: 26rpx; font-weight: 650; }
.value { color: var(--ink); font-size: 30rpx; font-weight: 680; }

.picker {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 22rpx;
  border: 1rpx solid #D6E2F1;
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  color: var(--ink);
  font-size: 29rpx;
  transition: border-color var(--motion-base) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}

.picker:active { border-color: var(--primary); background: var(--primary-soft); }
.textarea { min-height: 170rpx; }
.count-hint { display: block; margin-top: 8rpx; color: var(--faint); font-size: 22rpx; text-align: right; }
.pending-hint { margin: 4rpx 0 16rpx; padding: 16rpx 18rpx; border-left: 5rpx solid var(--gold); border-radius: var(--r-xs); background: var(--warning-soft); color: var(--warning); font-size: 24rpx; }
.btn-primary { width: 100%; min-height: 96rpx; margin-top: 12rpx; }
.btn-primary[disabled] { opacity: .4; }
.section-title { display: block; margin-bottom: 16rpx; color: var(--ink); font-size: 28rpx; font-weight: 720; }
.fb-header { margin-bottom: 16rpx; }
.fb-hint { color: var(--text-muted); font-size: 24rpx; }
.leave-item { padding: 18rpx 0; border-bottom: 1rpx solid var(--hairline); }
.leave-item:last-child { border-bottom: none; }
.l-hd { display: flex; align-items: center; justify-content: space-between; }
.l-date { color: var(--text-secondary); font-size: 26rpx; font-variant-numeric: tabular-nums; }
.l-status { padding: 4rpx 12rpx; border-radius: var(--r-xs); font-size: 23rpx; font-weight: 650; }
.l-status.pending { background: var(--warning-soft); color: var(--warning); }
.l-status.approved { background: var(--success-soft); color: var(--success); }
.l-status.rejected { background: var(--danger-soft); color: var(--danger); }
.l-reason { display: block; margin-top: 8rpx; color: var(--text-secondary); font-size: 28rpx; line-height: 1.6; }

@keyframes leave-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes leave-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .form-card { animation: none; }
  .picker { transition: none; }
}
</style>
