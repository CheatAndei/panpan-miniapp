<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="hero">
      <view>
        <text class="eyebrow">CHOICE PRACTICE</text>
        <view class="hero-title-row"><view class="hero-icon"><pp-icon name="exam" :size="38" motion="bob" :delay="80" /></view><text class="hero-title">选择刷题王</text></view>
        <text class="hero-sub">每次一题，即时判断。答错的题会在合适的时候回来。</text>
      </view>
      <button class="rank-link" :disabled="!studentId || loading" @tap="openLeaderboard">
        <pp-icon name="trophy" :size="28" motion="shine" :delay="180" />
        <text class="rank-link-num">{{ summary.weekly_correct }}</text>
        <text class="rank-link-label">本周答对</text>
      </button>
    </view>

    <view class="summary-strip" aria-label="刷题进度">
      <view class="summary-item">
        <pp-icon name="exam" :size="26" motion="pop" :delay="220" :stagger="60" :index="0" />
        <text class="summary-number">{{ summary.answered }}</text>
        <text class="summary-label">已刷题目</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <pp-icon name="check" :size="26" motion="pop" :delay="220" :stagger="60" :index="1" />
        <text class="summary-number">{{ summary.correct }}</text>
        <text class="summary-label">累计答对</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <pp-icon name="message" :size="26" motion="pop" :delay="220" :stagger="60" :index="2" />
        <text class="summary-number">{{ summary.wrong }}</text>
        <text class="summary-label">待巩固</text>
      </view>
    </view>

    <view v-if="loading" class="question-skeleton" aria-label="题目加载中">
      <view class="skeleton-line short"></view>
      <view class="skeleton-image"></view>
      <view v-for="item in 4" :key="item" class="skeleton-option"></view>
    </view>

    <view v-else-if="pageError" class="state-card">
      <pp-state type="error" title="题目加载失败" :description="pageError" action-text="重新加载" @action="loadNext" />
    </view>

    <view v-else-if="!question" class="state-card">
      <pp-state title="今天的题已经刷完啦" description="题库正在继续补充。可以先去看看本周排名，或稍后再来。" action-text="查看排行榜" @action="openLeaderboard" />
    </view>

    <template v-else>
      <view v-if="isReviewQuestion" class="review-notice">
        <view class="review-mark"><pp-icon name="message" :size="34" /></view>
        <view>
          <text class="review-title">错题回来啦</text>
          <text class="review-copy">再认真看一遍，把这道题真正拿下。</text>
        </view>
      </view>

      <view class="question-card">
        <view class="question-head">
          <text class="question-count">第 {{ summary.answered + 1 }} 题</text>
          <text class="source">{{ question.source_label || question.source || '广州七上数学原卷' }}</text>
        </view>

        <pp-question-reader
          v-if="questionImage || imageError"
          :src="questionImage"
          :error="imageError"
          :alt="`第 ${summary.answered + 1} 题题图`"
          @retry="retryQuestionImage"
          @image-error="imageError=true"
        />
        <pp-math-text v-if="question.stem" class="question-stem" :value="question.stem" />
        <view v-if="imageError && !question.stem" class="image-error">题图暂时无法显示，请点击下方报错告诉老师。</view>

        <view class="option-list" role="radiogroup" aria-label="选择答案">
          <button
            v-for="(option,index) in options"
            :key="optionKey(option,index)"
            :class="['option', optionClass(option,index)]"
            :disabled="submitting || Boolean(answerResult)"
            :aria-label="`选项 ${optionKey(option,index)} ${optionText(option)}`"
            @tap="submitAnswer(optionKey(option,index))"
          >
            <text class="option-key">{{ optionKey(option,index) }}</text>
            <pp-math-text class="option-text" :value="optionText(option)" />
            <text v-if="answerResult && optionKey(option,index) === normalizedCorrectAnswer" class="option-state">正确答案</text>
            <text v-else-if="answerResult && optionKey(option,index) === selectedAnswer && !answerResult.is_correct" class="option-state wrong">你选的</text>
          </button>
        </view>

        <view v-if="submitting" class="checking-bar"><view></view><text>正在判断答案</text></view>
      </view>

      <view v-if="answerResult" :class="['result-card', answerResult.is_correct ? 'correct' : 'wrong']">
        <view class="result-head">
          <view>
            <text class="result-kicker">{{ answerResult.is_correct ? '回答正确' : '这次没答对' }}</text>
            <text class="result-title">{{ answerResult.is_correct ? '已计入刷题榜' : `正确答案是 ${normalizedCorrectAnswer || '请看解析'}` }}</text>
          </view>
          <view class="result-symbol"><pp-icon :name="answerResult.is_correct ? 'check' : 'message'" :size="38" :motion="answerResult.is_correct ? 'pop' : 'ring'" /></view>
        </view>
        <view class="explanation">
          <text class="explanation-label">答案解析</text>
          <pp-math-text class="explanation-copy" :value="answerResult.explanation || answerResult.analysis || '解析暂未录入，可以先根据标准答案检查思路。'" />
        </view>
        <view class="result-actions">
          <button class="report-button" :disabled="reporting || reportSent" @tap="openReport">
            {{ reportSent ? '已反馈给老师' : '题目或答案有问题' }}
          </button>
          <button class="next-button" :disabled="loadingNext" @tap="loadNext">
            {{ loadingNext ? '取题中…' : '下一题' }}
          </button>
        </view>
        <button v-if="Number(stats.correct_count||0)>=30" class="poster-button" @tap="openAchievements">生成选择题成就海报</button>
      </view>

      <view v-else class="helper-row">
        <text>选择后会立即判断正误</text>
        <button class="quiet-report" :disabled="reporting || reportSent" @tap="openReport">题目有问题</button>
      </view>
    </template>

    <view v-if="reportPanel" class="report-mask" @tap="closeReport">
      <view class="report-sheet" @tap.stop>
        <text class="report-title">告诉老师哪里有问题</text>
        <text class="report-sub">老师会检查原卷和答案，不影响你继续刷题。</text>
        <view class="reason-grid">
          <button
            v-for="reason in reportReasons"
            :key="reason.value"
            :class="['reason-button',{active:reportReason===reason.value}]"
            :disabled="reporting"
            @tap="reportReason=reason.value"
          >{{ reason.label }}</button>
        </view>
        <textarea v-model="reportNote" class="report-note" maxlength="200" placeholder="可以补充说明（选填）" />
        <view class="report-actions">
          <button class="cancel-report" :disabled="reporting" @tap="closeReport">取消</button>
          <button class="send-report" :disabled="reporting || !reportReason" @tap="sendReport">{{ reporting ? '提交中…' : '提交反馈' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const studentId = ref('');
const gradeCode = ref('g7');
const question = ref(null);
const stats = ref({});
const selectedAnswer = ref('');
const answerResult = ref(null);
const loading = ref(false);
const loadingNext = ref(false);
const submitting = ref(false);
const pageError = ref('');
const imageError = ref(false);
const reportPanel = ref(false);
const reportReason = ref('');
const reportNote = ref('');
const reporting = ref(false);
const reportSent = ref(false);
const answerRequestId = ref('');
const weeklyCorrect = ref(0);
let weeklyScoreLoaded = false;
const reportReasons = [
  { value: 'unclear', label: '题目显示不完整' },
  { value: 'question_error', label: '选项与原卷不一致' },
  { value: 'answer_error', label: '答案或解析有误' },
  { value: 'other', label: '其他问题' },
];

const summary = computed(() => ({
  answered: Number(stats.value.attempted_count ?? stats.value.answered_count ?? stats.value.unique_answered_count ?? stats.value.total_answered ?? 0),
  correct: Number(stats.value.correct_count ?? stats.value.history_correct_count ?? stats.value.total_correct ?? 0),
  weekly_correct: Number(stats.value.weekly_correct_count ?? stats.value.week_correct ?? weeklyCorrect.value),
  wrong: Number(stats.value.pending_wrong_count ?? stats.value.wrong_count ?? stats.value.open_wrong_count ?? stats.value.pending_review_count ?? 0),
}));
const options = computed(() => {
  const list = question.value?.options;
  if (Array.isArray(list) && list.length) return list;
  if (list && typeof list === 'object') return Object.entries(list).map(([key,text]) => ({ key, text }));
  return ['A', 'B', 'C', 'D'].map((key) => ({ key, text: question.value?.[`option_${key.toLowerCase()}`] || key }));
});
const questionImage = computed(() => {
  if (imageError.value) return '';
  const url = question.value?.question_image_url || question.value?.question_url || question.value?.image_url || question.value?.asset_url || '';
  return url ? api.assetUrl(url) : '';
});
const isReviewQuestion = computed(() => Boolean(
  question.value?.is_review
  || question.value?.from_wrong_book
  || question.value?.reason === 'wrong_review'
  || question.value?.mode === 'review'
));
const normalizedCorrectAnswer = computed(() => String(answerResult.value?.correct_option || answerResult.value?.correct_answer || '').trim().toUpperCase());

onLoad((options) => {
  studentId.value = String(options?.student_id || uni.getStorageSync('activeChildId') || '');
  gradeCode.value = ['g7','g8','g9'].includes(String(options?.grade||'')) ? String(options.grade) : 'g7';
  loadNext();
});
onPullDownRefresh(async () => { try { await loadNext(); } finally { uni.stopPullDownRefresh(); } });

async function resolveStudentId() {
  if (studentId.value) return studentId.value;
  const result = await api.get('/bind/students');
  const students = result.students || [];
  const activeId = String(uni.getStorageSync('activeChildId') || '');
  const current = students.find((item) => String(item.id) === activeId) || students[0];
  studentId.value = current ? String(current.id) : '';
  return studentId.value;
}

async function loadNext() {
  if (loading.value || loadingNext.value || submitting.value) return;
  const hasQuestion = Boolean(question.value);
  if (hasQuestion) loadingNext.value = true;
  else loading.value = true;
  pageError.value = '';
  try {
    const id = await resolveStudentId();
    if (!id) throw { error: '请先绑定孩子后再开始刷题' };
    const result = await api.get(`/choice-king/next?student_id=${encodeURIComponent(id)}&grade=${gradeCode.value}&subject=math`);
    question.value = result.question || result.next_question || null;
    stats.value = result.stats || result.summary || stats.value || {};
    selectedAnswer.value = '';
    answerResult.value = null;
    answerRequestId.value = '';
    reportSent.value = false;
    imageError.value = false;
    if (!weeklyScoreLoaded) loadWeeklyScore();
  } catch (err) {
    pageError.value = err?.error || '请检查网络后重试';
    logError('choiceKing.next', err);
  } finally {
    loading.value = false;
    loadingNext.value = false;
  }
}

function optionKey(option, index) {
  if (typeof option === 'string') {
    const direct = option.trim().match(/^([A-D])(?:[.、．:\s]|$)/i);
    return direct ? direct[1].toUpperCase() : String.fromCharCode(65 + index);
  }
  return String(option?.key || option?.label || option?.value || String.fromCharCode(65 + index)).trim().toUpperCase();
}

function optionText(option) {
  if (typeof option === 'string') return option.replace(/^([A-D])(?:[.、．:]\s*)/i, '').trim() || option;
  return String(option?.text ?? option?.content ?? option?.label_text ?? option?.label ?? '');
}

function optionClass(option, index) {
  const key = optionKey(option, index);
  if (!answerResult.value) return { selected: selectedAnswer.value === key };
  return {
    selected: selectedAnswer.value === key,
    correct: key === normalizedCorrectAnswer.value,
    wrong: selectedAnswer.value === key && !answerResult.value.is_correct,
    muted: key !== normalizedCorrectAnswer.value && key !== selectedAnswer.value,
  };
}

async function submitAnswer(answer) {
  if (submitting.value || answerResult.value || !question.value?.id) return;
  selectedAnswer.value = answer;
  if (!answerRequestId.value) answerRequestId.value = createRequestId();
  submitting.value = true;
  const attemptedBefore = summary.value.answered;
  try {
    const result = await api.post(`/choice-king/questions/${question.value.id}/answer`, {
      student_id: Number(studentId.value),
      selected_option: answer,
      client_request_id: answerRequestId.value,
    });
    answerResult.value = result.result || result.answer || result;
    const nextStats = result.stats || result.summary || answerResult.value.stats || stats.value;
    stats.value = nextStats;
    if (answerResult.value.is_correct && !answerResult.value.is_review && Number(nextStats.attempted_count ?? attemptedBefore) > attemptedBefore) {
      weeklyCorrect.value += 1;
    }
  } catch (err) {
    selectedAnswer.value = '';
    uni.showToast({ title: err?.error || '提交失败，请重试', icon: 'none' });
    logError('choiceKing.answer', err);
  } finally { submitting.value = false; }
}

async function loadWeeklyScore() {
  if (!studentId.value || weeklyScoreLoaded) return;
  weeklyScoreLoaded = true;
  try {
    const data = await api.get(`/choice-king/leaderboard?student_id=${encodeURIComponent(studentId.value)}&period=week`);
    weeklyCorrect.value = Number(data?.my_rank?.score || 0);
  } catch (err) {
    weeklyScoreLoaded = false;
    logError('choiceKing.weeklyScore', err);
  }
}

function createRequestId() {
  return `choice-${studentId.value}-${question.value?.id}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

function retryQuestionImage(){imageError.value=false;}

function openReport() {
  if (reporting.value || reportSent.value) return;
  reportReason.value = '';
  reportNote.value = '';
  reportPanel.value = true;
}

function closeReport() {
  if (!reporting.value) reportPanel.value = false;
}

async function sendReport() {
  if (reporting.value || !reportReason.value || !question.value?.id) return;
  reporting.value = true;
  try {
    await api.post('/choice-king/reports', {
      question_id: question.value.id,
      student_id: Number(studentId.value),
      reason: reportReason.value,
      note: reportNote.value.trim(),
      selected_answer: selectedAnswer.value || null,
    });
    reportSent.value = true;
    reportPanel.value = false;
    uni.showToast({ title: '已反馈给老师', icon: 'success' });
  } catch (err) {
    uni.showToast({ title: err?.error || '反馈失败，请重试', icon: 'none' });
    logError('choiceKing.report', err);
  } finally { reporting.value = false; }
}

function openLeaderboard() {
  if (!studentId.value) return;
  uni.navigateTo({ url: `/pages/choice-king/leaderboard?student_id=${studentId.value}&grade=${gradeCode.value}` });
}
function openAchievements() {
  if (!studentId.value) return;
  uni.navigateTo({ url: `/pages/achievements/index?student_id=${studentId.value}` });
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(56rpx + env(safe-area-inset-bottom))}.hero{margin:0 -24rpx;padding:46rpx 34rpx 72rpx;display:flex;align-items:flex-end;justify-content:space-between;gap:24rpx}.eyebrow{display:block;font-size:19rpx;font-weight:750}.hero-title{display:block;margin-top:8rpx;font-size:47rpx;font-weight:820;line-height:1.25}.hero-sub{display:block;max-width:460rpx;margin-top:8rpx;font-size:22rpx;line-height:1.55}.rank-link{width:130rpx;min-height:116rpx;flex:none;margin:0;padding:13rpx 10rpx}.rank-link:active,.option:active,.report-button:active,.next-button:active,.reason-button:active,.send-report:active{transform:scale(.975)}.rank-link-num,.rank-link-label{display:block}.rank-link-num{font-size:38rpx;font-weight:850;line-height:1.1}.rank-link-label{margin-top:8rpx;font-size:19rpx}.summary-strip{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;margin:-42rpx 0 20rpx;padding:22rpx 16rpx}.summary-item{text-align:center}.summary-number,.summary-label{display:block}.summary-number{font-size:31rpx;font-weight:820}.summary-label{margin-top:2rpx;font-size:19rpx}.summary-divider{width:1rpx;height:48rpx}.question-skeleton,.state-card{margin-top:18rpx;padding:28rpx}.skeleton-line,.skeleton-image,.skeleton-option{overflow:hidden}.skeleton-line{width:42%;height:26rpx}.skeleton-image{height:260rpx;margin-top:24rpx}.skeleton-option{height:88rpx;margin-top:14rpx}.review-notice{display:flex;align-items:center;gap:14rpx;margin:0 0 16rpx;padding:18rpx 20rpx}.review-mark{width:62rpx;height:62rpx;display:flex;align-items:center;justify-content:center;flex:none}.review-title,.review-copy{display:block}.review-title{font-size:24rpx;font-weight:760}.review-copy{margin-top:2rpx;font-size:20rpx}.question-card{padding:25rpx}.question-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.question-count{font-size:22rpx;font-weight:760}.source{overflow:hidden;font-size:19rpx;text-overflow:ellipsis;white-space:nowrap}.question-image{width:100%;margin-top:20rpx}.question-stem{display:block;margin-top:22rpx;font-size:30rpx;font-weight:650;line-height:1.65;word-break:break-word}.image-error{margin-top:20rpx;padding:24rpx;font-size:22rpx;line-height:1.55}.option-list{display:flex;flex-direction:column;gap:13rpx;margin-top:24rpx}.option{width:100%;min-height:88rpx;display:flex;align-items:center;gap:17rpx;margin:0;padding:14rpx 17rpx;text-align:left}.option-key{width:52rpx;height:52rpx;display:flex;align-items:center;justify-content:center;flex:none;font-size:24rpx;font-weight:820}.option-text{flex:1;font-size:25rpx;line-height:1.45}.option-state{flex:none;font-size:19rpx;font-weight:720}.option.muted{opacity:.55}.checking-bar{display:flex;align-items:center;justify-content:center;gap:12rpx;margin-top:18rpx;font-size:21rpx}.checking-bar view{width:22rpx;height:22rpx}.result-card{margin-top:18rpx;padding:25rpx}.result-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18rpx}.result-kicker,.result-title{display:block}.result-kicker{font-size:20rpx;font-weight:760}.result-title{margin-top:3rpx;font-size:28rpx;font-weight:780}.result-symbol{width:55rpx;height:55rpx;display:flex;align-items:center;justify-content:center;flex:none;font-size:34rpx;font-weight:850;line-height:1}.explanation{margin-top:20rpx;padding:20rpx}.explanation-label,.explanation-copy{display:block}.explanation-label{font-size:21rpx;font-weight:760}.explanation-copy{margin-top:7rpx;font-size:23rpx;line-height:1.65}.result-actions{display:grid;grid-template-columns:.9fr 1.25fr;gap:12rpx;margin-top:20rpx}.report-button,.next-button{min-height:82rpx;margin:0;font-size:23rpx;font-weight:720}.helper-row{display:flex;align-items:center;justify-content:space-between;gap:18rpx;padding:18rpx 4rpx;font-size:20rpx}.quiet-report{min-height:60rpx;margin:0;padding:8rpx 14rpx;font-size:20rpx;text-decoration:underline}.report-mask{position:fixed;z-index:20;inset:0;display:flex;align-items:flex-end}.report-sheet{box-sizing:border-box;width:100%;padding:30rpx 28rpx calc(28rpx + env(safe-area-inset-bottom))}.report-title,.report-sub{display:block}.report-title{font-size:31rpx;font-weight:780}.report-sub{margin-top:5rpx;font-size:22rpx}.reason-grid{display:grid;grid-template-columns:1fr 1fr;gap:11rpx;margin-top:22rpx}.reason-button{min-height:72rpx;margin:0;padding:10rpx;font-size:21rpx}.reason-button.active{font-weight:720}.report-note{box-sizing:border-box;width:100%;height:120rpx;margin-top:14rpx;padding:15rpx 17rpx;font-size:22rpx}.report-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:12rpx;margin-top:18rpx}.cancel-report,.send-report{min-height:82rpx;margin:0;font-size:24rpx;font-weight:700}@media(max-width:360px){.hero{align-items:flex-start}.rank-link{width:116rpx}.hero-title{font-size:42rpx}.question-card{padding:21rpx}.option-text{font-size:23rpx}.reason-grid{grid-template-columns:1fr}}
.poster-button{width:100%;min-height:76rpx;margin-top:12rpx;font-size:23rpx;font-weight:760}
.question-stem,.option-text,.explanation-copy{display:flex}

/* 选择题学习页：浅色练习册，正确/错误只使用受控语义色。 */
.page {
  overflow-x: hidden;
}

.hero {
  position: relative;
  align-items: center;
  margin: 0 -24rpx;
  padding: 42rpx 34rpx 66rpx;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  right: 30rpx;
  top: 24rpx;
  width: 112rpx;
  height: 18rpx;
  opacity: .78;
  transform: rotate(2deg);
}

.rank-link {
  position: relative;
  z-index: 1;
  min-height: 112rpx;
}

.option {
  min-height: 112rpx;
}

.report-button,
.next-button,
.poster-button {
  min-height: 112rpx;
}
.quiet-report { min-height: 88rpx; }
.reason-button {
  min-height: 88rpx;
}
.cancel-report,
.send-report {
  min-height: 112rpx;
}

.rank-link:active,
.option:active,
.report-button:active,
.next-button:active,
.poster-button:active,
.reason-button:active,
.send-report:active { transform: scale(var(--tap-scale)); }

@media (prefers-reduced-motion: reduce) {
  .rank-link:active,
  .option:active,
  .report-button:active,
  .next-button:active,
  .poster-button:active,
  .reason-button:active,
  .send-report:active { transform: none; }
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
  align-items: center;
  margin: 0 -24rpx;
  padding: 34rpx 30rpx 28rpx;
  border-bottom: 7rpx solid var(--primary);
  border-radius: 0;
  background-color: var(--surface);
  box-shadow: none;
}

.student-challenge-page .hero::after {
  top: 0;
  right: 34rpx;
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
  font-size: 46rpx;
  letter-spacing: 0;
}

.student-challenge-page .hero-sub {
  max-width: 470rpx;
  margin-top: 9rpx;
  color: var(--text-secondary);
  font-size: 22rpx;
}

.student-challenge-page .rank-link {
  width: 132rpx;
  min-height: 92rpx;
  padding: 12rpx 10rpx;
  border: 1rpx solid #DDEEFF;
  border-top: 7rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
  color: var(--ink);
  box-shadow: none;
}

.student-challenge-page .rank-link-num {
  color: var(--primary-strong);
  font-size: 38rpx;
}

.student-challenge-page .rank-link-label {
  color: var(--text-secondary);
  font-size: 18rpx;
}

.student-challenge-page .summary-strip {
  z-index: auto;
  margin: 18rpx 0;
  padding: 20rpx 12rpx;
  border: 1rpx solid var(--border);
  border-left: 7rpx solid var(--accent);
  border-radius: var(--r-sm);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .summary-number {
  color: var(--primary-strong);
  font-size: 32rpx;
}

.student-challenge-page .summary-label {
  color: var(--text-muted);
  font-size: 19rpx;
}

.student-challenge-page .summary-divider {
  background: var(--hairline);
}

.student-challenge-page .question-skeleton,
.student-challenge-page .state-card,
.student-challenge-page .question-card {
  margin-top: 0;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .question-card {
  padding: 26rpx;
  border-top: 7rpx solid var(--primary);
}

.student-challenge-page .skeleton-line,
.student-challenge-page .skeleton-image,
.student-challenge-page .skeleton-option {
  background: var(--primary-soft);
}

.student-challenge-page .review-notice {
  margin-bottom: 16rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid #DDEEFF;
  border-left: 7rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
}

.student-challenge-page .review-mark {
  border-radius: var(--r-xs);
  background: var(--surface);
  color: var(--primary-strong);
}

.student-challenge-page .review-title {
  color: var(--ink);
}

.student-challenge-page .review-copy,
.student-challenge-page .source {
  color: var(--text-muted);
}

.student-challenge-page .question-count,
.student-challenge-page .explanation-label {
  color: var(--primary-strong);
}

.student-challenge-page .question-stem {
  color: var(--ink);
}

.student-challenge-page .option-list {
  gap: 12rpx;
}

.student-challenge-page .option {
  min-height: 96rpx;
  padding: 14rpx 16rpx;
  border: 2rpx solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  color: var(--ink);
  box-shadow: none;
}

.student-challenge-page .option-key {
  width: 54rpx;
  height: 54rpx;
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.student-challenge-page .option.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.student-challenge-page .option.correct {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.student-challenge-page .option.correct .option-key {
  background: var(--accent);
}

.student-challenge-page .option.wrong {
  border-color: var(--coral);
  background: var(--coral-soft);
}

.student-challenge-page .option.wrong .option-key {
  background: var(--coral);
}

.student-challenge-page .checking-bar {
  color: var(--text-secondary);
}

.student-challenge-page .checking-bar view {
  border-color: var(--border);
  border-top-color: var(--primary);
}

.student-challenge-page .result-card {
  padding: 24rpx;
  border: 1rpx solid #DDEEFF;
  border-left: 7rpx solid var(--accent);
  border-radius: var(--r);
  background: var(--accent-soft);
  box-shadow: none;
}

.student-challenge-page .result-card.wrong {
  border-color: #EFC9C2;
  border-left-color: var(--coral);
  background: var(--coral-soft);
}

.student-challenge-page .result-kicker {
  color: var(--accent-strong);
}

.student-challenge-page .wrong .result-kicker {
  color: #D66D62;
}

.student-challenge-page .result-title {
  color: var(--ink);
}

.student-challenge-page .result-symbol {
  border-radius: var(--r-xs);
  background: var(--accent);
}

.student-challenge-page .wrong .result-symbol {
  background: var(--coral);
}

.student-challenge-page .explanation {
  border: 1rpx solid rgba(215, 224, 237, .85);
  border-radius: var(--r-sm);
  background: var(--surface);
}

.student-challenge-page .explanation-copy {
  color: var(--text-secondary);
}

.student-challenge-page .report-button,
.student-challenge-page .next-button,
.student-challenge-page .poster-button {
  min-height: 94rpx;
  border-radius: var(--r-sm);
}

.student-challenge-page .report-button {
  border-color: var(--border);
  background: var(--surface);
  color: var(--text-secondary);
}

.student-challenge-page .next-button {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .poster-button {
  border-color: #DDEEFF;
  background: var(--primary-soft);
  color: #315EA8;
}

.student-challenge-page .helper-row,
.student-challenge-page .quiet-report {
  color: var(--text-muted);
}

.student-challenge-page .quiet-report {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-height: 64rpx;
  padding: 0;
  border: 0;
  background-color: transparent !important;
  background-image: none !important;
  text-decoration: underline;
}

.student-challenge-page .quiet-report::after {
  border: 0;
}

.student-challenge-page .report-mask {
  background: rgba(36, 50, 74, .46);
}

.student-challenge-page .report-sheet {
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  background: var(--surface);
}

.student-challenge-page .report-title {
  color: var(--ink);
}

.student-challenge-page .report-sub {
  color: var(--text-secondary);
}

.student-challenge-page .reason-button,
.student-challenge-page .report-note {
  border-color: var(--border);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.student-challenge-page .reason-button.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.student-challenge-page .cancel-report {
  border-color: var(--border);
  background: var(--surface);
  color: var(--text-secondary);
}

.student-challenge-page .send-report {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .hero-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.student-challenge-page .hero-icon {
  width: 62rpx;
  height: 62rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1rpx solid #CADCF2;
  border-radius: 13rpx;
  background: var(--primary-soft);
}

.student-challenge-page .rank-link .pp-icon,
.student-challenge-page .summary-item .pp-icon {
  margin: 0 auto 4rpx;
}

.student-challenge-page .result-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 360px) {
  .student-challenge-page .hero {
    align-items: flex-start;
  }

  .student-challenge-page .rank-link {
    width: 116rpx;
  }
}
</style>
