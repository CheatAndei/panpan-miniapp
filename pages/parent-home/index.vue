<template>
<view class="page">
  <view v-if="loading" class="loading">加载中…</view>
  <!-- 孩子卡片 -->
  <view class="hero hero-navy" v-if="child">
    <view class="greeting">{{ greeting }}，{{ child.name }}家长</view>
    <pp-avatar :name="child.name" :size="128" class="avatar" />
    <text class="child-name">{{ child.name }}</text>
    <text class="child-class">{{ child.className }}</text>
  </view>

  <!-- 签到 -->
  <view class="card" v-if="todayCheckin">
    <view :class="['checkin-badge', checkinBadgeClass(todayCheckin)]">
      <view :class="['i-dot',todayCheckin.checkedIn?'green':'amber']"></view>
      {{ checkinText(todayCheckin) }}
    </view>
    <view v-if="todayCheckin.checkOutNote" class="checkin-note">{{ todayCheckin.checkOutNote }}</view>
    <button class="notify-btn" @tap="requestSubscribe">接收签到签退和反馈提醒</button>
    <button class="notify-test-btn" @tap="sendTestNotify">测试服务通知</button>
  </view>

  <!-- 学习小组详情入口 -->
  <view class="card" @tap="nav('/pages/parent-schedule/index')">
    <view class="card-head">
      <text class="card-title">学习小组详情</text>
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
      <text class="card-title">最新反馈</text>
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
    <button v-if="feedback.notes_pdf_url" class="pdf-btn" @tap.stop="openPdf(feedback.notes_pdf_url)">打开学习笔记 PDF</button>
  </view>

  <view class="card" v-else>
    <view class="card-title">最新反馈</view>
    <view class="empty-sm">暂无反馈</view>
  </view>

  <!-- 老师印象入口 -->
  <view class="card" @tap="nav('/pages/mine/index')">
    <view class="card-head">
      <text class="card-title">在老师印象中的孩子</text>
      <text class="card-arrow">查看详情</text>
    </view>
    <view v-if="profile" class="tags">
      <text v-for="t in (profile.tags||[])" :key="t" class="tag tag-blue">{{ t }}</text>
    </view>
    <view v-else class="empty-sm">老师还未填写印象</view>
  </view>

  <view class="card">
    <button class="btn-outline" @tap="nav('/pages/parent-leave/index')">请假申请</button>
  </view>

  <view class="footer">小程序由潘潘独立制作与维护<br/>如有问题欢迎私信反馈<br/>桂ICP备2026013218号-2</view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
export default {
  data(){return{
    child:null,todayCheckin:null,schedules:[],feedback:null,profile:null,loading:false,refreshTimer:null,
    dayNames:['周日','周一','周二','周三','周四','周五','周六'],fbImages:[],notifyTpls:[]
  };},
  computed:{
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
      this.refreshTimer=setInterval(()=>this.loadData(),15000);
    },
    stopAutoRefresh(){
      if(this.refreshTimer)clearInterval(this.refreshTimer);
      this.refreshTimer=null;
    },
    async loadData(){
      const t=uni.getStorageSync('token');if(!t)return;
      this.loading=true;
      try{
        const kids=await api.get('/bind/students');
        const list=kids.students||[];
        const activeId=String(uni.getStorageSync('activeChildId')||'');
        this.child=(activeId?list.find(k=>String(k.id)===activeId):null)||list[0]||null;
        const s={student:this.child};
        const [c,sc,f,p]=await Promise.all([
          api.get('/checkins/today'+(s.student?.id?'?student_id='+s.student.id:'')),
          api.get('/schedules/parent'),api.get('/feedbacks/latest'+(s.student?.class_id?'?class_id='+s.student.class_id:'')),api.get('/profiles/my')
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
        if(this.feedback&&this.feedback.image_urls){
          try{this.fbImages=JSON.parse(this.feedback.image_urls).map(u=>api.assetUrl(u));}catch(e){this.fbImages=[];}
        }
      }catch(e){logError('parentHome.loadData',e);}
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
        this.notifyTpls=[...new Set([tplRes.checkin,tplRes.checkout,tplRes.feedback].filter(Boolean))];
      }catch(e){logError('parentHome.loadNotifyTemplates',e);}
    },
    async requestSubscribe(){
      const tmplIds=this.notifyTpls;
      if(tmplIds.length===0){
        this.loadNotifyTemplates();
        uni.showToast({title:'提醒模板未加载',icon:'none'});
        return {accepted:0};
      }
      return new Promise((resolve,reject)=>{
        uni.requestSubscribeMessage({
          tmplIds,
          success:res=>{
            const accepted=tmplIds.filter(id=>res[id]==='accept').length;
            uni.showToast({title:accepted>0?'提醒已开启':'未开启提醒',icon:accepted>0?'success':'none'});
            resolve({accepted,raw:res});
          },
          fail:e=>{
            logError('parentHome.subscribe',e);
            uni.showToast({title:'订阅弹窗失败',icon:'none'});
            reject(e);
          }
        });
      });
    },
    async sendTestNotify(){
      try{
        const sub=await this.requestSubscribe();
        if(!sub?.accepted)return;
        const r=await api.post('/notify/test',{type:'checkin'});
        uni.showModal({title:'测试已发送',content:'请在微信「服务通知」里查看。',showCancel:false});
      }catch(e){
        const msg=e?.error||e?.errmsg||e?.detail||'发送失败';
        uni.showModal({title:'测试失败',content:String(msg).slice(0,120),showCancel:false});
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
.page{padding-bottom:40rpx}
.hero{display:flex;flex-direction:column;align-items:center;padding:46rpx 0 44rpx}
.greeting{font-size:34rpx;font-weight:700;color:#202733;margin-bottom:20rpx}
.avatar{margin-bottom:8rpx}
.child-name{font-size:36rpx;font-weight:700;color:#202733;margin-top:14rpx}
.child-class{font-size:24rpx;color:#69717D;margin-top:4rpx}

.checkin-badge{display:flex;align-items:center;gap:10rpx;padding:16rpx 20rpx;border-radius:10rpx;font-size:28rpx;font-weight:600}
.checkin-badge.in{background:#EEF5EF;color:#3F7A5B}
.checkin-badge.done{background:#EEF2F7;color:#425B76}
.checkin-badge.out{background:#F7F2E5;color:#7B5B36}
.checkin-badge.leave{background:#F7EDEA;color:#9F4E43}
.checkin-note{margin-top:12rpx;color:#9F4E43;font-size:24rpx;line-height:1.5}

.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14rpx}
.card-title{font-size:28rpx;font-weight:700;color:#202733}
.card-arrow{font-size:24rpx;color:#8A929B}

.sc-line{display:flex;gap:12rpx;padding:8rpx 0;font-size:26rpx;align-items:center}
.sc-day{color:#A57945;font-weight:600;min-width:96rpx;font-size:24rpx}
.sc-time{color:#8A929B;width:120rpx;font-size:24rpx}
.sc-name{color:#46515C}

.fb-date{font-size:24rpx;color:#8A929B;margin-bottom:8rpx}
.fb-text{font-size:28rpx;color:#46515C;line-height:1.6;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
.fb-images{display:flex;gap:10rpx;margin-top:14rpx;flex-wrap:wrap}
.fb-img{width:150rpx;height:150rpx;border-radius:8rpx;background:#ECE8E0}
.img-more{width:150rpx;height:150rpx;border-radius:8rpx;background:#F8F6F1;display:flex;align-items:center;justify-content:center;font-size:36rpx;color:#8A929B}
.fb-hw{font-size:24rpx;color:#A57945;margin-top:10rpx}
.notify-btn{margin-top:16rpx;background:#F3F1EA;color:#202733;border:1rpx solid #E5E0D8;border-radius:10rpx;padding:16rpx;font-size:26rpx;width:100%}
.notify-test-btn{margin-top:12rpx;background:#202733;color:#fff;border:none;border-radius:10rpx;padding:16rpx;font-size:26rpx;width:100%}
.pdf-btn{margin-top:14rpx;background:#202733;color:#fff;border:none;border-radius:10rpx;padding:18rpx;font-size:26rpx;width:100%}

.tags{display:flex;gap:10rpx;flex-wrap:wrap}
.empty-sm{text-align:center;color:#C3C1BA;padding:24rpx;font-size:26rpx}

.btn-outline{border:1px solid #202733;color:#202733;background:#fff;border-radius:10rpx;padding:20rpx;font-size:28rpx;width:100%;font-weight:600}
.footer{text-align:center;color:#AAB0B7;font-size:24rpx;padding:40rpx 30rpx 30rpx;line-height:1.6}
</style>
