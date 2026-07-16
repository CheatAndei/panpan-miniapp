<template>
  <view class="page">
    <view class="topbar">
      <view>
        <text class="battle-label">{{ challenge?.battle_label || '口算王' }}</text>
        <text v-if="challenge?.is_fishing" class="fish-tag">炸鱼选手</text>
      </view>
      <text class="timer">{{ timeText }}</text>
    </view>

    <view v-if="loading" class="state"><pp-state type="loading" title="题目正在入场" /></view>
    <view v-else-if="error" class="state"><pp-state type="error" title="挑战加载失败" :description="error" action-text="重试" @action="loadChallenge" /></view>
    <template v-else-if="currentQuestion">
      <view class="progress-head">
        <text>第 {{ currentIndex + 1 }} / {{ questions.length }} 题</text>
        <text>已答 {{ answeredCount }} 题</text>
      </view>
      <view class="progress"><view class="progress-fill" :style="{width: `${((currentIndex + 1) / questions.length) * 100}%`}"></view></view>

      <view class="question-card">
        <text class="question-type">{{ currentQuestion.type }}</text>
        <text class="question-stem">{{ currentQuestion.stem }}</text>
        <view class="answer-wrap">
          <input
            v-model="answers[currentQuestion.id]"
            class="answer-input"
            type="text"
            maxlength="32"
            :focus="inputFocus"
            confirm-type="next"
            placeholder="输入答案"
            @confirm="nextQuestion"
          />
        </view>
        <text class="answer-tip">负数直接输入 -3；分数可输入 1/2；方程只填 x 的值</text>
      </view>

      <view class="number-map">
        <button v-for="(item,index) in questions" :key="item.id" :class="['number-dot',{current:index===currentIndex,done:hasAnswer(item.id)}]" @tap="jumpTo(index)">{{ index + 1 }}</button>
      </view>

      <view class="nav-actions">
        <button class="prev-btn" :disabled="currentIndex===0" @tap="previousQuestion">上一题</button>
        <button v-if="currentIndex < questions.length - 1" class="next-btn" @tap="nextQuestion">下一题</button>
        <button v-else class="submit-btn" :disabled="submitting" @tap="confirmSubmit">{{ submitting ? '交卷中…' : '交卷' }}</button>
      </view>
      <button v-if="currentIndex < questions.length - 1" class="early-submit" :disabled="submitting" @tap="confirmSubmit">提前交卷</button>
    </template>
  </view>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const challengeId = ref('');
const challenge = ref(null);
const currentIndex = ref(0);
const answers = reactive({});
const elapsed = ref(0);
const loading = ref(false);
const submitting = ref(false);
const inputFocus = ref(false);
const error = ref('');
let timer = null;

const questions = computed(() => challenge.value?.questions || []);
const currentQuestion = computed(() => questions.value[currentIndex.value] || null);
const answeredCount = computed(() => questions.value.filter((item) => hasAnswer(item.id)).length);
const timeText = computed(() => {
  const minutes = Math.floor(elapsed.value / 60);
  const seconds = elapsed.value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});

onLoad((options) => {
  challengeId.value = String(options?.id || '');
  loadChallenge();
});
onUnload(stopTimer);

function startTimer() {
  stopTimer();
  const startedAt = new Date(challenge.value.started_at).getTime();
  const tick = () => { elapsed.value = Math.max(0, Math.floor((Date.now() - startedAt) / 1000)); };
  tick();
  timer = setInterval(tick, 1000);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

async function loadChallenge() {
  if (!challengeId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await api.get(`/mental-arena/challenges/${challengeId.value}`);
    challenge.value = result.challenge;
    if (challenge.value.status === 'completed') {
      return uni.redirectTo({ url: `/pages/mental-arena/result?id=${challengeId.value}` });
    }
    startTimer();
    focusInput();
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('mentalArena.challenge', err);
  } finally { loading.value = false; }
}

function hasAnswer(id) { return String(answers[id] ?? '').trim().length > 0; }
function focusInput() {
  inputFocus.value = false;
  nextTick(() => { inputFocus.value = true; });
}
function jumpTo(index) { currentIndex.value = index; focusInput(); }
function previousQuestion() { if (currentIndex.value > 0) jumpTo(currentIndex.value - 1); }
function nextQuestion() { if (currentIndex.value < questions.value.length - 1) jumpTo(currentIndex.value + 1); }

function confirmSubmit() {
  const missing = questions.value.length - answeredCount.value;
  uni.showModal({
    title: missing ? `还有 ${missing} 题未作答` : '确认交卷',
    content: missing ? '未作答题目会按错误计算，确定现在交卷吗？' : `已完成全部 ${questions.value.length} 题，提交后不能修改。`,
    confirmText: '确认交卷',
    success: (result) => { if (result.confirm) submitChallenge(); },
  });
}

async function submitChallenge() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await api.post(`/mental-arena/challenges/${challengeId.value}/submit`, {
      answers: questions.value.map((item) => ({ question_id: item.id, answer: answers[item.id] || '' })),
    });
    stopTimer();
    uni.redirectTo({ url: `/pages/mental-arena/result?id=${challengeId.value}` });
  } catch (err) {
    uni.showToast({ title: err?.error || '交卷失败，请重试', icon: 'none' });
  } finally { submitting.value = false; }
}
</script>

<style scoped>
.page{min-height:100vh;padding:24rpx 24rpx calc(48rpx + env(safe-area-inset-bottom));background:#F3F7F5}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.battle-label{color:#183A36;font-size:30rpx;font-weight:850}.fish-tag{display:inline-flex;margin-left:12rpx;padding:7rpx 12rpx;border-radius:999rpx;background:#F5B83D;color:#493000;font-size:20rpx;font-weight:900}.timer{padding:12rpx 17rpx;border-radius:14rpx;background:#183A36;color:#fff;font-size:28rpx;font-weight:850;letter-spacing:2rpx}.state{margin-top:24rpx;padding:28rpx;border-radius:22rpx;background:#fff}.progress-head{display:flex;justify-content:space-between;margin-top:28rpx;color:#536762;font-size:22rpx}.progress{height:12rpx;margin-top:10rpx;overflow:hidden;border-radius:999rpx;background:#DCE8E4}.progress-fill{height:100%;border-radius:999rpx;background:#F5B83D;transition:width .2s ease}.question-card{margin-top:22rpx;padding:34rpx 28rpx;border:1rpx solid #D5E4DF;border-radius:26rpx;background:#fff;box-shadow:0 12rpx 30rpx rgba(24,58,54,.07)}.question-type{display:block;color:#2F7D6B;font-size:21rpx;font-weight:800;letter-spacing:1rpx}.question-stem{display:block;min-height:180rpx;margin-top:28rpx;color:#172D29;font-size:42rpx;font-weight:820;line-height:1.55;text-align:center;word-break:break-word}.answer-wrap{margin-top:30rpx}.answer-input{box-sizing:border-box;width:100%;height:106rpx;padding:0 24rpx;border:3rpx solid #2F7D6B;border-radius:18rpx;background:#F8FBFA;color:#183A36;font-size:42rpx;font-weight:850;text-align:center}.answer-tip{display:block;margin-top:12rpx;color:#667873;font-size:20rpx;line-height:1.45;text-align:center}.number-map{display:grid;grid-template-columns:repeat(10,1fr);gap:8rpx;margin-top:20rpx}.number-dot{min-width:0;height:54rpx;display:flex;align-items:center;justify-content:center;margin:0;padding:0;border-radius:12rpx;background:#E6EFEC;color:#647570;font-size:20rpx}.number-dot.done{background:#CAE5DD;color:#1F6254;font-weight:800}.number-dot.current{outline:3rpx solid #F5B83D;background:#FFF4D4;color:#664600}button::after{border:0}.nav-actions{display:grid;grid-template-columns:1fr 1.6fr;gap:14rpx;margin-top:22rpx}.prev-btn,.next-btn,.submit-btn{min-height:92rpx;display:flex;align-items:center;justify-content:center;margin:0;border-radius:16rpx;font-size:27rpx;font-weight:800}.prev-btn{border:1rpx solid #B8CAC4;background:#fff;color:#536762}.next-btn{background:#183A36;color:#fff}.submit-btn{background:#F5B83D;color:#493000}.early-submit{min-height:72rpx;margin:12rpx auto 0;background:transparent;color:#758680;font-size:22rpx;text-decoration:underline}.early-submit::after{border:0}@media(max-width:380px){.question-stem{font-size:36rpx}.number-map{grid-template-columns:repeat(5,1fr)}}
</style>
