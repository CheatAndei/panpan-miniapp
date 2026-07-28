<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">课程</view>
    <text class="hero-title">课表管理</text>
    <text class="hero-sub">选择学习安排，再发布上课提醒</text>
  </view>

  <view v-if="loading && schedules.length===0" class="state-card"><pp-state type="loading" title="正在整理课表" /></view>
  <view v-else-if="error && schedules.length===0" class="state-card"><pp-state type="error" title="课表加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>

  <view class="publish-dock" v-if="schedules.length>0 && checkedIds.length>0">
    <button class="btn-accent" :disabled="publishing" @tap="publishChecked">{{ publishing ? '发布中...' : `发布提醒（已选 ${checkedIds.length} 节）` }}</button>
  </view>

  <view class="card special-entry" @tap="openSpecial">
    <view class="special-icon"><pp-icon name="calendar" :size="42" motion="pop" /></view>
    <view class="special-copy"><text class="special-title">临时课程</text><text class="special-desc">自定义日期与上课时间</text></view>
    <pp-icon name="arrow" :size="34" />
  </view>

  <view v-if="!loading && !error && schedules.length===0" class="state-card"><pp-state title="还没有固定课表" description="按上课日添加学习安排。" /></view>

  <!-- 按天排列 -->
  <view class="card" v-for="day in days" :key="day.value">
    <view class="day-header">
      <text class="day-name">{{ day.label }}</text>
      <button class="btn-sm" @tap="openAdd(day.value)"><pp-icon name="plus" :size="30" />添加</button>
    </view>
    <view v-if="daySchedules(day.value).length===0" class="empty-sm">暂无学习安排</view>
    <view v-for="s in daySchedules(day.value)" :key="s.id"
      :class="['sc-card',{selected:checkedIds.includes(s.id)}]" @tap="toggleCheck(s.id)">
      <view class="sc-left">
        <view :class="['checkbox',{on:checkedIds.includes(s.id)}]">{{ checkedIds.includes(s.id)?'✓':'' }}</view>
      </view>
      <view class="sc-right">
        <view class="sc-top">
          <text class="sc-class">{{ s.class_name || '未命名' }}</text>
          <text class="sc-grade">{{ classGrade(s.class_id) }}</text>
          <text class="sc-delete" @tap.stop="deleteSchedule(s)">删除</text>
        </view>
        <text class="sc-time">{{ s.start_time }} - {{ s.end_time }}</text>
        <text v-if="s.location" class="sc-loc">{{ s.location }}</text>
      </view>
    </view>
  </view>

  <view v-if="showAdd" class="modal-mask" @tap="showAdd=false">
    <view class="modal" @tap.stop>
      <view class="modal-title">添加学习安排 - {{ dayNames[sForm.day_of_week] }}</view>
      <text class="field-label">学习小组</text>
      <picker :range="classNames" @change="i=>{sForm.class_id=classes[i.detail.value]?.id;sForm.class_name=classNames[i.detail.value]}">
        <view class="input">{{ sForm.class_name||'选择学习小组' }}</view>
      </picker>
      <text class="field-label">上课时间</text>
      <view class="row">
        <picker mode="time" :value="sForm.start_time" class="half" @change="e=>sForm.start_time=e.detail.value"><view class="input">{{ sForm.start_time||'开始时间' }}</view></picker>
        <picker mode="time" :value="sForm.end_time" class="half" @change="e=>sForm.end_time=e.detail.value"><view class="input">{{ sForm.end_time||'结束时间' }}</view></picker>
      </view>
      <text class="field-label">地点</text>
      <input v-model="sForm.location" class="input" placeholder="地点（可选）" />
      <button class="btn-primary" :disabled="savingSchedule" @tap="saveSched">{{ savingSchedule ? '保存中...' : '保存学习安排' }}</button>
      <button class="btn-cancel" @tap="showAdd=false">取消</button>
    </view>
  </view>

  <!-- 特殊发布弹窗 -->
  <view v-if="showSpecial" class="modal-mask" @tap="showSpecial=false">
    <view class="modal" @tap.stop>
      <view class="modal-title">特殊发布</view>
      <text class="field-label">学习小组</text>
      <picker :range="classNames" @change="selectSpecialClass">
        <view class="input">{{ spForm.name||'选择学习小组' }}</view>
      </picker>
      <text class="field-label">上课日期</text>
      <picker mode="date" :value="spForm.date" @change="e=>spForm.date=e.detail.value">
        <view class="input">{{ spForm.date||'选择日期' }}</view>
      </picker>
      <text class="field-label">上课时间</text>
      <view class="row">
        <picker mode="time" :value="spForm.start_time" class="half" @change="e=>spForm.start_time=e.detail.value"><view class="input">{{ spForm.start_time||'开始时间' }}</view></picker>
        <picker mode="time" :value="spForm.end_time" class="half" @change="e=>spForm.end_time=e.detail.value"><view class="input">{{ spForm.end_time||'结束时间' }}</view></picker>
      </view>
      <text class="field-label">地点</text>
      <input v-model="spForm.location" class="input" placeholder="地点（可选）" />
      <button class="btn-primary" :disabled="publishing" @tap="specialPublish">{{ publishing ? '发布中...' : '确认发布' }}</button>
      <button class="btn-cancel" @tap="showSpecial=false">取消</button>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { confirmAction, toastError, logError } from '@/utils/ui';
const DAYS = ['周日','周一','周二','周三','周四','周五','周六'];
const ALL_DAYS = [{label:'周五',value:5},{label:'周六',value:6},{label:'周日',value:0},{label:'周一',value:1},{label:'周二',value:2}];
const BG = ['bg0','bg1','bg2','bg3','bg4','bg5','bg6','bg7','bg8','bg9'];

function localDateString(){
  const date=new Date();
  const pad=(n)=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

export default {
  data(){return{
    schedules:[],classes:[],classNames:[],checkedIds:[],loading:false,error:'',savingSchedule:false,publishing:false,
    showAdd:false,sForm:{class_id:null,class_name:'',day_of_week:5,start_time:'',end_time:'',location:''},
    showSpecial:false,spForm:{class_id:null,name:'',date:localDateString(),start_time:'',end_time:'',location:''},
    days:ALL_DAYS,dayNames:DAYS
  };},
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const [sch,cls]=await Promise.all([api.get('/schedules'),api.get('/classes')]);
        this.classes=cls.classes||[];this.classNames=this.classes.map(c=>c.name+' ('+c.grade+')');
        this.schedules=(sch.schedules||[]).map(s=>{
          const c=this.classes.find(c=>String(c.id)===String(s.class_id));
          return {...s,class_name:c?.name,class_grade:c?.grade};
        });
        this.checkedIds=this.checkedIds.filter(id=>this.schedules.some(s=>String(s.id)===String(id)));
      }catch(e){this.error=e?.error||'请检查网络后重试';logError('schedule.loadData',e);}
      finally{this.loading=false;}
    },
    daySchedules(day){return this.schedules.filter(s=>Number(s.day_of_week)===Number(day)).sort((a,b)=>String(a.start_time||'').localeCompare(String(b.start_time||'')));},
    classGrade(cid){const c=this.classes.find(c=>String(c.id)===String(cid));return c?.grade||'';},
    bgClass(cid){const i=this.classes.findIndex(c=>String(c.id)===String(cid));return BG[Math.max(0,Math.min(i,BG.length-1))];},
    toggleCheck(id){const idx=this.checkedIds.indexOf(id);if(idx>-1)this.checkedIds.splice(idx,1);else this.checkedIds.push(id);},
    openAdd(day){this.sForm={class_id:null,class_name:'',day_of_week:day,start_time:'',end_time:'',location:''};this.showAdd=true;},
    openSpecial(){
      if(this.classes.length===0)return uni.showToast({title:'请先创建学习小组',icon:'none'});
      this.spForm={class_id:null,name:'',date:localDateString(),start_time:'',end_time:'',location:''};
      this.showSpecial=true;
    },
    selectSpecialClass(e){
      const idx=Number(e.detail.value);
      const cls=this.classes[idx];
      if(!cls)return;
      const base=this.schedules.find(s=>Number(s.class_id)===Number(cls.id));
      this.spForm.class_id=cls.id;
      this.spForm.name=this.classNames[idx];
      this.spForm.start_time=base?.start_time||'';
      this.spForm.end_time=base?.end_time||'';
      this.spForm.location=base?.location||'';
    },
    async saveSched(){
      if(this.savingSchedule)return;
      if(!this.sForm.class_id||!this.sForm.start_time||!this.sForm.end_time)
        return uni.showToast({title:'请填写学习小组和时间',icon:'none'});
      if(this.sForm.end_time<=this.sForm.start_time)return uni.showToast({title:'结束时间需晚于开始时间',icon:'none'});
      this.savingSchedule=true;
      try{await api.post('/schedules',this.sForm);this.showAdd=false;await this.loadData();}
      catch(e){toastError(e,'添加失败');}
      finally{this.savingSchedule=false;}
    },
    async specialPublish(){
      if(this.publishing)return;
      const f=this.spForm;
      if(!f.class_id||!f.date||!f.start_time||!f.end_time) return uni.showToast({title:'请填写完整',icon:'none'});
      if(f.end_time<=f.start_time)return uni.showToast({title:'结束时间需晚于开始时间',icon:'none'});
      this.publishing=true;
      try{
        const res=await api.post('/schedules/special-publish',{class_id:f.class_id,class_date:f.date,start_time:f.start_time,end_time:f.end_time,location:f.location||''});
        this.showPublishResult(res,'特殊发布');
        this.showSpecial=false;
      }catch(e){toastError(e,'发布失败');}
      finally{this.publishing=false;}
    },
    async publishChecked(){
      if(this.publishing)return;
      if(this.checkedIds.length===0)return uni.showToast({title:'请勾选学习安排',icon:'none'});
      const confirmed=await confirmAction({title:'发布上课提醒',content:'将通知这 '+this.checkedIds.length+' 节课的学生家长。',confirmText:'发布'});
      if(!confirmed)return;
      this.publishing=true;
      try{const res=await api.post('/schedules/publish',{ids:this.checkedIds});this.showPublishResult(res,'发布');this.checkedIds=[];await this.loadData();}
      catch(e){toastError(e,'发布失败');}
      finally{this.publishing=false;}
    },
    async deleteSchedule(schedule){
      const confirmed=await confirmAction({title:'删除学习安排',content:'删除后，关联的未完成签到任务和反馈也会移除。',confirmText:'删除',danger:true});
      if(!confirmed)return;
      try{await api.del('/schedules/'+schedule.id);this.checkedIds=this.checkedIds.filter(id=>String(id)!==String(schedule.id));await this.loadData();}
      catch(e){toastError(e,'删除失败');}
    },
    showPublishResult(res,title){
      const skipped=res.skipped?`，跳过重复 ${res.skipped} 节`:'';
      if((res.count||0)===0){
        return uni.showToast({title:`没有新增课程${skipped}`,icon:'none'});
      }
      const notify=res.notify||{};
      const notifyReason=notify.error||notify.errors?.[0]||'';
      const msg=notify.ok
        ? `${title} ${res.count} 节并提醒家长${skipped}`
        : `${title} ${res.count} 节，提醒未送达${notifyReason?'：'+notifyReason:''}${skipped}`;
    uni.showModal({title:notify.ok?'发布完成':'课程已发布',content:msg,showCancel:false,confirmColor:'#315EA8'});
    }
  }
};
</script>

<style scoped>
/* Teacher operations theme: timetable rows, not cards inside cards. */
.page {
  min-height: 100vh;
  padding-bottom: calc(116rpx + env(safe-area-inset-bottom));
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
.hero-sub {
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
.page > .card {
  margin: 14rpx 20rpx;
  padding: 20rpx;
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  background: var(--surface);
  box-shadow: none;
}
.special-entry {
  min-height: 86rpx;
  gap: 14rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid var(--border);
  border-left: 5rpx solid var(--gold);
  background: var(--surface);
}
.special-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: 10rpx;
  background: var(--gold-soft);
  color: var(--warning);
}
.special-copy {
  min-width: 0;
  flex: 1;
}
.special-title {
  display: block;
  color: var(--ink);
  font-size: 27rpx;
  font-weight: 700;
}
.special-desc {
  display: block;
  margin-top: 2rpx;
  color: var(--text-muted);
  font-size: 21rpx;
}
.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 50rpx;
  margin-bottom: 4rpx;
}
.day-name {
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 720;
}
.btn-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52rpx;
  padding: 4rpx 13rpx;
  gap: 3rpx;
  border: 1rpx solid #DDE7F2;
  border-radius: 8rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 22rpx;
  font-weight: 650;
}
.empty-sm {
  padding: 22rpx 0 12rpx;
  color: var(--text-muted);
  font-size: 22rpx;
}
.sc-card {
  display: flex;
  margin: 0;
  padding: 18rpx 4rpx;
  gap: 12rpx;
  border: 0;
  border-top: 1rpx solid var(--hairline);
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  box-shadow: none;
}
.sc-left {
  display: flex;
  align-items: center;
}
.sc-card.selected {
  margin: 0 -8rpx;
  padding-right: 12rpx;
  padding-left: 12rpx;
  border-top-color: #DDE7F2;
  border-left: 5rpx solid var(--primary);
  background: var(--primary-soft);
}
.checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #B8C8DC;
  border-radius: 7rpx;
  background: var(--surface);
  color: #FFFFFF;
  font-size: 21rpx;
}
.checkbox.on {
  border-color: var(--primary);
  background: var(--primary);
}
.sc-right {
  min-width: 0;
  flex: 1;
}
.sc-top {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 4rpx;
}
.sc-class {
  color: var(--ink);
  font-size: 26rpx;
  font-weight: 700;
}
.sc-grade {
  color: var(--text-muted);
  font-size: 20rpx;
  opacity: 1;
}
.sc-delete {
  margin-left: auto;
  padding: 4rpx 7rpx;
  color: var(--danger);
  font-size: 20rpx;
}
.sc-time {
  display: block;
  color: var(--text-secondary);
  font-size: 24rpx;
}
.sc-loc {
  display: block;
  margin-top: 2rpx;
  color: var(--text-muted);
  font-size: 20rpx;
  opacity: 1;
}
.bg0,
.bg5 { background: var(--primary-soft); color: var(--primary-strong); }
.bg1,
.bg4,
.bg6,
.bg9 { background: var(--success-soft); color: var(--success); }
.bg2,
.bg7 { background: var(--surface-muted); color: var(--text-secondary); }
.bg3 { background: var(--gold-soft); color: var(--warning); }
.bg8 { background: var(--coral-soft); color: var(--danger); }
.publish-dock {
  position: fixed;
  z-index: 30;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 12rpx 20rpx calc(12rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border);
  background: rgba(248, 252, 249, .98);
}
.publish-dock .btn-accent {
  width: 100%;
  min-height: 84rpx;
  border: 0;
  border-radius: 10rpx;
  background: var(--primary-strong);
  color: #FFFFFF;
  box-shadow: none;
  font-size: 27rpx;
}
.modal-mask {
  position: fixed;
  z-index: 99;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(36, 50, 74, .44);
}
.modal {
  width: 100%;
  padding: 28rpx 26rpx calc(28rpx + env(safe-area-inset-bottom));
  border: 1rpx solid var(--border);
  border-radius: 18rpx 18rpx 0 0;
  background: var(--surface);
  animation: none;
  box-sizing: border-box;
}
.modal-title {
  margin-bottom: 20rpx;
  color: var(--ink);
  font-size: 31rpx;
  text-align: left;
}
.field-label {
  display: block;
  margin: 14rpx 0 7rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
  font-weight: 650;
}
.input {
  width: 100%;
  min-height: 80rpx;
  margin-bottom: 12rpx;
  padding: 0 18rpx;
  border: 1rpx solid var(--border);
  border-radius: 9rpx;
  background: #F6FAFF;
  color: var(--ink);
  font-size: 27rpx;
  line-height: 80rpx;
  box-sizing: border-box;
}
.row {
  display: flex;
  align-items: stretch;
  gap: 10rpx;
}
.half {
  min-width: 0;
  flex: 1;
}
.half .input { width: 100%; }
.btn-primary {
  width: 100%;
  min-height: 86rpx;
  margin-top: 18rpx;
  border: 0;
  border-radius: 10rpx;
  background: var(--primary-strong);
  color: #FFFFFF;
  box-shadow: none;
  font-size: 28rpx;
}
.btn-cancel {
  width: 100%;
  min-height: 70rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
}
.btn-primary[disabled],
.publish-dock .btn-accent[disabled] { opacity: .5; }
.btn-sm::after,
.publish-dock .btn-accent::after,
.btn-primary::after,
.btn-cancel::after { border: 0; }

.special-entry,
.btn-sm,
.sc-card,
.checkbox,
.publish-dock .btn-accent,
.btn-primary,
.btn-cancel {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}
.special-entry:active,
.btn-sm:active,
.sc-card:active,
.checkbox:active,
.publish-dock .btn-accent:active,
.btn-primary:active,
.btn-cancel:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}

@media (prefers-reduced-motion: reduce) {
  .special-entry,
  .btn-sm,
  .sc-card,
  .checkbox,
  .publish-dock .btn-accent,
  .btn-primary,
  .btn-cancel {
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
.hero-title { color: #24324A; }
.hero-sub { color: #5C6C84; }
.state-card,
.page > .card {
  border-color: #DDE7F2;
  border-radius: 14rpx;
  background: #FFFFFF;
}
.special-entry {
  min-height: 0;
  padding: 15rpx 18rpx;
  align-items: flex-start;
  border-left-color: #527CC9;
}
.special-icon {
  background: #EAF2FF;
  color: #315EA8;
}
.day-header {
  min-height: 0;
  align-items: flex-start;
}
.btn-sm {
  height: 54rpx;
  min-height: 0;
  padding: 0 13rpx;
  border-color: #BFD0EC;
  background: #EAF2FF;
  color: #315EA8;
  line-height: 54rpx;
}
.sc-card {
  align-items: flex-start;
  padding: 15rpx 4rpx;
}
.sc-card.selected {
  border-top-color: #BFD0EC;
  border-left-color: #527CC9;
  background: #EAF2FF;
}
.checkbox.on {
  border-color: #527CC9;
  background: #527CC9;
}
.bg0,
.bg5 {
  background: #EAF2FF;
  color: #315EA8;
}
.bg1,
.bg4,
.bg6,
.bg9 {
  background: #EAF2FF;
  color: #315EA8;
}
.bg3 {
  background: #EAF2FF;
  color: #315EA8;
}
.bg8 {
  background: #EAF2FF;
  color: #315EA8;
}
.publish-dock { background: rgba(248, 252, 249, .98); }
.publish-dock .btn-accent,
.btn-primary {
  height: 82rpx;
  min-height: 0;
  padding: 0 18rpx;
  background: #527CC9;
  color: #FFFFFF;
  line-height: 82rpx;
}
.modal {
  border-radius: 16rpx 16rpx 0 0;
  background: #FFFFFF;
}
.input {
  border-color: #DDE7F2;
  background: #F6FAFF;
}
.row {
  align-items: flex-start;
}
.btn-cancel {
  height: 64rpx;
  min-height: 0;
  padding: 0;
  line-height: 64rpx;
}
</style>
