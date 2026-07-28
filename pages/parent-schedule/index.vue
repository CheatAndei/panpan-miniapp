<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">课程</view>
    <text class="hero-title">学习小组详情</text>
    <text class="hero-sub num">{{ weekendRange }}</text>
  </view>

  <!-- 时间轴 -->
  <view v-if="loading && schedules.length===0" class="state-card"><pp-state type="loading" title="正在整理课程安排" /></view>
  <view v-else-if="error && schedules.length===0" class="state-card"><pp-state type="error" title="课表加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>
  <view class="timeline" v-else-if="schedules.length>0">
    <view v-for="day in days" :key="day.value" class="day-section">
      <view class="day-header">
        <text class="day-label">{{ day.label }}</text>
      </view>

      <view v-if="day.scheds.length===0" class="day-empty">无学习安排</view>

      <view v-for="s in day.scheds" :key="s.id" class="class-block" :class="{mine:isMyClass(s.class_id)}">
        <template v-if="isMyClass(s.class_id)">
          <view class="block-inner mine-inner" @tap="openClass(s)">
            <view class="block-badge">我的学习小组</view>
            <text class="block-name">{{ s.class_name }}</text>
            <text v-if="s.class_date" class="block-date">{{ formatDate(s.class_date) }}</text>
            <text class="block-time">{{ s.start_time }} - {{ s.end_time }}</text>
            <text v-if="s.location" class="block-loc">{{ s.location }}</text>
            <text class="block-arrow">查看详情 ›</text>
          </view>
        </template>
        <template v-else>
          <view class="block-inner other-block">
            <text class="block-name">其他学习小组</text>
            <text v-if="s.class_date" class="block-date">{{ formatDate(s.class_date) }}</text>
            <text class="block-time">{{ s.start_time }} - {{ s.end_time }}</text>
            <text v-if="s.location" class="block-loc">{{ s.location }}</text>
            <text class="block-note">仅显示老师的时间安排</text>
          </view>
        </template>
      </view>
    </view>
  </view>

  <view v-else class="state-card"><pp-state title="本周暂无学习安排" description="老师发布课程后会显示在这里。" /></view>

  <!-- 学习小组详情弹窗 -->
  <view v-if="showDetail" class="modal-mask" @tap="showDetail=false">
    <view class="modal" @tap.stop>
      <view class="m-header">
        <text class="m-title">{{ detailClass?.class_name }}</text>
        <text class="m-close" @tap="showDetail=false">关闭</text>
      </view>

      <scroll-view scroll-y class="m-body">
        <!-- 本讲作业 -->
        <text class="m-section">本讲作业</text>
        <view v-if="latestHomework" class="hw-card">{{ latestHomework }}</view>
        <view v-else class="m-empty">暂无作业</view>

        <!-- 反馈列表 -->
        <text class="m-section">学习小组总反馈</text>
        <view v-if="feedbacks.length===0" class="m-empty">暂无反馈</view>
        <view v-for="fb in feedbacks" :key="fb.id" class="fb-card" @tap="openFb(fb)">
          <text class="fb-date">{{ fb.class_date }}</text>
          <text class="fb-preview">{{ (fb.summary||'').slice(0,80) }}{{ fb.summary&&fb.summary.length>80?'...':'' }}</text>
        </view>

        <!-- 学生 -->
        <text class="m-section">学习小组同学</text>
        <view v-if="students.length===0" class="m-empty">暂无数据</view>
        <view v-for="s in students" :key="s.id" class="stu-row" @tap="showStuFb(s)">
          <text class="stu-name">{{ s.name }}</text>
          <text class="stu-arrow">{{ isMyStudent(s.id) ? '查看反馈' : '同组同学' }}</text>
        </view>
      </scroll-view>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
const DAYS = ['周日','周一','周二','周三','周四','周五','周六'];
const ALL = [{label:'周日',value:0},{label:'周一',value:1},{label:'周二',value:2},{label:'周三',value:3},{label:'周四',value:4},{label:'周五',value:5},{label:'周六',value:6}];

export default {
  data(){return{
    schedules:[],myClassIds:[],myStudentIds:[],days:[],loading:false,error:'',
    showDetail:false,detailClass:null,feedbacks:[],students:[],latestHomework:''
  };},
  computed:{
    weekendRange(){
      const now=new Date();
      const mondayOffset=(now.getDay()+6)%7;
      const monday=new Date(now);monday.setDate(now.getDate()-mondayOffset);
      const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);
      return `${monday.getMonth()+1}/${monday.getDate()} - ${sunday.getMonth()+1}/${sunday.getDate()}`;
    },
  },
  onShow(){this.loadData();},
  methods:{
    isMyClass(cid){return this.myClassIds.some(id=>String(id)===String(cid));},
    isMyStudent(id){return this.myStudentIds.includes(Number(id));},
    async loadData(){
      const t=uni.getStorageSync('token');if(!t)return;
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const kids=await api.get('/bind/students');
        const list=kids.students||[];
        const activeId=String(uni.getStorageSync('activeChildId')||'');
        const child=(activeId?list.find(k=>String(k.id)===activeId):null)||list[0]||null;
        const sch=await api.get('/schedules/parent'+(child?.id?'?student_id='+child.id:''));
        this.schedules=sch.schedules||[];
        this.myClassIds=sch.myClassIds||[];
        this.myStudentIds=list.map(s=>Number(s.id));
        this.days=ALL.map(d=>({
          ...d,scheds:this.schedules.filter(s=>s.day_of_week===d.value)
            .sort((a,b)=>String(a.class_date||'9999-99-99').localeCompare(String(b.class_date||'9999-99-99')) || String(a.start_time||'').localeCompare(String(b.start_time||'')))
        }));
      }catch(e){this.error=e?.error||'请检查网络后重试';logError('parentSchedule.loadData',e);}
      finally{this.loading=false;}
    },
    async openClass(s){
      this.detailClass=s;this.showDetail=true;this.feedbacks=[];this.students=[];
      this.latestHomework='';
      try{
        const [fb,st]=await Promise.all([
          api.get('/feedbacks/list?class_id='+s.class_id),
          api.get('/students?class_id='+s.class_id)
        ]);
        this.feedbacks=fb.feedbacks||[];
        this.students=st.students||[];
        // 提取最新作业
        const last=this.feedbacks.find(f=>f.homework);
        if(last)this.latestHomework=last.homework;
      }catch(e){logError('parentSchedule.openClass',e);}
    },
    showStuFb(s){
      if(!this.isMyStudent(s.id))return;
      const last=this.feedbacks[0];
      if(!last||!last.student_feedbacks)return uni.showToast({title:'暂无该同学反馈',icon:'none'});
      try{
        const list=JSON.parse(last.student_feedbacks);
        const f=list.find(x=>String(x.id)===String(s.id));
        if(f)uni.showModal({title:s.name+'的反馈',content:f.text||'暂无',showCancel:false});
        else uni.showToast({title:'暂无该同学反馈',icon:'none'});
      }catch(e){uni.showToast({title:'暂无',icon:'none'});}
    },
    openFb(){this.showDetail=false;uni.navigateTo({url:'/pages/parent-feedback/index'});},
    formatDate(date){
      const d=new Date(date+'T00:00:00+08:00');
      return `${d.getMonth()+1}/${d.getDate()} ${DAYS[d.getDay()]}`;
    },
    lvClass(lv){const m={好:'lv-good',中上:'lv-above',中:'lv-mid',中下:'lv-below',下:'lv-low'};return m[lv]||'';}
  }
};
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: calc(80rpx + env(safe-area-inset-bottom)); background: var(--page-bg); }

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
  text-align: left;
  animation: schedule-enter var(--motion-slow) var(--ease-out) both;
}

.hero::after {
  content: '';
  position: absolute;
  right: 34rpx;
  top: 36rpx;
  width: 54rpx;
  height: 54rpx;
  border: 8rpx solid rgba(244, 199, 91, .54);
  border-radius: 16rpx;
  transform: rotate(8deg);
}

.hero .eyebrow { color: var(--primary-strong); }
.hero-title { display: block; margin-top: 8rpx; color: var(--ink); font-size: 40rpx; font-weight: 760; }
.hero-sub { display: block; margin-top: 6rpx; color: var(--text-muted); font-size: 24rpx; }
.state-card { margin: 22rpx 24rpx; border: 1rpx solid var(--border); border-radius: var(--r); background: var(--surface); box-shadow: var(--shadow-sm); }

.timeline { padding: 18rpx 24rpx; }
.day-section { margin-bottom: 28rpx; }
.day-header { display: flex; align-items: center; margin-bottom: 12rpx; }
.day-label { color: var(--ink); font-size: 30rpx; font-weight: 720; }
.day-label::before { content: ''; display: inline-block; width: 8rpx; height: 28rpx; margin-right: 12rpx; border-radius: 6rpx; background: var(--gold); vertical-align: -3rpx; }
.day-empty { padding: 16rpx 20rpx; border-radius: var(--r-xs); background: var(--surface-muted); color: var(--text-muted); font-size: 25rpx; }

.class-block { margin-bottom: 16rpx; animation: schedule-card-enter var(--motion-slow) var(--ease-out) both; }
.block-inner { position: relative; overflow: hidden; padding: 28rpx; border-radius: var(--r); }
.mine-inner {
  border: 1rpx solid #C9DAF0;
  border-left: 8rpx solid var(--primary);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  transition: transform var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
}

.mine-inner:active { transform: scale(var(--tap-scale)); box-shadow: none; }
.block-badge { display: inline-block; margin-bottom: 12rpx; padding: 5rpx 12rpx; border-radius: var(--r-xs); background: var(--primary-soft); color: var(--primary-strong); font-size: 20rpx; font-weight: 680; }
.block-name { display: block; margin-bottom: 8rpx; color: var(--ink); font-size: 32rpx; font-weight: 720; }
.block-time { display: block; color: var(--text-secondary); font-size: 26rpx; font-variant-numeric: tabular-nums; }
.block-date { display: block; margin-bottom: 4rpx; color: var(--primary-strong); font-size: 24rpx; font-weight: 650; }
.block-loc { margin-top: 4rpx; color: var(--text-muted); font-size: 24rpx; }
.block-arrow { display: block; margin-top: 16rpx; color: var(--primary-strong); font-size: 24rpx; font-weight: 650; text-align: right; }

.other-block { padding: 24rpx; border: 1rpx solid var(--hairline); background: var(--surface-muted); }
.other-block .block-name { display: block; margin-bottom: 6rpx; color: var(--text-secondary); font-size: 28rpx; font-weight: 600; }
.other-block .block-time,
.other-block .block-loc { color: var(--text-muted); font-size: 24rpx; }
.other-block .block-loc { margin-top: 4rpx; }
.block-note { display: block; margin-top: 8rpx; color: var(--faint); font-size: 22rpx; }

.modal-mask { position: fixed; inset: 0; z-index: 99; display: flex; align-items: flex-end; background: rgba(36, 50, 74, .44); animation: schedule-mask-in var(--motion-base) ease-out both; }
.modal { width: 100%; max-height: 80vh; display: flex; flex-direction: column; padding: 0; border-radius: 30rpx 30rpx 0 0; background: var(--surface); box-shadow: var(--shadow-lg); animation: schedule-sheet-in var(--motion-slow) var(--ease-out) both; }
.m-header { display: flex; align-items: center; justify-content: space-between; padding: 30rpx; border-bottom: 1rpx solid var(--hairline); }
.m-title { color: var(--ink); font-size: 34rpx; font-weight: 720; }
.m-close { min-height: 64rpx; display: flex; align-items: center; color: var(--primary-strong); font-size: 26rpx; font-weight: 650; }
.m-body { flex: 1; overflow-y: auto; padding: 30rpx; }
.m-section { display: block; margin: 24rpx 0 16rpx; color: var(--ink); font-size: 28rpx; font-weight: 720; }
.m-section:first-child { margin-top: 0; }
.m-empty { padding: 30rpx; color: var(--text-muted); font-size: 26rpx; text-align: center; }
.fb-card { margin-bottom: 12rpx; padding: 20rpx; border: 1rpx solid var(--hairline); border-radius: var(--r-sm); background: var(--surface-muted); transition: transform var(--motion-fast) var(--ease-out); }
.fb-card:active,
.stu-row:active { transform: scale(var(--tap-scale)); }
.fb-date { color: var(--text-muted); font-size: 24rpx; }
.fb-preview { display: block; margin: 8rpx 0; color: var(--text-secondary); font-size: 26rpx; line-height: 1.6; }
.fb-hw { color: var(--warning); font-size: 24rpx; }
.stu-row { min-height: 76rpx; display: flex; align-items: center; justify-content: space-between; gap: 18rpx; padding: 14rpx 0; border-bottom: 1rpx solid var(--hairline); transition: transform var(--motion-fast) var(--ease-out); }
.stu-name { color: var(--ink); font-size: 28rpx; font-weight: 650; }
.stu-lv { margin-left: 12rpx; padding: 3rpx 10rpx; border-radius: var(--r-xs); font-size: 20rpx; }
.stu-arrow { color: var(--primary-strong); font-size: 24rpx; }
.hw-card { padding: 20rpx; border-radius: var(--r-sm); background: var(--warning-soft); color: var(--warning); font-size: 28rpx; line-height: 1.6; }
.lv-good { background: var(--success-soft); color: var(--success); }
.lv-above { background: var(--primary-soft); color: var(--primary-strong); }
.lv-mid { background: var(--warning-soft); color: var(--warning); }
.lv-below,
.lv-low { background: var(--danger-soft); color: var(--danger); }
.empty { padding: 40rpx; color: var(--text-muted); text-align: center; }

@keyframes schedule-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes schedule-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes schedule-mask-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes schedule-sheet-in {
  from { opacity: .4; transform: translateY(34rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .class-block,
  .modal-mask,
  .modal { animation: none; }
  .mine-inner,
  .fb-card,
  .stu-row { transition: none; }
}
</style>
