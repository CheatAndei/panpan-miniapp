<template>
  <view class="page page-bottom-safe">
    <view class="hero">
      <view>
        <text class="eyebrow">CHOICE PRACTICE</text>
        <text class="hero-title">选择刷题王</text>
        <text class="hero-sub">每次一题，即时判断。答错的题会在合适的时候回来。</text>
      </view>
      <button class="rank-link" :disabled="!studentId || loading" @tap="openLeaderboard">
        <text class="rank-link-num">{{ summary.weekly_correct }}</text>
        <text class="rank-link-label">本周答对</text>
      </button>
    </view>

    <view class="summary-strip" aria-label="刷题进度">
      <view class="summary-item">
        <text class="summary-number">{{ summary.answered }}</text>
        <text class="summary-label">已刷题目</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-number">{{ summary.correct }}</text>
        <text class="summary-label">累计答对</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
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
        <text v-if="question.stem" class="question-stem">{{ question.stem }}</text>
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
            <text class="option-text">{{ optionText(option) }}</text>
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
          <text class="result-symbol">{{ answerResult.is_correct ? '✓' : '×' }}</text>
        </view>
        <view class="explanation">
          <text class="explanation-label">答案解析</text>
          <text class="explanation-copy">{{ answerResult.explanation || answerResult.analysis || '解析暂未录入，可以先根据标准答案检查思路。' }}</text>
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
.page{min-height:100vh;padding:0 24rpx calc(56rpx + env(safe-area-inset-bottom));background:#F3F7F5}.hero{margin:0 -24rpx;padding:46rpx 34rpx 72rpx;display:flex;align-items:flex-end;justify-content:space-between;gap:24rpx;background:linear-gradient(145deg,#173A36,#2D6259);color:#fff}.eyebrow{display:block;color:#A9D8CB;font-size:19rpx;font-weight:750;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:47rpx;font-weight:820;line-height:1.25}.hero-sub{display:block;max-width:460rpx;margin-top:8rpx;color:#D4E9E3;font-size:22rpx;line-height:1.55}.rank-link{width:130rpx;min-height:116rpx;flex:none;margin:0;padding:13rpx 10rpx;border:1rpx solid rgba(255,255,255,.22);border-radius:18rpx;background:rgba(255,255,255,.1);color:#fff}.rank-link::after,.option::after,.report-button::after,.next-button::after,.quiet-report::after,.reason-button::after,.cancel-report::after,.send-report::after{border:0}.rank-link:active,.option:active,.report-button:active,.next-button:active,.reason-button:active,.send-report:active{transform:scale(.975)}.rank-link-num,.rank-link-label{display:block}.rank-link-num{font-size:38rpx;font-weight:850;line-height:1.1}.rank-link-label{margin-top:8rpx;color:#D1E8E1;font-size:19rpx}.summary-strip{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;margin:-42rpx 0 20rpx;padding:22rpx 16rpx;border:1rpx solid #D9E6E2;border-radius:20rpx;background:#fff;box-shadow:0 12rpx 30rpx rgba(24,58,54,.1)}.summary-item{text-align:center}.summary-number,.summary-label{display:block}.summary-number{color:#183A36;font-size:31rpx;font-weight:820}.summary-label{margin-top:2rpx;color:#71817C;font-size:19rpx}.summary-divider{width:1rpx;height:48rpx;background:#DDE8E4}.question-skeleton,.state-card{margin-top:18rpx;padding:28rpx;border:1rpx solid #DDE8E4;border-radius:22rpx;background:#fff}.skeleton-line,.skeleton-image,.skeleton-option{overflow:hidden;background:linear-gradient(100deg,#EDF3F1 20%,#F8FBFA 40%,#EDF3F1 60%);background-size:200% 100%;animation:shimmer 1.25s linear infinite}.skeleton-line{width:42%;height:26rpx;border-radius:8rpx}.skeleton-image{height:260rpx;margin-top:24rpx;border-radius:16rpx}.skeleton-option{height:88rpx;margin-top:14rpx;border-radius:16rpx}@keyframes shimmer{to{background-position:-200% 0}}.review-notice{display:flex;align-items:center;gap:14rpx;margin:0 0 16rpx;padding:18rpx 20rpx;border:1rpx solid #E8D5A5;border-radius:18rpx;background:#FFF8E8}.review-mark{width:62rpx;height:62rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:16rpx;background:#F5E6B8}.review-title,.review-copy{display:block}.review-title{color:#76540B;font-size:24rpx;font-weight:760}.review-copy{margin-top:2rpx;color:#866E39;font-size:20rpx}.question-card{padding:25rpx;border:1rpx solid #D9E6E2;border-radius:22rpx;background:#fff;box-shadow:0 10rpx 28rpx rgba(24,58,54,.06)}.question-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.question-count{color:#246B5B;font-size:22rpx;font-weight:760}.source{overflow:hidden;color:#7A8B86;font-size:19rpx;text-overflow:ellipsis;white-space:nowrap}.question-image{width:100%;margin-top:20rpx;border-radius:14rpx;background:#F8FAF9}.question-stem{display:block;margin-top:22rpx;color:#172D29;font-size:30rpx;font-weight:650;line-height:1.65;word-break:break-word}.image-error{margin-top:20rpx;padding:24rpx;border-radius:14rpx;background:#FCEEEB;color:#9C5048;font-size:22rpx;line-height:1.55}.option-list{display:flex;flex-direction:column;gap:13rpx;margin-top:24rpx}.option{width:100%;min-height:88rpx;display:flex;align-items:center;gap:17rpx;margin:0;padding:14rpx 17rpx;border:2rpx solid #D7E4E0;border-radius:16rpx;background:#FAFCFB;color:#1C332F;text-align:left;transition:transform .15s ease,border-color .15s ease,background-color .15s ease}.option-key{width:52rpx;height:52rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:13rpx;background:#E6F0ED;color:#27695B;font-size:24rpx;font-weight:820}.option-text{flex:1;font-size:25rpx;line-height:1.45}.option-state{flex:none;color:#236B5B;font-size:19rpx;font-weight:720}.option-state.wrong{color:#A45149}.option.selected{border-color:#2F7D6B;background:#F0F7F4}.option.correct{border-color:#2F7D6B;background:#E8F5F1}.option.correct .option-key{background:#2F7D6B;color:#fff}.option.wrong{border-color:#C75D54;background:#FCEEEB}.option.wrong .option-key{background:#C75D54;color:#fff}.option.muted{opacity:.55}.checking-bar{display:flex;align-items:center;justify-content:center;gap:12rpx;margin-top:18rpx;color:#52706A;font-size:21rpx}.checking-bar view{width:22rpx;height:22rpx;border:3rpx solid #C6DBD5;border-top-color:#2F7D6B;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.result-card{margin-top:18rpx;padding:25rpx;border:1rpx solid #CDE2DC;border-radius:22rpx;background:#F0F8F5}.result-card.wrong{border-color:#EBCFCB;background:#FFF6F4}.result-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18rpx}.result-kicker,.result-title{display:block}.result-kicker{color:#2A6C5E;font-size:20rpx;font-weight:760}.wrong .result-kicker{color:#A45149}.result-title{margin-top:3rpx;color:#193934;font-size:28rpx;font-weight:780}.result-symbol{width:55rpx;height:55rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:15rpx;background:#2F7D6B;color:#fff;font-size:34rpx;font-weight:850;line-height:1}.wrong .result-symbol{background:#C75D54}.explanation{margin-top:20rpx;padding:20rpx;border-radius:15rpx;background:#fff}.explanation-label,.explanation-copy{display:block}.explanation-label{color:#246B5B;font-size:21rpx;font-weight:760}.explanation-copy{margin-top:7rpx;color:#455E58;font-size:23rpx;line-height:1.65}.result-actions{display:grid;grid-template-columns:.9fr 1.25fr;gap:12rpx;margin-top:20rpx}.report-button,.next-button{min-height:82rpx;margin:0;border-radius:14rpx;font-size:23rpx;font-weight:720}.report-button{border:1rpx solid #BDD2CC;background:#fff;color:#49645D}.next-button{background:#183A36;color:#fff}.helper-row{display:flex;align-items:center;justify-content:space-between;gap:18rpx;padding:18rpx 4rpx;color:#73847F;font-size:20rpx}.quiet-report{min-height:60rpx;margin:0;padding:8rpx 14rpx;background:transparent;color:#55726A;font-size:20rpx;text-decoration:underline}.report-mask{position:fixed;z-index:20;inset:0;display:flex;align-items:flex-end;background:rgba(12,31,27,.46)}.report-sheet{box-sizing:border-box;width:100%;padding:30rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));border-radius:28rpx 28rpx 0 0;background:#fff}.report-title,.report-sub{display:block}.report-title{color:#183A36;font-size:31rpx;font-weight:780}.report-sub{margin-top:5rpx;color:#697B76;font-size:22rpx}.reason-grid{display:grid;grid-template-columns:1fr 1fr;gap:11rpx;margin-top:22rpx}.reason-button{min-height:72rpx;margin:0;padding:10rpx;border:1rpx solid #D6E3DF;border-radius:13rpx;background:#F8FBFA;color:#536762;font-size:21rpx}.reason-button.active{border:2rpx solid #2F7D6B;background:#EAF5F1;color:#205F51;font-weight:720}.report-note{box-sizing:border-box;width:100%;height:120rpx;margin-top:14rpx;padding:15rpx 17rpx;border:1rpx solid #D6E3DF;border-radius:13rpx;background:#F8FBFA;color:#263B36;font-size:22rpx}.report-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:12rpx;margin-top:18rpx}.cancel-report,.send-report{min-height:82rpx;margin:0;border-radius:14rpx;font-size:24rpx;font-weight:700}.cancel-report{border:1rpx solid #C9D8D3;background:#fff;color:#5E736D}.send-report{background:#183A36;color:#fff}@media(max-width:360px){.hero{align-items:flex-start}.rank-link{width:116rpx}.hero-title{font-size:42rpx}.question-card{padding:21rpx}.option-text{font-size:23rpx}.reason-grid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.skeleton-line,.skeleton-image,.skeleton-option,.checking-bar view{animation:none}.option,.rank-link{transition:none}}
.poster-button{width:100%;min-height:76rpx;margin-top:12rpx;border:1rpx solid #D6B759;border-radius:14rpx;background:#FFF7D8;color:#6D4F0D;font-size:23rpx;font-weight:760}.poster-button::after{border:0}
</style>
