<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">反馈</view>
    <text class="hero-title">课后反馈</text>
    <view class="gold-rule"></view>
    <text class="hero-sub">{{ teacherName }}的学习记录</text>
  </view>

  <view v-if="loading && feedbacks.length===0" class="state-card"><pp-state type="loading" title="正在整理课后反馈" /></view>
  <view v-else-if="error && feedbacks.length===0" class="state-card"><pp-state type="error" title="反馈加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>
  <view v-else-if="feedbacks.length===0" class="state-card"><pp-state title="还没有课后反馈" description="老师发布后会出现在这里。" /></view>

  <view v-for="fb in feedbacks" :key="fb.id" class="card fb-card" @tap="showDetail(fb)">
    <view class="fb-head"><view class="fb-date">{{ fb.class_date }}</view><pp-icon name="arrow" :size="34" /></view>
    <view class="fb-summary">{{ (fb.summary||'').slice(0,100) }}{{ fb.summary&&fb.summary.length>100?'...':'' }}</view>
    <view v-if="fb.homework" class="fb-hw">作业：{{ fb.homework }}</view>
    <view v-if="fb.notes_pdf_url" class="pdf-link" @tap.stop="openPdf(fb.notes_pdf_url)">打开学习笔记</view>
    <text class="fb-more">查看完整反馈</text>
  </view>

  <!-- 详情弹窗 -->
  <view v-if="detail" class="modal-mask" @tap="detail=null">
    <view class="modal" @tap.stop>
      <view class="modal-date">{{ detail.class_date }}</view>
      <scroll-view scroll-y class="modal-body">
        <text class="detail-text">{{ detail.summary }}</text>
        <view v-if="detail.homework" class="hw-block">作业：{{ detail.homework }}</view>
        <button v-if="detail.notes_pdf_url" class="pdf-btn" @tap="openPdf(detail.notes_pdf_url)">打开学习笔记 PDF</button>
        <!-- 学生个人反馈 -->
        <view v-if="detail._students && detail._students.length>0" class="stu-fb-section">
          <text class="stu-fb-title">学生个人反馈</text>
          <view v-for="s in detail._students" :key="s.id" class="stu-fb-card">
            <text class="stu-fb-name">{{ s.name }}</text>
            <text class="stu-fb-text">{{ s.text }}</text>
            <view v-if="s.images && s.images.length>0" class="fb-imgs">
              <image v-for="(img,i) in s.images" :key="i" :src="imgUrl(img)" mode="aspectFill" class="fb-thumb" @tap="previewImg(s.images,i)" />
            </view>
          </view>
        </view>
      </scroll-view>
      <button class="btn-cancel" @tap="detail=null">关闭</button>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
import { teacherNameFromChild } from '@/utils/brand';
export default {
  data(){return{feedbacks:[],detail:null,loading:false,error:'',teacherName:'孩子的老师'};},
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const kids=await api.get('/bind/students');
        const activeId=String(uni.getStorageSync('activeChildId')||'');
        const child=(kids.students||[]).find(k=>String(k.id)===activeId)||(kids.students||[])[0];
        const r=await api.get('/feedbacks/list'+(child?.class_id?'?class_id='+child.class_id:''));
        this.feedbacks=r.feedbacks||[];
        this.teacherName=teacherNameFromChild(child);
      }
      catch(e){this.error=e?.error||'请检查网络后重试';logError('parentFeedback.loadData',e);}
      finally{this.loading=false;}
    },
    imgUrl(url){return api.assetUrl(url);},
    previewImg(list,i){uni.previewImage({current:this.imgUrl(list[i]),urls:list.map(u=>this.imgUrl(u))});},
    async openPdf(url){
      try{await api.openPdf(url);}
      catch(e){uni.showToast({title:'PDF 打开失败',icon:'none'});}
    },
    showDetail(fb){
      let students=[];
      if(fb.student_feedbacks){try{students=JSON.parse(fb.student_feedbacks);}catch(e){students=[];}}
      this.detail={...fb,_students:Array.isArray(students)?students:[]};
    }
  }
};
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: calc(60rpx + env(safe-area-inset-bottom)); background: var(--page-bg); }

.hero {
  position: relative;
  padding: 46rpx 34rpx 36rpx;
  border-bottom: 1rpx solid var(--hairline);
  background: linear-gradient(150deg, #FFFFFF, var(--primary-soft));
  text-align: left;
  animation: feedback-enter var(--motion-slow) var(--ease-out) both;
}

.hero::after {
  content: '';
  position: absolute;
  right: 36rpx;
  bottom: 32rpx;
  width: 70rpx;
  height: 48rpx;
  border: 3rpx solid rgba(82, 124, 201, .2);
  border-radius: 12rpx;
  box-shadow: -12rpx -12rpx 0 rgba(244, 199, 91, .22);
}

.hero .eyebrow { color: var(--primary-strong); }
.hero .gold-rule { display: none; }
.hero-title { display: block; margin-top: 8rpx; color: var(--ink); font-size: 40rpx; font-weight: 760; }
.hero-sub { display: block; margin-top: 4rpx; color: var(--text-muted); font-size: 24rpx; }
.state-card { margin: 22rpx 24rpx; border: 1rpx solid var(--border); border-radius: var(--r); background: var(--surface); box-shadow: var(--shadow-sm); }

.fb-card {
  margin-bottom: 14rpx;
  padding: 28rpx;
  border-radius: var(--r);
  animation: feedback-card-enter var(--motion-slow) var(--ease-out) both;
  transition: transform var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
}

.fb-card:active { transform: scale(var(--tap-scale)); box-shadow: none; }
.fb-head { display: flex; align-items: center; justify-content: space-between; }
.fb-date { margin-bottom: 8rpx; color: var(--text-muted); font-size: 24rpx; font-variant-numeric: tabular-nums; }
.fb-summary { color: var(--text-secondary); font-size: 28rpx; line-height: 1.7; }
.fb-hw { display: block; margin-top: 12rpx; padding: 14rpx 16rpx; border-radius: var(--r-xs); background: var(--warning-soft); color: var(--warning); font-size: 24rpx; line-height: 1.55; }
.pdf-link { display: inline-flex; margin-top: 12rpx; padding: 12rpx 16rpx; border-radius: var(--r-xs); background: var(--primary-soft); color: var(--primary-strong); font-size: 24rpx; font-weight: 650; }
.fb-more { display: block; margin-top: 14rpx; color: var(--primary-strong); font-size: 24rpx; font-weight: 650; }
.empty { padding: 40rpx; color: var(--text-muted); text-align: center; }

.modal { max-height: 82vh; display: flex; flex-direction: column; }
.modal-date { margin-bottom: 20rpx; color: var(--text-muted); font-size: 26rpx; text-align: center; }
.modal-body { flex: 1; overflow-y: auto; }
.detail-text { color: var(--text-secondary); font-size: 28rpx; line-height: 1.8; white-space: pre-wrap; }
.hw-block { margin-top: 20rpx; padding: 18rpx; border-radius: var(--r-sm); background: var(--warning-soft); color: var(--warning); font-size: 28rpx; line-height: 1.65; }

.pdf-btn,
.btn-cancel {
  width: 100%;
  min-height: 88rpx;
  border: none;
  border-radius: var(--r-sm);
  font-size: 28rpx;
  font-weight: 650;
  text-align: center;
  transition: transform var(--motion-fast) var(--ease-out);
}

.pdf-btn { margin-top: 18rpx; background: var(--primary-strong); color: #FFFFFF; }
.btn-cancel { margin-top: 20rpx; background: var(--surface-muted); color: var(--text-muted); }
.pdf-btn:active,
.btn-cancel:active { transform: scale(var(--tap-scale)); }
.pdf-btn::after,
.btn-cancel::after { border: 0; }
.stu-fb-section { margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid var(--hairline); }
.stu-fb-title { display: block; margin-bottom: 16rpx; color: var(--ink); font-size: 28rpx; font-weight: 720; }
.stu-fb-card { margin-bottom: 12rpx; padding: 20rpx; border: 1rpx solid var(--hairline); border-radius: var(--r-sm); background: var(--surface-muted); }
.stu-fb-name { display: block; margin-bottom: 6rpx; color: var(--primary-strong); font-size: 26rpx; font-weight: 700; }
.stu-fb-text { color: var(--text-secondary); font-size: 26rpx; line-height: 1.65; }
.fb-imgs { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.fb-thumb { width: 150rpx; height: 150rpx; border-radius: var(--r-xs); background: var(--surface-muted); }

@keyframes feedback-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes feedback-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .fb-card { animation: none; }
  .fb-card,
  .pdf-btn,
  .btn-cancel { transition: none; }
}
</style>
