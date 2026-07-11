<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">考勤</view>
    <text class="hero-title">签到管理</text>
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
          s._checked=false;s._out=false;s._leave=false;s._inTime='';s._outTime='';s._outNote='';s._busy=false;
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
.page{padding-bottom:80rpx}
.hero{padding:40rpx 32rpx 30rpx;background:var(--card);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero .gold-rule{margin:14rpx 0}
.hero-title{font-size:38rpx;font-weight:700;color:var(--ink);display:block}
.hero-date{font-size:24rpx;color:var(--muted);margin-top:4rpx}
.session-card{margin-bottom:8rpx}
.se-header{display:flex;justify-content:space-between;align-items:center}
.se-title{font-size:30rpx;font-weight:700;color:#183A36;display:block}
.se-date{font-size:24rpx;color:#7C8C87;margin-top:4rpx}
.se-toggle{font-size:24rpx;color:#7C8C87}
.btn-accent{background:#2F7D6B;color:#fff;border-radius:12rpx;padding:12rpx;font-size:24rpx;border:none;width:100%}
.btn-special-main{background:#183A36;color:#fff;border-radius:12rpx;padding:14rpx;font-size:26rpx;border:none;width:100%;font-weight:700}
.mb-sm{margin-bottom:16rpx}
.btn-sm{padding:10rpx 24rpx;border-radius:8rpx;font-size:24rpx;border:none}
.btn-in{background:#2F7D6B;color:#fff}.btn-out{background:#52756F;color:#fff}.btn-leave{background:#F4F2E8;color:#3F7167}
.stats{display:flex;gap:24rpx;margin-bottom:16rpx}
.stat{font-size:26rpx;color:#536762}.stat.green{color:#2F7D6B}.stat.gray{color:#7C8C87}
.stu-row{display:flex;justify-content:space-between;align-items:center;padding:18rpx 0;border-bottom:1rpx solid #E5EEEB}
.stu-row.leave{opacity:.4}
.stu-left{display:flex;flex-direction:column}
.stu-right{display:flex;align-items:center;justify-content:flex-end;gap:12rpx;flex-wrap:wrap;min-width:224rpx}
.stu-right .btn-sm{width:104rpx;min-width:104rpx;padding:10rpx 0;margin:0;line-height:1.4}
.s-name{font-size:30rpx;font-weight:600}
.s-status{font-size:24rpx;margin-top:4rpx}
.st-time{font-size:20rpx;font-weight:400;margin-left:4rpx}
.note-text{font-size:22rpx;color:#A94F48;margin-top:6rpx;line-height:1.45}
.time-text{font-size:24rpx;color:#7C8C87}
.empty{text-align:center;color:#A4B1AD;padding:40rpx;font-size:28rpx}
.empty-sm{text-align:center;color:#A4B1AD;padding:20rpx;font-size:24rpx}
.swiper-wrap{position:relative;overflow:hidden}
.swiper-inner{transition:transform .2s}
.swipe-del{position:absolute;right:0;top:0;bottom:0;width:120rpx;background:#C75D54;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26rpx;transform:translateX(120rpx);transition:transform .2s}
.swipe-del.show{transform:translateX(0)}
</style>

<style scoped>
.page{padding-bottom:calc(80rpx + env(safe-area-inset-bottom))}
.hero{padding:46rpx 34rpx 36rpx;background:linear-gradient(150deg,#F9FCFB,#EEF6F3)}
.hero .gold-rule{display:none}
.hero-title{margin-top:8rpx;font-size:40rpx;font-weight:760;color:var(--ink)}
.hero-date{color:var(--text-muted)}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border)}
.session-card{padding:0;border-radius:22rpx;overflow:hidden;border-color:var(--border);box-shadow:var(--shadow-sm)}
.se-header{min-height:96rpx;padding:26rpx 28rpx}
.se-title{color:var(--ink);font-size:30rpx}
.se-date{color:var(--text-muted)}
.se-toggle{transition:transform .18s var(--ease-out)}
.se-toggle.open{transform:rotate(90deg)}
.stats{margin:0 28rpx 18rpx;padding:18rpx 20rpx;border-radius:14rpx;background:var(--surface-muted);justify-content:space-between}
.stat{color:var(--text-muted);font-size:24rpx}.stat.green{color:var(--success);font-weight:650}
.btn-accent,.btn-special-main{width:auto;min-height:76rpx;margin-left:28rpx;margin-right:28rpx;border-radius:14rpx;font-size:26rpx}
.btn-special-main{background:var(--primary)}
.stu-row{min-height:108rpx;padding:20rpx 28rpx;border-color:var(--hairline)}
.stu-row.leave{opacity:.6}
.s-name{color:var(--ink);font-weight:680}
.stu-right .btn-sm{min-height:64rpx;border-radius:11rpx;font-weight:650}
.btn-in{background:var(--accent);color:#fff}.btn-out{background:var(--info);color:#fff}.btn-leave{background:var(--warning-soft);color:var(--warning)}
.swipe-del{background:var(--danger)}
</style>
