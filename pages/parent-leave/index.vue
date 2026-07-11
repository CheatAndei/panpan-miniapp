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
.page{padding-bottom:calc(60rpx + env(safe-area-inset-bottom))}
.hero{padding:46rpx 34rpx 36rpx;background:linear-gradient(150deg,#F9FCFB,#EEF6F3);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero-title{display:block;margin-top:8rpx;font-size:40rpx;font-weight:760;color:var(--ink)}
.hero-sub{display:block;margin-top:4rpx;color:var(--text-muted);font-size:24rpx}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border)}
.form-card{padding:32rpx}
.field{margin-bottom:24rpx}
.label{font-size:26rpx;color:var(--text-secondary);display:block;margin-bottom:10rpx;font-weight:650}
.value{font-size:30rpx;color:var(--ink);font-weight:680}
.picker{min-height:88rpx;display:flex;align-items:center;background:#FAFCFB;border:1rpx solid #D5E3DE;border-radius:14rpx;padding:0 22rpx;font-size:29rpx}
.textarea{min-height:170rpx}
.count-hint{display:block;margin-top:8rpx;text-align:right;color:var(--faint);font-size:22rpx}
.pending-hint{margin:4rpx 0 16rpx;padding:16rpx 18rpx;border-radius:13rpx;background:var(--warning-soft);color:var(--warning);font-size:24rpx}
.btn-primary{width:100%;margin-top:12rpx}
.btn-primary[disabled]{opacity:.4}
.section-title{font-size:28rpx;font-weight:700;color:#183A36;margin-bottom:16rpx}
.fb-header{margin-bottom:16rpx}
.fb-hint{font-size:24rpx;color:#7C8C87}
.leave-item{padding:16rpx 0;border-bottom:1rpx solid #E5EEEB}
.leave-item:last-child{border-bottom:none}
.l-hd{display:flex;justify-content:space-between;align-items:center}
.l-date{font-size:26rpx;color:#536762}
.l-status{font-size:23rpx;padding:4rpx 12rpx;border-radius:9rpx;font-weight:650}
.l-status.pending{background:#F4F2E8;color:#3F7167}
.l-status.approved{background:#E8F4F0;color:#2F735F}
.l-status.rejected{background:#FCEEEB;color:#A94F48}
.l-reason{font-size:28rpx;color:#536762;margin-top:8rpx}
.btn-outline{border:1px solid #183A36;color:#183A36;background:#fff;border-radius:10rpx;padding:20rpx;font-size:28rpx;width:100%;margin-top:12rpx;font-weight:600}
.btn-outline[disabled]{opacity:.4}
</style>
