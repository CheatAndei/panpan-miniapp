<template>
  <view class="session-page">
    <pp-state v-if="loading" type="loading" title="正在准备题目" description="题目只会在服务端判定，练习中不会显示答案。" />
    <pp-state v-else-if="error && !attempt" type="error" title="题目加载失败" :description="error" action-text="重新加载" @action="loadAttempt" />

    <template v-else-if="attempt && attempt.status !== 'completed'">
      <view class="session-head">
        <view class="head-copy">
          <text class="head-kicker">{{ attempt.task_title }}</text>
          <text class="head-count"><text class="num">{{ currentIndex + 1 }}</text> / {{ attempt.total_questions }}</text>
        </view>
        <text class="head-time num">{{ elapsedLabel }}</text>
      </view>
      <view class="progress-track"><view class="progress-fill" :style="{width:progressPercent+'%'}"></view></view>

      <view v-if="currentQuestion" class="question-stage">
        <view class="question-meta">
          <text class="question-type">{{ currentQuestion.type || '综合计算' }}</text>
          <text class="question-position">第 {{ currentIndex + 1 }} 题</text>
        </view>
        <text class="question-stem">{{ currentQuestion.stem }}</text>
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
          <text class="result-kicker">练习完成</text>
          <text class="result-score num">{{ attempt.score }}</text>
          <text class="result-unit">分</text>
          <text class="result-summary">答对 {{ attempt.correct_count }} / {{ attempt.total_questions }} 题 · 用时 {{ resultTime }}</text>
        </view>

        <view class="result-card">
          <view class="result-head">
            <text class="result-title">逐题结果</text>
            <text class="result-correct">正确率 {{ attempt.score }}%</text>
          </view>
          <view v-for="item in attempt.answers" :key="item.question_id" :class="['answer-row',{wrong:!item.is_correct}]">
            <view :class="['answer-mark',{ok:item.is_correct}]">{{ item.is_correct ? '✓' : item.position }}</view>
            <view class="answer-copy">
              <text class="answer-stem">{{ item.stem }}</text>
              <text class="answer-given">你的答案：{{ item.answer || '未作答' }}</text>
              <text v-if="!item.is_correct" class="answer-correct">正确答案：{{ item.correct_answer }}</text>
            </view>
          </view>
        </view>

        <view class="result-note">
          <pp-icon name="message" :size="38" />
          <text>本次错题已自动进入错题本；同类题连续答对 2 次后会标记为已掌握。</text>
        </view>
        <button class="done-btn" @tap="finish">返回学习中心</button>
      </scroll-view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError, toastError } from '@/utils/ui';

const studentId = ref(0);
const taskType = ref('warmup');
const attempt = ref(null);
const answers = ref({});
const currentIndex = ref(0);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const elapsedSeconds = ref(0);
const answerFocused = ref(true);
let startedAt = Date.now();
let timer = null;

const currentQuestion = computed(() => attempt.value?.questions?.[currentIndex.value] || null);
const currentAnswer = computed(() => String(answers.value[currentQuestion.value?.id] || '').trim());
const progressPercent = computed(() => attempt.value ? Math.round((currentIndex.value + 1) / attempt.value.total_questions * 100) : 0);
const elapsedLabel = computed(() => `${String(Math.floor(elapsedSeconds.value / 60)).padStart(2, '0')}:${String(elapsedSeconds.value % 60).padStart(2, '0')}`);
const resultTime = computed(() => `${Math.floor(Number(attempt.value?.elapsed_seconds || 0) / 60)}分${Number(attempt.value?.elapsed_seconds || 0) % 60}秒`);

onLoad((query) => {
  studentId.value = Number(query.student_id || uni.getStorageSync('activeChildId') || 0);
  taskType.value = String(query.type || 'warmup');
  loadAttempt();
});
onHide(stopTimer);
onShow(() => { if (attempt.value?.status === 'active') startTimer(); });
onUnload(stopTimer);

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
    const data = await api.post('/learning/sessions', { student_id: studentId.value, task_type: taskType.value });
    attempt.value = data.attempt;
    if (attempt.value.status === 'active') {
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
    uni.vibrateShort?.({ type: 'light' });
  } catch (e) {
    toastError(e, '提交失败，请重试');
    startTimer();
  } finally { submitting.value = false; }
}

function finish() {
  uni.redirectTo({ url: `/pages/learning-center/index?student_id=${studentId.value}` });
}
</script>

<style scoped>
.session-page{min-height:100vh;background:linear-gradient(180deg,#F7FAF8 0%,#EEF5F2 100%);box-sizing:border-box}.session-head{display:flex;align-items:flex-end;justify-content:space-between;padding:34rpx 30rpx 18rpx}.head-kicker{display:block;color:var(--accent-strong);font-size:22rpx;font-weight:750;letter-spacing:1rpx}.head-count{display:block;margin-top:4rpx;color:var(--ink);font-size:30rpx;font-weight:700}.head-count .num{font-size:40rpx}.head-time{color:var(--text-muted);font-size:26rpx;font-weight:650}.progress-track{height:8rpx;margin:0 30rpx;border-radius:999rpx;background:#DCE8E4;overflow:hidden}.progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#2F7D6B,#66A997);transition:width .22s ease-out}.question-stage{margin:40rpx 24rpx 0;padding:34rpx 30rpx 38rpx;border:1rpx solid var(--border);border-radius:28rpx;background:#fff;box-shadow:0 18rpx 48rpx rgba(24,58,54,.09)}.question-meta{display:flex;align-items:center;justify-content:space-between}.question-type{padding:7rpx 14rpx;border-radius:9rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:21rpx;font-weight:700}.question-position{color:var(--text-muted);font-size:22rpx}.question-stem{display:block;min-height:190rpx;padding:60rpx 6rpx 34rpx;color:var(--ink);font-size:42rpx;font-weight:720;line-height:1.55;text-align:center;word-break:break-word}.answer-block{padding-top:28rpx;border-top:1rpx solid var(--hairline)}.answer-label{display:block;margin-bottom:10rpx;color:var(--text-secondary);font-size:24rpx;font-weight:700}.answer-input{height:104rpx;padding:0 24rpx;border:2rpx solid #BFD2CC;border-radius:18rpx;background:#FAFCFB;color:var(--ink);font-size:36rpx;font-weight:680;text-align:center;box-sizing:border-box}.answer-input:focus{border-color:var(--accent);background:#fff;box-shadow:0 0 0 6rpx rgba(47,125,107,.08)}.answer-tip{display:block;margin-top:10rpx;color:var(--faint);font-size:21rpx;text-align:center}.session-actions{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:190rpx 1fr;gap:14rpx;padding:20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));background:rgba(247,250,248,.96);border-top:1rpx solid var(--border);backdrop-filter:blur(14px)}.previous-btn,.next-btn{min-height:92rpx;border-radius:16rpx;font-size:28rpx;font-weight:700}.previous-btn{border:1rpx solid #BFD2CC;background:#fff;color:var(--text-secondary)}.next-btn{background:var(--primary);color:#fff;box-shadow:0 10rpx 24rpx rgba(24,58,54,.15)}.result-scroll{height:100vh}.result-hero{display:flex;align-items:baseline;justify-content:center;flex-wrap:wrap;padding:58rpx 30rpx 48rpx;background:linear-gradient(145deg,#183A36,#2F6E61);color:#fff}.result-kicker{width:100%;margin-bottom:2rpx;color:#B8DDD3;font-size:22rpx;font-weight:750;letter-spacing:3rpx;text-align:center}.result-score{font-size:112rpx;font-weight:820;line-height:1.1}.result-unit{margin-left:8rpx;font-size:28rpx}.result-summary{width:100%;margin-top:8rpx;color:#D7EBE5;font-size:25rpx;text-align:center}.result-card{margin:22rpx 24rpx;padding:28rpx;border:1rpx solid var(--border);border-radius:24rpx;background:#fff;box-shadow:var(--shadow-sm)}.result-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:18rpx;border-bottom:1rpx solid var(--hairline)}.result-title{font-size:30rpx;font-weight:740}.result-correct{color:var(--accent-strong);font-size:23rpx;font-weight:700}.answer-row{display:flex;gap:16rpx;padding:22rpx 0;border-bottom:1rpx solid var(--hairline)}.answer-row:last-child{border-bottom:0}.answer-mark{width:48rpx;height:48rpx;flex:none;display:flex;align-items:center;justify-content:center;border-radius:14rpx;background:var(--danger-soft);color:var(--danger);font-size:23rpx;font-weight:800}.answer-mark.ok{background:var(--success-soft);color:var(--success)}.answer-copy{flex:1;min-width:0}.answer-stem{display:block;color:var(--ink);font-size:26rpx;font-weight:650;line-height:1.55}.answer-given,.answer-correct{display:block;margin-top:5rpx;color:var(--text-muted);font-size:23rpx}.answer-correct{color:var(--danger);font-weight:650}.result-note{display:flex;gap:14rpx;margin:0 24rpx;padding:22rpx;border-radius:18rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:23rpx;line-height:1.65}.done-btn{min-height:92rpx;margin:22rpx 24rpx calc(38rpx + env(safe-area-inset-bottom));border-radius:16rpx;background:var(--primary);color:#fff;font-size:29rpx;font-weight:720}
</style>
