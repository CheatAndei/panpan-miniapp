<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="hero"><view class="hero-mark"><pp-icon name="clipboard" :size="42" motion="ring" :delay="80" /></view><text class="eyebrow">REVIEW DESK</text><text class="hero-title">压轴挑战批阅</text><text class="hero-sub">题目、标准答案和学生过程同屏核对</text></view>
    <view class="tabs"><button v-for="item in tabs" :key="item.value" :class="{on:status===item.value}" @tap="selectStatus(item.value)">{{ item.label }}</button></view>
    <pp-state v-if="loading && !items.length" type="loading" title="正在读取提交" />
    <pp-state v-else-if="error" type="error" title="提交加载失败" :description="error" action-text="重试" @action="load" />
    <pp-state v-else-if="!items.length" title="当前没有待批阅挑战" description="家长拍照提交后会显示在这里。" />
    <view v-for="item in items" :key="item.submission.id" class="review-card">
      <view class="review-head"><view class="review-student"><view class="review-icon"><pp-icon name="report" :size="28" /></view><view><text class="student">{{ item.student_name }}</text><text class="meta">{{ item.class_name }} · {{ typeLabel(item.question_type) }} · 第 {{ item.submission.attempt_no }} 次提交</text></view></view><text :class="['state',item.submission.status]">{{ item.submission.status==='reviewed'?'已批阅':'待批阅' }}</text></view>
      <text class="title">{{ item.title }}</text><text class="source">{{ item.source_label }}</text>
      <view class="asset-actions"><button @tap="showAsset(item.question_url,'question')"><pp-icon name="book" :size="25" />查看题目</button><button @tap="showAnswer(item)"><pp-icon name="check" :size="25" />查看标准答案</button></view>
      <scroll-view scroll-x class="photos"><view class="photo-row"><image v-for="(photo,index) in item.localPhotos" :key="photo" :src="photo" mode="aspectFill" @tap="preview(item.localPhotos,index)" /></view></scroll-view>
      <textarea v-model="item.note" class="note" maxlength="500" placeholder="给家长的批阅说明（可选）" />
      <view class="result-actions"><button class="skip" @tap="skipQuestion(item)">异常题跳过</button><button class="wrong" @tap="review(item,false)">需要订正</button><button class="correct" @tap="review(item,true)">挑战成功</button></view>
    </view>
    <view v-if="answerPreview" class="answer-mask" @tap="answerPreview=null">
      <view class="answer-sheet" @tap.stop>
        <text class="answer-sheet-label">STANDARD ANSWER</text>
        <view class="answer-sheet-title-row"><pp-icon name="book" :size="30" motion="pop" /><text class="answer-sheet-title">标准答案</text></view>
        <pp-math-text class="answer-sheet-math" :value="answerPreview.answer_text || '该题暂未录入答案，请核对原卷。'" align="center" />
        <button class="answer-sheet-close" @tap="answerPreview=null">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
const status=ref('submitted'),loading=ref(false),items=ref([]);
const error=ref('');
const answerPreview=ref(null);
const tabs=[{value:'submitted',label:'待批阅'},{value:'reviewed',label:'已批阅'},{value:'all',label:'全部'}];
onShow(load);onPullDownRefresh(async()=>{try{await load();}finally{uni.stopPullDownRefresh();}});
function selectStatus(value){if(status.value===value)return;status.value=value;items.value=[];error.value='';load();}
async function load(){if(loading.value)return;loading.value=true;error.value='';try{const data=await api.get(`/weekly-challenge/v2/teacher/submissions?status=${status.value}`);items.value=await Promise.all((data.submissions||[]).map(async item=>({...item,note:item.submission?.teacher_note||'',localPhotos:await Promise.all((item.submission?.attachments||[]).map(photo=>api.downloadPrivate(photo.url).catch(()=>''))).then(list=>list.filter(Boolean))})));}catch(e){error.value=e?.error||'加载失败';}finally{loading.value=false;}}
function typeLabel(type){return type==='fill'?'填空题':type==='subjective'?'解答题':'历史题';}
async function showAsset(url){try{const local=await api.downloadPrivate(url);uni.previewImage({urls:[local]});}catch(e){uni.showToast({title:e?.error||'图片读取失败',icon:'none'});}}
async function showAnswer(item){if(item.answer_url)return showAsset(item.answer_url);answerPreview.value=item;}
function preview(urls,index){uni.previewImage({urls,current:urls[index]});}
async function review(item,isCorrect){try{const result=await api.put(`/weekly-challenge/v2/teacher/submissions/${item.submission.id}/review`,{is_correct:isCorrect,teacher_note:item.note});uni.showToast({title:'批阅已保存',icon:'success'});await load();if(isCorrect&&result.promotion?.id)uni.navigateTo({url:`/pages/promotion-posters/index?event_id=${result.promotion.id}&auto=1`});}catch(e){uni.showToast({title:e?.error||'保存失败',icon:'none'});}}
function skipQuestion(item){uni.showModal({title:'跳过异常题',content:'该题会停用，学生可以重新领取。确认继续？',confirmText:'停用并跳过',success:async result=>{if(!result.confirm)return;try{await api.post(`/weekly-challenge/v2/teacher/assignments/${item.id}/skip`,{stop_question:true});uni.showToast({title:'已跳过异常题',icon:'success'});await load();}catch(e){uni.showToast({title:e?.error||'操作失败',icon:'none'});}}});}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx 50rpx;background:var(--page-bg)}.hero{margin:0 -24rpx 20rpx;padding:48rpx 34rpx 40rpx;border-radius:0 0 32rpx 32rpx;background:#FFFFFF;color:#fff}.eyebrow{display:block;color:#B8DED3;font-size:19rpx;font-weight:800;letter-spacing: 0}.hero-title{display:block;margin-top:8rpx;font-size:41rpx;font-weight:780}.hero-sub{display:block;margin-top:7rpx;color:#D7ECE6;font-size:23rpx}.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8rpx;margin-bottom:18rpx;padding:7rpx;border-radius:17rpx;background:#fff;border:1rpx solid var(--border)}.tabs button{min-height:66rpx;margin:0;border-radius:12rpx;background:transparent;color:var(--text-muted);font-size:23rpx}.tabs button::after,.asset-actions button::after,.result-actions button::after{border:0}.tabs button.on{background:var(--primary);color:#fff}.review-card{margin-bottom:18rpx;padding:26rpx;border-radius:22rpx;background:#fff;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}.review-head{display:flex;justify-content:space-between;gap:16rpx}.student{display:block;color:var(--ink);font-size:29rpx;font-weight:750}.meta,.source{display:block;margin-top:5rpx;color:var(--text-muted);font-size:21rpx}.state{padding:7rpx 13rpx;border-radius:999rpx;background:#EEF8F3;color:#15946D;font-size:20rpx}.state.reviewed{background:#E8F5EF;color:#236756}.title{display:block;margin-top:18rpx;color:var(--ink);font-size:26rpx;font-weight:700;line-height:1.45}.asset-actions,.result-actions{display:flex;gap:12rpx;margin-top:18rpx}.asset-actions button{flex:1;min-height:70rpx;margin:0;border-radius:12rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:22rpx}.photos{margin-top:18rpx;white-space:nowrap}.photo-row{display:flex;gap:11rpx}.photo-row image{width:220rpx;height:220rpx;flex:none;border-radius:13rpx}.note{width:100%;min-height:126rpx;margin-top:18rpx;padding:17rpx;box-sizing:border-box;border:1rpx solid var(--border);border-radius:13rpx;background:#FAFCFB;font-size:23rpx}.result-actions button{flex:1;min-height:78rpx;margin:0;border-radius:13rpx;font-size:24rpx;font-weight:720}.wrong{background:#FFF0EE;color:#D94B45}.correct{background:var(--primary);color:#fff}
.skip{background:#F1F3F2!important;color:#5A6A62!important}
.answer-mask{position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;background:rgba(12,31,27,.48)}.answer-sheet{box-sizing:border-box;width:100%;padding:32rpx 28rpx calc(30rpx + env(safe-area-inset-bottom));border-radius:30rpx 30rpx 0 0;background:#fff}.answer-sheet-label{display:block;color:#15946D;font-size:18rpx;font-weight:800;letter-spacing: 0}.answer-sheet-title{display:block;margin-top:5rpx;color:#26352F;font-size:34rpx;font-weight:800}.answer-sheet-math{display:flex;min-height:180rpx;margin-top:22rpx;padding:28rpx;border-radius:18rpx;background:#EEF8F3;color:#26352F;font-size:38rpx;font-weight:720;line-height:1.55}.answer-sheet-close{min-height:84rpx;margin-top:20rpx;border-radius:14rpx;background:#20B486;color:#fff;font-size:26rpx;font-weight:740}.answer-sheet-close::after{border:0}
.page {
  background-color: var(--page-bg, #F8FCF9);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(32, 180, 134, .028) 64rpx 65rpx
  );
}
.hero { border-radius: 0 0 24rpx 24rpx; }
.tabs { box-shadow: var(--shadow-sm); }
.tabs button.on { background: var(--primary-strong); }
.review-card { border-radius: 18rpx; }
.state.reviewed { background: var(--accent-soft); color: var(--accent-strong); }
.asset-actions button { background: var(--primary-soft); color: var(--primary-strong); }
.correct { background: var(--primary-strong); color: #FFFFFF; }
.tabs button,
.review-card,
.asset-actions button,
.result-actions button {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}
.tabs button:active,
.review-card:active,
.asset-actions button:active,
.result-actions button:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}
@media (prefers-reduced-motion: reduce) {
  .tabs button,
  .review-card,
  .asset-actions button,
  .result-actions button {
    transition: none !important;
  }
  .tabs button:active,
  .review-card:active,
  .asset-actions button:active,
  .result-actions button:active { transform: none; }
}
/* mei final pass: terminal review desk */
.page {
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(32, 180, 134, .028) 64rpx 65rpx
  );
}
.hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1rpx solid rgba(32, 180, 134, .16);
  background:
    linear-gradient(rgba(32, 180, 134, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(32, 180, 134, .05) 1rpx, transparent 1rpx),
    linear-gradient(145deg, #FFFFFF, #E8F5EF 72%, #EEF8F3);
  background-size: 34rpx 34rpx, 34rpx 34rpx, auto;
  color: var(--ink);
  box-shadow: 0 12rpx 28rpx rgba(38, 53, 47, .07);
  animation: review-surface-in var(--motion-slow) var(--ease-out) both;
}
.hero::after {
  position: absolute;
  right: 34rpx;
  bottom: 0;
  width: 116rpx;
  height: 8rpx;
  border-radius: 999rpx 999rpx 0 0;
  background: var(--primary);
  content: "";
}
.eyebrow { color: var(--primary-strong); }
.hero-title { color: var(--ink); }
.hero-sub { color: var(--text-secondary); }
.tabs {
  border-color: var(--border);
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}
.tabs button { min-height: 80rpx; }
.tabs button.on { background: var(--primary-strong); color: #FFFFFF; }
.review-card {
  border-color: var(--border);
  border-radius: 18rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
  animation: review-surface-in var(--motion-slow) var(--ease-out) both;
  transition: none;
}
.review-card:active { transform: none; opacity: 1; }
.state { background: var(--primary-soft); color: #15946D; }
.state.reviewed { background: var(--success-soft); color: var(--success); }
.asset-actions button {
  min-height: 80rpx;
  border: 1rpx solid #BFE4D4;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.photo-row image {
  border: 1rpx solid var(--border);
  background: #F8FCF9;
}
.note {
  border-color: var(--border);
  background: #F8FCF9;
  color: var(--ink);
}
.result-actions button { min-height: 88rpx; }
.skip { background: #F1F4F8 !important; color: var(--text-secondary) !important; }
.wrong { background: var(--coral-soft); color: #D94B45; }
.correct {
  background: var(--primary-strong);
  color: #FFFFFF;
  box-shadow: 0 8rpx 18rpx rgba(21, 148, 109, .16);
}
.answer-mask { background: rgba(24, 55, 43, .48); }
.answer-sheet {
  border: 1rpx solid var(--border);
  background: #FFFFFF;
  animation: review-sheet-in var(--motion-slow) var(--ease-out) both;
}
.answer-sheet-label { color: #15946D; }
.answer-sheet-title { color: var(--ink); }
.answer-sheet-math {
  border: 1rpx solid #BFE4D4;
  background: var(--primary-soft);
  color: var(--ink);
}
.answer-sheet-close {
  min-height: 84rpx;
  padding-block: 0;
  background: var(--primary-strong);
  color: #FFFFFF;
}
.tabs button,
.asset-actions button,
.result-actions button,
.answer-sheet-close {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}
.tabs button:active,
.asset-actions button:active,
.result-actions button:active,
.answer-sheet-close:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}
@keyframes review-surface-in {
  from { transform: translateY(12rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes review-sheet-in {
  from { transform: translateY(24rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .hero,
  .review-card,
  .answer-sheet,
  .tabs button,
  .asset-actions button,
  .result-actions button,
  .answer-sheet-close {
    animation: none !important;
    transition: none !important;
  }
  .tabs button:active,
  .asset-actions button:active,
  .result-actions button:active,
  .answer-sheet-close:active { transform: none; }
}

/* Student challenge theme v3: review desk uses white space, green action, coral correction. */
.student-challenge-page {
  --page-bg: #F8FCF9;
  --surface: #FFFFFF;
  --surface-muted: #F1F8F4;
  --ink: #26352F;
  --text-secondary: #5A6A62;
  --text-muted: #6D7C74;
  --primary: #20B486;
  --primary-strong: #15946D;
  --primary-soft: #E8F5EF;
  --coral: #FF7468;
  --coral-soft: #FFF0EE;
  --danger: #D94B45;
  --border: #D5E6DE;
  min-height: 100vh;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(0deg, transparent 0 55rpx, rgba(32, 180, 134, .05) 56rpx 57rpx);
  color: var(--ink);
}
.student-challenge-page .hero {
  min-height: 0;
  margin-bottom: 18rpx;
  padding: 34rpx 30rpx 28rpx;
  border: 0;
  border-bottom: 6rpx solid var(--primary);
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}
.student-challenge-page .hero::after { display: none; }
.student-challenge-page .eyebrow,
.student-challenge-page .answer-sheet-label { color: var(--primary-strong); }
.student-challenge-page .hero-title,
.student-challenge-page .student,
.student-challenge-page .answer-sheet-title { color: var(--ink); }
.student-challenge-page .hero-sub,
.student-challenge-page .meta,
.student-challenge-page .note { color: var(--text-secondary); }
.student-challenge-page .tabs,
.student-challenge-page .review-card,
.student-challenge-page .answer-sheet {
  min-height: 0;
  border-color: var(--border);
  border-radius: 16rpx;
  background: var(--surface);
  box-shadow: 0 6rpx 18rpx rgba(38, 53, 47, .06);
}
.student-challenge-page .tabs { align-items: start; }
.student-challenge-page .tabs button {
  min-height: 76rpx;
  padding: 8rpx 14rpx;
  border-radius: 12rpx;
  background: transparent;
  color: var(--text-secondary);
}
.student-challenge-page .tabs button.on {
  background: var(--primary);
  color: #FFFFFF;
}
.student-challenge-page .asset-actions,
.student-challenge-page .result-actions { align-items: start; }
.student-challenge-page .asset-actions button,
.student-challenge-page .result-actions button {
  min-height: 82rpx;
  padding: 8rpx 14rpx;
  border-radius: 14rpx;
}
.student-challenge-page .asset-actions button,
.student-challenge-page .skip {
  border-color: var(--border);
  background: var(--surface-muted) !important;
  color: var(--text-secondary) !important;
}
.student-challenge-page .wrong {
  background: var(--coral-soft);
  color: var(--danger);
}
.student-challenge-page .correct,
.student-challenge-page .answer-sheet-close {
  background: var(--primary);
  color: #FFFFFF;
}
.student-challenge-page .correct {
  box-shadow: 0 8rpx 18rpx rgba(21, 148, 109, .16);
}
.student-challenge-page .answer-mask {
  background: rgba(24, 55, 43, .48);
}
.student-challenge-page .answer-sheet-close {
  min-height: 84rpx;
  padding-block: 0;
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
  border: 1rpx solid #BFE4D4;
  border-radius: 14rpx;
  background: var(--primary-soft);
}

.student-challenge-page .review-student,
.student-challenge-page .asset-actions button,
.student-challenge-page .answer-sheet-title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.student-challenge-page .review-student {
  min-width: 0;
  gap: 11rpx;
}

.student-challenge-page .review-icon {
  width: 50rpx;
  height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 11rpx;
  background: var(--primary-soft);
}
.student-challenge-page .answer-sheet-math {
  min-height: 0;
  padding: 22rpx;
  border-radius: 14rpx;
  background: var(--surface-muted);
  color: var(--ink);
}
</style>
