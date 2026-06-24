<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">课程</view>
    <text class="hero-title">课表管理</text>
    <view class="gold-rule"></view>
    <text class="hero-sub">勾选学习安排 → 发布上课提醒</text>
  </view>

  <view v-if="loading" class="loading">加载中…</view>

  <view class="card" v-if="schedules.length>0 && checkedIds.length>0" style="background:#FEF5E7">
    <button class="btn-accent" @tap="publishChecked">发布上课提醒（已选 {{ checkedIds.length }} 节）</button>
  </view>

  <view class="card">
    <button class="btn-special" @tap="showSpecial=true">特殊发布（自定义日期时间）</button>
  </view>

  <!-- 按天排列 -->
  <view class="card" v-for="day in days" :key="day.value">
    <view class="day-header">
      <text class="day-name">{{ day.label }}</text>
      <button class="btn-sm" @tap="openAdd(day.value)">+</button>
    </view>
    <view v-if="daySchedules(day.value).length===0" class="empty-sm">暂无学习安排</view>
    <view v-for="s in daySchedules(day.value)" :key="s.id"
      :class="['sc-card',bgClass(s.class_id)]" @tap="toggleCheck(s.id)">
      <view class="sc-left">
        <view :class="['checkbox',{on:checkedIds.includes(s.id)}]">{{ checkedIds.includes(s.id)?'✓':'' }}</view>
      </view>
      <view class="sc-right">
        <view class="sc-top">
          <text class="sc-class">{{ s.class_name || '未命名' }}</text>
          <text class="sc-grade">{{ classGrade(s.class_id) }}</text>
        </view>
        <text class="sc-time">{{ s.start_time }} - {{ s.end_time }}</text>
        <text v-if="s.location" class="sc-loc">{{ s.location }}</text>
      </view>
    </view>
  </view>

  <view v-if="showAdd" class="modal-mask" @tap="showAdd=false">
    <view class="modal" @tap.stop>
      <view class="modal-title">添加学习安排 — {{ dayNames[sForm.day_of_week] }}</view>
      <picker :range="classNames" @change="i=>{sForm.class_id=classes[i.detail.value]?.id;sForm.class_name=classNames[i.detail.value]}">
        <view class="input">{{ sForm.class_name||'选择学习小组' }}</view>
      </picker>
      <view class="row">
        <input v-model="sForm.start_time" class="input half" placeholder="开始 如14:00" />
        <input v-model="sForm.end_time" class="input half" placeholder="结束 如16:30" />
      </view>
      <input v-model="sForm.location" class="input" placeholder="地点（可选）" />
      <button class="btn-primary" @tap="saveSched">保存</button>
      <button class="btn-cancel" @tap="showAdd=false">取消</button>
    </view>
  </view>

  <!-- 特殊发布弹窗 -->
  <view v-if="showSpecial" class="modal-mask" @tap="showSpecial=false">
    <view class="modal" @tap.stop>
      <view class="modal-title">特殊发布</view>
      <picker :range="classNames" @change="i=>{spForm.class_id=classes[i.detail.value]?.id;spForm.name=classNames[i.detail.value]}">
        <view class="input">{{ spForm.name||'选择学习小组' }}</view>
      </picker>
      <picker mode="date" :value="spForm.date" @change="e=>spForm.date=e.detail.value">
        <view class="input">{{ spForm.date||'选择日期' }}</view>
      </picker>
      <input v-model="spForm.start_time" class="input" placeholder="开始时间（如14:00）" />
      <input v-model="spForm.end_time" class="input" placeholder="结束时间（如16:00）" />
      <input v-model="spForm.location" class="input" placeholder="地点（可选）" />
      <button class="btn-primary" @tap="specialPublish">确认发布</button>
      <button class="btn-cancel" @tap="showSpecial=false">取消</button>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { toastSuccess, toastError, logError } from '@/utils/ui';
const DAYS = ['周日','周一','周二','周三','周四','周五','周六'];
const ALL_DAYS = [{label:'周五',value:5},{label:'周六',value:6},{label:'周日',value:0},{label:'周一',value:1},{label:'周二',value:2}];
const BG = ['bg0','bg1','bg2','bg3','bg4','bg5','bg6','bg7','bg8','bg9'];

export default {
  data(){return{
    schedules:[],classes:[],classNames:[],checkedIds:[],loading:false,
    showAdd:false,sForm:{class_id:null,class_name:'',day_of_week:5,start_time:'',end_time:'',location:''},
    showSpecial:false,spForm:{class_id:null,name:'',date:new Date().toISOString().slice(0,10),start_time:'',end_time:'',location:''},
    days:ALL_DAYS,dayNames:DAYS
  };},
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      this.loading=true;
      try{
        const [sch,cls]=await Promise.all([api.get('/schedules'),api.get('/classes')]);
        this.classes=cls.classes||[];this.classNames=this.classes.map(c=>c.name+' ('+c.grade+')');
        this.schedules=(sch.schedules||[]).map(s=>{
          const c=this.classes.find(c=>c.id===s.class_id);
          return {...s,class_name:c?.name,class_grade:c?.grade};
        });
      }catch(e){logError('schedule.loadData',e);}
      finally{this.loading=false;}
    },
    daySchedules(day){return this.schedules.filter(s=>s.day_of_week===day).sort((a,b)=>{const ta=parseInt(a.start_time.replace(':',''));const tb=parseInt(b.start_time.replace(':',''));return ta-tb;});},
    classGrade(cid){const c=this.classes.find(c=>c.id===cid);return c?.grade||'';},
    bgClass(cid){const i=this.classes.findIndex(c=>c.id===cid);return BG[Math.min(i,BG.length-1)];},
    toggleCheck(id){const idx=this.checkedIds.indexOf(id);if(idx>-1)this.checkedIds.splice(idx,1);else this.checkedIds.push(id);},
    openAdd(day){this.sForm={class_id:null,class_name:'',day_of_week:day,start_time:'',end_time:'',location:''};this.showAdd=true;},
    async saveSched(){
      if(!this.sForm.class_id||!this.sForm.start_time||!this.sForm.end_time)
        return uni.showToast({title:'请填写学习小组和时间',icon:'none'});
      try{await api.post('/schedules',this.sForm);this.showAdd=false;this.loadData();}
      catch(e){toastError(e,'添加失败');}
    },
    async specialPublish(){
      const f=this.spForm;
      if(!f.class_id||!f.date||!f.start_time||!f.end_time) return uni.showToast({title:'请填写完整',icon:'none'});
      try{
        await api.post('/schedules/special-publish',{class_id:f.class_id,class_date:f.date,start_time:f.start_time,end_time:f.end_time,location:f.location||''});
        toastSuccess('特殊发布成功');
        this.showSpecial=false;
      }catch(e){toastError(e,'发布失败');}
    },
    async publishChecked(){
      if(this.checkedIds.length===0)return uni.showToast({title:'请勾选学习安排',icon:'none'});
      uni.showModal({title:'发布上课提醒',content:'将通知这 '+this.checkedIds.length+' 节课的学生家长。',success:async r=>{
        if(!r.confirm)return;
        try{const res=await api.post('/schedules/publish',{ids:this.checkedIds});toastSuccess('已发布 '+res.count+' 节');this.checkedIds=[];this.loadData();}
        catch(e){toastError(e,'发布失败');}
      }});
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
.btn-accent{background:#D69E2E;color:#fff;border-radius:12rpx;padding:20rpx;font-size:28rpx;border:none;width:100%}
.btn-special{border:1px dashed #D69E2E;color:#D69E2E;background:#fff;border-radius:12rpx;padding:20rpx;font-size:28rpx;width:100%}

.day-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12rpx}
.day-name{font-size:32rpx;font-weight:700;color:#1A365D}
.btn-sm{padding:8rpx 24rpx;background:#EBF0F7;color:#1A365D;border:none;border-radius:8rpx;font-size:24rpx}
.empty-sm{text-align:center;color:#CBD5E0;padding:20rpx;font-size:24rpx}

.sc-card{display:flex;padding:20rpx;border-radius:12rpx;margin-bottom:12rpx;gap:16rpx}
.sc-left{display:flex;align-items:center}
.checkbox{width:44rpx;height:44rpx;border:3rpx solid #CBD5E0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24rpx;color:#fff}
.checkbox.on{background:#38A169;border-color:#38A169}
.sc-right{flex:1}
.sc-top{display:flex;align-items:center;gap:12rpx;margin-bottom:6rpx}
.sc-class{font-size:28rpx;font-weight:700}
.sc-grade{font-size:22rpx;opacity:.7}
.sc-time{font-size:26rpx;font-weight:500;display:block}
.sc-loc{font-size:22rpx;opacity:.6;margin-top:4rpx}
.bg0{background:#EBF0F7;color:#1A365D}.bg1{background:#FEF5E7;color:#B7791F}
.bg2{background:#EBF8FF;color:#2A4365}.bg3{background:#FFFFF0;color:#975A16}
.bg4{background:#F0FFF4;color:#276749}.bg5{background:#EDF2F7;color:#2D3748}
.bg6{background:#FFF8F0;color:#9C4221}.bg7{background:#F0FFFF;color:#234E52}
.bg8{background:#FFF5F5;color:#C53030}.bg9{background:#F0FFF8;color:#1D4044}

.modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;display:flex;align-items:flex-end}
.modal{background:#fff;border-radius:24rpx 24rpx 0 0;padding:30rpx;width:100%}
.modal-title{font-size:34rpx;font-weight:700;text-align:center;margin-bottom:24rpx;color:#1A365D}
.input{border:1rpx solid #E2E8F0;border-radius:10rpx;padding:18rpx;margin-bottom:16rpx;font-size:28rpx;color:#4A5568}
.row{display:flex;gap:16rpx}.half{flex:1}
.btn-primary{background:#1A365D;color:#fff;border-radius:12rpx;padding:24rpx;font-size:30rpx;text-align:center;border:none;width:100%;margin-top:20rpx}
.btn-cancel{background:#fff;color:#A0AEC0;border:none;padding:16rpx;font-size:26rpx;text-align:center;width:100%}
</style>
