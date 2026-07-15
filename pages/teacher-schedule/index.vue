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
    <view class="special-icon"><pp-icon name="calendar" :size="42" /></view>
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
      uni.showModal({title:notify.ok?'发布完成':'课程已发布',content:msg,showCancel:false,confirmColor:'#2F7D6B'});
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
.hero-sub{font-size:24rpx;color:var(--muted);margin-top:4rpx}
.btn-accent{background:#2F7D6B;color:#fff;border-radius:12rpx;padding:20rpx;font-size:28rpx;border:none;width:100%}
.btn-special{border:1px dashed #2F7D6B;color:#2F7D6B;background:#fff;border-radius:12rpx;padding:20rpx;font-size:28rpx;width:100%}

.day-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12rpx}
.day-name{font-size:32rpx;font-weight:700;color:#183A36}
.btn-sm{padding:8rpx 24rpx;background:#EDF5F2;color:#183A36;border:none;border-radius:8rpx;font-size:24rpx}
.empty-sm{text-align:center;color:#A4B1AD;padding:20rpx;font-size:24rpx}

.sc-card{display:flex;padding:20rpx;border-radius:12rpx;margin-bottom:12rpx;gap:16rpx}
.sc-left{display:flex;align-items:center}
.checkbox{width:44rpx;height:44rpx;border:3rpx solid #A4B1AD;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24rpx;color:#fff}
.checkbox.on{background:#2F7D6B;border-color:#2F7D6B}
.sc-right{flex:1}
.sc-top{display:flex;align-items:center;gap:12rpx;margin-bottom:6rpx}
.sc-class{font-size:28rpx;font-weight:700}
.sc-grade{font-size:22rpx;opacity:.7}
.sc-time{font-size:26rpx;font-weight:500;display:block}
.sc-loc{font-size:22rpx;opacity:.6;margin-top:4rpx}
.bg0{background:#EDF5F2;color:#183A36}.bg1{background:#EEF7F3;color:#2F6E61}
.bg2{background:#EDF4F2;color:#52756F}.bg3{background:#F4F2E8;color:#3F7167}
.bg4{background:#E8F4F0;color:#2F735F}.bg5{background:#E9F0ED;color:#183A36}
.bg6{background:#EEF7F3;color:#2F6E61}.bg7{background:#EDF4F2;color:#52756F}
.bg8{background:#FCEEEB;color:#A94F48}.bg9{background:#E8F4F0;color:#2F735F}

.modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;display:flex;align-items:flex-end}
.modal{background:#fff;border-radius:24rpx 24rpx 0 0;padding:30rpx;width:100%}
.modal-title{font-size:34rpx;font-weight:700;text-align:center;margin-bottom:24rpx;color:#183A36}
.input{border:1rpx solid #D5E3DE;border-radius:10rpx;padding:18rpx;margin-bottom:16rpx;font-size:28rpx;color:#536762}
.row{display:flex;gap:16rpx}.half{flex:1}
.btn-primary{background:#183A36;color:#fff;border-radius:12rpx;padding:24rpx;font-size:30rpx;text-align:center;border:none;width:100%;margin-top:20rpx}
.btn-cancel{background:#fff;color:#7C8C87;border:none;padding:16rpx;font-size:26rpx;text-align:center;width:100%}
</style>

<style scoped>
.page{padding-bottom:calc(130rpx + env(safe-area-inset-bottom))}
.hero{padding:46rpx 34rpx 36rpx;background:linear-gradient(150deg,#F9FCFB,#EEF6F3)}
.hero .gold-rule{display:none}
.hero-title{margin-top:8rpx;font-size:40rpx;font-weight:760;color:var(--ink)}
.hero-sub{color:var(--text-muted)}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border)}
.special-entry{min-height:104rpx;display:flex;align-items:center;gap:18rpx;padding:24rpx 26rpx}
.special-icon{width:68rpx;height:68rpx;border-radius:20rpx;display:flex;align-items:center;justify-content:center;background:var(--accent-soft)}
.special-copy{flex:1}.special-title{display:block;color:var(--ink);font-size:28rpx;font-weight:680}.special-desc{display:block;color:var(--text-muted);font-size:23rpx;margin-top:2rpx}
.day-header{min-height:56rpx;margin-bottom:14rpx}
.day-name{color:var(--ink);font-size:30rpx}
.btn-sm{min-height:58rpx;display:flex;align-items:center;gap:4rpx;padding:6rpx 16rpx;border-radius:11rpx;background:var(--accent-soft);color:var(--accent-strong);font-weight:650}
.sc-card{padding:22rpx;border-radius:18rpx;background:var(--surface-muted);border:1rpx solid transparent;color:var(--ink);transition:transform .16s var(--ease-out),border-color .16s var(--ease-out),background-color .16s var(--ease-out)}
.sc-card.selected{background:var(--accent-soft);border-color:#B9D8CF}
.checkbox{width:42rpx;height:42rpx;border-width:2rpx;border-color:#9FB1AC}
.checkbox.on{background:var(--accent);border-color:var(--accent)}
.sc-class{color:var(--ink)}
.sc-grade{color:var(--text-muted);opacity:1}
.sc-delete{margin-left:auto;padding:6rpx 10rpx;color:var(--danger);font-size:22rpx}
.sc-time{color:var(--text-secondary)}.sc-loc{color:var(--text-muted);opacity:1}
.publish-dock{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));background:rgba(243,247,245,.95);border-top:1rpx solid rgba(221,232,228,.85)}
.publish-dock .btn-accent{min-height:88rpx;background:var(--primary);box-shadow:0 12rpx 26rpx rgba(24,58,54,.16)}
.modal{border-radius:32rpx 32rpx 0 0}
.field-label{display:block;margin:6rpx 0 9rpx;color:var(--text-secondary);font-size:25rpx;font-weight:650}
.input{min-height:88rpx;line-height:88rpx;padding:0 22rpx;border-radius:14rpx;background:#FAFCFB;border-color:#D5E3DE;box-sizing:border-box}
.row{align-items:stretch}.half{flex:1;min-width:0}
.half .input{width:100%}
</style>
