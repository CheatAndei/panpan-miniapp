<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">反馈</view>
    <text class="hero-title">课后反馈</text>
    <view class="gold-rule"></view>
    <text class="hero-sub">潘潘老师的学习记录</text>
  </view>

  <view v-if="loading" class="loading">加载中…</view>
  <view v-else-if="feedbacks.length===0" class="card">
    <view class="empty">暂无反馈</view>
  </view>

  <view v-for="fb in feedbacks" :key="fb.id" class="card fb-card" @tap="showDetail(fb)">
    <view class="fb-date">{{ fb.class_date }}</view>
    <view class="fb-summary">{{ (fb.summary||'').slice(0,100) }}{{ fb.summary&&fb.summary.length>100?'...':'' }}</view>
    <view v-if="fb.homework" class="fb-hw">作业：{{ fb.homework }}</view>
    <view v-if="fb.notes_pdf_url" class="pdf-link" @tap.stop="openPdf(fb.notes_pdf_url)">打开学习笔记</view>
    <text class="fb-more">查看详情 ›</text>
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
export default {
  data(){return{feedbacks:[],detail:null,loading:false};},
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      this.loading=true;
      try{const r=await api.get('/feedbacks/list');this.feedbacks=r.feedbacks||[];}
      catch(e){logError('parentFeedback.loadData',e);}
      finally{this.loading=false;}
    },
    imgUrl(url){return api.assetUrl(url);},
    previewImg(list,i){uni.previewImage({current:this.imgUrl(list[i]),urls:list.map(u=>this.imgUrl(u))});},
    async openPdf(url){
      try{await api.openPdf(url);}
      catch(e){uni.showToast({title:'PDF 打开失败',icon:'none'});}
    },
    showDetail(fb){
      if(fb.student_feedbacks){try{fb._students=JSON.parse(fb.student_feedbacks);}catch(e){fb._students=[];}}
      else fb._students=[];
      this.detail=fb;
    }
  }
};
</script>

<style scoped>
.page{padding-bottom:60rpx}
.hero{padding:40rpx 32rpx 30rpx;text-align:center;background:var(--card);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero .gold-rule{margin:14rpx auto}
.hero-title{font-size:40rpx;font-weight:700;color:var(--ink);display:block}
.hero-sub{font-size:24rpx;color:var(--muted);margin-top:4rpx}
.fb-card{margin-bottom:12rpx}
.fb-date{font-size:24rpx;color:#8A929B;margin-bottom:8rpx}
.fb-summary{font-size:28rpx;color:#46515C;line-height:1.6}
.fb-hw{font-size:24rpx;color:#A57945;margin-top:8rpx}
.pdf-link{font-size:24rpx;color:#202733;background:#F3F1EA;border-radius:8rpx;padding:10rpx 14rpx;margin-top:12rpx;display:inline-flex}
.fb-more{font-size:24rpx;color:#202733;display:block;margin-top:12rpx}
.empty{text-align:center;color:#C3C1BA;padding:40rpx}

.modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99;display:flex;align-items:flex-end}
.modal{background:#fff;border-radius:24rpx 24rpx 0 0;padding:30rpx;width:100%;max-height:75vh;display:flex;flex-direction:column}
.modal-date{font-size:28rpx;color:#8A929B;text-align:center;margin-bottom:20rpx}
.modal-body{flex:1;overflow-y:auto}
.detail-text{font-size:28rpx;line-height:1.8;color:#46515C;white-space:pre-wrap}
.hw-block{background:#F7F1E7;padding:16rpx;border-radius:10rpx;margin-top:20rpx;font-size:28rpx;color:#8D6A3F}
.pdf-btn{background:#202733;color:#fff;border:none;padding:18rpx;font-size:28rpx;text-align:center;width:100%;margin-top:18rpx;border-radius:12rpx}
.btn-cancel{background:#F8F6F1;color:#8A929B;border:none;padding:20rpx;font-size:28rpx;text-align:center;width:100%;margin-top:20rpx;border-radius:12rpx}
.stu-fb-section{margin-top:24rpx;border-top:1rpx solid #EFEDE7;padding-top:20rpx}
.stu-fb-title{font-size:28rpx;font-weight:700;color:#202733;display:block;margin-bottom:16rpx}
.stu-fb-card{background:#F8F6F1;border-radius:10rpx;padding:18rpx;margin-bottom:12rpx}
.stu-fb-name{font-size:26rpx;font-weight:700;color:#A57945;display:block;margin-bottom:6rpx}
.stu-fb-text{font-size:26rpx;color:#46515C;line-height:1.6}
.fb-imgs{display:flex;gap:10rpx;flex-wrap:wrap;margin-top:10rpx}
.fb-thumb{width:150rpx;height:150rpx;border-radius:8rpx}
</style>
