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
.page{padding-bottom:calc(80rpx + env(safe-area-inset-bottom))}
.hero{padding:46rpx 34rpx 36rpx;text-align:left;background:linear-gradient(150deg,#F9FCFB,#EEF6F3);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero-title{font-size:40rpx;font-weight:760;color:var(--ink);display:block;margin-top:8rpx}
.hero-sub{font-size:24rpx;color:var(--muted);margin-top:6rpx;display:block}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border)}

/* 时间轴 */
.timeline{padding:16rpx 30rpx}
.day-section{margin-bottom:24rpx}
.day-header{display:flex;align-items:center;margin-bottom:12rpx}
.day-label{font-size:30rpx;font-weight:700;color:#183A36}
.day-empty{padding:16rpx 0;color:#A4B1AD;font-size:26rpx}

/* 学习安排块 */
.class-block{margin-bottom:16rpx}
.block-inner{border-radius:20rpx;padding:28rpx;position:relative;overflow:hidden}
.mine-inner{background:#FFFFFF;color:var(--ink);border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}
.block-badge{display:inline-block;background:var(--accent-soft);color:var(--accent-strong);font-size:20rpx;padding:4rpx 12rpx;border-radius:8rpx;margin-bottom:12rpx;font-weight:650}
.block-name{display:block;font-size:32rpx;font-weight:700;margin-bottom:8rpx}
.block-time{font-size:26rpx;opacity:.8;display:block}
.block-date{font-size:24rpx;color:#2F7D6B;display:block;margin-bottom:4rpx}
.block-loc{font-size:24rpx;opacity:.6;margin-top:4rpx}
.block-arrow{display:block;margin-top:16rpx;font-size:24rpx;opacity:.6;text-align:right}

/* 锁定/马赛克 */
.other-block{background:var(--surface-muted);border:1rpx solid var(--hairline);padding:24rpx}
.other-block .block-name{font-size:28rpx;font-weight:600;color:#183A36;display:block;margin-bottom:6rpx}
.other-block .block-time{font-size:24rpx;color:#7C8C87}
.other-block .block-loc{font-size:24rpx;color:#7C8C87;margin-top:4rpx}
.block-note{font-size:22rpx;color:#A4B1AD;margin-top:8rpx;display:block}

/* 弹窗 */
.modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;display:flex;align-items:flex-end}
.modal{background:#fff;border-radius:24rpx 24rpx 0 0;padding:0;width:100%;max-height:80vh;display:flex;flex-direction:column}
.m-header{display:flex;justify-content:space-between;align-items:center;padding:30rpx;border-bottom:1rpx solid #E9F0ED}
.m-title{font-size:34rpx;font-weight:700;color:#183A36}
.m-close{font-size:28rpx;color:#697B76}
.m-body{flex:1;overflow-y:auto;padding:30rpx}
.m-section{font-size:28rpx;font-weight:700;color:#183A36;margin-bottom:16rpx;margin-top:24rpx;display:block}
.m-section:first-child{margin-top:0}
.m-empty{text-align:center;color:#A4B1AD;padding:30rpx;font-size:26rpx}
.fb-card{background:#F7FAF8;border-radius:12rpx;padding:20rpx;margin-bottom:12rpx}
.fb-date{font-size:24rpx;color:#7C8C87}
.fb-preview{font-size:26rpx;color:#536762;display:block;margin:8rpx 0}
.fb-hw{font-size:24rpx;color:#2F7D6B}
.stu-row{display:flex;align-items:center;padding:14rpx 0;border-bottom:1rpx solid #E5EEEB}
.stu-name{font-size:28rpx;font-weight:600}
.stu-lv{font-size:20rpx;margin-left:12rpx;padding:2rpx 10rpx;border-radius:4rpx}
.stu-arrow{font-size:24rpx;color:#7C8C87}
.hw-card{background:#EEF7F3;border-radius:10rpx;padding:20rpx;font-size:28rpx;color:#3F7167;line-height:1.6}
.lv-good{background:#E8F4F0;color:#2F7D6B}.lv-above{background:#EDF4F2;color:#52756F}
.lv-mid{background:#F4F2E8;color:#2F7D6B}.lv-below{background:#FCEEEB;color:#B66A3C}
.lv-low{background:#FCEEEB;color:#C75D54}
.empty{text-align:center;color:#A4B1AD;padding:40rpx}
</style>
