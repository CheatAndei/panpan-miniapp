<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">课程</view>
    <text class="hero-title">学习小组详情</text>
    <view class="gold-rule"></view>
    <text class="hero-sub num">{{ weekendRange }}</text>
  </view>

  <!-- 时间轴 -->
  <view v-if="loading" class="loading">加载中…</view>
  <view class="timeline" v-else-if="schedules.length>0">
    <view v-for="day in days" :key="day.value" class="day-section">
      <view class="day-header">
        <view class="day-dot"></view>
        <text class="day-label">{{ day.label }}</text>
      </view>

      <view v-if="day.scheds.length===0" class="day-empty">无学习安排</view>

      <view v-for="s in day.scheds" :key="s.id" class="class-block" :class="{mine:isMyClass(s.class_id)}">
        <template v-if="isMyClass(s.class_id)">
          <view class="block-inner mine-inner" @tap="openClass(s)">
            <view class="block-badge">我的学习小组</view>
            <text class="block-name">{{ s.class_name }}</text>
            <text class="block-time">{{ s.start_time }} - {{ s.end_time }}</text>
            <text v-if="s.location" class="block-loc">{{ s.location }}</text>
            <text class="block-arrow">查看详情 ›</text>
          </view>
        </template>
        <template v-else>
          <view class="block-inner other-block">
            <text :class="['block-name',{'blurred':s.student_count<=1}]">{{ s.class_name }}</text>
            <text class="block-time">{{ s.start_time }} - {{ s.end_time }}</text>
            <text v-if="s.location" class="block-loc">{{ s.location }}</text>
            <text class="block-note">其他学习小组</text>
          </view>
        </template>
      </view>
    </view>
  </view>

  <view v-else class="card"><view class="empty">暂无学习安排</view></view>

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
          <text class="fb-preview">{{ (fb.summary||'').slice(0,80) }}...</text>
        </view>

        <!-- 学生 -->
        <text class="m-section">学习小组同学</text>
        <view v-if="students.length===0" class="m-empty">暂无数据</view>
        <view v-for="s in students" :key="s.id" class="stu-row" @tap="showStuFb(s)">
          <text class="stu-name">{{ s.name }}</text>
          <text v-if="s.level" :class="['stu-lv',lvClass(s.level)]">{{ s.level }}</text>
          <text class="stu-arrow">查看反馈</text>
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
const ALL = [{label:'周五',value:5},{label:'周六',value:6},{label:'周日',value:0},{label:'周一',value:1},{label:'周二',value:2}];

export default {
  data(){return{
    schedules:[],myClassIds:[],days:[],loading:false,
    showDetail:false,detailClass:null,feedbacks:[],students:[],latestHomework:''
  };},
  computed:{
    weekendRange(){
      const now=new Date();const dow=now.getDay();
      const fri=new Date(now);fri.setDate(fri.getDate()+(5-dow));
      const tue=new Date(now);tue.setDate(tue.getDate()+(9-dow));
      return `${fri.getMonth()+1}/${fri.getDate()} - ${tue.getMonth()+1}/${tue.getDate()}`;
    },
  },
  onShow(){this.loadData();},
  methods:{
    isMyClass(cid){return this.myClassIds.includes(cid);},
    async loadData(){
      const t=uni.getStorageSync('token');if(!t)return;
      this.loading=true;
      try{
        const sch=await api.get('/schedules/parent');
        this.schedules=sch.schedules||[];
        this.myClassIds=sch.myClassIds||[];
        this.days=ALL.map(d=>({
          ...d,scheds:this.schedules.filter(s=>s.day_of_week===d.value)
            .sort((a,b)=>(parseInt(a.start_time.replace(':',''))-parseInt(b.start_time.replace(':',''))))
        }));
      }catch(e){logError('parentSchedule.loadData',e);}
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
      const last=this.feedbacks[0];
      if(!last||!last.student_feedbacks)return uni.showToast({title:'暂无该同学反馈',icon:'none'});
      try{
        const list=JSON.parse(last.student_feedbacks);
        const f=list.find(x=>x.id===s.id);
        if(f)uni.showModal({title:s.name+'的反馈',content:f.text||'暂无',showCancel:false});
        else uni.showToast({title:'暂无该同学反馈',icon:'none'});
      }catch(e){uni.showToast({title:'暂无',icon:'none'});}
    },
    openFb(fb){},
    lvClass(lv){const m={好:'lv-good',中上:'lv-above',中:'lv-mid',中下:'lv-below',下:'lv-low'};return m[lv]||'';}
  }
};
</script>

<style scoped>
.page{padding-bottom:80rpx}
.hero{padding:40rpx 32rpx 30rpx;text-align:center;background:var(--card);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero .gold-rule{margin:14rpx auto}
.hero-title{font-size:38rpx;font-weight:800;color:var(--ink);display:block}
.hero-sub{font-size:24rpx;color:var(--muted);margin-top:6rpx;display:block}

/* 时间轴 */
.timeline{padding:16rpx 30rpx}
.day-section{margin-bottom:24rpx}
.day-header{display:flex;align-items:center;gap:12rpx;margin-bottom:12rpx}
.day-dot{width:12rpx;height:12rpx;border-radius:50%;background:#A57945}
.day-label{font-size:30rpx;font-weight:700;color:#202733}
.day-empty{padding:16rpx 0;color:#C3C1BA;font-size:26rpx}

/* 学习安排块 */
.class-block{margin-bottom:16rpx}
.block-inner{border-radius:14rpx;padding:28rpx;position:relative;overflow:hidden}
.mine-inner{background:#FBFAF7;color:#202733;border:1rpx solid #E5E0D8;box-shadow:0 6rpx 18rpx rgba(36,42,50,.045)}
.block-badge{display:inline-block;background:#F7F1E7;color:#8D6A3F;font-size:20rpx;padding:4rpx 14rpx;border-radius:20rpx;margin-bottom:12rpx}
.block-name{display:block;font-size:32rpx;font-weight:700;margin-bottom:8rpx}
.block-time{font-size:26rpx;opacity:.8;display:block}
.block-loc{font-size:24rpx;opacity:.6;margin-top:4rpx}
.block-arrow{display:block;margin-top:16rpx;font-size:24rpx;opacity:.6;text-align:right}

/* 锁定/马赛克 */
.other-block{background:#F8F6F1;border:1px solid #E1DDD4;padding:24rpx}
.other-block .block-name{font-size:28rpx;font-weight:600;color:#202733;display:block;margin-bottom:6rpx}
.other-block .block-name.blurred{filter:blur(6rpx);user-select:none;color:#C3C1BA}
.other-block .block-time{font-size:24rpx;color:#8A929B}
.other-block .block-loc{font-size:24rpx;color:#8A929B;margin-top:4rpx}
.block-note{font-size:22rpx;color:#C3C1BA;margin-top:8rpx;display:block}

/* 弹窗 */
.modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;display:flex;align-items:flex-end}
.modal{background:#fff;border-radius:24rpx 24rpx 0 0;padding:0;width:100%;max-height:80vh;display:flex;flex-direction:column}
.m-header{display:flex;justify-content:space-between;align-items:center;padding:30rpx;border-bottom:1rpx solid #EFEDE7}
.m-title{font-size:34rpx;font-weight:700;color:#202733}
.m-close{font-size:28rpx;color:#69717D}
.m-body{flex:1;overflow-y:auto;padding:30rpx}
.m-section{font-size:28rpx;font-weight:700;color:#202733;margin-bottom:16rpx;margin-top:24rpx;display:block}
.m-section:first-child{margin-top:0}
.m-empty{text-align:center;color:#C3C1BA;padding:30rpx;font-size:26rpx}
.fb-card{background:#F8F6F1;border-radius:12rpx;padding:20rpx;margin-bottom:12rpx}
.fb-date{font-size:24rpx;color:#8A929B}
.fb-preview{font-size:26rpx;color:#46515C;display:block;margin:8rpx 0}
.fb-hw{font-size:24rpx;color:#A57945}
.stu-row{display:flex;align-items:center;padding:14rpx 0;border-bottom:1rpx solid #ECE8E0}
.stu-name{font-size:28rpx;font-weight:600}
.stu-lv{font-size:20rpx;margin-left:12rpx;padding:2rpx 10rpx;border-radius:4rpx}
.stu-arrow{font-size:24rpx;color:#8A929B}
.hw-card{background:#F7F1E7;border-radius:10rpx;padding:20rpx;font-size:28rpx;color:#7B5B36;line-height:1.6}
.lv-good{background:#EEF5EF;color:#3F8B65}.lv-above{background:#EFF3F2;color:#52707E}
.lv-mid{background:#F7F2E5;color:#A57945}.lv-below{background:#F7EDEA;color:#A66A3E}
.lv-low{background:#F7EDEA;color:#B85C4E}
.empty{text-align:center;color:#C3C1BA;padding:40rpx}
</style>
