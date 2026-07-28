<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">请假</view>
    <view class="hero-title-row">
      <view class="title-icon tone-green"><pp-icon name="calendar" :size="34" motion="pop" /></view>
      <text class="hero-title">请假申请</text>
    </view>
    <text class="hero-sub">提前告诉老师，安排更从容</text>
  </view>

  <view v-if="loading && !childName" class="state-card"><pp-state type="loading" title="正在读取请假信息" /></view>
  <view v-else class="card form-card">
    <view class="field">
      <view class="label"><pp-icon name="user" :size="24" /><text>学生</text></view>
      <text class="value">{{ childName }}</text>
    </view>
    <view class="field">
      <view class="label"><pp-icon name="calendar" :size="24" /><text>请假日期</text></view>
      <picker mode="date" :value="form.date" @change="e=>form.date=e.detail.value">
        <view class="picker">{{ form.date || '选择日期' }}</view>
      </picker>
    </view>
    <view class="field">
      <view class="label"><pp-icon name="message" :size="24" /><text>请假原因</text></view>
      <textarea v-model="form.reason" class="textarea" placeholder="例如：身体不适，需要休息一天" :maxlength="200" />
      <text class="count-hint num">{{ form.reason.length }}/200</text>
    </view>
    <view v-if="hasPending" class="pending-hint"><pp-icon name="bell" :size="24" motion="ring" /><text>已有一条请假等待老师审批</text></view>
    <button class="btn-primary" @tap="submit" :disabled="!form.reason.trim() || submitting || hasPending"><pp-icon name="check" :size="28" /><text>{{ submitting ? '提交中...' : '提交申请' }}</text></button>
  </view>

  <!-- 请假记录 -->
  <view class="card" v-if="leaves.length>0">
    <view class="section-title"><pp-icon name="history" :size="28" /><text>请假记录</text></view>
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
.page {
  --panpan-green: #20B486;
  --panpan-green-strong: #15946D;
  --panpan-sprout: #20B486;
  --panpan-coral: #FF7468;
  --panpan-leaf: #15946D;
  --panpan-paper: #F8FCF9;
  --panpan-ink: #26352F;
  --panpan-muted: #5A6A62;
  min-height: 100vh;
  padding-bottom: calc(54rpx + env(safe-area-inset-bottom));
  background: var(--panpan-paper);
}

.hero {
  padding: 38rpx 32rpx 30rpx;
  border-bottom: 1rpx solid #D4E9DC;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(32, 180, 134, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 72%, #E7F8F1 100%);
  animation: leave-enter var(--motion-slow) var(--ease-out) both;
}

.hero .eyebrow { display: inline-flex; padding: 5rpx 12rpx; border-radius: 7rpx; background: #E7F8F1; color: #15946D; font-size: 20rpx; font-weight: 720; letter-spacing: 0; }
.hero-title-row { display: flex; align-items: center; gap: 12rpx; margin-top: 9rpx; }
.title-icon { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; }
.title-icon.tone-green { background: #E7F8F1; }
.hero-title { color: var(--panpan-ink); font-size: 40rpx; font-weight: 770; }
.hero-title-row::after { content: ''; width: 52rpx; height: 6rpx; flex: none; border-radius: 3rpx; background: var(--panpan-coral); }
.hero-sub { display: block; margin-top: 9rpx; color: var(--panpan-muted); font-size: 23rpx; }
.state-card { margin: 20rpx 24rpx; border: 1rpx solid #D4E9DC; border-radius: 14rpx; background: #FFFFFF; box-shadow: 0 8rpx 20rpx rgba(36, 48, 41, .06); }
.card { margin: 18rpx 24rpx 0; border: 1rpx solid #CFE6D8; border-radius: 16rpx; background: #FFFFFF; box-shadow: 0 9rpx 22rpx rgba(36, 48, 41, .06); }
.form-card { padding: 27rpx; border-top: 6rpx solid var(--panpan-green); animation: leave-card-enter var(--motion-slow) var(--ease-out) both; }
.field { margin-bottom: 21rpx; }
.label { display: flex; align-items: center; gap: 7rpx; margin-bottom: 8rpx; color: #5A6A62; font-size: 25rpx; font-weight: 680; }
.value { color: var(--panpan-ink); font-size: 29rpx; font-weight: 700; }

.picker {
  min-height: 84rpx;
  display: flex;
  align-items: center;
  padding: 0 18rpx;
  border: 1rpx solid #CFE6D8;
  border-radius: 10rpx;
  background: #F8FCF9;
  color: var(--panpan-ink);
  font-size: 28rpx;
  transition: border-color var(--motion-base) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}

.picker:active { border-color: var(--panpan-green); background: #E7F8F1; }
.textarea { min-height: 158rpx; padding: 16rpx 18rpx; border: 1rpx solid #CFE6D8; border-radius: 10rpx; background: #F8FCF9; color: var(--panpan-ink); }
.count-hint { display: block; margin-top: 7rpx; color: #5A6A62; font-size: 21rpx; text-align: right; }
.pending-hint { display: flex; align-items: center; gap: 8rpx; margin: 3rpx 0 15rpx; padding: 14rpx 16rpx; border-left: 5rpx solid var(--panpan-coral); border-radius: 8rpx; background: #FFF2F0; color: #D94B45; font-size: 23rpx; }
.btn-primary { width: 100%; min-height: 88rpx; display: flex; align-items: center; justify-content: center; gap: 9rpx; margin: 10rpx 0 0; border-radius: 12rpx; background: var(--panpan-green-strong); color: #FFFFFF; font-size: 27rpx; font-weight: 720; box-shadow: 0 9rpx 18rpx rgba(21, 148, 109, .2); }
.btn-primary::after { border: 0; }
.btn-primary[disabled] { background: #BBDCCF; opacity: .7; box-shadow: none; }
.section-title { display: flex; align-items: center; gap: 9rpx; margin-bottom: 14rpx; color: var(--panpan-ink); font-size: 28rpx; font-weight: 730; }
.fb-header { margin-bottom: 16rpx; }
.fb-hint { color: var(--panpan-muted); font-size: 23rpx; }
.leave-item { padding: 16rpx 0; border-bottom: 1rpx solid #E0EEE5; }
.leave-item:last-child { border-bottom: none; }
.l-hd { display: flex; align-items: center; justify-content: space-between; }
.l-date { color: #5A6A62; font-size: 25rpx; font-variant-numeric: tabular-nums; }
.l-status { padding: 4rpx 11rpx; border-radius: 8rpx; font-size: 22rpx; font-weight: 680; }
.l-status.pending { background: #E7F8F1; color: #15946D; }
.l-status.approved { background: #E7F8F1; color: var(--panpan-green-strong); }
.l-status.rejected { background: #FFF0EE; color: #D94B45; }
.l-reason { display: block; margin-top: 7rpx; color: #5A6A62; font-size: 27rpx; line-height: 1.58; }

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
