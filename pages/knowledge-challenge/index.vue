<template>
  <view class="page page-bottom-safe">
    <view class="hero"><text class="eyebrow">GRADE 8 KNOWLEDGE</text><text class="hero-title">八上知识点闯关</text><text class="hero-sub">知识卡 → 8 题闯关 → 错题复练</text></view>
    <pp-state v-if="loading&&!catalog" type="loading" title="正在整理知识点" />
    <pp-state v-else-if="error&&!catalog" type="error" title="知识点加载失败" :description="error" action-text="重试" @action="loadCatalog" />
    <template v-if="catalog&&!attempt&&!selectedTopic">
      <view class="progress-note"><text>共 {{ catalog.topics.length }} 个知识点</text><text>达到 75 分标记掌握</text></view>
      <button v-for="(topic,index) in catalog.topics" :key="topic.topic_key" class="topic-card" @tap="openTopic(topic)">
        <view class="topic-index">{{ String(index+1).padStart(2,'0') }}</view>
        <view class="topic-copy"><text class="chapter">{{ topic.chapter_name }}</text><text class="topic-title">{{ topic.title }}</text><text class="topic-desc">{{ topic.knowledge_card }}</text></view>
        <view :class="['topic-score',{mastered:topic.mastered}]"><text>{{ topic.best_score||'—' }}</text><text>{{ topic.mastered?'已掌握':'最高分' }}</text></view>
      </button>
    </template>
    <template v-if="selectedTopic&&!attempt">
      <view class="knowledge-card"><text class="knowledge-kicker">知识卡</text><text class="knowledge-title">{{ selectedTopic.title }}</text><pp-math-text class="knowledge-copy" :value="selectedTopic.knowledge_card" /><button class="start-btn" :disabled="starting" @tap="start">{{ starting?'准备中…':'开始 8 题闯关' }}</button><button class="back-link" @tap="selectedTopic=null">返回知识点列表</button></view>
    </template>
    <template v-if="attempt&&!finished">
      <view class="quiz-progress"><view :style="{width:`${(currentIndex+1)/attempt.questions.length*100}%`}"></view></view>
      <view class="question-card">
        <text class="question-count">第 {{ currentIndex+1 }} / {{ attempt.questions.length }} 题</text>
        <pp-math-text class="question-stem" :value="currentQuestion.stem" />
        <button v-for="(value,key) in currentQuestion.options" :key="key" :class="['option',{selected:selected===key,correct:answerResult&&key===answerResult.correct_option,wrong:answerResult&&key===selected&&!answerResult.is_correct}]" :disabled="submitting||Boolean(answerResult)" @tap="answer(key)"><text class="option-key">{{ key }}</text><pp-math-text class="option-copy" :value="value" /></button>
      </view>
      <view v-if="answerResult" :class="['answer-card',{wrong:!answerResult.is_correct}]"><text class="answer-title">{{ answerResult.is_correct?'回答正确':'这题需要再巩固' }}</text><pp-math-text class="answer-copy" :value="answerResult.explanation" /><button class="next-btn" @tap="next">{{ answerResult.completed?'查看本轮结果':'下一题' }}</button></view>
    </template>
    <view v-if="attempt&&finished" class="finish-card"><text class="finish-score">{{ attempt.score }}</text><text class="finish-unit">分</text><text class="finish-title">{{ attempt.score>=75?'本知识点已掌握':'再练一次会更稳' }}</text><text class="finish-desc">答对 {{ attempt.correct_count }} / {{ attempt.questions.length }} 题；错题会在下一轮继续出现。</text><button class="start-btn" @tap="restart">再练一次</button><button class="back-link" @tap="backToCatalog">返回知识点列表</button></view>
  </view>
</template>

<script setup>
import {computed,ref} from 'vue';
import {onLoad,onPullDownRefresh} from '@dcloudio/uni-app';
import {api} from '@/utils/api';
const studentId=ref(0),catalog=ref(null),selectedTopic=ref(null),attempt=ref(null),loading=ref(false),starting=ref(false),submitting=ref(false);
const error=ref(''),selected=ref(''),answerResult=ref(null),currentIndex=ref(0),finished=ref(false);
const currentQuestion=computed(()=>attempt.value?.questions?.[currentIndex.value]||{});
onLoad(query=>{studentId.value=Number(query.student_id||uni.getStorageSync('activeChildId')||0);loadCatalog();});
onPullDownRefresh(async()=>{try{await loadCatalog();}finally{uni.stopPullDownRefresh();}});
async function loadCatalog(){if(loading.value)return;loading.value=true;error.value='';try{catalog.value=await api.get(`/knowledge-challenge/catalog?student_id=${studentId.value}`);}catch(e){error.value=e?.error||'请检查网络后重试';}finally{loading.value=false;}}
function openTopic(topic){selectedTopic.value=topic;}
async function start(){if(starting.value||!selectedTopic.value)return;starting.value=true;try{const data=await api.post(`/knowledge-challenge/topics/${selectedTopic.value.topic_key}/start`,{student_id:studentId.value});attempt.value=data.attempt;currentIndex.value=(attempt.value.answers||[]).length;finished.value=attempt.value.status==='completed';}catch(e){uni.showToast({title:e?.error||'开始失败',icon:'none'});}finally{starting.value=false;}}
async function answer(option){if(submitting.value||answerResult.value)return;selected.value=option;submitting.value=true;try{const result=await api.post(`/knowledge-challenge/attempts/${attempt.value.id}/answer`,{question_id:currentQuestion.value.id,selected_option:option});answerResult.value=result;attempt.value=result.attempt;}catch(e){selected.value='';uni.showToast({title:e?.error||'提交失败',icon:'none'});}finally{submitting.value=false;}}
function next(){if(answerResult.value?.completed){finished.value=true;return;}currentIndex.value+=1;selected.value='';answerResult.value=null;}
function restart(){attempt.value=null;finished.value=false;selected.value='';answerResult.value=null;start();}
async function backToCatalog(){attempt.value=null;selectedTopic.value=null;finished.value=false;await loadCatalog();}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx 60rpx;background:var(--page-bg)}.hero{margin:0 -24rpx 20rpx;padding:48rpx 34rpx 43rpx;border-radius:0 0 34rpx 34rpx;background:linear-gradient(145deg,#183A36,#2F6E61);color:#fff}.eyebrow{display:block;color:#B9DDD3;font-size:18rpx;font-weight:800;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:42rpx;font-weight:800}.hero-sub{display:block;margin-top:7rpx;color:#D7ECE6;font-size:23rpx}.progress-note{display:flex;justify-content:space-between;margin:0 5rpx 15rpx;color:var(--text-muted);font-size:21rpx}.topic-card{width:100%;display:flex;align-items:flex-start;gap:16rpx;margin:0 0 14rpx;padding:23rpx;border:1rpx solid var(--border);border-radius:21rpx;background:#fff;text-align:left;box-shadow:var(--shadow-sm)}.topic-card::after,.start-btn::after,.back-link::after,.option::after,.next-btn::after{border:0}.topic-card:active{transform:scale(.98)}.topic-index{flex:none;color:#B89152;font-size:22rpx;font-weight:800}.topic-copy{flex:1;min-width:0}.chapter{display:block;color:#6F817C;font-size:19rpx}.topic-title{display:block;margin-top:3rpx;color:#183A36;font-size:29rpx;font-weight:760}.topic-desc{display:-webkit-box;overflow:hidden;margin-top:5rpx;color:#64736F;font-size:21rpx;line-height:1.5;-webkit-line-clamp:2;-webkit-box-orient:vertical}.topic-score{width:76rpx;flex:none;text-align:right}.topic-score text{display:block;color:#8A8174;font-size:18rpx}.topic-score text:first-child{color:#183A36;font-size:30rpx;font-weight:800}.topic-score.mastered text{color:#27705F}.knowledge-card,.finish-card{padding:34rpx 28rpx;border:1rpx solid var(--border);border-radius:24rpx;background:#fff}.knowledge-kicker{color:#A47429;font-size:20rpx;font-weight:800;letter-spacing:2rpx}.knowledge-title{display:block;margin-top:9rpx;color:#183A36;font-size:36rpx;font-weight:800}.knowledge-copy{display:block;margin-top:20rpx;padding:24rpx;border-radius:17rpx;background:#F4F0E7;color:#3E504B;font-size:27rpx;line-height:1.75}.start-btn,.next-btn{min-height:86rpx;margin:26rpx 0 0;border-radius:14rpx;background:#183A36;color:#fff;font-size:26rpx;font-weight:740}.back-link{min-height:62rpx;margin:10rpx 0 0;background:transparent;color:#64736F;font-size:22rpx}.quiz-progress{height:10rpx;margin:4rpx 0 18rpx;border-radius:999rpx;background:#DDE8E4;overflow:hidden}.quiz-progress view{height:100%;border-radius:999rpx;background:#2F7D6B;transition:width .25s}.question-card{padding:28rpx;border:1rpx solid var(--border);border-radius:22rpx;background:#fff}.question-count{color:#2F7D6B;font-size:21rpx;font-weight:760}.question-stem{display:block;margin:18rpx 0 24rpx;color:#18312D;font-size:30rpx;font-weight:650;line-height:1.65}.option{width:100%;min-height:84rpx;display:flex;align-items:center;gap:15rpx;margin:12rpx 0 0;padding:13rpx 16rpx;border:2rpx solid #D9E5E1;border-radius:15rpx;background:#FAFCFB;color:#314A44;text-align:left;font-size:24rpx}.option-key{width:50rpx;height:50rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:12rpx;background:#E8F1EE;color:#286A5B;font-weight:800}.option.selected{border-color:#2F7D6B}.option.correct{border-color:#2F7D6B;background:#EAF5F1}.option.wrong{border-color:#C75D54;background:#FFF2EF}.answer-card{margin-top:16rpx;padding:24rpx;border-radius:20rpx;background:#EAF5F1}.answer-card.wrong{background:#FFF2EF}.answer-title{display:block;color:#245F52;font-size:27rpx;font-weight:780}.answer-card.wrong .answer-title{color:#A24E45}.answer-copy{display:block;margin-top:7rpx;color:#50645E;font-size:23rpx;line-height:1.6}.next-btn{width:100%;margin-top:18rpx}.finish-card{text-align:center}.finish-score{color:#183A36;font-size:100rpx;font-weight:850;line-height:1}.finish-unit{color:#60736E;font-size:25rpx}.finish-title{display:block;margin-top:15rpx;color:#183A36;font-size:32rpx;font-weight:780}.finish-desc{display:block;margin-top:8rpx;color:#667772;font-size:23rpx;line-height:1.6}
.knowledge-copy,.question-stem,.option-copy,.answer-copy{display:flex}.option-copy{flex:1;min-width:0}
</style>
