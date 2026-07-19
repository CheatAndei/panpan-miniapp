<template>
  <view class="page page-bottom-safe">
    <view class="hero">
      <text class="eyebrow">WEEKLY CHALLENGE</text>
      <text class="hero-title">压轴挑战</text>
      <text class="hero-sub">每周一题 · 聚焦最后一道填空或最后两道大题 · 完成后拍照提交</text>
    </view>
    <pp-state v-if="loading && !assignment" type="loading" title="正在准备本周压轴题" />
    <pp-state v-else-if="error && !assignment" type="error" title="挑战加载失败" :description="error" action-text="重试" @action="loadCurrent" />

    <view v-if="!loading && !assignment && !error" class="choose-card">
      <text class="section-title">这周想挑战哪类压轴题？</text>
      <text class="section-desc">同一套原卷可以同时提供最后一道填空和最后两道大题；领取后本周题型固定。</text>
      <button v-for="item in types" :key="item.value" class="type-card" :disabled="!available[item.value] || claiming" @tap="claim(item.value)">
        <view :class="['type-mark',item.value]">{{ item.short }}</view>
        <view class="type-copy"><text class="type-title">{{ item.label }}</text><text class="type-desc">{{ item.desc }} · 题库 {{ available[item.value] || 0 }} 题</text></view>
        <pp-icon name="arrow" :size="30" />
      </button>
    </view>

    <template v-if="assignment">
      <view class="challenge-card">
        <view class="challenge-head"><view><text class="type-pill">{{ typeLabel(assignment.question_type) }}</text><text class="challenge-title">{{ assignment.title }}</text></view><text class="week-label">{{ assignment.week_start }}</text></view>
        <text class="source">{{ assignment.source_label || '广州七年级数学真题精选' }}</text>
        <pp-state v-if="imageLoading" type="loading" title="正在读取题目图片" />
        <image v-else-if="questionImage" class="question-image" :src="questionImage" mode="widthFix" @tap="preview(questionImage)" />
        <pp-state v-else type="error" title="题目图片暂时无法显示" description="下拉刷新后重试。" />
      </view>

      <view class="submit-card">
        <view class="submit-head"><view><text class="section-title">拍照提交解题过程</text><text class="section-desc">写清题号和步骤，最多 4 张；答案仅老师批阅时可见。</text></view><text v-if="photoCount" class="count">{{ photoCount }} 张</text></view>
        <view v-if="localPhotos.length" class="photo-grid"><image v-for="(src,index) in localPhotos" :key="src" :src="src" mode="aspectFill" @tap="previewPhotos(index)" /></view>
        <button class="upload-btn" :disabled="uploading || photoCount>=4" @tap="chooseAndUpload">{{ uploading?`正在上传 ${progress}`:photoCount?'继续补充照片':'拍照或选择图片' }}</button>
        <view v-if="assignment.submission" :class="['review-state',assignment.submission.status]">
          <text class="review-title">{{ assignment.submission.status==='reviewed'?(assignment.submission.is_correct?'挑战成功':'老师已批阅'):'提交成功，等待老师批阅' }}</text>
          <text v-if="assignment.submission.teacher_note" class="review-note">{{ assignment.submission.teacher_note }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onBackPress, onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';

const studentId=ref(0),loading=ref(false),claiming=ref(false),uploading=ref(false),imageLoading=ref(false);
const error=ref(''),progress=ref(''),assignment=ref(null),questionImage=ref(''),available=ref({}),localPhotos=ref([]);
let allowBack=false;
const types=[
  {value:'fill',short:'填',label:'填空题',desc:'原卷最后一道填空，准确计算并规范作答'},
  {value:'subjective',short:'解',label:'解答题',desc:'原卷最后两道大题，完整表达推理过程'},
];
const photoCount=computed(()=>assignment.value?.submission?.attachments?.length||0);
onLoad((query)=>{studentId.value=Number(query.student_id||uni.getStorageSync('activeChildId')||0);});
onShow(()=>{if(studentId.value)loadCurrent();});
onPullDownRefresh(async()=>{try{await loadCurrent();}finally{uni.stopPullDownRefresh();}});
onBackPress(()=>{
  if(allowBack || !assignment.value || assignment.value.submission)return false;
  uni.showModal({title:'暂存并退出挑战？',content:'本周压轴题会保留，下次进入可继续拍照提交。',confirmText:'暂存退出',cancelText:'继续完成',success:(res)=>{if(res.confirm){allowBack=true;uni.navigateBack();}}});
  return true;
});
async function loadCurrent(){
  if(loading.value)return;loading.value=true;error.value='';
  try{const data=await api.get(`/weekly-challenge/current?student_id=${studentId.value}`);available.value=data.available||{};assignment.value=data.assignment||null;if(assignment.value)await loadImages();}
  catch(e){error.value=e?.error||'请检查网络后重试';}finally{loading.value=false;}
}
async function loadImages(){
  imageLoading.value=true;
  try{questionImage.value=await api.downloadPrivate(assignment.value.question_url);localPhotos.value=await Promise.all((assignment.value.submission?.attachments||[]).map(item=>api.downloadPrivate(item.url)));}
  catch(e){questionImage.value='';}finally{imageLoading.value=false;}
}
async function claim(type){
  if(claiming.value)return;claiming.value=true;
  try{const data=await api.post('/weekly-challenge/assignments',{student_id:studentId.value,question_type:type});assignment.value=data.assignment;await loadImages();}
  catch(e){uni.showToast({title:e?.error||'领取失败',icon:'none'});}finally{claiming.value=false;}
}
function chooseImages(){return new Promise((resolve,reject)=>{const count=Math.max(1,4-photoCount.value);if(uni.chooseMedia)uni.chooseMedia({count,mediaType:['image'],sourceType:['camera','album'],success:r=>resolve((r.tempFiles||[]).map(f=>f.tempFilePath)),fail:reject});else uni.chooseImage({count,sourceType:['camera','album'],success:r=>resolve(r.tempFilePaths||[]),fail:reject});});}
async function chooseAndUpload(){
  try{const files=await chooseImages();if(!files.length)return;uploading.value=true;for(let i=0;i<files.length;i++){progress.value=`${i+1}/${files.length}`;await api.upload(`/weekly-challenge/assignments/${assignment.value.id}/upload`,files[i],'image');}uni.showToast({title:'挑战已提交',icon:'success'});await loadCurrent();}
  catch(e){if(!/cancel/i.test(e?.errMsg||''))uni.showToast({title:e?.error||'上传失败',icon:'none'});}finally{uploading.value=false;progress.value='';}
}
function typeLabel(type){return types.find(item=>item.value===type)?.label||'压轴题';}
function preview(src){uni.previewImage({urls:[src],current:src});}
function previewPhotos(index){uni.previewImage({urls:localPhotos.value,current:localPhotos.value[index]});}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx 48rpx;background:var(--page-bg)}.hero{margin:0 -24rpx 22rpx;padding:50rpx 34rpx 44rpx;border-radius:0 0 34rpx 34rpx;background:linear-gradient(145deg,#183A36,#2F6E61);color:#fff}.eyebrow{display:block;color:#B9DDD3;font-size:19rpx;font-weight:800;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:43rpx;font-weight:780}.hero-sub{display:block;margin-top:8rpx;color:#D8EDE7;font-size:23rpx}.choose-card,.challenge-card,.submit-card{margin-bottom:18rpx;padding:28rpx;border-radius:22rpx;background:#fff;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}.section-title{display:block;color:var(--ink);font-size:30rpx;font-weight:750}.section-desc{display:block;margin-top:6rpx;color:var(--text-muted);font-size:22rpx;line-height:1.5}.type-card{width:100%;min-height:112rpx;display:flex;align-items:center;gap:17rpx;margin:18rpx 0 0;padding:17rpx;border-radius:17rpx;background:var(--surface-muted);text-align:left}.type-card::after,.upload-btn::after{border:0}.type-mark{width:64rpx;height:64rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:18rpx;background:#E1F0EB;color:#276B5C;font-size:28rpx;font-weight:850}.type-mark.fill{background:#FFF0D6;color:#8B5E08}.type-mark.subjective{background:#ECE9F7;color:#5A4B90}.type-copy{flex:1}.type-title{display:block;color:var(--ink);font-size:27rpx;font-weight:720}.type-desc{display:block;margin-top:3rpx;color:var(--text-muted);font-size:20rpx}.challenge-head,.submit-head{display:flex;justify-content:space-between;gap:18rpx}.type-pill{display:inline-block;padding:6rpx 13rpx;border-radius:999rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:20rpx;font-weight:720}.challenge-title{display:block;margin-top:10rpx;color:var(--ink);font-size:29rpx;font-weight:740}.week-label,.count{flex:none;color:var(--text-muted);font-size:20rpx}.source{display:block;margin-top:7rpx;color:var(--text-muted);font-size:21rpx}.question-image{width:100%;margin-top:22rpx;border-radius:14rpx;background:#F5F7F6}.upload-btn{min-height:88rpx;margin:22rpx 0 0;border-radius:15rpx;background:var(--primary);color:#fff;font-size:27rpx;font-weight:720}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10rpx;margin-top:20rpx}.photo-grid image{width:100%;height:180rpx;border-radius:12rpx}.review-state{margin-top:18rpx;padding:18rpx;border-radius:14rpx;background:#FFF8E7;color:#84620C}.review-state.reviewed{background:#EAF5F1;color:#236756}.review-title{display:block;font-size:24rpx;font-weight:720}.review-note{display:block;margin-top:6rpx;color:var(--ink);font-size:23rpx;line-height:1.55}
</style>
