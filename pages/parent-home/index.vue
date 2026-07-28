<template>
<view class="page">
  <view v-if="loading && !child" class="state-card"><pp-state type="loading" title="正在读取学习动态" /></view>
  <view v-else-if="error && !child" class="state-card"><pp-state type="error" title="暂时无法加载" :description="error" action-text="重新加载" @action="loadData" /></view>
  <!-- 孩子卡片 -->
  <view class="hero hero-navy" v-if="child">
    <view class="hero-mark" aria-hidden="true"><pp-icon name="home" :size="34" motion="bob" decorative /></view>
    <view class="greeting">{{ greeting }}，{{ child.name }}家长</view>
    <pp-avatar :name="child.name" :size="128" class="avatar" />
    <text class="child-name">{{ child.name }}</text>
    <text class="child-class">{{ child.className }} · {{ teacherName }}</text>
  </view>

  <!-- 签到 -->
  <view class="card" v-if="todayCheckin">
    <view :class="['checkin-badge', checkinBadgeClass(todayCheckin)]">
      <pp-icon :name="todayCheckin.checkedIn ? 'check' : 'calendar'" :size="27" :motion="todayCheckin.checkedIn ? 'pop' : 'breathe'" decorative />
      {{ checkinText(todayCheckin) }}
    </view>
    <view v-if="todayCheckin.checkOutNote" class="checkin-note">{{ todayCheckin.checkOutNote }}</view>
    <button class="notify-btn" @tap="requestSubscribe"><pp-icon name="bell" :size="27" motion="ring" decorative />开启全部学习提醒</button>
  </view>

  <!-- 学习小组详情入口 -->
  <view class="card" @tap="nav('/pages/parent-schedule/index')">
    <view class="card-head">
      <view class="card-title-group"><pp-icon name="calendar" :size="28" motion="pop" decorative /><text class="card-title">学习小组详情</text></view>
      <text class="card-arrow">查看完整课表</text>
    </view>
    <view v-if="schedules.length===0" class="empty-sm">暂无学习安排</view>
    <view v-for="s in schedules" :key="s.id" class="sc-line">
      <text class="sc-day">{{ scheduleLabel(s) }}</text>
      <text class="sc-time">{{ s.start_time }}-{{ s.end_time }}</text>
      <text class="sc-name">{{ s.title||s.class_name }}</text>
    </view>
  </view>

  <!-- 最新反馈 -->
  <view class="card" @tap="nav('/pages/parent-feedback/index')" v-if="feedback">
    <view class="card-head">
      <view class="card-title-group"><pp-icon name="message" :size="28" motion="ring" decorative /><text class="card-title">最新反馈</text></view>
      <text class="card-arrow">查看全部</text>
    </view>
    <text class="fb-date">{{ feedback.class_date }}</text>
    <text class="fb-text">{{ (feedback.summary||'').slice(0,120) }}{{ feedback.summary&&feedback.summary.length>120?'...':'' }}</text>
    <!-- 图片预览 -->
    <view v-if="fbImages.length>0" class="fb-images">
      <image v-for="(img,i) in fbImages.slice(0,4)" :key="i" :src="img" mode="aspectFill" class="fb-img" @tap.stop="previewImg(i)" />
      <view v-if="fbImages.length>4" class="img-more">+{{ fbImages.length-4 }}</view>
    </view>
    <text v-if="feedback.homework" class="fb-hw">作业：{{ feedback.homework }}</text>
    <button v-if="feedback.notes_pdf_url" class="pdf-btn" @tap.stop="openPdf(feedback.notes_pdf_url)"><pp-icon name="book" :size="27" decorative />打开学习笔记 PDF</button>
  </view>

  <view class="card" v-else>
    <view class="card-title-group"><pp-icon name="message" :size="28" decorative /><view class="card-title">最新反馈</view></view>
    <view class="empty-sm">暂无反馈</view>
  </view>

  <!-- 老师印象入口 -->
  <view class="card" @tap="nav('/pages/mine/index')">
    <view class="card-head">
      <view class="card-title-group"><pp-icon name="target" :size="28" motion="shine" decorative /><text class="card-title">在老师印象中的孩子</text></view>
      <text class="card-arrow">查看详情</text>
    </view>
    <view v-if="profile" class="tags">
      <text v-for="t in (profile.tags||[])" :key="t" class="tag tag-blue">{{ t }}</text>
    </view>
    <view v-else class="empty-sm">老师还未填写印象</view>
  </view>

  <view class="card">
    <button class="btn-outline" @tap="nav('/pages/parent-leave/index')"><pp-icon name="report" :size="27" decorative />请假申请</button>
  </view>

  <view class="footer">番番记录 · 熟人老师共用版<br/>桂ICP备2026013218号-2</view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
import { requestSubscribeBatches, subscribeResultTitle } from '@/utils/subscribe';
import { teacherNameFromChild } from '@/utils/brand';
export default {
  data(){return{
    child:null,todayCheckin:null,schedules:[],feedback:null,profile:null,loading:false,error:'',refreshTimer:null,
    dayNames:['周日','周一','周二','周三','周四','周五','周六'],fbImages:[],notifyTpls:[]
  };},
  computed:{
    teacherName(){return teacherNameFromChild(this.child);},
    greeting(){
      const h=new Date().getHours();
      return h<6?'夜深了':h<12?'上午好':h<14?'中午好':h<18?'下午好':'晚上好';
    }
  },
  onShow(){this.startAutoRefresh();},
  onHide(){this.stopAutoRefresh();},
  methods:{
    startAutoRefresh(){
      this.stopAutoRefresh();
      if(!uni.getStorageSync('token'))return;
      this.loadNotifyTemplates();
      this.loadData();
      this.refreshTimer=setInterval(()=>this.loadData(),30000);
    },
    stopAutoRefresh(){
      if(this.refreshTimer)clearInterval(this.refreshTimer);
      this.refreshTimer=null;
    },
    async loadData(){
      const t=uni.getStorageSync('token');if(!t)return;
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const kids=await api.get('/bind/students');
        const list=kids.students||[];
        const activeId=String(uni.getStorageSync('activeChildId')||'');
        this.child=(activeId?list.find(k=>String(k.id)===activeId):null)||list[0]||null;
        const s={student:this.child};
        const [c,sc,f,p]=await Promise.all([
          api.get('/checkins/today'+(s.student?.id?'?student_id='+s.student.id:'')),
          api.get('/schedules/parent'+(s.student?.id?'?student_id='+s.student.id:'')),api.get('/feedbacks/latest'+(s.student?.class_id?'?class_id='+s.student.class_id:'')),api.get(s.student?.id?'/profiles/'+s.student.id:'/profiles/my')
        ]);
        this.todayCheckin=c;
        if(this.todayCheckin&&this.todayCheckin.checkInTime){
          this.todayCheckin.checkInTime=new Date(this.todayCheckin.checkInTime).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        }
        if(this.todayCheckin&&this.todayCheckin.checkOutTime){
          this.todayCheckin.checkOutTime=new Date(this.todayCheckin.checkOutTime).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        }
        this.schedules=(sc.schedules||[]).filter(item=>!s.student?.class_id||item.class_id===s.student.class_id)
          .sort((a,b)=>String(a.class_date||'9999-99-99').localeCompare(String(b.class_date||'9999-99-99')) || String(a.start_time||'').localeCompare(String(b.start_time||'')))
          .slice(0,3);
        this.feedback=f.feedback;this.profile=p.profile;
        if(this.profile){
          let tags=this.profile.tags;
          if(typeof tags==='string'){try{tags=JSON.parse(tags);}catch(e){tags=[];}}
          this.profile={...this.profile,tags:Array.isArray(tags)?tags:[]};
        }
        if(this.feedback&&this.feedback.image_urls){
          try{this.fbImages=JSON.parse(this.feedback.image_urls).map(u=>api.assetUrl(u));}catch(e){this.fbImages=[];}
        }
      }catch(e){this.error=e?.error||'请检查网络后重试';logError('parentHome.loadData',e);}
      finally{this.loading=false;}
    },
    previewImg(i){uni.previewImage({current:this.fbImages[i],urls:this.fbImages});},
    checkinBadgeClass(ci){return ci?.onLeave?'leave':(ci?.checkedOut?'done':(ci?.checkedIn?'in':'out'));},
    checkinText(ci){
      if(ci?.onLeave)return '今日已请假';
      if(!ci||!ci.checkedIn)return '等待签到';
      if(ci.checkedOut)return '今日已签退 '+(ci.checkOutTime||'');
      return '今日已签到 '+(ci.checkInTime||'');
    },
    scheduleLabel(sc){
      if(sc.class_date){
        const d=new Date(sc.class_date+'T00:00:00+08:00');
        return `${d.getMonth()+1}/${d.getDate()} ${this.dayNames[d.getDay()]}`;
      }
      return this.dayNames[sc.day_of_week];
    },
    async loadNotifyTemplates(){
      try{
        const tplRes=await api.get('/notify/templates');
        this.notifyTpls=[...new Set([tplRes.checkin,tplRes.checkout,tplRes.reminder,tplRes.feedback,tplRes.homework].filter(Boolean))];
      }catch(e){logError('parentHome.loadNotifyTemplates',e);}
    },
    async requestSubscribe(){
      if(this.notifyTpls.length===0) await this.loadNotifyTemplates();
      const tmplIds=this.notifyTpls;
      if(tmplIds.length===0){
        uni.showToast({title:'提醒模板未加载',icon:'none'});
        return {accepted:0};
      }
      try{
        const result=await requestSubscribeBatches(tmplIds);
        uni.showToast({title:subscribeResultTitle(result),icon:result.accepted===result.total?'success':'none'});
        return result;
      }catch(e){
        logError('parentHome.subscribe',e);
        uni.showToast({title:'订阅弹窗失败',icon:'none'});
        throw e;
      }
    },
    async openPdf(url){
      try{await api.openPdf(url);}
      catch(e){uni.showToast({title:'PDF 打开失败',icon:'none'});}
    },
    nav(url){uni.navigateTo({url});}
  }
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: calc(44rpx + env(safe-area-inset-bottom));
  background: var(--page-bg);
}

.state-card {
  margin: 22rpx 24rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 24rpx 44rpx;
  animation: parent-home-enter var(--motion-slow) var(--ease-out) both;
}

.hero::before {
  content: '';
  position: absolute;
  left: 34rpx;
  top: 34rpx;
  width: 54rpx;
  height: 8rpx;
  border-radius: 8rpx;
  background: var(--coral);
  box-shadow: 0 17rpx 0 rgba(82, 124, 201, .16);
}

.hero-mark {
  position: absolute;
  top: 28rpx;
  right: 30rpx;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #C9DAF0;
  border-radius: 14rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.greeting { margin-bottom: 20rpx; color: var(--primary-strong); font-size: 30rpx; font-weight: 700; }
.avatar { margin-bottom: 8rpx; }
.child-name { margin-top: 14rpx; color: var(--ink); font-size: 38rpx; font-weight: 760; }
.child-class { margin-top: 4rpx; color: var(--text-muted); font-size: 24rpx; }

.card {
  animation: parent-card-enter var(--motion-slow) var(--ease-out) both;
}

.checkin-badge {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--r-sm);
  font-size: 28rpx;
  font-weight: 650;
}

.checkin-badge.in,
.checkin-badge.done { background: var(--success-soft); color: var(--success); }
.checkin-badge.out { background: var(--warning-soft); color: var(--warning); }
.checkin-badge.leave { background: var(--danger-soft); color: var(--danger); }
.checkin-note { margin-top: 12rpx; color: var(--danger); font-size: 24rpx; line-height: 1.5; }

.card-head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin-bottom: 14rpx; }
.card-title-group { display: flex; align-items: center; gap: 10rpx; color: var(--primary-strong); }
.card-title { color: var(--ink); font-size: 29rpx; font-weight: 720; }
.card-arrow { flex: none; color: var(--primary-strong); font-size: 23rpx; font-weight: 650; }

.sc-line {
  min-height: 66rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  border-top: 1rpx solid var(--hairline);
  font-size: 26rpx;
}

.sc-line:first-of-type { border-top: 0; }
.sc-day { min-width: 104rpx; color: var(--primary-strong); font-size: 24rpx; font-weight: 700; }
.sc-time { width: 128rpx; color: var(--text-muted); font-size: 24rpx; font-variant-numeric: tabular-nums; }
.sc-name { flex: 1; min-width: 0; color: var(--text-secondary); }

.fb-date { margin-bottom: 8rpx; color: var(--text-muted); font-size: 24rpx; }
.fb-text {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 28rpx;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.fb-images { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 16rpx; }
.fb-img,
.img-more { width: 150rpx; height: 150rpx; border-radius: var(--r-xs); }
.fb-img { background: var(--surface-muted); }
.img-more { display: flex; align-items: center; justify-content: center; background: var(--primary-soft); color: var(--primary-strong); font-size: 32rpx; font-weight: 700; }
.fb-hw { display: block; margin-top: 14rpx; padding: 14rpx 16rpx; border-radius: var(--r-xs); background: var(--warning-soft); color: var(--warning); font-size: 24rpx; line-height: 1.55; }

.notify-btn,
.pdf-btn,
.btn-outline {
  width: 100%;
  min-height: 88rpx;
  padding-block: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  border-radius: var(--r-sm);
  font-size: 26rpx;
  font-weight: 650;
  transition: transform var(--motion-fast) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}

.notify-btn { margin-top: 16rpx; border: 1rpx solid #FCEEEB; background: var(--coral-soft); color: var(--danger); }
.pdf-btn { margin-top: 14rpx; border: none; background: var(--primary-strong); color: #FFFFFF; }
.btn-outline { border: 1rpx solid #FCEEEB; background: var(--coral-soft); color: var(--danger); font-size: 28rpx; }
.notify-btn:active,
.pdf-btn:active,
.btn-outline:active { transform: scale(var(--tap-scale)); }
.notify-btn::after,
.pdf-btn::after,
.btn-outline::after { border: 0; }

.tags { display: flex; flex-wrap: wrap; gap: 10rpx; }
.empty-sm { padding: 24rpx; color: var(--text-muted); font-size: 26rpx; text-align: center; }
.footer { padding: 40rpx 30rpx 30rpx; color: var(--faint); font-size: 24rpx; line-height: 1.6; text-align: center; }

@keyframes parent-home-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes parent-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .card { animation: none; }
  .notify-btn,
  .pdf-btn,
  .btn-outline { transition: none; }
}
</style>
