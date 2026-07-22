<template>
  <view class="page page-bottom-safe">
    <view class="hero"><text class="eyebrow">REVIEW DESK</text><text class="hero-title">压轴挑战批阅</text><text class="hero-sub">题目、标准答案和学生过程同屏核对</text></view>
    <view class="tabs"><button v-for="item in tabs" :key="item.value" :class="{on:status===item.value}" @tap="selectStatus(item.value)">{{ item.label }}</button></view>
    <pp-state v-if="loading && !items.length" type="loading" title="正在读取提交" />
    <pp-state v-else-if="error" type="error" title="提交加载失败" :description="error" action-text="重试" @action="load" />
    <pp-state v-else-if="!items.length" title="当前没有待批阅挑战" description="家长拍照提交后会显示在这里。" />
    <view v-for="item in items" :key="item.submission.id" class="review-card">
      <view class="review-head"><view><text class="student">{{ item.student_name }}</text><text class="meta">{{ item.class_name }} · {{ typeLabel(item.question_type) }} · 第 {{ item.submission.attempt_no }} 次提交</text></view><text :class="['state',item.submission.status]">{{ item.submission.status==='reviewed'?'已批阅':'待批阅' }}</text></view>
      <text class="title">{{ item.title }}</text><text class="source">{{ item.source_label }}</text>
      <view class="asset-actions"><button @tap="showAsset(item.question_url,'question')">查看题目</button><button @tap="showAnswer(item)">查看标准答案</button></view>
      <scroll-view scroll-x class="photos"><view class="photo-row"><image v-for="(photo,index) in item.localPhotos" :key="photo" :src="photo" mode="aspectFill" @tap="preview(item.localPhotos,index)" /></view></scroll-view>
      <textarea v-model="item.note" class="note" maxlength="500" placeholder="给家长的批阅说明（可选）" />
      <view class="result-actions"><button class="skip" @tap="skipQuestion(item)">异常题跳过</button><button class="wrong" @tap="review(item,false)">需要订正</button><button class="correct" @tap="review(item,true)">挑战成功</button></view>
    </view>
    <view v-if="answerPreview" class="answer-mask" @tap="answerPreview=null">
      <view class="answer-sheet" @tap.stop>
        <text class="answer-sheet-label">STANDARD ANSWER</text>
        <text class="answer-sheet-title">标准答案</text>
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
.page{min-height:100vh;padding:0 24rpx 50rpx;background:var(--page-bg)}.hero{margin:0 -24rpx 20rpx;padding:48rpx 34rpx 40rpx;border-radius:0 0 32rpx 32rpx;background:linear-gradient(145deg,#183A36,#2F6E61);color:#fff}.eyebrow{display:block;color:#B8DED3;font-size:19rpx;font-weight:800;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:41rpx;font-weight:780}.hero-sub{display:block;margin-top:7rpx;color:#D7ECE6;font-size:23rpx}.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8rpx;margin-bottom:18rpx;padding:7rpx;border-radius:17rpx;background:#fff;border:1rpx solid var(--border)}.tabs button{min-height:66rpx;margin:0;border-radius:12rpx;background:transparent;color:var(--text-muted);font-size:23rpx}.tabs button::after,.asset-actions button::after,.result-actions button::after{border:0}.tabs button.on{background:var(--primary);color:#fff}.review-card{margin-bottom:18rpx;padding:26rpx;border-radius:22rpx;background:#fff;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}.review-head{display:flex;justify-content:space-between;gap:16rpx}.student{display:block;color:var(--ink);font-size:29rpx;font-weight:750}.meta,.source{display:block;margin-top:5rpx;color:var(--text-muted);font-size:21rpx}.state{padding:7rpx 13rpx;border-radius:999rpx;background:#FFF0D6;color:#8B5E08;font-size:20rpx}.state.reviewed{background:#E8F4F0;color:#236756}.title{display:block;margin-top:18rpx;color:var(--ink);font-size:26rpx;font-weight:700;line-height:1.45}.asset-actions,.result-actions{display:flex;gap:12rpx;margin-top:18rpx}.asset-actions button{flex:1;min-height:70rpx;margin:0;border-radius:12rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:22rpx}.photos{margin-top:18rpx;white-space:nowrap}.photo-row{display:flex;gap:11rpx}.photo-row image{width:220rpx;height:220rpx;flex:none;border-radius:13rpx}.note{width:100%;min-height:126rpx;margin-top:18rpx;padding:17rpx;box-sizing:border-box;border:1rpx solid var(--border);border-radius:13rpx;background:#FAFCFB;font-size:23rpx}.result-actions button{flex:1;min-height:78rpx;margin:0;border-radius:13rpx;font-size:24rpx;font-weight:720}.wrong{background:#FFF0EB;color:#A85146}.correct{background:var(--primary);color:#fff}
.skip{background:#F1F3F2!important;color:#65736F!important}
.answer-mask{position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;background:rgba(12,31,27,.48)}.answer-sheet{box-sizing:border-box;width:100%;padding:32rpx 28rpx calc(30rpx + env(safe-area-inset-bottom));border-radius:30rpx 30rpx 0 0;background:#fff}.answer-sheet-label{display:block;color:#A47429;font-size:18rpx;font-weight:800;letter-spacing:3rpx}.answer-sheet-title{display:block;margin-top:5rpx;color:#183A36;font-size:34rpx;font-weight:800}.answer-sheet-math{display:flex;min-height:180rpx;margin-top:22rpx;padding:28rpx;border-radius:18rpx;background:#F4F0E7;color:#263D38;font-size:38rpx;font-weight:720;line-height:1.55}.answer-sheet-close{min-height:84rpx;margin-top:20rpx;border-radius:14rpx;background:#183A36;color:#fff;font-size:26rpx;font-weight:740}.answer-sheet-close::after{border:0}
</style>
