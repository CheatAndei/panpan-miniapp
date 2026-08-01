<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">课程</view>
    <view class="hero-title-row">
      <view class="title-icon tone-green"><pp-icon name="calendar" :size="34" motion="pop" /></view>
      <text class="hero-title">学习小组详情</text>
    </view>
    <view class="hero-sub num"><pp-icon name="calendar" :size="24" /><text>{{ weekendRange }}</text></view>
  </view>

  <!-- 时间轴 -->
  <view v-if="loading && schedules.length===0" class="state-card"><pp-state type="loading" title="正在整理课程安排" /></view>
  <view v-else-if="error && schedules.length===0" class="state-card"><pp-state type="error" title="课表加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>
  <view class="timeline" v-else-if="schedules.length>0">
    <view v-for="day in days" :key="day.value" class="day-section">
      <view class="day-header">
        <view class="day-label"><pp-icon name="calendar" :size="26" /><text>{{ day.label }}</text></view>
      </view>

      <view v-if="day.scheds.length===0" class="day-empty">无学习安排</view>

      <view v-for="s in day.scheds" :key="s.id" class="class-block" :class="{mine:isMyClass(s.class_id)}">
        <template v-if="isMyClass(s.class_id)">
          <view class="block-inner mine-inner" @tap="openClass(s)">
            <view class="block-badge"><pp-icon name="users" :size="22" /><text>我的学习小组</text></view>
            <view class="block-name"><pp-icon name="book" :size="28" /><text>{{ s.class_name }}</text></view>
            <text v-if="s.class_date" class="block-date">{{ formatDate(s.class_date) }}</text>
            <text class="block-time">{{ s.start_time }} - {{ s.end_time }}</text>
            <view v-if="s.location" class="block-loc"><pp-icon name="home" :size="22" /><text>{{ s.location }}</text></view>
            <view class="block-arrow"><text>查看详情</text><pp-icon name="arrow" :size="24" /></view>
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
        <view class="m-section"><pp-icon name="pencil" :size="26" /><text>本讲作业</text></view>
        <view v-if="latestHomework" class="hw-card"><pp-icon name="pencil" :size="24" /><text>{{ latestHomework }}</text></view>
        <view v-else class="m-empty">暂无作业</view>

        <!-- 反馈列表 -->
        <view class="m-section"><pp-icon name="message" :size="26" /><text>学习小组总反馈</text></view>
        <view v-if="feedbacks.length===0" class="m-empty">暂无反馈</view>
        <view v-for="fb in feedbacks" :key="fb.id" class="fb-card" @tap="openFb(fb)">
          <text class="fb-date">{{ fb.class_date }}</text>
          <text class="fb-preview">{{ (fb.summary||'').slice(0,80) }}{{ fb.summary&&fb.summary.length>80?'...':'' }}</text>
        </view>

        <!-- 学生 -->
        <view class="m-section"><pp-icon name="users" :size="26" /><text>学习小组同学</text></view>
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
.page {
  --panpan-green: #0B789A;
  --panpan-green-strong: #050505;
  --panpan-sprout: #0B789A;
  --panpan-coral: #F79BC0;
  --panpan-leaf: #050505;
  --panpan-paper: #F7FCFE;
  --panpan-ink: #050505;
  --panpan-muted: #50545B;
  min-height: 100vh;
  padding-bottom: calc(66rpx + env(safe-area-inset-bottom));
  background: var(--panpan-paper);
}

.hero {
  padding: 38rpx 32rpx 30rpx;
  border-bottom: 1rpx solid #DCE9ED;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(153, 222, 244, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 72%, #E5F8FE 100%);
  text-align: left;
  animation: schedule-enter var(--motion-slow) var(--ease-out) both;
}

.hero .eyebrow { display: inline-flex; padding: 5rpx 12rpx; border-radius: 7rpx; background: #E5F8FE; color: var(--panpan-green-strong); font-size: 20rpx; font-weight: 720; letter-spacing: 0; }
.hero-title-row { display: flex; align-items: center; gap: 12rpx; margin-top: 9rpx; }
.title-icon { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; }
.title-icon.tone-green { background: #E5F8FE; }
.hero-title { color: var(--panpan-ink); font-size: 40rpx; font-weight: 770; }
.hero-title-row::after { content: ''; width: 52rpx; height: 6rpx; flex: none; border-radius: 3rpx; background: var(--panpan-sprout); }
.hero-sub { display: flex; align-items: center; gap: 7rpx; margin-top: 9rpx; color: #050505; font-size: 23rpx; font-weight: 650; }
.state-card { margin: 20rpx 24rpx; border: 1rpx solid #DCE9ED; border-radius: 14rpx; background: #FFFFFF; box-shadow: 0 8rpx 20rpx rgba(5, 5, 5, .06); }

.timeline { padding: 18rpx 24rpx; }
.day-section { margin-bottom: 24rpx; }
.day-header { display: flex; align-items: center; margin-bottom: 10rpx; }
.day-label { display: flex; align-items: center; gap: 8rpx; color: var(--panpan-ink); font-size: 29rpx; font-weight: 730; }
.day-empty { padding: 14rpx 18rpx; border: 1rpx dashed #D9E5F3; border-radius: 9rpx; background: #F7FCFE; color: var(--panpan-muted); font-size: 24rpx; }

.class-block { margin-bottom: 13rpx; animation: schedule-card-enter var(--motion-slow) var(--ease-out) both; }
.block-inner { position: relative; overflow: hidden; padding: 23rpx 24rpx; border-radius: 14rpx; }
.mine-inner {
  border: 1rpx solid #D9E5F3;
  border-left: 7rpx solid var(--panpan-green);
  background: #FFFFFF;
  color: var(--panpan-ink);
  box-shadow: 0 8rpx 20rpx rgba(5, 5, 5, .06);
  transition: transform var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
}

.mine-inner:active { transform: scale(var(--tap-scale)); box-shadow: none; }
.block-badge { display: inline-flex; align-items: center; gap: 5rpx; margin-bottom: 10rpx; padding: 5rpx 11rpx; border-radius: 7rpx; background: #E5F8FE; color: var(--panpan-green-strong); font-size: 20rpx; font-weight: 700; }
.block-name { display: flex; align-items: center; gap: 8rpx; margin-bottom: 7rpx; color: var(--panpan-ink); font-size: 31rpx; font-weight: 730; }
.block-time { display: block; color: #50545B; font-size: 25rpx; font-variant-numeric: tabular-nums; }
.block-date { display: block; margin-bottom: 4rpx; color: #050505; font-size: 23rpx; font-weight: 680; }
.block-loc { display: flex; align-items: center; gap: 6rpx; margin-top: 4rpx; color: var(--panpan-muted); font-size: 23rpx; }
.block-arrow { display: flex; align-items: center; justify-content: flex-end; gap: 4rpx; margin-top: 13rpx; color: var(--panpan-green-strong); font-size: 23rpx; font-weight: 680; }

.other-block { padding: 21rpx 22rpx; border: 1rpx dashed #DCE9ED; background: #F7FCFE; }
.other-block .block-name { display: block; margin-bottom: 6rpx; color: #50545B; font-size: 27rpx; font-weight: 620; }
.other-block .block-time,
.other-block .block-loc { color: var(--panpan-muted); font-size: 23rpx; }
.other-block .block-loc { margin-top: 4rpx; }
.block-note { display: block; margin-top: 7rpx; color: #50545B; font-size: 21rpx; }

.modal-mask { position: fixed; inset: 0; z-index: 99; display: flex; align-items: flex-end; background: rgba(5, 5, 5, .42); animation: schedule-mask-in var(--motion-base) ease-out both; }
.modal { width: 100%; max-height: 80vh; display: flex; flex-direction: column; padding: 0; border-radius: 16rpx 16rpx 0 0; background: #FFFFFF; box-shadow: 0 -12rpx 30rpx rgba(5, 5, 5, .1); animation: schedule-sheet-in var(--motion-slow) var(--ease-out) both; }
.m-header { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 26rpx; border-bottom: 1rpx solid #EDF3F5; }
.m-title { color: var(--panpan-ink); font-size: 32rpx; font-weight: 730; }
.m-close { min-height: 58rpx; display: flex; align-items: center; color: var(--panpan-green-strong); font-size: 24rpx; font-weight: 680; }
.m-body { flex: 1; overflow-y: auto; padding: 24rpx 26rpx; }
.m-section { display: flex; align-items: center; gap: 8rpx; margin: 22rpx 0 13rpx; color: var(--panpan-ink); font-size: 27rpx; font-weight: 730; }
.m-section:first-child { margin-top: 0; }
.m-empty { padding: 24rpx; color: var(--panpan-muted); font-size: 25rpx; text-align: center; }
.fb-card { margin-bottom: 0; padding: 16rpx 0; border-bottom: 1rpx solid #EDF3F5; border-radius: 0; background: transparent; transition: transform var(--motion-fast) var(--ease-out); }
.fb-card:active,
.stu-row:active { transform: scale(var(--tap-scale)); }
.fb-date { color: var(--panpan-muted); font-size: 23rpx; }
.fb-preview { display: block; margin: 7rpx 0; color: #50545B; font-size: 25rpx; line-height: 1.58; }
.fb-hw { color: #050505; font-size: 23rpx; }
.stu-row { min-height: 72rpx; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 10rpx 0; border-bottom: 1rpx solid #EDF3F5; transition: transform var(--motion-fast) var(--ease-out); }
.stu-name { color: var(--panpan-ink); font-size: 27rpx; font-weight: 680; }
.stu-lv { margin-left: 11rpx; padding: 3rpx 9rpx; border-radius: 7rpx; font-size: 19rpx; }
.stu-arrow { color: var(--panpan-green-strong); font-size: 23rpx; }
.hw-card { display: flex; align-items: flex-start; gap: 8rpx; padding: 16rpx 18rpx; border-left: 5rpx solid var(--panpan-sprout); border-radius: 9rpx; background: #E5F8FE; color: #050505; font-size: 27rpx; line-height: 1.58; }
.hw-card text { flex: 1; min-width: 0; }
.lv-good { background: #E5F8FE; color: var(--panpan-green-strong); }
.lv-above { background: #E5F8FE; color: #050505; }
.lv-mid { background: #E5F8FE; color: #050505; }
.lv-below,
.lv-low { background: #FFF0F6; color: #B53A52; }
.empty { padding: 34rpx; color: var(--panpan-muted); text-align: center; }

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
