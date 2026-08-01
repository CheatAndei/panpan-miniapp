<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">反馈</view>
    <view class="hero-title-row">
      <view class="title-icon tone-green"><pp-icon name="message" :size="34" motion="pop" /></view>
      <text class="hero-title">课后反馈</text>
    </view>
    <view class="gold-rule"></view>
    <text class="hero-sub">{{ teacherName }}的学习记录</text>
  </view>

  <view v-if="loading && feedbacks.length===0" class="state-card"><pp-state type="loading" title="正在整理课后反馈" /></view>
  <view v-else-if="error && feedbacks.length===0" class="state-card"><pp-state type="error" title="反馈加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>
  <view v-else-if="feedbacks.length===0" class="state-card"><pp-state title="还没有课后反馈" description="老师发布后会出现在这里。" /></view>

  <view v-for="fb in feedbacks" :key="fb.id" class="card fb-card" @tap="showDetail(fb)">
    <view class="fb-head">
      <view class="meta-with-icon"><pp-icon name="calendar" :size="24" /><view class="fb-date">{{ fb.class_date }}</view></view>
      <pp-icon name="arrow" :size="30" />
    </view>
    <view class="fb-summary">{{ (fb.summary||'').slice(0,100) }}{{ fb.summary&&fb.summary.length>100?'...':'' }}</view>
    <view v-if="fb.homework" class="fb-hw"><pp-icon name="pencil" :size="24" /><text>作业：{{ fb.homework }}</text></view>
    <view v-if="fb.notes_pdf_url" class="pdf-link" @tap.stop="openPdf(fb.notes_pdf_url)"><pp-icon name="book" :size="24" /><text>打开学习笔记</text></view>
    <view class="fb-more"><text>查看完整反馈</text><pp-icon name="arrow" :size="24" /></view>
  </view>

  <!-- 详情弹窗 -->
  <view v-if="detail" class="modal-mask" @tap="detail=null">
    <view class="modal" @tap.stop>
      <view class="modal-date">{{ detail.class_date }}</view>
      <scroll-view scroll-y class="modal-body">
        <text class="detail-text">{{ detail.summary }}</text>
        <view v-if="detail.homework" class="hw-block"><pp-icon name="pencil" :size="26" /><text>作业：{{ detail.homework }}</text></view>
        <button v-if="detail.notes_pdf_url" class="pdf-btn" @tap="openPdf(detail.notes_pdf_url)"><pp-icon name="book" :size="28" /><text>打开学习笔记 PDF</text></button>
        <!-- 学生个人反馈 -->
        <view v-if="detail._students && detail._students.length>0" class="stu-fb-section">
          <view class="stu-fb-title"><pp-icon name="users" :size="28" /><text>学生个人反馈</text></view>
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
.page {
  --panpan-green: #0B789A;
  --panpan-green-strong: #050505;
  --panpan-sprout: #0B789A;
  --panpan-coral: #F79BC0;
  --panpan-leaf: #050505;
  --panpan-paper: #F7FCFE;
  --panpan-ink: #050505;
  --panpan-muted: #50545B;
  min-height: 100vh;
  padding-bottom: calc(54rpx + env(safe-area-inset-bottom));
  background: var(--panpan-paper);
}

.hero {
  padding: 38rpx 32rpx 30rpx;
  border-bottom: 1rpx solid #DCE9ED;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(153, 222, 244, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 72%, #E5F8FE 100%);
  text-align: left;
  animation: feedback-enter var(--motion-slow) var(--ease-out) both;
}

.hero .eyebrow { display: inline-flex; padding: 5rpx 12rpx; border-radius: 7rpx; background: #E5F8FE; color: var(--panpan-green-strong); font-size: 20rpx; font-weight: 720; letter-spacing: 0; }
.hero .gold-rule { width: 78rpx; height: 6rpx; display: block; margin-top: 13rpx; border-radius: 3rpx; background: var(--panpan-sprout); }
.hero-title-row { display: flex; align-items: center; gap: 12rpx; margin-top: 9rpx; }
.title-icon { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; }
.title-icon.tone-green { background: #E5F8FE; }
.hero-title { color: var(--panpan-ink); font-size: 40rpx; font-weight: 770; }
.hero-sub { display: block; margin-top: 7rpx; color: var(--panpan-muted); font-size: 23rpx; }
.state-card { margin: 20rpx 24rpx; border: 1rpx solid #DCE9ED; border-radius: 14rpx; background: #FFFFFF; box-shadow: 0 8rpx 20rpx rgba(5, 5, 5, .06); }

.fb-card {
  margin: 16rpx 24rpx 0;
  padding: 23rpx 24rpx;
  border: 1rpx solid #D9E5F3;
  border-left: 6rpx solid var(--panpan-green);
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 20rpx rgba(5, 5, 5, .06);
  animation: feedback-card-enter var(--motion-slow) var(--ease-out) both;
  transition: transform var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
}

.fb-card:active { transform: scale(var(--tap-scale)); box-shadow: none; }
.fb-head { display: flex; align-items: center; justify-content: space-between; }
.meta-with-icon { display: flex; align-items: center; gap: 7rpx; }
.fb-date { color: var(--panpan-muted); font-size: 23rpx; font-variant-numeric: tabular-nums; }
.fb-summary { color: #50545B; font-size: 27rpx; line-height: 1.66; }
.fb-hw { display: flex; align-items: flex-start; gap: 8rpx; margin-top: 11rpx; padding: 12rpx 14rpx; border-left: 5rpx solid var(--panpan-sprout); border-radius: 8rpx; background: #E5F8FE; color: #050505; font-size: 23rpx; line-height: 1.52; }
.fb-hw text,
.hw-block text { flex: 1; min-width: 0; }
.pdf-link { display: inline-flex; align-items: center; gap: 7rpx; margin-top: 11rpx; padding: 10rpx 14rpx; border: 1rpx solid rgba(153, 222, 244, .25); border-radius: 8rpx; background: #E5F8FE; color: #050505; font-size: 23rpx; font-weight: 680; }
.fb-more { display: flex; align-items: center; justify-content: flex-end; gap: 5rpx; margin-top: 12rpx; color: var(--panpan-green-strong); font-size: 23rpx; font-weight: 700; }
.empty { padding: 34rpx; color: var(--panpan-muted); text-align: center; }

.modal-mask { background: rgba(5, 5, 5, .42); }
.modal { max-height: 82vh; display: flex; flex-direction: column; padding: 26rpx; border-radius: 16rpx 16rpx 0 0; background: #FFFFFF; }
.modal-date { margin-bottom: 17rpx; color: var(--panpan-muted); font-size: 25rpx; text-align: center; }
.modal-body { flex: 1; overflow-y: auto; }
.detail-text { color: #50545B; font-size: 27rpx; line-height: 1.75; white-space: pre-wrap; }
.hw-block { display: flex; align-items: flex-start; gap: 9rpx; margin-top: 18rpx; padding: 16rpx; border-left: 5rpx solid var(--panpan-sprout); border-radius: 10rpx; background: #E5F8FE; color: #050505; font-size: 27rpx; line-height: 1.62; }

.pdf-btn,
.btn-cancel {
  width: 100%;
  min-height: 84rpx;
  margin-left: 0;
  margin-right: 0;
  border: none;
  border-radius: 12rpx;
  font-size: 27rpx;
  font-weight: 680;
  text-align: center;
  transition: transform var(--motion-fast) var(--ease-out);
}

.pdf-btn { display: flex; align-items: center; justify-content: center; gap: 9rpx; margin-top: 16rpx; background: var(--panpan-green-strong); color: #FFFFFF; box-shadow: 0 8rpx 16rpx rgba(5, 5, 5, .18); }
.btn-cancel { margin-top: 16rpx; border: 1rpx solid #DCE9ED; background: var(--panpan-paper); color: var(--panpan-muted); }
.pdf-btn:active,
.btn-cancel:active { transform: scale(var(--tap-scale)); }
.pdf-btn::after,
.btn-cancel::after { border: 0; }
.stu-fb-section { margin-top: 22rpx; padding-top: 18rpx; border-top: 1rpx solid #EDF3F5; }
.stu-fb-title { display: flex; align-items: center; gap: 9rpx; margin-bottom: 14rpx; color: var(--panpan-ink); font-size: 27rpx; font-weight: 730; }
.stu-fb-card { margin-bottom: 0; padding: 16rpx 0; border-bottom: 1rpx solid #EDF3F5; border-radius: 0; background: transparent; }
.stu-fb-name { display: block; margin-bottom: 5rpx; color: var(--panpan-green-strong); font-size: 25rpx; font-weight: 700; }
.stu-fb-text { color: #50545B; font-size: 25rpx; line-height: 1.62; }
.fb-imgs { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.fb-thumb { width: 150rpx; height: 150rpx; border: 1rpx solid #DCE9ED; border-radius: 10rpx; background: var(--panpan-paper); }

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
