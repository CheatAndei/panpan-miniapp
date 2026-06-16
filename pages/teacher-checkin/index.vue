<template>
<view class="page">
  <view class="hero">
    <text class="hero-title">签到管理</text>
    <text class="hero-date">{{ today }}</text>
  </view>

  <!-- 已发布学习安排 -->
  <view v-if="sessions.length===0" class="card">
    <view class="empty">暂无已发布的学习安排，先去「课表管理」发布上课提醒</view>
  </view>

  <view v-for="se in sessions" :key="se.id" class="card session-card swiper-wrap">
    <view class="swiper-inner" :style="{transform:'translateX('+(se._swiped?-120:0)+'rpx)'}"
      @touchstart="onTouchStart($event,se)" @touchmove="onTouchMove($event,se)" @touchend="onTouchEnd($event,se)">
    <view class="se-header" @tap="toggleSession(se)">
      <view>
        <text class="se-title">{{ se.title }}</text>
        <text class="se-date">{{ se.class_date }} {{ dayNames[new Date(se.class_date).getDay()] }} {{ se.start_time }}-{{ se.end_time }}</text>
      </view>
      <text class="se-toggle">{{ se._open ? '▾' : '▸' }}</text>
    </view>

    <view v-if="se._open">
      <view v-if="se._loading" class="empty-sm">加载中...</view>
      <view v-else-if="se._students && se._students.length>0">
        <view class="stats">
          <text class="stat">共{{ se._students.length }}人</text>
          <text class="stat green">已到{{ se._students.filter(s=>s._checked).length }}人</text>
          <text class="stat gray">未到{{ se._students.filter(s=>!s._checked&&!s._leave).length }}人</text>
        </view>
        <button v-if="se._students.filter(s=>!s._checked&&!s._leave).length>0" class="btn-accent mb-sm" @tap="checkInAll(se)">一键签到剩余全部</button>
        <view v-for="s in se._students" :key="s.id" class="stu-row" :class="{leave:s._leave}">
          <view class="stu-left">
            <text class="s-name">{{ s.name }}</text>
            <view :class="['i-badge',s._leave?'warn':s._out?'out':s._checked?'in':'out']">{{ s._leave?'请假':s._out?'已签退':s._checked?'已签到':'待签到' }}<text v-if="statusText(s)" class="st-time"> {{ statusText(s) }}</text></view>
          </view>
          <view class="stu-right">
            <button v-if="!s._leave&&!s._checked" class="btn-sm btn-in" @tap="checkIn(se,s)">签到</button>
            <button v-if="s._checked&&!s._out" class="btn-sm btn-out" @tap="checkOut(se,s)">签退</button>
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
import BASE, { ASSET_BASE } from '@/utils/config';
const DAYS = ['周日','周一','周二','周三','周四','周五','周六'];

export default {
  data(){return{
    sessions:[],today:'',dayNames:DAYS
  };},
  onLoad(){this.today=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});this.loadSessions();},
  methods:{
    async loadSessions(){
      try{
        const res=await this.req('/schedules/sessions');
        this.sessions=(res.sessions||[]).map(se=>({...se,_open:false,_students:[],_loading:false}));
      }catch(e){}
    },
    async toggleSession(se){
      se._open=!se._open;
      if(se._open && se._students.length===0){await this.loadStudents(se);}
    },
    async loadStudents(se){
      se._loading=true;
      try{
        const res=await this.req('/students?class_id='+se.class_id);
        const students=(res.students||[]).map(s=>{
          s._checked=false;s._out=false;s._leave=false;s._inTime='';s._outTime='';
          return s;
        });
        // 查签到状态
        for(const s of students){
          try{
            const ci=await this.req('/checkins/status?student_id='+s.id+'&date='+se.class_date);
            s._checked=ci.checkedIn||false;s._out=ci.checkedOut||false;
            s._inTime=ci.checkInTime?new Date(ci.checkInTime).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
            s._outTime=ci.checkOutTime?new Date(ci.checkOutTime).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
            s._leave=ci.onLeave||false;
          }catch(e){}
        }
        se._students=students;
      }catch(e){}finally{se._loading=false;}
    },
    async checkIn(se,s){
      try{await this.req('/checkins/check-in','POST',{studentId:s.id,classDate:se.class_date,studentName:s.name});
        s._checked=true;s._inTime=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        uni.showToast({title:s.name+' 已签到',icon:'success'});}
      catch(e){uni.showToast({title:'签到失败',icon:'none'});}
    },
    async checkOut(se,s){
      try{await this.req('/checkins/check-out','POST',{studentId:s.id,studentName:s.name,classDate:se.class_date});
        s._out=true;s._outTime=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
        uni.showToast({title:s.name+' 已签退',icon:'success'});
        const allDone=se._students.every(s=>s._leave||s._out);
        if(allDone){await this.req('/schedules/sessions/'+se.id+'/complete','PUT');this.sessions=this.sessions.filter(x=>x.id!==se.id);}
      }catch(e){uni.showToast({title:'签退失败',icon:'none'});}
    },
    async checkInAll(se){
      const notChecked=se._students.filter(s=>!s._checked&&!s._leave);
      for(const s of notChecked){try{await this.checkIn(se,s);}catch{}}
    },
    statusText(s){if(s._leave)return'请假';if(s._out)return s._outTime;if(s._checked)return s._inTime;return'';},
    statusClass(s){if(s._leave)return'st-leave';if(s._out)return'st-out';if(s._checked)return'st-in';return'st-absent';},
    onTouchStart(e,se){se._startX=e.touches[0].clientX;se._swiping=true;},
    onTouchMove(e,se){if(!se._swiping)return;const dx=e.touches[0].clientX-se._startX;if(dx<-40){se._swiped=true;}else if(dx>40){se._swiped=false;}},
    onTouchEnd(e,se){se._swiping=false;},
    async delSession(se){
      uni.showModal({title:'删除学习安排',content:'确定删除该已发布学习安排？',success:async r=>{
        if(!r.confirm)return;
        await this.delSessionSilent(se);
      }});
    },
    async delSessionSilent(se){
      try{await this.req('/schedules/sessions/'+se.id,'DELETE');this.loadSessions();}
      catch(e){}
    },
    req(p,m='GET',d){const t=uni.getStorageSync('token');return new Promise((resolve,reject)=>{uni.request({url:BASE+p,method:m,data:d,header:{Authorization:`Bearer ${t}`},success(r){if(r.statusCode===200)resolve(r.data);else reject(r.data);},fail:reject});});}
  }
};
</script>

<style scoped>
.page{padding-bottom:80rpx}
.hero{padding:30rpx;background:#fff;border-bottom:1rpx solid #EDF2F7}
.hero-title{font-size:38rpx;font-weight:700;color:#1A365D;display:block}
.hero-date{font-size:24rpx;opacity:.7;margin-top:6rpx}
.session-card{margin-bottom:8rpx}
.se-header{display:flex;justify-content:space-between;align-items:center}
.se-title{font-size:30rpx;font-weight:700;color:#1A365D;display:block}
.se-date{font-size:24rpx;color:#A0AEC0;margin-top:4rpx}
.se-toggle{font-size:24rpx;color:#A0AEC0}
.btn-accent{background:#D69E2E;color:#fff;border-radius:12rpx;padding:12rpx;font-size:24rpx;border:none;width:100%}
.mb-sm{margin-bottom:16rpx}
.btn-sm{padding:10rpx 24rpx;border-radius:8rpx;font-size:24rpx;border:none}
.btn-in{background:#38A169;color:#fff}.btn-out{background:#3182CE;color:#fff}
.stats{display:flex;gap:24rpx;margin-bottom:16rpx}
.stat{font-size:26rpx;color:#4A5568}.stat.green{color:#38A169}.stat.gray{color:#A0AEC0}
.stu-row{display:flex;justify-content:space-between;align-items:center;padding:18rpx 0;border-bottom:1rpx solid #F0F0F0}
.stu-row.leave{opacity:.4}
.stu-left{display:flex;flex-direction:column}
.s-name{font-size:30rpx;font-weight:600}
.s-status{font-size:24rpx;margin-top:4rpx}
.st-time{font-size:20rpx;font-weight:400;margin-left:4rpx}
.time-text{font-size:24rpx;color:#A0AEC0}
.empty{text-align:center;color:#CBD5E0;padding:40rpx;font-size:28rpx}
.empty-sm{text-align:center;color:#CBD5E0;padding:20rpx;font-size:24rpx}
.swiper-wrap{position:relative;overflow:hidden}
.swiper-inner{transition:transform .2s}
.swipe-del{position:absolute;right:0;top:0;bottom:0;width:120rpx;background:#E53E3E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26rpx;transform:translateX(120rpx);transition:transform .2s}
.swipe-del.show{transform:translateX(0)}
</style>
