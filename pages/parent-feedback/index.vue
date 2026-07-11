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
.page{padding-bottom:calc(60rpx + env(safe-area-inset-bottom))}
.hero{padding:46rpx 34rpx 36rpx;text-align:left;background:linear-gradient(150deg,#F9FCFB,#EEF6F3);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero .gold-rule{display:none}
.hero-title{font-size:40rpx;font-weight:760;color:var(--ink);display:block;margin-top:8rpx}
.hero-sub{font-size:24rpx;color:var(--muted);margin-top:4rpx}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}
.fb-card{margin-bottom:12rpx;padding:28rpx;border-radius:22rpx}
.fb-head{display:flex;align-items:center;justify-content:space-between}
.fb-date{font-size:24rpx;color:#7C8C87;margin-bottom:8rpx}
.fb-summary{font-size:28rpx;color:#536762;line-height:1.6}
.fb-hw{font-size:24rpx;color:#2F7D6B;margin-top:8rpx}
.pdf-link{font-size:24rpx;color:#183A36;background:#EDF5F2;border-radius:8rpx;padding:10rpx 14rpx;margin-top:12rpx;display:inline-flex}
.fb-more{font-size:24rpx;color:var(--accent-strong);display:block;margin-top:14rpx;font-weight:650}
.empty{text-align:center;color:#A4B1AD;padding:40rpx}

.modal{max-height:82vh;display:flex;flex-direction:column}
.modal-date{font-size:28rpx;color:#7C8C87;text-align:center;margin-bottom:20rpx}
.modal-body{flex:1;overflow-y:auto}
.detail-text{font-size:28rpx;line-height:1.8;color:#536762;white-space:pre-wrap}
.hw-block{background:#EEF7F3;padding:16rpx;border-radius:10rpx;margin-top:20rpx;font-size:28rpx;color:#2F6E61}
.pdf-btn{background:#183A36;color:#fff;border:none;padding:18rpx;font-size:28rpx;text-align:center;width:100%;margin-top:18rpx;border-radius:12rpx}
.btn-cancel{background:#F7FAF8;color:#7C8C87;border:none;padding:20rpx;font-size:28rpx;text-align:center;width:100%;margin-top:20rpx;border-radius:12rpx}
.stu-fb-section{margin-top:24rpx;border-top:1rpx solid #E9F0ED;padding-top:20rpx}
.stu-fb-title{font-size:28rpx;font-weight:700;color:#183A36;display:block;margin-bottom:16rpx}
.stu-fb-card{background:#F7FAF8;border-radius:16rpx;padding:20rpx;margin-bottom:12rpx}
.stu-fb-name{font-size:26rpx;font-weight:700;color:#2F7D6B;display:block;margin-bottom:6rpx}
.stu-fb-text{font-size:26rpx;color:#536762;line-height:1.6}
.fb-imgs{display:flex;gap:10rpx;flex-wrap:wrap;margin-top:10rpx}
.fb-thumb{width:150rpx;height:150rpx;border-radius:8rpx}
</style>
