<template>
  <view class="session-page student-challenge-page">
    <pp-state v-if="loading" type="loading" title="正在准备题目" description="题目只会在服务端判定，练习中不会显示答案。" />
    <pp-state v-else-if="error && !attempt" type="error" title="题目加载失败" :description="error" action-text="重新加载" @action="loadAttempt" />

    <template v-else-if="attempt && attempt.status !== 'completed'">
      <view class="session-head">
        <view class="head-copy">
          <view class="head-title-row"><pp-icon name="pencil" :size="28" motion="pop" :delay="80" /><text class="head-kicker">{{ attempt.task_title }}</text></view>
          <text class="head-count"><text class="num">{{ currentIndex + 1 }}</text> / {{ attempt.total_questions }}</text>
        </view>
        <view class="head-actions">
          <view class="head-time num"><pp-icon name="history" :size="26" motion="breathe" :delay="160" /><text>{{ elapsedLabel }}</text></view>
          <button class="exit-btn" @tap="confirmExit">暂存退出</button>
        </view>
      </view>
      <view class="progress-track"><view class="progress-fill" :style="{width:progressPercent+'%'}"></view></view>

      <view v-if="currentQuestion" class="question-stage">
        <view class="question-meta">
          <view class="question-type-row"><pp-icon name="calculator" :size="26" motion="bob" :delay="240" /><text class="question-type">{{ currentQuestion.type || '综合计算' }}</text></view>
          <text class="question-position">第 {{ currentIndex + 1 }} 题</text>
        </view>
        <pp-math-text class="question-stem" :value="currentQuestion.stem" align="center" />
        <view class="answer-block">
          <text class="answer-label">填写答案</text>
          <input
            v-model="answers[currentQuestion.id]"
            class="answer-input"
            type="text"
            confirm-type="next"
            maxlength="48"
            placeholder="输入计算结果"
            :focus="answerFocused"
            @confirm="nextOrSubmit"
          />
          <text class="answer-tip">支持整数、小数、分数；方程可直接填写 x 的值</text>
          <button class="question-report" @tap="reportQuestion=currentQuestion">题目有问题</button>
        </view>
      </view>

      <view class="session-actions">
        <button class="previous-btn" :disabled="currentIndex===0 || submitting" @tap="previousQuestion">上一题</button>
        <button class="next-btn" :disabled="!currentAnswer || submitting" @tap="nextOrSubmit">
          {{ submitting ? '提交中…' : currentIndex === attempt.total_questions - 1 ? '提交并查看结果' : '下一题' }}
        </button>
      </view>
    </template>

    <template v-else-if="attempt">
      <scroll-view scroll-y class="result-scroll">
        <view class="result-hero">
          <view class="result-icon"><view class="result-icon-mark"><pp-icon name="trophy" :size="48" motion="shine" :delay="80" /></view></view>
          <text class="result-kicker">练习完成</text>
          <text class="result-score num">{{ attempt.score }}</text>
          <text class="result-unit">分</text>
          <text class="result-summary">答对 {{ attempt.correct_count }} / {{ attempt.total_questions }} 题 · 用时 {{ resultTime }}</text>
        </view>

        <view class="result-card">
          <view class="result-head">
            <view class="result-title-row"><pp-icon name="report" :size="28" motion="pop" :delay="180" /><text class="result-title">逐题结果</text></view>
            <text class="result-correct">正确率 {{ attempt.score }}%</text>
          </view>
          <view v-for="item in attempt.answers" :key="item.question_id" :class="['answer-row',{wrong:!item.is_correct}]">
            <view :class="['answer-mark',{ok:item.is_correct}]">{{ item.is_correct ? '✓' : item.position }}</view>
            <view class="answer-copy">
              <pp-math-text class="answer-stem" :value="item.stem" />
              <view class="answer-given"><text>你的答案：</text><pp-math-text class="answer-inline" :value="item.answer || '未作答'" /></view>
              <view v-if="!item.is_correct" class="answer-correct"><text>正确答案：</text><pp-math-text class="answer-inline" :value="item.correct_answer" /></view>
              <button class="question-report result-report" @tap="reportQuestion=item">题目有问题</button>
            </view>
          </view>
        </view>

        <view class="result-note">
          <pp-icon name="message" :size="38" motion="ring" :delay="260" />
          <text>本次错题已自动进入错题本；同类题连续答对 2 次后会标记为已掌握。</text>
        </view>
        <button class="done-btn" @tap="finish">返回学习中心</button>
      </scroll-view>
    </template>
    <question-report-sheet
      :visible="Boolean(reportQuestion)"
      source-type="learning_attempt"
      :source-id="attempt?.id || 0"
      :student-id="attempt?.student_id || studentId"
      :question-id="reportQuestion?.question_id || reportQuestion?.id || ''"
      @close="reportQuestion=null"
    />
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onBackPress, onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError, toastError } from '@/utils/ui';
import QuestionReportSheet from '@/components/question-report-sheet/question-report-sheet.vue';

const studentId = ref(0);
const taskType = ref('warmup');
const gradeCode = ref('g7');
const attempt = ref(null);
const answers = ref({});
const currentIndex = ref(0);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const elapsedSeconds = ref(0);
const answerFocused = ref(true);
const reportQuestion = ref(null);
let startedAt = Date.now();
let timer = null;
let allowBack = false;

const currentQuestion = computed(() => attempt.value?.questions?.[currentIndex.value] || null);
const currentAnswer = computed(() => String(answers.value[currentQuestion.value?.id] || '').trim());
const progressPercent = computed(() => attempt.value ? Math.round((currentIndex.value + 1) / attempt.value.total_questions * 100) : 0);
const elapsedLabel = computed(() => `${String(Math.floor(elapsedSeconds.value / 60)).padStart(2, '0')}:${String(elapsedSeconds.value % 60).padStart(2, '0')}`);
const resultTime = computed(() => `${Math.floor(Number(attempt.value?.elapsed_seconds || 0) / 60)}分${Number(attempt.value?.elapsed_seconds || 0) % 60}秒`);

onLoad((query) => {
  studentId.value = Number(query.student_id || uni.getStorageSync('activeChildId') || 0);
  taskType.value = String(query.type || 'warmup');
  gradeCode.value = ['g7','g8','g9'].includes(String(query.grade||'')) ? String(query.grade) : 'g7';
  loadAttempt();
});
onHide(() => { stopTimer(); saveDraft(); });
onShow(() => { if (attempt.value?.status === 'active') startTimer(); });
onUnload(() => { stopTimer(); saveDraft(); });
onBackPress(() => {
  if (allowBack || !attempt.value || attempt.value.status === 'completed') return false;
  confirmExit();
  return true;
});

function draftKey() { return attempt.value?.id ? `panpan_learning_draft_${attempt.value.id}` : ''; }
function saveDraft() {
  const key = draftKey();
  if (!key || attempt.value?.status !== 'active') return;
  uni.setStorageSync(key, { answers: answers.value, currentIndex: currentIndex.value, savedAt: Date.now() });
}
function restoreDraft() {
  const key = draftKey();
  if (!key) return;
  const draft = uni.getStorageSync(key);
  if (!draft || typeof draft !== 'object') return;
  answers.value = { ...(draft.answers || {}) };
  currentIndex.value = Math.max(0, Math.min(Number(draft.currentIndex || 0), Math.max(0, Number(attempt.value?.total_questions || 1) - 1)));
}
function clearDraft() { const key = draftKey(); if (key) uni.removeStorageSync(key); }

function confirmExit() {
  saveDraft();
  uni.showModal({
    title: '现在退出？',
    content: '当前作答已自动保存，下次进入可以继续。',
    cancelText: '继续作答',
    confirmText: '暂存退出',
    success: (result) => {
      if (!result.confirm) return;
      allowBack = true;
      uni.navigateBack({ delta: 1, fail: () => uni.redirectTo({ url: `/pages/learning-center/index?student_id=${studentId.value}` }) });
    },
  });
}

function startTimer() {
  stopTimer();
  startedAt = Date.now() - elapsedSeconds.value * 1000;
  timer = setInterval(() => { elapsedSeconds.value = Math.max(1, Math.floor((Date.now() - startedAt) / 1000)); }, 1000);
}
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

async function loadAttempt() {
  if (!studentId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await api.post('/learning/sessions', { student_id: studentId.value, task_type: taskType.value, grade: gradeCode.value, subject: 'math' });
    attempt.value = data.attempt;
    if (attempt.value.status === 'active') {
      restoreDraft();
      const serverStart = new Date(attempt.value.started_at).getTime();
      elapsedSeconds.value = Number.isFinite(serverStart) ? Math.max(0, Math.floor((Date.now() - serverStart) / 1000)) : 0;
      startTimer();
    }
  } catch (e) {
    error.value = e?.error || '请检查网络后重试';
    logError('learning.session', e);
  } finally { loading.value = false; }
}

function previousQuestion() {
  if (currentIndex.value > 0) currentIndex.value -= 1;
  refocus();
}

function refocus() {
  answerFocused.value = false;
  setTimeout(() => { answerFocused.value = true; }, 80);
}

async function nextOrSubmit() {
  if (!currentAnswer.value || submitting.value) return;
  if (currentIndex.value < attempt.value.total_questions - 1) {
    currentIndex.value += 1;
    refocus();
    return;
  }
  const missing = attempt.value.questions.find((question) => !String(answers.value[question.id] || '').trim());
  if (missing) {
    currentIndex.value = attempt.value.questions.findIndex((question) => question.id === missing.id);
    uni.showToast({ title: '还有题目未填写', icon: 'none' });
    refocus();
    return;
  }
  submitting.value = true;
  stopTimer();
  try {
    const payload = attempt.value.questions.map((question) => ({ question_id: question.id, answer: answers.value[question.id] }));
    const data = await api.post(`/learning/sessions/${attempt.value.id}/submit`, {
      answers: payload,
      elapsed_seconds: Math.max(1, elapsedSeconds.value),
    });
    attempt.value = data.attempt;
    clearDraft();
    uni.vibrateShort?.({ type: 'light' });
  } catch (e) {
    toastError(e, '提交失败，请重试');
    startTimer();
  } finally { submitting.value = false; }
}

function finish() {
  clearDraft();
  uni.redirectTo({ url: `/pages/learning-center/index?student_id=${studentId.value}` });
}
</script>

<style scoped>
.session-page{min-height:100vh;box-sizing:border-box}.session-head{display:flex;align-items:flex-end;justify-content:space-between;padding:34rpx 30rpx 18rpx}.head-kicker{display:block;font-size:22rpx;font-weight:750}.head-count{display:block;margin-top:4rpx;font-size:30rpx;font-weight:700}.head-count .num{font-size:40rpx}.head-actions{display:flex;align-items:center;gap:12rpx}.head-time{font-size:26rpx;font-weight:650}.exit-btn{min-height:58rpx;margin:0;padding:0 16rpx;font-size:21rpx;font-weight:650}.progress-track{height:8rpx;margin:0 30rpx;overflow:hidden}.progress-fill{height:100%}.question-stage{margin:40rpx 24rpx 0;padding:34rpx 30rpx 38rpx}.question-meta{display:flex;align-items:center;justify-content:space-between}.question-type{padding:7rpx 14rpx;font-size:21rpx;font-weight:700}.question-position{font-size:22rpx}.question-stem{display:block;min-height:190rpx;padding:60rpx 6rpx 34rpx;font-size:42rpx;font-weight:720;line-height:1.55;text-align:center;word-break:break-word}.answer-block{padding-top:28rpx}.answer-label{display:block;margin-bottom:10rpx;font-size:24rpx;font-weight:700}.answer-input{height:104rpx;padding:0 24rpx;font-size:36rpx;font-weight:680;text-align:center;box-sizing:border-box}.answer-tip{display:block;margin-top:10rpx;font-size:21rpx;text-align:center}.session-actions{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:190rpx 1fr;gap:14rpx;padding:20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));backdrop-filter:blur(14px)}.previous-btn,.next-btn{min-height:92rpx;font-size:28rpx;font-weight:700}.result-scroll{height:100vh}.result-hero{display:flex;align-items:baseline;justify-content:center;flex-wrap:wrap;padding:58rpx 30rpx 48rpx}.result-kicker{width:100%;margin-bottom:2rpx;font-size:22rpx;font-weight:750;text-align:center}.result-score{font-size:112rpx;font-weight:820;line-height:1.1}.result-unit{margin-left:8rpx;font-size:28rpx}.result-summary{width:100%;margin-top:8rpx;font-size:25rpx;text-align:center}.result-card{margin:22rpx 24rpx;padding:28rpx}.result-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:18rpx}.result-title{font-size:30rpx;font-weight:740}.result-correct{font-size:23rpx;font-weight:700}.answer-row{display:flex;gap:16rpx;padding:22rpx 0}.answer-mark{width:48rpx;height:48rpx;flex:none;display:flex;align-items:center;justify-content:center;font-size:23rpx;font-weight:800}.answer-copy{flex:1;min-width:0}.answer-stem{display:block;font-size:26rpx;font-weight:650;line-height:1.55}.answer-given,.answer-correct{display:block;margin-top:5rpx;font-size:23rpx}.answer-correct{font-weight:650}.result-note{display:flex;gap:14rpx;margin:0 24rpx;padding:22rpx;font-size:23rpx;line-height:1.65}.done-btn{min-height:92rpx;margin:22rpx 24rpx calc(38rpx + env(safe-area-inset-bottom));font-size:29rpx;font-weight:720}
.question-report{min-height:56rpx;margin:10rpx auto 0;padding:0 12rpx;font-size:20rpx;text-decoration:underline}.result-report{margin:7rpx 0 0;padding:0;text-align:left}
.question-stem,.answer-stem{display:flex}.answer-given,.answer-correct{display:flex;align-items:center;flex-wrap:wrap;gap:5rpx}.answer-inline{width:auto;flex:none}

/* 浅色校园学习场景：题目始终是页面的最高视觉层级。 */
.session-page {
  padding-bottom: calc(156rpx + env(safe-area-inset-bottom));
}

.session-head {
  align-items: center;
  padding: 28rpx 28rpx 18rpx;
}

.exit-btn {
  min-height: 88rpx;
  padding: 0 20rpx;
}

.progress-track {
  height: 10rpx;
  margin: 18rpx 28rpx 0;
}

.question-stage {
  margin: 28rpx 24rpx 0;
  padding: 30rpx 28rpx 34rpx;
}

.session-actions {
  z-index: 10;
  grid-template-columns: 190rpx 1fr;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  backdrop-filter: none;
}

.previous-btn,
.next-btn,
.done-btn {
  min-height: 112rpx;
}

.previous-btn:active,
.next-btn:active,
.done-btn:active { transform: scale(var(--tap-scale)); }

.previous-btn[disabled],
.next-btn[disabled] {
  opacity: .5;
}

.result-hero {
  margin: 0 24rpx;
  padding: 46rpx 30rpx 42rpx;
}

.question-report {
  min-height: 88rpx;
}

@media (max-width: 360px) {
  .session-head { align-items: flex-start; }
  .head-actions { flex-direction: column; align-items: flex-end; }
  .question-stage { padding-left: 22rpx; padding-right: 22rpx; }
  .question-stem { font-size: 36rpx; }
  .session-actions { grid-template-columns: 154rpx 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .previous-btn:active,
  .next-btn:active,
  .done-btn:active { transform: none; }
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

.student-challenge-page .session-head {
  min-height: 0;
  align-items: center;
  padding: 24rpx 28rpx 18rpx;
  border-bottom: 1rpx solid var(--border);
  background: var(--surface);
}

.student-challenge-page .head-kicker {
  color: var(--primary-strong);
  letter-spacing: 0;
}

.student-challenge-page .head-count,
.student-challenge-page .head-count .num {
  color: var(--ink);
}

.student-challenge-page .head-time {
  padding: 8rpx 10rpx;
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: #050505;
}

.student-challenge-page .exit-btn {
  min-height: 74rpx;
  padding: 0 18rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-xs);
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.student-challenge-page .progress-track {
  height: 12rpx;
  margin: 16rpx 28rpx 0;
  border-radius: 5rpx;
  background: var(--primary-soft);
}

.student-challenge-page .progress-fill {
  border-radius: 5rpx;
  background: var(--primary);
}

.student-challenge-page .question-stage {
  margin: 24rpx 24rpx 0;
  padding: 24rpx 24rpx 28rpx;
  border: 1rpx solid var(--border);
  border-top: 7rpx solid var(--primary);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.student-challenge-page .question-type {
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.student-challenge-page .question-position,
.student-challenge-page .answer-tip,
.student-challenge-page .question-report {
  color: var(--text-muted);
}

.student-challenge-page .question-report {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-height: 56rpx;
  padding: 0;
  border: 0;
  background-color: transparent !important;
  background-image: none !important;
  text-decoration: underline;
}

.student-challenge-page .question-report::after {
  border: 0;
}

.student-challenge-page .question-stem {
  min-height: 0;
  padding: 32rpx 6rpx 24rpx;
  color: var(--ink);
}

.student-challenge-page .answer-block {
  border-top-color: var(--hairline);
}

.student-challenge-page .answer-label {
  color: var(--text-secondary);
}

.student-challenge-page .answer-input {
  height: 102rpx;
  border: 2rpx solid #CADCF2;
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  color: var(--ink);
}

.student-challenge-page .answer-input:focus {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: 0 0 0 5rpx rgba(153, 222, 244, .1);
}

.student-challenge-page .session-actions {
  z-index: 10;
  grid-template-columns: 180rpx 1fr;
  gap: 12rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border);
  background: var(--surface);
  box-shadow: 0 -8rpx 24rpx rgba(5, 5, 5, .08);
  backdrop-filter: none;
}

.student-challenge-page .previous-btn,
.student-challenge-page .next-btn,
.student-challenge-page .done-btn {
  min-height: 96rpx;
  border-radius: var(--r-sm);
}

.student-challenge-page .previous-btn {
  border: 1rpx solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
}

.student-challenge-page .next-btn,
.student-challenge-page .done-btn {
  background: var(--primary);
  color: #FFFFFF;
  box-shadow: none;
}

.student-challenge-page .result-scroll {
  height: 100vh;
  background-color: var(--page-bg);
}

.student-challenge-page .result-hero {
  margin: 0;
  padding: 44rpx 30rpx 38rpx;
  border: 0;
  border-bottom: 7rpx solid var(--brand-sky);
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
}

.student-challenge-page .result-kicker {
  color: var(--primary-strong);
  letter-spacing: 0;
}

.student-challenge-page .result-score {
  color: var(--ink);
}

.student-challenge-page .result-unit,
.student-challenge-page .result-summary {
  color: var(--text-secondary);
}

.student-challenge-page .result-card {
  margin: 18rpx 24rpx;
  padding: 24rpx;
  border: 1rpx solid var(--border);
  border-top: 7rpx solid var(--primary);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .result-head,
.student-challenge-page .answer-row {
  border-color: var(--hairline);
}

.student-challenge-page .result-title,
.student-challenge-page .answer-stem {
  color: var(--ink);
}

.student-challenge-page .result-correct {
  color: var(--accent-strong);
}

.student-challenge-page .answer-mark {
  border-radius: var(--r-xs);
  background: var(--coral-soft);
  color: #B53A52;
}

.student-challenge-page .answer-mark.ok {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.student-challenge-page .answer-given {
  color: var(--text-muted);
}

.student-challenge-page .answer-correct {
  color: #B53A52;
}

.student-challenge-page .result-note {
  border: 1rpx solid #DDEEFF;
  border-left: 7rpx solid var(--accent);
  border-radius: var(--r-sm);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.student-challenge-page .done-btn {
  margin-top: 18rpx;
}

.student-challenge-page .head-title-row,
.student-challenge-page .head-time,
.student-challenge-page .question-type-row,
.student-challenge-page .result-title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.student-challenge-page .result-icon {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 10rpx;
}

.student-challenge-page .result-icon-mark {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #FCEEEB;
  border-radius: 16rpx;
  background: var(--coral-soft);
}

@media (max-width: 360px) {
  .student-challenge-page .session-actions {
    grid-template-columns: 150rpx 1fr;
  }
}
</style>
