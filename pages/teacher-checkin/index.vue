<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">考勤</view>
    <view class="hero-title-line">
      <pp-icon name="clipboard" :size="34" :motion="sessions.length > 0 ? 'ring' : 'pop'" />
      <text class="hero-title">签到管理</text>
    </view>
    <text class="hero-date num">{{ today }}</text>
  </view>

  <!-- 已发布学习安排 -->
  <view v-if="loading && sessions.length===0" class="state-card"><pp-state type="loading" title="正在读取签到任务" /></view>
  <view v-else-if="error && sessions.length===0" class="state-card"><pp-state type="error" title="签到任务加载失败" :description="error" action-text="重新加载" @action="loadSessions" /></view>
  <view v-else-if="sessions.length===0" class="state-card"><pp-state title="暂无签到任务" description="请先在课表管理中发布上课提醒。" action-text="前往课表" @action="goSchedule" /></view>

  <view v-for="se in sessions" :key="se.id" class="card session-card swiper-wrap">
    <view class="swiper-inner" :style="{transform:'translateX('+(se._swiped?-120:0)+'rpx)'}"
      @touchstart="onTouchStart($event,se)" @touchmove="onTouchMove($event,se)" @touchend="onTouchEnd($event,se)">
    <view class="se-header" @tap="toggleSession(se)">
      <view>
        <text class="se-title">{{ se.title }}</text>
        <text class="se-date">{{ formatSessionDate(se) }}</text>
      </view>
      <view :class="['se-toggle',{open:se._open}]"><pp-icon name="arrow" :size="34" /></view>
    </view>

    <view v-if="se._open">
      <view v-if="se._loading" class="empty-sm">加载中...</view>
      <view v-else-if="se._students && se._students.length>0">
        <view class="stats">
          <text class="stat">共{{ se._students.length }}人</text>
          <text class="stat green">已到{{ se._students.filter(s=>s._checked).length }}人</text>
          <text class="stat gray">未到{{ se._students.filter(s=>!s._checked&&!s._leave).length }}人</text>
        </view>
        <button v-if="se._students.filter(s=>!s._checked&&!s._leave).length>0" class="btn-accent mb-sm" :disabled="se._bulkBusy" @tap="checkInAll(se)">{{ se._bulkBusy ? '处理中...' : '一键签到剩余全部' }}</button>
        <button v-if="se._students.filter(s=>s._checked&&!s._out&&!s._leave).length>0" class="btn-special-main mb-sm" :disabled="se._bulkBusy" @tap="specialCheckOutAll(se)">特殊签退剩余已签到</button>
        <view v-for="s in se._students" :key="s.id" class="stu-row" :class="{leave:s._leave}">
          <view class="stu-left">
            <text class="s-name">{{ s.name }}</text>
            <view :class="['i-badge',s._leave?'warn':s._out?'out':s._checked?'in':'out']">{{ s._leave?'请假':s._out?'已签退':s._checked?'已签到':'待签到' }}<text v-if="statusText(s)" class="st-time"> {{ statusText(s) }}</text></view>
            <text v-if="s._outNote" class="note-text">{{ s._outNote }}</text>
          </view>
          <view class="stu-right">
            <button v-if="!s._leave&&!s._checked" class="btn-sm btn-remind" :disabled="s._busy||s._reminding" @tap="remindArrival(se,s)">{{ s._reminding ? '发送中' : '提醒' }}</button>
            <button v-if="!s._leave&&!s._checked" class="btn-sm btn-in" :disabled="s._busy" @tap="checkIn(se,s)">签到</button>
            <button v-if="!s._leave&&!s._checked" class="btn-sm btn-leave" :disabled="s._busy" @tap="markLeave(se,s)">请假</button>
            <button v-if="s._checked&&!s._out" class="btn-sm btn-out" :disabled="s._busy" @tap="checkOut(se,s)">签退</button>
            <text v-if="s._out" class="time-text">{{ s._outTime }}</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-sm">该学习小组暂无学生</view>
    </view>
    </view><!-- end swiper-inner -->
    <view :class="['swipe-del',{show:se._swiped}]" @tap="delSession(se)">删除</view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { confirmAction, toastSuccess, toastError, logError } from '@/utils/ui';
import { teacherShortName } from '@/utils/brand';
const DAYS = ['周日','周一','周二','周三','周四','周五','周六'];

export default {
  data(){return{
    sessions:[],today:'',dayNames:DAYS,loading:false,error:''
  };},
  onLoad(){this.today=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});this.loadSessions();},
  methods:{
    async loadSessions(){
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const res=await api.get('/schedules/sessions');
        this.sessions=(res.sessions||[]).map(se=>({...se,_open:false,_students:[],_loading:false,_bulkBusy:false,_swiped:false}));
      }catch(e){this.error=e?.error||'请检查网络后重试';logError('loadSessions',e);}
      finally{this.loading=false;}
    },
    async toggleSession(se){
      se._open=!se._open;
      if(se._open && se._students.length===0){await this.loadStudents(se);}
    },
    async loadStudents(se){
      se._loading=true;
      try{
        const res=await api.get('/students?class_id='+se.class_id);
        const students=(res.students||[]).map(s=>{
          s._checked=false;s._out=false;s._leave=false;s._inTime='';s._outTime='';s._outNote='';s._busy=false;s._reminding=false;
          return s;
        });
        // 并行查询各学生签到状态（原为逐个 await 的串行瀑布，N 人=N 次往返）
        await Promise.all(students.map(async s=>{
          try{
            const ci=await api.get('/checkins/status?student_id='+s.id+'&date='+se.class_date);
            s._checked=ci.checkedIn||false;s._out=ci.checkedOut||false;
            s._inTime=ci.checkInTime?new Date(ci.checkInTime).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
            s._outTime=ci.checkOutTime?new Date(ci.checkOutTime).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
            s._outNote=ci.checkOutNote||'';
            s._leave=ci.onLeave||false;
          }catch(e){logError('checkinStatus',e);}
        }));
        se._students=students;
      }catch(e){logError('loadStudents',e);}finally{se._loading=false;}
    },
    async checkIn(se,s,silent=false){
      if(s._busy)return false;
      s._busy=true;
      try{const res=await api.post('/checkins/check-in',{studentId:s.id,classDate:se.class_date,studentName:s.name});
        s._checked=true;s._inTime=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        if(!silent)toastSuccess(res.notify?.ok?s.name+' 已签到并提醒':s.name+' 已签到，提醒未送达');return true;}
      catch(e){if(!silent)toastError(e,'签到失败');return false;}
      finally{s._busy=false;}
    },
    async remindArrival(se,s){
      if(s._busy||s._reminding||s._checked||s._leave)return;
      s._reminding=true;
      try{
        const res=await api.post('/checkins/remind-arrival',{studentId:s.id,classDate:se.class_date});
        if(res.notify?.ok)toastSuccess(s.name+' 的到达提醒已发送');
        else toastError(res.notify||{},'提醒未送达');
      }catch(e){toastError(e,'提醒发送失败');}
      finally{s._reminding=false;}
    },
    async checkOut(se,s,special=false,silent=false){
      if(s._busy)return false;
      s._busy=true;
      try{const res=await api.post('/checkins/check-out',{studentId:s.id,studentName:s.name,classDate:se.class_date,special,teacherName:this.teacherName()});
        s._out=true;s._outTime=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        const shortName=this.teacherName();
        if(special)s._outNote=(shortName?shortName+'老师':'老师')+'已离开，请主动联系小朋友。';
        if(!silent)toastSuccess(res.notify?.ok?s.name+' 已签退并提醒':s.name+' 已签退，提醒未送达');
        const allDone=se._students.every(s=>s._leave||s._out);
        if(allDone){await api.put('/schedules/sessions/'+se.id+'/complete');this.sessions=this.sessions.filter(x=>x.id!==se.id);}
        return true;
      }catch(e){if(!silent)toastError(e,'签退失败');return false;}
      finally{s._busy=false;}
    },
    async markLeave(se,s){
      const confirmed=await confirmAction({title:'标记请假',content:'确定将 '+s.name+' 标记为请假？',confirmText:'标记'});
      if(!confirmed||s._busy)return;
      s._busy=true;
      try{
        await api.post('/leaves/teacher-mark',{student_id:s.id,class_date:se.class_date,reason:'老师在签到页标记请假'});
        s._leave=true;s._checked=false;s._out=false;s._inTime='';s._outTime='';
        toastSuccess(s.name+' 已标记请假');
        const allDone=se._students.every(item=>item._leave||item._out);
        if(allDone){await api.put('/schedules/sessions/'+se.id+'/complete');this.sessions=this.sessions.filter(x=>x.id!==se.id);}
      }catch(e){toastError(e,'标记请假失败');}
      finally{s._busy=false;}
    },
    async checkInAll(se){
      const notChecked=se._students.filter(s=>!s._checked&&!s._leave);
      if(se._bulkBusy||notChecked.length===0)return;
      se._bulkBusy=true;let success=0;
      for(const s of notChecked){if(await this.checkIn(se,s,true))success++;}
      se._bulkBusy=false;
      toastSuccess('已完成 '+success+' 人签到');
    },
    async specialCheckOutAll(se){
      const list=se._students.filter(s=>s._checked&&!s._out&&!s._leave);
      if(list.length===0||se._bulkBusy)return;
      const confirmed=await confirmAction({title:'特殊签退',content:'将对 '+list.length+' 位已签到学生发送特殊签退说明。',confirmText:'继续'});
      if(!confirmed)return;
      se._bulkBusy=true;let success=0;
      for(const s of list){if(await this.checkOut(se,s,true,true))success++;}
      se._bulkBusy=false;
      toastSuccess('已完成 '+success+' 人签退');
    },
    statusText(s){if(s._leave)return'请假';if(s._out)return s._outTime;if(s._checked)return s._inTime;return'';},
    formatSessionDate(se){
      const d=new Date(String(se.class_date)+'T00:00:00+08:00');
      return `${se.class_date} ${this.dayNames[d.getDay()]} ${se.start_time||''}-${se.end_time||''}`;
    },
    goSchedule(){uni.navigateTo({url:'/pages/teacher-schedule/index'});},
    teacherName(){try{return teacherShortName(JSON.parse(uni.getStorageSync('user')||'{}').nickname);}catch(e){return'老师';}},
    statusClass(s){if(s._leave)return'st-leave';if(s._out)return'st-out';if(s._checked)return'st-in';return'st-absent';},
    onTouchStart(e,se){se._startX=e.touches[0].clientX;se._swiping=true;},
    onTouchMove(e,se){if(!se._swiping)return;const dx=e.touches[0].clientX-se._startX;if(dx<-40){se._swiped=true;}else if(dx>40){se._swiped=false;}},
    onTouchEnd(e,se){se._swiping=false;},
    async delSession(se){
      const confirmed=await confirmAction({title:'删除学习安排',content:'删除后本节课的签到任务也会移除。',confirmText:'删除',danger:true});
      if(confirmed)await this.delSessionSilent(se);
    },
    async delSessionSilent(se){
      try{await api.del('/schedules/sessions/'+se.id);this.loadSessions();}
      catch(e){toastError(e,'删除失败');}
    }
  }
};
</script>

<style scoped>
/* Teacher operations theme: compact attendance rows with functional color. */
.page {
  min-height: 100vh;
  padding-bottom: calc(64rpx + env(safe-area-inset-bottom));
  color: var(--ink);
  background-color: var(--page-bg);
}
.hero {
  padding: 30rpx 28rpx 24rpx;
  border-bottom: 6rpx solid var(--primary);
  box-shadow: none;
  animation: none;
}
.hero::after {
  top: 0;
  right: 28rpx;
  bottom: auto;
  width: 104rpx;
  height: 8rpx;
  border-radius: 0 0 4rpx 4rpx;
  background: var(--gold);
}
.hero .eyebrow {
  color: var(--primary-strong);
  letter-spacing: 0;
}
.hero .gold-rule { display: none; }
.hero-title {
  display: block;
  margin-top: 6rpx;
  color: var(--ink);
  font-size: 38rpx;
  font-weight: 760;
}
.hero-date {
  display: block;
  margin-top: 4rpx;
  color: var(--text-secondary);
  font-size: 23rpx;
}
.state-card {
  margin: 16rpx 20rpx;
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  background: var(--surface);
  box-shadow: none;
}
.session-card {
  position: relative;
  margin: 14rpx 20rpx;
  padding: 0;
  overflow: hidden;
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  background: var(--surface);
  box-shadow: none;
}
.session-card::before {
  position: absolute;
  z-index: 1;
  top: 0;
  bottom: 0;
  width: 5rpx;
  height: auto;
  border-radius: 0;
  background: var(--primary);
  content: "";
  pointer-events: none;
}
.se-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72rpx;
  padding: 19rpx 20rpx 17rpx 24rpx;
}
.se-title {
  display: block;
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 720;
}
.se-date {
  margin-top: 3rpx;
  color: var(--text-muted);
  font-size: 22rpx;
}
.se-toggle {
  color: var(--text-muted);
  transition: transform var(--motion-base) var(--ease-out);
}
.se-toggle.open { transform: rotate(90deg); }
.stats {
  display: flex;
  margin: 0;
  padding: 13rpx 20rpx 13rpx 24rpx;
  gap: 12rpx;
  justify-content: space-between;
  border: 0;
  border-top: 1rpx solid var(--hairline);
  border-bottom: 1rpx solid var(--hairline);
  border-radius: 0;
  background: var(--surface-muted);
}
.stat {
  color: var(--text-secondary);
  font-size: 22rpx;
}
.stat.green {
  color: var(--success);
  font-weight: 680;
}
.stat.gray { color: var(--text-muted); }
.btn-accent,
.btn-special-main {
  width: auto;
  min-height: 68rpx;
  margin: 14rpx 20rpx 0 24rpx;
  padding: 10rpx 16rpx;
  border-radius: 9rpx;
  font-size: 24rpx;
  font-weight: 680;
  box-shadow: none;
}
.btn-accent[disabled],
.btn-special-main[disabled],
.stu-right .btn-sm[disabled] { opacity: .5; }
.btn-accent {
  border: 0;
  background: var(--primary-strong);
  color: #FFFFFF;
}
.btn-special-main {
  border: 1rpx solid #DDE7F2;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.mb-sm { margin-bottom: 12rpx; }
.stu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 78rpx;
  padding: 16rpx 20rpx 16rpx 24rpx;
  gap: 12rpx;
  border-bottom: 1rpx solid var(--hairline);
}
.stu-row:last-child { border-bottom: 0; }
.stu-row.leave {
  opacity: .68;
  background: var(--surface-muted);
}
.stu-left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.s-name {
  color: var(--ink);
  font-size: 27rpx;
  font-weight: 680;
}
.st-time {
  color: var(--text-muted);
  font-size: 19rpx;
}
.note-text {
  margin-top: 4rpx;
  color: var(--danger);
  font-size: 20rpx;
}
.time-text {
  color: var(--text-muted);
  font-size: 22rpx;
}
.stu-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  min-width: 202rpx;
  gap: 7rpx;
}
.stu-right .btn-sm {
  width: 94rpx;
  min-width: 94rpx;
  min-height: 54rpx;
  margin: 0;
  padding: 6rpx 0;
  border-radius: 8rpx;
  font-size: 22rpx;
  font-weight: 650;
}
.btn-in {
  border: 0;
  background: var(--accent);
  color: #FFFFFF;
}
.btn-out {
  border: 1rpx solid #DDE7F2;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.btn-remind {
  border: 1rpx solid var(--border);
  background: var(--surface);
  color: var(--primary-strong);
}
.btn-leave {
  border: 1rpx solid #BFD0EC;
  background: var(--gold-soft);
  color: var(--warning);
}
.empty,
.empty-sm {
  color: var(--text-muted);
  font-size: 23rpx;
}
.swiper-inner { transition: transform var(--motion-base) var(--ease-out); }
.swiper-wrap {
  position: relative;
  overflow: hidden;
}
.swipe-del {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  width: 120rpx;
  align-items: center;
  justify-content: center;
  background: var(--coral);
  color: #FFFFFF;
  font-size: 25rpx;
  transform: translateX(120rpx);
  transition: transform var(--motion-base) var(--ease-out);
}
.swipe-del.show { transform: translateX(0); }
.btn-accent::after,
.btn-special-main::after,
.stu-right .btn-sm::after { border: 0; }

.se-header,
.btn-accent,
.btn-special-main,
.stu-right .btn-sm {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}
.se-header:active,
.btn-accent:active,
.btn-special-main:active,
.stu-right .btn-sm:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}

@media (prefers-reduced-motion: reduce) {
  .se-header,
  .se-toggle,
  .swiper-inner,
  .swipe-del,
  .btn-accent,
  .btn-special-main,
  .stu-right .btn-sm {
    transition: none !important;
  }
}

/* Teacher operations theme: bright learning studio v2. */
.page {
  --primary: #527CC9;
  --primary-strong: #315EA8;
  --primary-soft: #EAF2FF;
  --accent: #527CC9;
  --accent-strong: #315EA8;
  --accent-soft: #EAF2FF;
  --success: #315EA8;
  --success-soft: #EAF2FF;
  --gold: #527CC9;
  --gold-soft: #EAF2FF;
  --warning: #315EA8;
  --warning-soft: #EAF2FF;
  --coral: #E98577;
  --coral-soft: #FFF0ED;
  --danger: #D66D62;
  --danger-soft: #FFF0ED;
  --info: #527CC9;
  --info-soft: #EAF2FF;
  --ink: #24324A;
  --text-secondary: #5C6C84;
  --text-muted: #5C6C84;
  --page-bg: #F6FAFF;
  --surface: #FFFFFF;
  --surface-muted: #F8FBFF;
  --border: #DDE7F2;
  --hairline: #E9F0F8;
  background-color: #F6FAFF;
  background-image: repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(82, 124, 201, .035) 64rpx 65rpx);
}
.page {
  box-sizing: border-box;
  letter-spacing: 0;
}
.hero {
  position: relative;
  padding: 28rpx 28rpx 22rpx 36rpx;
  border: 0;
  border-bottom: 1rpx solid #DDE7F2;
  background: #FFFFFF !important;
}
.hero::before {
  position: absolute;
  top: 22rpx;
  bottom: 22rpx;
  left: 20rpx;
  width: 6rpx;
  border-radius: 3rpx;
  background: #527CC9;
  content: "";
}
.hero::after {
  top: 0;
  right: 28rpx;
  width: 112rpx;
  height: 8rpx;
  background: #527CC9;
}
.hero .eyebrow { color: #315EA8; }
.hero-title-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 6rpx;
}
.hero-title { margin-top: 0; color: #24324A; }
.hero-date { color: #5C6C84; }
.state-card,
.session-card {
  border-color: #DDE7F2;
  border-radius: 14rpx;
  background: #FFFFFF;
}
.session-card::before { background: #527CC9; }
.se-header {
  min-height: 0;
  padding: 17rpx 18rpx 15rpx 24rpx;
  align-items: flex-start;
}
.stats {
  align-items: flex-start;
  padding: 12rpx 18rpx 12rpx 24rpx;
  background: #F6FAFF;
}
.stat {
  padding: 7rpx 9rpx;
  border-radius: 7rpx;
  background: #EAF2FF;
  color: #315EA8;
  line-height: 1.25;
}
.stat.green {
  background: #EAF2FF;
  color: #315EA8;
}
.stat.gray {
  background: #FFF0ED;
  color: #D66D62;
}
.btn-accent,
.btn-special-main {
  height: 72rpx;
  min-height: 0;
  padding: 0 16rpx;
  line-height: 72rpx;
}
.btn-accent {
  background: #527CC9;
  color: #FFFFFF;
}
.btn-special-main {
  border-color: #BFD0EC;
  background: #FFFFFF;
  color: #315EA8;
}
.stu-row {
  min-height: 0;
  padding: 14rpx 18rpx 14rpx 24rpx;
  align-items: flex-start;
}
.stu-right {
  align-items: flex-start;
  align-self: flex-start;
}
.stu-right .btn-sm {
  height: 54rpx;
  min-height: 0;
  padding: 0;
  line-height: 54rpx;
}
.btn-in { background: #527CC9; }
.btn-out {
  border-color: #BFD0EC;
  background: #EAF2FF;
  color: #315EA8;
}
.btn-remind {
  border-color: #EFC9C2;
  background: #FFF0ED;
  color: #D66D62;
}
.btn-leave {
  border-color: #EFC9C2;
  background: #FFF0ED;
  color: #D66D62;
}
</style>
