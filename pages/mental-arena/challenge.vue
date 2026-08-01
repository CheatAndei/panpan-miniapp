<template>
  <view class="page student-challenge-page">
    <view class="topbar">
      <view class="battle-identity">
        <view class="topbar-icon"><pp-icon name="calculator" :size="34" motion="pop" :delay="80" /></view>
        <view>
          <text class="battle-label">{{ challenge?.battle_label || '口算王' }}</text>
          <text v-if="challenge?.is_fishing" class="fish-tag">炸鱼选手</text>
        </view>
      </view>
      <view class="timer"><pp-icon name="history" :size="28" motion="breathe" :delay="180" /><text>{{ timeText }}</text></view>
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
        <view class="question-type-row">
          <pp-icon name="pencil" :size="28" motion="bob" :delay="260" />
          <text class="question-type">{{ currentQuestion.type }}</text>
        </view>
        <pp-math-text class="question-stem" :value="currentQuestion.stem" align="center" />
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
        <button class="question-report" @tap="openReport(currentQuestion)">题目有问题</button>
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
    <question-report-sheet
      :visible="Boolean(reportQuestion)"
      source-type="mental_challenge"
      :source-id="challengeId"
      :student-id="challenge?.student_id || 0"
      :question-id="reportQuestion?.id || ''"
      @close="reportQuestion=null"
    />
  </view>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
import QuestionReportSheet from '@/components/question-report-sheet/question-report-sheet.vue';

const challengeId = ref('');
const challenge = ref(null);
const currentIndex = ref(0);
const answers = reactive({});
const elapsed = ref(0);
const loading = ref(false);
const submitting = ref(false);
const inputFocus = ref(false);
const error = ref('');
const reportQuestion = ref(null);
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
function openReport(question) { reportQuestion.value = question || null; }

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
.page{min-height:100vh;padding:24rpx 24rpx calc(48rpx + env(safe-area-inset-bottom))}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.battle-label{font-size:30rpx;font-weight:850}.fish-tag{display:inline-flex;margin-left:12rpx;padding:7rpx 12rpx;font-size:20rpx;font-weight:900}.timer{padding:12rpx 17rpx;font-size:28rpx;font-weight:850}.state{margin-top:24rpx;padding:28rpx}.progress-head{display:flex;justify-content:space-between;margin-top:28rpx;font-size:22rpx}.progress{height:12rpx;margin-top:10rpx;overflow:hidden}.progress-fill{height:100%}.question-card{margin-top:22rpx;padding:34rpx 28rpx}.question-type{display:block;font-size:21rpx;font-weight:800}.question-stem{display:block;min-height:180rpx;margin-top:28rpx;font-size:42rpx;font-weight:820;line-height:1.55;text-align:center;word-break:break-word}.answer-wrap{margin-top:30rpx}.answer-input{box-sizing:border-box;width:100%;height:106rpx;padding:0 24rpx;font-size:42rpx;font-weight:850;text-align:center}.answer-tip{display:block;margin-top:12rpx;font-size:20rpx;line-height:1.45;text-align:center}.question-report{min-height:58rpx;margin:12rpx auto 0;padding:0 14rpx;font-size:20rpx;text-decoration:underline}.number-map{display:grid;grid-template-columns:repeat(10,1fr);gap:8rpx;margin-top:20rpx}.number-dot{min-width:0;height:54rpx;display:flex;align-items:center;justify-content:center;margin:0;padding:0;font-size:20rpx}.number-dot.done{font-weight:800}.nav-actions{display:grid;grid-template-columns:1fr 1.6fr;gap:14rpx;margin-top:22rpx}.prev-btn,.next-btn,.submit-btn{min-height:92rpx;display:flex;align-items:center;justify-content:center;margin:0;font-size:27rpx;font-weight:800}.early-submit{min-height:72rpx;margin:12rpx auto 0;font-size:22rpx;text-decoration:underline}@media(max-width:380px){.question-stem{font-size:36rpx}.number-map{grid-template-columns:repeat(5,1fr)}}
.question-stem{display:flex}

/* 答题过程维持高对比，但不再以深色竞技场承载主界面。 */
.page {
  overflow-x: hidden;
}

.topbar {
  min-height: 106rpx;
  padding: 0 20rpx;
}

.number-dot {
  min-height: 60rpx;
}

.number-dot:active { transform: scale(var(--tap-scale)); }

.prev-btn,
.next-btn,
.submit-btn {
  min-height: 112rpx;
}

.early-submit { min-height: 88rpx; }

.prev-btn:active,
.next-btn:active,
.submit-btn:active { transform: scale(var(--tap-scale)); }

.prev-btn[disabled],
.next-btn[disabled],
.submit-btn[disabled] { opacity: .5; }

@media (prefers-reduced-motion: reduce) {
  .number-dot:active,
  .prev-btn:active,
  .next-btn:active,
  .submit-btn:active { transform: none; }
}

/* Student challenge theme v3: warm paper and one energetic teaching green. */
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
  --accent: #F79BC0;
  --accent-strong: #9B2F5F;
  --accent-soft: #FFF0F6;
  --coral: #F79BC0;
  --coral-soft: #FFF0F6;
  --danger: #B53A52;
  --border: #DCE9ED;
  --hairline: #EDF3F5;
  --r: 16rpx;
  --r-sm: 14rpx;
  --r-xs: 10rpx;
  --r-lg: 16rpx;
  --shadow-sm: 0 6rpx 18rpx rgba(5, 5, 5, .06);
  --shadow: 0 10rpx 28rpx rgba(5, 5, 5, .08);
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 55rpx,
    rgba(153, 222, 244, .045) 56rpx 57rpx
  );
  color: var(--ink);
}

.student-challenge-page .topbar {
  min-height: 100rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--border);
  border-left: 7rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .battle-label {
  color: var(--ink);
}

.student-challenge-page .fish-tag {
  padding: 6rpx 10rpx;
  border-radius: var(--r-xs);
  background: var(--coral-soft);
  color: #B53A52;
}

.student-challenge-page .timer {
  min-width: 104rpx;
  padding: 11rpx 14rpx;
  border: 1rpx solid #CADCF2;
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: var(--primary-strong);
  letter-spacing: 0;
  text-align: center;
}

.student-challenge-page .state {
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
}

.student-challenge-page .progress-head {
  margin-top: 24rpx;
  color: var(--text-secondary);
}

.student-challenge-page .progress {
  height: 12rpx;
  border-radius: 5rpx;
  background: var(--primary-soft);
}

.student-challenge-page .progress-fill {
  border-radius: 5rpx;
  background: var(--primary);
}

.student-challenge-page .question-card {
  margin-top: 20rpx;
  padding: 26rpx 24rpx;
  border: 1rpx solid var(--border);
  border-top: 7rpx solid var(--primary);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.student-challenge-page .question-type {
  color: var(--primary-strong);
  letter-spacing: 0;
}

.student-challenge-page .question-stem {
  min-height: 0;
  margin-top: 20rpx;
  padding: 18rpx 0;
  color: var(--ink);
}

.student-challenge-page .answer-input {
  height: 102rpx;
  border: 2rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  color: var(--ink);
}

.student-challenge-page .answer-tip,
.student-challenge-page .question-report,
.student-challenge-page .early-submit {
  color: var(--text-muted);
}

.student-challenge-page .question-report,
.student-challenge-page .early-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  border: 0;
  background-color: transparent !important;
  background-image: none !important;
  text-decoration: underline;
}

.student-challenge-page .question-report::after,
.student-challenge-page .early-submit::after {
  border: 0;
}

.student-challenge-page .number-map {
  gap: 8rpx;
  margin-top: 18rpx;
}

.student-challenge-page .number-dot {
  min-height: 58rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-xs);
  background: var(--surface);
  color: var(--text-muted);
}

.student-challenge-page .number-dot.done {
  border-color: #DDEEFF;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.student-challenge-page .number-dot.current {
  border: 2rpx solid var(--primary);
  background: var(--primary-soft);
  color: var(--primary-strong);
  box-shadow: none;
}

.student-challenge-page .nav-actions {
  gap: 12rpx;
  margin-top: 20rpx;
}

.student-challenge-page .prev-btn,
.student-challenge-page .next-btn,
.student-challenge-page .submit-btn {
  min-height: 96rpx;
  border-radius: var(--r-sm);
}

.student-challenge-page .prev-btn {
  border: 1rpx solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
}

.student-challenge-page .next-btn {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .submit-btn {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .early-submit {
  min-height: 82rpx;
}

.student-challenge-page .battle-identity,
.student-challenge-page .timer,
.student-challenge-page .question-type-row {
  display: flex;
  align-items: center;
}

.student-challenge-page .battle-identity {
  min-width: 0;
  gap: 12rpx;
}

.student-challenge-page .topbar-icon {
  width: 58rpx;
  height: 58rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1rpx solid #CADCF2;
  border-radius: 13rpx;
  background: var(--primary-soft);
}

.student-challenge-page .timer {
  gap: 8rpx;
}

.student-challenge-page .question-type-row {
  justify-content: center;
  gap: 8rpx;
}

@media (max-width: 380px) {
  .student-challenge-page .number-map {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
