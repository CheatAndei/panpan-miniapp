<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="hero">
      <view class="hero-mark"><pp-icon name="target" :size="42" motion="bob" :delay="80" /></view>
      <text class="eyebrow">TERMINAL CHALLENGE</text>
      <text class="hero-title">压轴挑战</text>
      <text class="hero-sub">连续闯关 · 答错重交同题 · 答对后填空与解答交替</text>
    </view>
    <pp-state v-if="loading && !assignment" type="loading" title="正在准备本周压轴题" />
    <pp-state v-else-if="error && !assignment" type="error" title="挑战加载失败" :description="error" action-text="重试" @action="loadCurrent" />

    <view v-if="!loading && !assignment && !error && !nextQuestionType" class="choose-card">
      <view class="section-title-row"><pp-icon name="book" :size="30" motion="pop" :delay="180" /><text class="section-title">想挑战哪类压轴题？</text></view>
      <text class="section-desc">每天首次可自选；通关后两类题交替，未提交前可换 1 次同类型题。</text>
      <button v-for="(item,index) in types" :key="item.value" class="type-card" :disabled="!available[item.value] || claiming" @tap="claim(item.value)">
        <view class="type-icon"><pp-icon name="exam" :size="30" :motion="index === 0 ? 'pop' : 'none'" :delay="260" :stagger="70" :index="index" /></view>
        <view :class="['type-mark',item.value]">{{ item.short }}</view>
        <view class="type-copy"><text class="type-title">{{ item.label }}</text><text class="type-desc">{{ item.desc }} · 题库 {{ available[item.value] || 0 }} 题</text></view>
        <pp-icon name="arrow" :size="30" />
      </button>
    </view>

    <template v-if="assignment">
      <view class="challenge-card">
        <view class="challenge-head"><view class="challenge-title-row"><view class="challenge-icon"><pp-icon name="target" :size="32" motion="shine" :delay="120" /></view><view><text class="type-pill">{{ typeLabel(assignment.question_type) }}</text><text class="challenge-title">{{ assignment.title }}</text></view></view><text class="week-label">已通关 {{ progress[assignment.question_type]||0 }} 题</text></view>
        <text class="source">{{ assignment.source_label || '广州七年级数学真题精选' }}</text>
        <pp-question-reader
          :src="questionImage"
          :loading="imageLoading"
          :error="!imageLoading&&!questionImage"
          :alt="assignment.title+'题图'"
          @retry="loadImages"
          @image-error="questionImage=''"
        />
        <button v-if="canChange" class="change-btn" :disabled="claiming" @tap="changeQuestion">换一道同类型题 · 今日剩余 {{ changeRemaining }} 次</button>
      </view>

      <view class="submit-card">
        <view class="submit-head"><view class="section-title-row"><pp-icon name="pencil" :size="30" motion="pop" :delay="240" /><view><text class="section-title">拍照提交解题过程</text><text class="section-desc">写清题号和步骤，最多 4 张；答案仅老师批阅时可见。</text></view></view><text v-if="photoCount" class="count">{{ photoCount }} 张</text></view>
        <view v-if="localPhotos.length" class="photo-grid"><image v-for="(src,index) in localPhotos" :key="src" :src="src" mode="aspectFill" @tap="previewPhotos(index)" /></view>
        <button class="upload-btn" :disabled="uploading || assignment.status==='submitted' || photoCount>=4" @tap="chooseAndUpload">{{ assignment.status==='submitted'?'等待老师批阅':uploading?`正在上传 ${uploadProgress}`:assignment.status==='reviewed_wrong'?'重新拍照提交':photoCount?'继续补充照片':'拍照或选择图片' }}</button>
        <view v-if="assignment.submission" :class="['review-state',assignment.submission.status]">
          <text class="review-title">{{ assignment.status==='reviewed_wrong'?'本次未通过，可修改后重新提交同一道题':'提交成功，等待老师批阅' }}</text>
          <text v-if="assignment.submission.teacher_note" class="review-note">{{ assignment.submission.teacher_note }}</text>
        </view>
      </view>
    </template>

    <view v-if="!loading&&!assignment&&lastPassed&&nextQuestionType" class="passed-card">
      <view class="passed-mark"><pp-icon name="check" :size="42" motion="pop" :delay="100" /></view>
      <text class="passed-title">挑战通过</text>
      <text class="passed-desc">{{ lastPassed.title }} 已计入通关记录，下一题将切换为{{ typeLabel(nextQuestionType) }}。</text>
      <button class="poster-btn" @tap="openAchievements">生成通关成就海报</button>
      <button class="upload-btn" :disabled="claiming || !available[nextQuestionType]" @tap="claim(nextQuestionType)">{{ claiming?'领取中…':available[nextQuestionType]?`领取${typeLabel(nextQuestionType)}`:`${typeLabel(nextQuestionType)}题库待补充` }}</button>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onBackPress, onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';

const studentId=ref(0),loading=ref(false),claiming=ref(false),uploading=ref(false),imageLoading=ref(false);
const error=ref(''),uploadProgress=ref(''),assignment=ref(null),lastPassed=ref(null),questionImage=ref(''),available=ref({}),localPhotos=ref([]);
const gradeCode=ref('g7'),progress=ref({}),canChange=ref(false),changeRemaining=ref(0),nextQuestionType=ref(null);
let allowBack=false,loadPromise=null,reloadCurrent=false;
const types=[
  {value:'fill',short:'填',label:'填空题',desc:'原卷最后一道填空，准确计算并规范作答'},
  {value:'subjective',short:'解',label:'解答题',desc:'原卷最后两道大题，完整表达推理过程'},
];
const photoCount=computed(()=>assignment.value?.status==='reviewed_wrong'?0:(assignment.value?.submission?.attachments?.length||0));
onLoad((query)=>{studentId.value=Number(query.student_id||uni.getStorageSync('activeChildId')||0);gradeCode.value=['g7','g8','g9'].includes(String(query.grade||''))?String(query.grade):'g7';});
onShow(()=>{if(studentId.value)loadCurrent();});
onPullDownRefresh(async()=>{try{await loadCurrent();}finally{uni.stopPullDownRefresh();}});
onBackPress(()=>{
  if(allowBack || !assignment.value || assignment.value.submission)return false;
  uni.showModal({title:'暂存并退出挑战？',content:'这道压轴题会保留，下次进入可继续拍照提交。',confirmText:'暂存退出',cancelText:'继续完成',success:(res)=>{if(res.confirm){allowBack=true;uni.navigateBack();}}});
  return true;
});
async function runCurrentLoads(){
  loading.value=true;
  try{
    do{
      reloadCurrent=false;error.value='';
      try{const data=await api.get(`/weekly-challenge/v2/current?student_id=${studentId.value}&grade=${gradeCode.value}&subject=math`);available.value=data.available||{};progress.value=data.progress||{};assignment.value=data.assignment||null;lastPassed.value=data.last_passed||null;nextQuestionType.value=data.next_question_type||null;canChange.value=Boolean(data.can_change);changeRemaining.value=Number(data.change_remaining||0);if(assignment.value)await loadImages();else{questionImage.value='';localPhotos.value=[];}}
      catch(e){error.value=e?.error||'请检查网络后重试';}
    }while(reloadCurrent);
  }finally{loading.value=false;}
}
function loadCurrent(){
  if(loadPromise){reloadCurrent=true;return loadPromise;}
  loadPromise=runCurrentLoads().finally(()=>{loadPromise=null;});
  return loadPromise;
}
async function loadImages(){
  imageLoading.value=true;
  try{questionImage.value=await api.downloadPrivate(assignment.value.question_url);localPhotos.value=await Promise.all((assignment.value.submission?.attachments||[]).map(item=>api.downloadPrivate(item.url)));}
  catch(e){questionImage.value='';}finally{imageLoading.value=false;}
}
async function claim(type){
  if(claiming.value)return;claiming.value=true;
  try{if(loadPromise)await loadPromise;const data=await api.post('/weekly-challenge/v2/assignments',{student_id:studentId.value,grade:gradeCode.value,subject:'math',question_type:type});assignment.value=data.assignment;lastPassed.value=null;await loadCurrent();}
  catch(e){uni.showToast({title:e?.error||'领取失败',icon:'none'});}finally{claiming.value=false;}
}
function chooseImages(){return new Promise((resolve,reject)=>{const count=Math.max(1,4-photoCount.value);if(uni.chooseMedia)uni.chooseMedia({count,mediaType:['image'],sourceType:['camera','album'],success:r=>resolve((r.tempFiles||[]).map(f=>f.tempFilePath)),fail:reject});else uni.chooseImage({count,sourceType:['camera','album'],success:r=>resolve(r.tempFilePaths||[]),fail:reject});});}
async function chooseAndUpload(){
  try{const files=await chooseImages();if(!files.length)return;uploading.value=true;for(let i=0;i<files.length;i++){uploadProgress.value=`${i+1}/${files.length}`;await api.upload(`/weekly-challenge/v2/assignments/${assignment.value.id}/upload`,files[i],'image');}uni.showToast({title:'挑战已提交',icon:'success'});await loadCurrent();}
  catch(e){if(!/cancel/i.test(e?.errMsg||''))uni.showToast({title:e?.error||'上传失败',icon:'none'});}finally{uploading.value=false;uploadProgress.value='';}
}
async function changeQuestion(){
  if(!assignment.value||!canChange.value||claiming.value)return;claiming.value=true;
  try{await api.post(`/weekly-challenge/v2/assignments/${assignment.value.id}/change`,{});uni.showToast({title:'已更换题目',icon:'success'});await loadCurrent();}
  catch(e){uni.showToast({title:e?.error||'更换失败',icon:'none'});}finally{claiming.value=false;}
}
function typeLabel(type){return types.find(item=>item.value===type)?.label||'压轴题';}
function previewPhotos(index){uni.previewImage({urls:localPhotos.value,current:localPhotos.value[index]});}
function openAchievements(){uni.navigateTo({url:`/pages/achievements/index?student_id=${studentId.value}`});}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx 48rpx}.hero{margin:0 -24rpx 22rpx;padding:50rpx 34rpx 44rpx}.eyebrow{display:block;font-size:19rpx;font-weight:800}.hero-title{display:block;margin-top:8rpx;font-size:43rpx;font-weight:780}.hero-sub{display:block;margin-top:8rpx;font-size:23rpx}.choose-card,.challenge-card,.submit-card{margin-bottom:18rpx;padding:28rpx}.section-title{display:block;font-size:30rpx;font-weight:750}.section-desc{display:block;margin-top:6rpx;font-size:22rpx;line-height:1.5}.type-card{width:100%;min-height:112rpx;display:flex;align-items:center;gap:17rpx;margin:18rpx 0 0;padding:17rpx;text-align:left}.type-mark{width:64rpx;height:64rpx;display:flex;align-items:center;justify-content:center;flex:none;font-size:28rpx;font-weight:850}.type-copy{flex:1}.type-title{display:block;font-size:27rpx;font-weight:720}.type-desc{display:block;margin-top:3rpx;font-size:20rpx}.challenge-head,.submit-head{display:flex;justify-content:space-between;gap:18rpx}.type-pill{display:inline-block;padding:6rpx 13rpx;font-size:20rpx;font-weight:720}.challenge-title{display:block;margin-top:10rpx;font-size:29rpx;font-weight:740}.week-label,.count{flex:none;font-size:20rpx}.source{display:block;margin-top:7rpx;font-size:21rpx}.question-image{width:100%;margin-top:22rpx}.upload-btn{min-height:88rpx;margin:22rpx 0 0;font-size:27rpx;font-weight:720}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10rpx;margin-top:20rpx}.photo-grid image{width:100%;height:180rpx}.review-state{margin-top:18rpx;padding:18rpx}.review-title{display:block;font-size:24rpx;font-weight:720}.review-note{display:block;margin-top:6rpx;font-size:23rpx;line-height:1.55}
.change-btn{min-height:68rpx;margin:14rpx 0 0;font-size:22rpx}.passed-card{margin-bottom:18rpx;padding:42rpx 28rpx;text-align:center}.passed-mark{width:76rpx;height:76rpx;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:46rpx;font-weight:800}.passed-title{display:block;margin-top:18rpx;font-size:34rpx;font-weight:800}.passed-desc{display:block;margin-top:6rpx;font-size:23rpx;line-height:1.55}
.poster-btn{min-height:76rpx;margin:20rpx 0 10rpx;font-size:23rpx;font-weight:760}

/* 压轴挑战：浅色试卷页，珊瑚提示风险、薄荷表示通过。 */
.page {
  overflow-x: hidden;
}

.hero {
  position: relative;
  margin: 0 -24rpx 22rpx;
  padding: 44rpx 34rpx 38rpx;
}
.hero::after {
  content: '';
  position: absolute;
  right: 34rpx;
  top: 28rpx;
  width: 112rpx;
  height: 18rpx;
  opacity: .78;
  transform: rotate(2deg);
}
.type-card:active { transform: scale(var(--tap-scale)); }
.type-card[disabled] { opacity: .5; }

.change-btn {
  min-height: 88rpx;
}

.upload-btn,
.poster-btn {
  min-height: 112rpx;
}
.upload-btn:active,
.poster-btn:active,
.change-btn:active { transform: scale(var(--tap-scale)); }
.upload-btn[disabled],
.poster-btn[disabled],
.change-btn[disabled] { opacity: .5; }

@media (max-width: 360px) {
  .challenge-head,
  .submit-head { flex-direction: column; }
  .week-label,
  .count { align-self: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  .type-card:active,
  .upload-btn:active,
  .poster-btn:active,
  .change-btn:active { transform: none; }
}

/* Student challenge theme v3: warm paper and one energetic teaching green. */
.student-challenge-page {
  --page-bg: #F6FAFF;
  --surface: #FFFFFF;
  --surface-muted: #F8FBFF;
  --ink: #24324A;
  --text-secondary: #5C6C84;
  --text-muted: #6E7D91;
  --primary: #527CC9;
  --primary-strong: #315EA8;
  --primary-soft: #EDF5FF;
  --accent: #527CC9;
  --accent-strong: #315EA8;
  --accent-soft: #EDF5FF;
  --coral: #E98577;
  --coral-soft: #FFF0ED;
  --danger: #D66D62;
  --border: #DDE7F2;
  --hairline: #E9F0F8;
  --r: 16rpx;
  --r-sm: 14rpx;
  --r-xs: 10rpx;
  --r-lg: 16rpx;
  --shadow-sm: 0 6rpx 18rpx rgba(36, 50, 74, .06);
  --shadow: 0 10rpx 28rpx rgba(36, 50, 74, .08);
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 55rpx,
    rgba(82, 124, 201, .045) 56rpx 57rpx
  );
  color: var(--ink);
}

.student-challenge-page .hero {
  min-height: 0;
  margin: 0 -24rpx 18rpx;
  padding: 34rpx 30rpx 28rpx;
  border-bottom: 7rpx solid var(--primary);
  border-radius: 0;
  background-color: var(--surface);
  box-shadow: none;
}

.student-challenge-page .hero::after {
  top: 0;
  right: 34rpx;
  bottom: auto;
  width: 94rpx;
  height: 10rpx;
  border-radius: 0 0 4rpx 4rpx;
  background: var(--primary);
  opacity: 1;
  transform: none;
}

.student-challenge-page .eyebrow {
  color: var(--primary-strong);
  font-size: 18rpx;
  letter-spacing: 0;
}

.student-challenge-page .hero-title {
  margin-top: 10rpx;
  color: var(--ink);
  font-size: 44rpx;
}

.student-challenge-page .hero-sub {
  color: var(--text-secondary);
}

.student-challenge-page .choose-card,
.student-challenge-page .challenge-card,
.student-challenge-page .submit-card,
.student-challenge-page .passed-card {
  margin-bottom: 16rpx;
  padding: 26rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .choose-card {
  border-top: 7rpx solid var(--accent);
}

.student-challenge-page .challenge-card {
  border-top: 7rpx solid var(--primary);
}

.student-challenge-page .submit-card {
  border-top: 7rpx solid var(--primary);
}

.student-challenge-page .section-title,
.student-challenge-page .type-title,
.student-challenge-page .challenge-title {
  color: var(--ink);
}

.student-challenge-page .section-desc,
.student-challenge-page .type-desc,
.student-challenge-page .week-label,
.student-challenge-page .count,
.student-challenge-page .source {
  color: var(--text-muted);
}

.student-challenge-page .type-card {
  min-height: 0;
  margin-top: 14rpx;
  padding: 16rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  box-shadow: none;
}

.student-challenge-page .type-mark {
  width: 64rpx;
  height: 64rpx;
  border-radius: var(--r-xs);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.student-challenge-page .type-mark.fill {
  background: var(--primary-soft);
  color: #315EA8;
}

.student-challenge-page .type-mark.subjective {
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.student-challenge-page .type-pill {
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: #315EA8;
}

.student-challenge-page .change-btn {
  min-height: 84rpx;
  border: 1rpx solid #CADCF2;
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--primary-strong);
}

.student-challenge-page .photo-grid {
  gap: 10rpx;
}

.student-challenge-page .photo-grid image {
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
}

.student-challenge-page .upload-btn,
.student-challenge-page .poster-btn {
  min-height: 96rpx;
  border-radius: var(--r-sm);
  box-shadow: none;
}

.student-challenge-page .upload-btn {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .poster-btn {
  border: 1rpx solid #DDEEFF;
  background: var(--primary-soft);
  color: #315EA8;
}

.student-challenge-page .review-state {
  padding: 18rpx;
  border: 1rpx solid #DDEEFF;
  border-left: 7rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
  color: #315EA8;
}

.student-challenge-page .review-state.reviewed,
.student-challenge-page .review-state.passed {
  border-color: #DDEEFF;
  border-left-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.student-challenge-page .review-state.reviewed_wrong,
.student-challenge-page .review-state.rejected {
  border-color: #EFC9C2;
  border-left-color: var(--coral);
  background: var(--coral-soft);
  color: #D66D62;
}

.student-challenge-page .review-note {
  color: var(--text-secondary);
}

.student-challenge-page .passed-card {
  border-color: #DDEEFF;
  border-top: 7rpx solid var(--accent);
  background: var(--surface);
}

.student-challenge-page .passed-mark {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--r-sm);
  background: var(--accent);
  color: #FFFFFF;
}

.student-challenge-page .passed-title {
  color: var(--ink);
}

.student-challenge-page .passed-desc {
  color: var(--text-secondary);
}

.student-challenge-page .hero-mark {
  position: absolute;
  top: 24rpx;
  right: 28rpx;
  width: 70rpx;
  height: 70rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #CADCF2;
  border-radius: 14rpx;
  background: var(--primary-soft);
}

.student-challenge-page .section-title-row,
.student-challenge-page .challenge-title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.student-challenge-page .type-icon,
.student-challenge-page .challenge-icon {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1rpx solid #CADCF2;
  border-radius: 12rpx;
  background: var(--primary-soft);
}

.student-challenge-page .passed-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft);
}
</style>
