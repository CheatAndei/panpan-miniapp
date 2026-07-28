<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="hero"><view class="hero-mark"><pp-icon name="lightbulb" :size="42" motion="bob" :delay="80" /></view><text class="eyebrow">GRADE 8 KNOWLEDGE</text><text class="hero-title">八上知识点闯关</text><text class="hero-sub">知识卡 → 8 题闯关 → 错题复练</text></view>
    <pp-state v-if="loading&&!catalog" type="loading" title="正在整理知识点" />
    <pp-state v-else-if="error&&!catalog" type="error" title="知识点加载失败" :description="error" action-text="重试" @action="loadCatalog" />
    <template v-if="catalog&&!attempt&&!selectedTopic">
      <view class="progress-note"><view class="progress-title"><pp-icon name="target" :size="28" motion="pop" :delay="180" /><text>共 {{ catalog.topics.length }} 个知识点</text></view><text>达到 75 分标记掌握</text></view>
      <button v-for="(topic,index) in catalog.topics" :key="topic.topic_key" class="topic-card" @tap="openTopic(topic)">
        <view class="topic-index">{{ String(index+1).padStart(2,'0') }}</view>
        <view class="topic-copy"><text class="chapter">{{ topic.chapter_name }}</text><text class="topic-title">{{ topic.title }}</text><text class="topic-desc">{{ topic.knowledge_card }}</text></view>
        <view :class="['topic-score',{mastered:topic.mastered}]"><text>{{ topic.best_score||'—' }}</text><text>{{ topic.mastered?'已掌握':'最高分' }}</text></view>
      </button>
    </template>
    <template v-if="selectedTopic&&!attempt">
      <view class="knowledge-card"><view class="knowledge-kicker-row"><pp-icon name="book" :size="30" motion="shine" :delay="220" /><text class="knowledge-kicker">知识卡</text></view><text class="knowledge-title">{{ selectedTopic.title }}</text><pp-math-text class="knowledge-copy" :value="selectedTopic.knowledge_card" /><button class="start-btn" :disabled="starting" @tap="start">{{ starting?'准备中…':'开始 8 题闯关' }}</button><button class="back-link" @tap="selectedTopic=null">返回知识点列表</button></view>
    </template>
    <template v-if="attempt&&!finished">
      <view class="quiz-progress"><view :style="{width:`${(currentIndex+1)/attempt.questions.length*100}%`}"></view></view>
      <view class="question-card">
        <view class="question-count-row"><pp-icon name="calculator" :size="28" motion="pop" :delay="120" /><text class="question-count">第 {{ currentIndex+1 }} / {{ attempt.questions.length }} 题</text></view>
        <pp-math-text class="question-stem" :value="currentQuestion.stem" />
        <button v-for="(value,key) in currentQuestion.options" :key="key" :class="['option',{selected:selected===key,correct:answerResult&&key===answerResult.correct_option,wrong:answerResult&&key===selected&&!answerResult.is_correct}]" :disabled="submitting||Boolean(answerResult)" @tap="answer(key)"><text class="option-key">{{ key }}</text><pp-math-text class="option-copy" :value="value" /></button>
      </view>
      <view v-if="answerResult" :class="['answer-card',{wrong:!answerResult.is_correct}]"><view class="answer-title-row"><pp-icon :name="answerResult.is_correct?'check':'message'" :size="30" :motion="answerResult.is_correct?'pop':'ring'" /><text class="answer-title">{{ answerResult.is_correct?'回答正确':'这题需要再巩固' }}</text></view><pp-math-text class="answer-copy" :value="answerResult.explanation" /><button class="next-btn" @tap="next">{{ answerResult.completed?'查看本轮结果':'下一题' }}</button></view>
    </template>
    <view v-if="attempt&&finished" class="finish-card"><view class="finish-icon"><pp-icon name="trophy" :size="46" motion="shine" :delay="100" /></view><text class="finish-score">{{ attempt.score }}</text><text class="finish-unit">分</text><text class="finish-title">{{ attempt.score>=75?'本知识点已掌握':'再练一次会更稳' }}</text><text class="finish-desc">答对 {{ attempt.correct_count }} / {{ attempt.questions.length }} 题；错题会在下一轮继续出现。</text><button class="start-btn" @tap="restart">再练一次</button><button class="back-link" @tap="backToCatalog">返回知识点列表</button></view>
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
.page{min-height:100vh;padding:0 24rpx 60rpx}.hero{margin:0 -24rpx 20rpx;padding:48rpx 34rpx 43rpx}.eyebrow{display:block;font-size:18rpx;font-weight:800}.hero-title{display:block;margin-top:8rpx;font-size:42rpx;font-weight:800}.hero-sub{display:block;margin-top:7rpx;font-size:23rpx}.progress-note{display:flex;justify-content:space-between;margin:0 5rpx 15rpx;font-size:21rpx}.topic-card{width:100%;display:flex;align-items:flex-start;gap:16rpx;margin:0 0 14rpx;padding:23rpx;text-align:left}.topic-card:active{transform:scale(.98)}.topic-index{flex:none;font-size:22rpx;font-weight:800}.topic-copy{flex:1;min-width:0}.chapter{display:block;font-size:19rpx}.topic-title{display:block;margin-top:3rpx;font-size:29rpx;font-weight:760}.topic-desc{display:-webkit-box;overflow:hidden;margin-top:5rpx;font-size:21rpx;line-height:1.5;-webkit-line-clamp:2;-webkit-box-orient:vertical}.topic-score{width:76rpx;flex:none;text-align:right}.topic-score text{display:block;font-size:18rpx}.topic-score text:first-child{font-size:30rpx;font-weight:800}.knowledge-card,.finish-card{padding:34rpx 28rpx}.knowledge-kicker{font-size:20rpx;font-weight:800}.knowledge-title{display:block;margin-top:9rpx;font-size:36rpx;font-weight:800}.knowledge-copy{display:block;margin-top:20rpx;padding:24rpx;font-size:27rpx;line-height:1.75}.start-btn,.next-btn{min-height:86rpx;margin:26rpx 0 0;font-size:26rpx;font-weight:740}.back-link{min-height:62rpx;margin:10rpx 0 0;font-size:22rpx}.quiz-progress{height:10rpx;margin:4rpx 0 18rpx;overflow:hidden}.quiz-progress view{height:100%}.question-card{padding:28rpx}.question-count{font-size:21rpx;font-weight:760}.question-stem{display:block;margin:18rpx 0 24rpx;font-size:30rpx;font-weight:650;line-height:1.65}.option{width:100%;min-height:84rpx;display:flex;align-items:center;gap:15rpx;margin:12rpx 0 0;padding:13rpx 16rpx;text-align:left;font-size:24rpx}.option-key{width:50rpx;height:50rpx;display:flex;align-items:center;justify-content:center;flex:none;font-weight:800}.answer-card{margin-top:16rpx;padding:24rpx}.answer-title{display:block;font-size:27rpx;font-weight:780}.answer-copy{display:block;margin-top:7rpx;font-size:23rpx;line-height:1.6}.next-btn{width:100%;margin-top:18rpx}.finish-card{text-align:center}.finish-score{font-size:100rpx;font-weight:850;line-height:1}.finish-unit{font-size:25rpx}.finish-title{display:block;margin-top:15rpx;font-size:32rpx;font-weight:780}.finish-desc{display:block;margin-top:8rpx;font-size:23rpx;line-height:1.6}
.knowledge-copy,.question-stem,.option-copy,.answer-copy{display:flex}.option-copy{flex:1;min-width:0}

/* mei: light educational paper system */
.page{
  position:relative;
  padding-bottom:88rpx;
  overflow-x:hidden;
}
.page::before{
  position:fixed;
  top:160rpx;
  right:-54rpx;
  width:180rpx;
  height:180rpx;
  content:"";
  opacity:.7;
  pointer-events:none;
}
.hero{
  position:relative;
  margin-bottom:26rpx;
  padding:52rpx 34rpx 46rpx;
  overflow:hidden;
}
.hero::after{
  position:absolute;
  right:38rpx;
  bottom:0;
  width:116rpx;
  height:10rpx;
  content:"";
}
.progress-note{
  position:relative;
  z-index:1;
  margin-bottom:18rpx;
}
.topic-card{
  position:relative;
  z-index:1;
  min-height:132rpx;
  margin-bottom:16rpx;
  padding:24rpx;
}
.topic-card:active{transform:translateY(2rpx) scale(.985)}
.topic-index{
  min-width:50rpx;
  padding:7rpx 8rpx;
  text-align:center;
}
.topic-score.mastered{
  padding:8rpx;
}
.knowledge-card,
.question-card,
.finish-card{
  position:relative;
  z-index:1;
}
.knowledge-card{overflow:hidden}
.knowledge-card::before,
.finish-card::before{
  position:absolute;
  top:0;
  left:28rpx;
  width:118rpx;
  height:9rpx;
  content:"";
}
.start-btn,
.next-btn{
  min-height:112rpx;
}
.start-btn:active,
.next-btn:active{transform:translateY(2rpx) scale(.985);opacity:.94}
.start-btn[disabled]{opacity:.56}
.back-link{
  min-height:88rpx;
}
.back-link:active{transform:scale(.985);opacity:.7}
.quiz-progress{
  position:relative;
  z-index:1;
  height:12rpx;
}
.option{
  min-height:104rpx;
}
.option:active{transform:translateY(2rpx) scale(.988)}
.answer-card{
  position:relative;
  z-index:1;
}
.finish-card{
  overflow:hidden;
  padding-top:62rpx;
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
  padding-bottom: 72rpx;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 55rpx,
    rgba(82, 124, 201, .045) 56rpx 57rpx
  );
  background-size: auto;
  color: var(--ink);
}

.student-challenge-page::before {
  display: none;
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

.student-challenge-page .progress-note {
  z-index: auto;
  margin: 0 4rpx 16rpx;
  padding: 14rpx 16rpx;
  border: 1rpx solid #CADCF2;
  border-left: 6rpx solid var(--primary);
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: var(--text-secondary);
}

.student-challenge-page .topic-card {
  z-index: auto;
  min-height: 0;
  margin-bottom: 14rpx;
  padding: 22rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .topic-index {
  min-width: 50rpx;
  padding: 7rpx 8rpx;
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: #315EA8;
  text-align: center;
}

.student-challenge-page .chapter {
  color: var(--primary-strong);
}

.student-challenge-page .topic-title {
  color: var(--ink);
}

.student-challenge-page .topic-desc {
  color: var(--text-secondary);
}

.student-challenge-page .topic-score {
  width: 82rpx;
  padding: 7rpx 0;
}

.student-challenge-page .topic-score text {
  color: var(--text-muted);
}

.student-challenge-page .topic-score text:first-child {
  color: var(--primary-strong);
}

.student-challenge-page .topic-score.mastered {
  border-radius: var(--r-xs);
  background: var(--accent-soft);
}

.student-challenge-page .topic-score.mastered text,
.student-challenge-page .topic-score.mastered text:first-child {
  color: var(--accent-strong);
}

.student-challenge-page .knowledge-card,
.student-challenge-page .question-card,
.student-challenge-page .finish-card {
  z-index: auto;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .knowledge-card,
.student-challenge-page .finish-card {
  padding: 32rpx 28rpx;
  border-top: 7rpx solid var(--primary);
}

.student-challenge-page .knowledge-card::before,
.student-challenge-page .finish-card::before {
  display: none;
}

.student-challenge-page .knowledge-kicker {
  color: #315EA8;
  letter-spacing: 0;
}

.student-challenge-page .knowledge-title,
.student-challenge-page .finish-title {
  color: var(--ink);
}

.student-challenge-page .knowledge-copy {
  margin-top: 18rpx;
  padding: 22rpx;
  border: 1rpx solid #DDEEFF;
  border-left: 6rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
  color: var(--ink);
}

.student-challenge-page .start-btn,
.student-challenge-page .next-btn {
  min-height: 96rpx;
  border-radius: var(--r-sm);
  background: var(--primary);
  color: #FFFFFF;
  box-shadow: none;
}

.student-challenge-page .back-link {
  min-height: 82rpx;
  border: 0;
  background-color: transparent !important;
  background-image: none !important;
  color: var(--primary-strong);
}

.student-challenge-page .back-link::after {
  border: 0;
}

.student-challenge-page .quiz-progress {
  z-index: auto;
  height: 12rpx;
  border-radius: 5rpx;
  background: var(--primary-soft);
}

.student-challenge-page .quiz-progress view {
  border-radius: 5rpx;
  background: var(--primary);
}

.student-challenge-page .question-card {
  padding: 26rpx;
  border-top: 7rpx solid var(--primary);
}

.student-challenge-page .question-count {
  color: var(--primary-strong);
}

.student-challenge-page .question-stem {
  color: var(--ink);
}

.student-challenge-page .option {
  min-height: 96rpx;
  border: 2rpx solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  color: var(--ink);
}

.student-challenge-page .option-key {
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.student-challenge-page .option.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.student-challenge-page .option.selected .option-key {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .option.correct {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.student-challenge-page .option.correct .option-key {
  background: var(--accent);
  color: #FFFFFF;
}

.student-challenge-page .option.wrong {
  border-color: var(--coral);
  background: var(--coral-soft);
}

.student-challenge-page .option.wrong .option-key {
  background: var(--coral);
  color: #FFFFFF;
}

.student-challenge-page .answer-card {
  z-index: auto;
  border: 1rpx solid #DDEEFF;
  border-left: 7rpx solid var(--accent);
  border-radius: var(--r-sm);
  background: var(--accent-soft);
}

.student-challenge-page .answer-card.wrong {
  border-color: #EFC9C2;
  border-left-color: var(--coral);
  background: var(--coral-soft);
}

.student-challenge-page .answer-title {
  color: var(--accent-strong);
}

.student-challenge-page .answer-card.wrong .answer-title {
  color: #D66D62;
}

.student-challenge-page .answer-copy {
  color: var(--text-secondary);
}

.student-challenge-page .finish-card {
  padding-top: 48rpx;
  background: var(--surface);
}

.student-challenge-page .finish-score {
  color: var(--primary-strong);
}

.student-challenge-page .finish-unit,
.student-challenge-page .finish-desc {
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

.student-challenge-page .progress-title,
.student-challenge-page .knowledge-kicker-row,
.student-challenge-page .question-count-row,
.student-challenge-page .answer-title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.student-challenge-page .finish-icon {
  width: 76rpx;
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12rpx;
  border: 1rpx solid #FCEEEB;
  border-radius: 16rpx;
  background: var(--coral-soft);
}

@media (prefers-reduced-motion: reduce) {
  .student-challenge-page .topic-card,
  .student-challenge-page .start-btn,
  .student-challenge-page .next-btn,
  .student-challenge-page .back-link,
  .student-challenge-page .option {
    transition: none;
  }

  .student-challenge-page .topic-card:active,
  .student-challenge-page .start-btn:active,
  .student-challenge-page .next-btn:active,
  .student-challenge-page .back-link:active,
  .student-challenge-page .option:active {
    transform: none;
  }
}
</style>
