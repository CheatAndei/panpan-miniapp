<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="hero"><view class="hero-mark"><pp-icon name="clipboard" :size="42" motion="ring" :delay="80" /></view><text class="eyebrow">REVIEW DESK</text><text class="hero-title">压轴挑战批阅</text><text class="hero-sub">题目、标准答案和学生过程同屏核对</text></view>
    <view class="tabs"><button v-for="item in tabs" :key="item.value" :class="{on:status===item.value}" @tap="selectStatus(item.value)">{{ item.label }}</button></view>
    <pp-state v-if="loading && !items.length" type="loading" title="正在读取提交" />
    <pp-state v-else-if="error" type="error" title="提交加载失败" :description="error" action-text="重试" @action="load" />
    <pp-state
      v-else-if="!items.length"
      :title="status==='reviewed'?'还没有最近批阅记录':'当前没有待批阅挑战'"
      :description="status==='reviewed'?'完成批阅后，最近记录会显示在这里。':'家长拍照提交后会显示在这里。'"
    />
    <view v-for="item in visibleItems" :key="item.submission.id" class="review-card">
      <view class="review-head"><view class="review-student"><view class="review-icon"><pp-icon name="report" :size="28" /></view><view><text class="student">{{ item.student_name }}</text><text class="meta">{{ item.class_name }} · {{ typeLabel(item.question_type) }} · 第 {{ item.submission.attempt_no }} 次提交</text></view></view><text :class="['state',item.submission.status]">{{ item.submission.status==='reviewed'?'已批阅':'待批阅' }}</text></view>
      <text class="title">{{ item.title }}</text><text class="source">{{ item.source_label }}</text>
      <view class="asset-actions"><button @tap="showAsset(item.question_url,'question')"><pp-icon name="book" :size="25" />查看题目</button><button @tap="showAnswer(item)"><pp-icon name="check" :size="25" />查看标准答案</button></view>
      <button v-if="!item.photoExpanded" class="photo-loader" @tap="expandPhotos(item)">
        <pp-icon name="document" :size="25" />展开学生照片（{{ item.submission.attachments?.length || 0 }} 张）
      </button>
      <view v-else class="student-photo-panel">
        <view class="student-photo-head"><text>学生作答图片</text><text>{{ item.localPhotos.length }} / {{ item.submission.attachments?.length || 0 }} 张</text></view>
        <view v-if="item.photoLoading" class="student-photo-state">正在读取学生照片…</view>
        <template v-else-if="item.localPhotos.length">
          <image class="student-photo-main" :src="item.localPhotos[item.activePhotoIndex || 0]" mode="aspectFit" @tap="preview(item.localPhotos,item.activePhotoIndex || 0)" />
          <scroll-view v-if="item.localPhotos.length > 1" scroll-x class="student-photo-thumbs">
            <view class="student-photo-thumb-row">
              <button v-for="(photo,index) in item.localPhotos" :key="photo" :class="['student-photo-thumb',{active:(item.activePhotoIndex || 0)===index}]" @tap="selectStudentPhoto(item,index)">
                <image :src="photo" mode="aspectFill" /><text>{{ index + 1 }}</text>
              </button>
            </view>
          </scroll-view>
        </template>
        <button v-else class="student-photo-retry" :disabled="item.photoLoading" @tap="loadPhotos(item)">照片未读取成功，点击重试</button>
      </view>
      <view v-if="item.submission.student_note" class="student-note"><text class="student-note-label">学生说明</text><text class="student-note-copy">{{ item.submission.student_note }}</text></view>
      <template v-if="item.submission.status!=='reviewed'">
        <textarea v-model="item.note" class="note" maxlength="500" placeholder="给家长的批阅说明（可选）" />
        <view class="result-actions"><button class="skip" @tap="skipQuestion(item)">异常题跳过</button><button class="wrong" @tap="review(item,false)">需要订正</button><button class="correct" @tap="review(item,true)">挑战成功</button></view>
      </template>
      <view v-else-if="item.submission.teacher_note" class="teacher-note"><text>批阅说明</text><text>{{ item.submission.teacher_note }}</text></view>
    </view>
    <button v-if="status==='reviewed' && items.length>3" class="recent-toggle" @tap="reviewedExpanded=!reviewedExpanded">
      {{ reviewedExpanded ? '收起最近记录' : `展开最近 ${items.length} 份` }}
    </button>
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
import { computed, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
const status=ref('submitted'),loading=ref(false),items=ref([]);
const error=ref('');
const answerPreview=ref(null);
const reviewedExpanded=ref(false);
const tabs=[{value:'submitted',label:'待批阅'},{value:'reviewed',label:'最近已批阅'}];
const visibleItems=computed(()=>status.value==='reviewed'&&!reviewedExpanded.value?items.value.slice(0,3):items.value);
onShow(load);onPullDownRefresh(async()=>{try{await load();}finally{uni.stopPullDownRefresh();}});
function selectStatus(value){if(status.value===value)return;status.value=value;reviewedExpanded.value=false;items.value=[];error.value='';load();}
async function load(){if(loading.value)return;loading.value=true;error.value='';try{const limit=status.value==='reviewed'?10:30;const data=await api.get(`/weekly-challenge/v2/teacher/submissions?status=${status.value}&limit=${limit}`);items.value=(data.submissions||[]).map((item,index)=>({...item,note:item.submission?.teacher_note||'',localPhotos:[],photosLoaded:false,photoLoading:false,photoExpanded:index===0,activePhotoIndex:0}));if(items.value[0])await loadPhotos(items.value[0]);}catch(e){error.value=e?.error||'加载失败';}finally{loading.value=false;}}
async function loadPhotos(item){if(item.photoLoading||item.photosLoaded)return;item.photoLoading=true;try{const attachments=item.submission?.attachments||[];const list=await Promise.all(attachments.map(photo=>api.downloadPrivate(photo.url).catch(()=>'')));item.localPhotos=list.filter(Boolean);item.photosLoaded=attachments.length===0||item.localPhotos.length>0;if(attachments.length&&!item.localPhotos.length)uni.showToast({title:'照片读取失败，请稍后重试',icon:'none'});}finally{item.photoLoading=false;}}
async function expandPhotos(item){items.value.forEach(entry=>{entry.photoExpanded=entry===item;});await loadPhotos(item);}
function selectStudentPhoto(item,index){item.activePhotoIndex=Math.max(0,Math.min(item.localPhotos.length-1,Number(index||0)));}
function typeLabel(type){return type==='fill'?'填空题':type==='subjective'?'解答题':'历史题';}
async function showAsset(url){try{const local=await api.downloadPrivate(url);uni.previewImage({urls:[local]});}catch(e){uni.showToast({title:e?.error||'图片读取失败',icon:'none'});}}
async function showAnswer(item){if(item.answer_url)return showAsset(item.answer_url);answerPreview.value=item;}
function preview(urls,index){uni.previewImage({urls,current:urls[index]});}
async function review(item,isCorrect){try{const result=await api.put(`/weekly-challenge/v2/teacher/submissions/${item.submission.id}/review`,{is_correct:isCorrect,teacher_note:item.note});uni.showToast({title:'批阅已保存',icon:'success'});await load();if(isCorrect&&result.promotion?.id)uni.navigateTo({url:`/pages/promotion-posters/index?event_id=${result.promotion.id}&auto=1`});}catch(e){uni.showToast({title:e?.error||'保存失败',icon:'none'});}}
function skipQuestion(item){uni.showModal({title:'跳过异常题',content:'该题会停用，学生可以重新领取。确认继续？',confirmText:'停用并跳过',success:async result=>{if(!result.confirm)return;try{await api.post(`/weekly-challenge/v2/teacher/assignments/${item.id}/skip`,{stop_question:true});uni.showToast({title:'已跳过异常题',icon:'success'});await load();}catch(e){uni.showToast({title:e?.error||'操作失败',icon:'none'});}}});}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx 50rpx;background:var(--page-bg)}.hero{margin:0 -24rpx 20rpx;padding:48rpx 34rpx 40rpx;border-radius:0 0 32rpx 32rpx;background:#FFFFFF;color:#fff}.eyebrow{display:block;color:#B8DED3;font-size:19rpx;font-weight:800;letter-spacing: 0}.hero-title{display:block;margin-top:8rpx;font-size:41rpx;font-weight:780}.hero-sub{display:block;margin-top:7rpx;color:#D7ECE6;font-size:23rpx}.tabs{display:grid;grid-template-columns:repeat(2,1fr);gap:8rpx;margin-bottom:18rpx;padding:7rpx;border-radius:17rpx;background:#fff;border:1rpx solid var(--border)}.tabs button{min-height:66rpx;margin:0;border-radius:12rpx;background:transparent;color:var(--text-muted);font-size:23rpx}.tabs button::after,.asset-actions button::after,.result-actions button::after,.photo-loader::after,.recent-toggle::after{border:0}.tabs button.on{background:var(--primary);color:#fff}.review-card{margin-bottom:18rpx;padding:26rpx;border-radius:22rpx;background:#fff;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}.review-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.student{display:block;color:var(--ink);font-size:29rpx;font-weight:750}.meta,.source{display:block;margin-top:5rpx;color:var(--text-muted);font-size:21rpx}.state{width:96rpx;height:96rpx;display:flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box;padding:0;border-radius:50%;background:#EDF9FC;color:#050505;font-size:19rpx;line-height:1;white-space:nowrap;text-align:center}.state.reviewed{background:#EDF9FC;color:#236756}.title{display:block;margin-top:18rpx;color:var(--ink);font-size:26rpx;font-weight:700;line-height:1.45}.asset-actions,.result-actions{display:flex;gap:12rpx;margin-top:18rpx}.asset-actions button{flex:1;min-height:70rpx;margin:0;border-radius:12rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:22rpx}.photo-loader,.recent-toggle{min-height:72rpx;display:flex;align-items:center;justify-content:center;gap:8rpx;margin:16rpx 0 0;border:1rpx solid var(--border);border-radius:12rpx;background:#F7FCFE;color:var(--primary);font-size:22rpx}.recent-toggle{width:100%;margin-top:4rpx;background:#fff;color:var(--text-secondary)}.photos{margin-top:18rpx;white-space:nowrap}.photo-row{display:flex;gap:11rpx}.photo-row image{width:220rpx;height:220rpx;flex:none;border-radius:13rpx}.student-note{margin-top:16rpx;padding:16rpx 18rpx;border-left:5rpx solid var(--primary);background:var(--primary-soft)}.student-note-label,.student-note-copy{display:block}.student-note-label{color:var(--primary-strong);font-size:20rpx;font-weight:760}.student-note-copy{margin-top:5rpx;color:var(--ink);font-size:23rpx;line-height:1.55}.teacher-note{margin-top:16rpx;padding:15rpx 17rpx;border-left:5rpx solid var(--success);background:var(--success-soft)}.teacher-note text{display:block;color:var(--text-secondary);font-size:21rpx;line-height:1.5}.teacher-note text:first-child{color:var(--success);font-size:19rpx;font-weight:760}.note{width:100%;min-height:126rpx;margin-top:18rpx;padding:17rpx;box-sizing:border-box;border:1rpx solid var(--border);border-radius:13rpx;background:#FCFEFF;font-size:23rpx}.result-actions button{flex:1;min-height:78rpx;margin:0;border-radius:13rpx;font-size:24rpx;font-weight:720}.wrong{background:#FFF0F6;color:#B53A52}.correct{background:var(--primary);color:#fff}
.skip{background:#F1F3F2!important;color:#50545B!important}
.answer-mask{position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;background:rgba(12,31,27,.48)}.answer-sheet{box-sizing:border-box;width:100%;padding:32rpx 28rpx calc(30rpx + env(safe-area-inset-bottom));border-radius:30rpx 30rpx 0 0;background:#fff}.answer-sheet-label{display:block;color:#050505;font-size:18rpx;font-weight:800;letter-spacing: 0}.answer-sheet-title{display:block;margin-top:5rpx;color:#050505;font-size:34rpx;font-weight:800}.answer-sheet-math{display:flex;min-height:180rpx;margin-top:22rpx;padding:28rpx;border-radius:18rpx;background:#EDF9FC;color:#050505;font-size:38rpx;font-weight:720;line-height:1.55}.answer-sheet-close{min-height:84rpx;margin-top:20rpx;border-radius:14rpx;background:#0B789A;color:#fff;font-size:26rpx;font-weight:740}.answer-sheet-close::after{border:0}
.page {
  background-color: var(--page-bg, #F7FCFE);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(153, 222, 244, .028) 64rpx 65rpx
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
    rgba(153, 222, 244, .028) 64rpx 65rpx
  );
}
.hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1rpx solid rgba(153, 222, 244, .16);
  background:
    linear-gradient(rgba(153, 222, 244, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(153, 222, 244, .05) 1rpx, transparent 1rpx),
    linear-gradient(145deg, #FFFFFF, #EDF9FC 72%, #EDF9FC);
  background-size: 34rpx 34rpx, 34rpx 34rpx, auto;
  color: var(--ink);
  box-shadow: 0 12rpx 28rpx rgba(5, 5, 5, .07);
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
.state { background: var(--primary-soft); color: #050505; }
.state.reviewed { background: var(--success-soft); color: var(--success); }
.asset-actions button {
  min-height: 80rpx;
  border: 1rpx solid #CADCF2;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.photo-row image {
  border: 1rpx solid var(--border);
  background: #F7FCFE;
}
.note {
  border-color: var(--border);
  background: #F7FCFE;
  color: var(--ink);
}
.result-actions button { min-height: 88rpx; }
.skip { background: #F1F4F8 !important; color: var(--text-secondary) !important; }
.wrong { background: var(--coral-soft); color: #B53A52; }
.correct {
  background: var(--primary-strong);
  color: #FFFFFF;
  box-shadow: 0 8rpx 18rpx rgba(5, 5, 5, .16);
}
.answer-mask { background: rgba(24, 55, 43, .48); }
.answer-sheet {
  border: 1rpx solid var(--border);
  background: #FFFFFF;
  animation: review-sheet-in var(--motion-slow) var(--ease-out) both;
}
.answer-sheet-label { color: #050505; }
.answer-sheet-title { color: var(--ink); }
.answer-sheet-math {
  border: 1rpx solid #CADCF2;
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
  --page-bg: #F7FCFE;
  --surface: #FFFFFF;
  --surface-muted: #FBFDFE;
  --ink: #050505;
  --text-secondary: #50545B;
  --text-muted: #6B7078;
  --primary: #0B789A;
  --primary-strong: #050505;
  --primary-soft: #E5F8FE;
  --coral: #F79BC0;
  --coral-soft: #FFF0F6;
  --danger: #B53A52;
  --border: #DCE9ED;
  min-height: 100vh;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(0deg, transparent 0 55rpx, rgba(153, 222, 244, .05) 56rpx 57rpx);
  color: var(--ink);
}
.student-challenge-page .hero {
  min-height: 0;
  margin-bottom: 18rpx;
  padding: 34rpx 30rpx 28rpx;
  border: 0;
  border-bottom: 6rpx solid var(--brand-sky);
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
  box-shadow: 0 6rpx 18rpx rgba(5, 5, 5, .06);
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
  box-shadow: 0 8rpx 18rpx rgba(5, 5, 5, .16);
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
  border: 1rpx solid #CADCF2;
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
/* First submission opens as a large preview; the remaining submissions stay folded. */
.student-photo-panel{margin-top:18rpx;padding:16rpx;border:1rpx solid var(--border);border-radius:14rpx;background:#F7FCFE}.student-photo-head{display:flex;align-items:center;justify-content:space-between;gap:12rpx;margin-bottom:12rpx;color:var(--text-secondary);font-size:20rpx}.student-photo-head text:first-child{color:var(--ink);font-size:23rpx;font-weight:760}.student-photo-main{display:block;width:100%;height:620rpx;border:1rpx solid var(--border);border-radius:12rpx;background:#FFFFFF}.student-photo-state{height:220rpx;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:21rpx}.student-photo-thumbs{margin-top:12rpx;white-space:nowrap}.student-photo-thumb-row{display:flex;gap:10rpx}.student-photo-thumb{position:relative;width:112rpx;height:112rpx;flex:none;margin:0;padding:0;border:2rpx solid transparent;border-radius:10rpx;background:#FFFFFF}.student-photo-thumb.active{border-color:var(--primary);box-shadow:3rpx 3rpx 0 var(--brand-sky)}.student-photo-thumb image{display:block;width:100%;height:100%;border-radius:8rpx}.student-photo-thumb text{position:absolute;right:4rpx;bottom:4rpx;min-width:28rpx;height:28rpx;line-height:28rpx;border-radius:6rpx;background:#050505;color:#FFFFFF;font-size:16rpx}.student-photo-retry{min-height:78rpx;margin:0;background:#FFF0F6;color:#B53A52;font-size:21rpx}
</style>
