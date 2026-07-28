<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="hero">
      <text class="eyebrow">QUESTION REPORTS</text>
      <view class="hero-title-row">
        <view class="hero-icon"><pp-icon name="report" :size="34" motion="ring" :delay="80" decorative /></view>
        <text class="hero-title">题目报错处理</text>
      </view>
      <text class="hero-sub">统一核对选择题、口算题和学习计算题，必要时立即停用。</text>
    </view>

    <view class="source-tabs" aria-label="报错题目类型">
      <button v-for="item in sourceTabs" :key="item.value" :class="['source-tab',{active:sourceType===item.value}]" :disabled="loading" @tap="switchSource(item.value)">
        {{ item.label }}
      </button>
    </view>

    <view class="tabs" aria-label="报错处理状态">
      <button v-for="item in tabs" :key="item.value" :class="['tab',{active:status===item.value}]" :disabled="loading" @tap="switchStatus(item.value)">
        {{ item.label }}
      </button>
    </view>

    <view v-if="loading && !reports.length" class="report-skeleton" aria-label="报错列表加载中">
      <view v-for="item in 3" :key="item" class="skeleton-card">
        <view class="skeleton-line short"></view><view class="skeleton-line"></view><view class="skeleton-box"></view>
      </view>
    </view>

    <view v-else-if="error && !reports.length" class="state-card">
      <pp-state type="error" title="报错记录加载失败" :description="error" action-text="重新加载" @action="loadReports" />
    </view>

    <view v-else-if="!reports.length" class="state-card">
      <pp-state :title="status === 'pending' ? '当前没有待处理报错' : '当前没有相关记录'" description="学生反馈题目或答案问题后，会集中显示在这里。" />
    </view>

    <view v-for="item in reports" :key="item.id" class="report-card">
      <view class="report-head">
        <view class="report-student-icon"><pp-icon name="user" :size="28" /></view>
        <view class="student-copy">
          <text class="student-name">{{ item.student_name || item.student?.name || '学生反馈' }}</text>
          <text class="report-meta">{{ item.class_name || item.student?.class_name || '未分组' }} · {{ formatTime(item.created_at) }}</text>
        </view>
        <view class="status-stack">
          <text v-if="item.high_priority" class="priority-tag">多人反馈</text>
          <text :class="['status-tag',reportStatus(item)]">{{ statusLabel(item) }}</text>
        </view>
      </view>

      <view class="reason-box">
        <view class="reason-label-row"><pp-icon name="message" :size="24" /><text class="reason-label">反馈原因</text></view>
        <text class="reason-title">{{ reasonLabel(item.reason || item.report_reason) }}</text>
        <text v-if="item.note || item.description" class="reason-note">{{ item.note || item.description }}</text>
      </view>

      <view class="question-box">
        <view class="question-top">
          <text class="question-id">{{ item.question_position ? `第 ${item.question_position} 题` : `题目 #${item.question_id || item.question?.id || '-'}` }}</text>
          <text class="question-source">{{ item.source_label || item.question?.source_label || item.question?.source || '原卷题目' }}</text>
        </view>
        <image v-if="questionImage(item)" class="question-image" :src="questionImage(item)" mode="widthFix" @tap="previewQuestion(item)" />
        <pp-math-text v-if="item.question?.stem || item.question_stem" class="question-stem" :value="item.question?.stem || item.question_stem" />
        <view v-if="sourceType==='choice'" class="answer-row">
          <text>学生选择：{{ item.selected_answer || '未作答' }}</text>
          <view class="answer-math"><text>标准答案：</text><pp-math-text class="answer-inline" :value="item.correct_answer || item.question?.correct_answer || '待核对'" /></view>
        </view>
        <view v-else class="answer-row"><view class="answer-math"><text>标准答案：</text><pp-math-text class="answer-inline" :value="item.correct_answer || '待核对'" /></view></view>
      </view>

      <view v-if="reportStatus(item)==='pending'" class="review-actions">
        <button class="no-issue" :disabled="processingId===item.id" @tap="resolveReport(item,false)">
          {{ processingId===item.id ? '处理中…' : '核对无误' }}
        </button>
        <button class="stop-question" :disabled="processingId===item.id" @tap="resolveReport(item,true)">停用题目</button>
      </view>
      <view v-else class="resolution-box">
        <text class="resolution-label">处理结果</text>
        <text class="resolution-copy">{{ resolutionLabel(item) }}</text>
        <text v-if="Number(item.affected_review_count)>0" class="resolution-copy">已生成 {{ item.affected_review_count }} 条历史成绩复核记录，原成绩未自动修改。</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const tabs = [{ value: 'pending', label: '待处理' }, { value: 'resolved', label: '已处理' }, { value: 'all', label: '全部' }];
const sourceTabs = [
  { value: 'choice', label: '选择题' },
  { value: 'mental_challenge', label: '口算题' },
  { value: 'learning_attempt', label: '学习计算题' },
];
const sourceType = ref('choice');
const status = ref('pending');
const reports = ref([]);
const loading = ref(false);
const error = ref('');
const processingId = ref(null);

onShow(loadReports);
onPullDownRefresh(async () => { try { await loadReports(); } finally { uni.stopPullDownRefresh(); } });

async function loadReports() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const url = sourceType.value === 'choice'
      ? `/choice-king/reports?status=${status.value}`
      : `/calculation-reports?source_type=${sourceType.value}&status=${status.value}`;
    const result = await api.get(url);
    reports.value = result.reports || result.items || [];
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('choiceReports.load', err);
  } finally { loading.value = false; }
}

function switchSource(value) {
  if (sourceType.value === value || loading.value) return;
  sourceType.value = value;
  reports.value = [];
  loadReports();
}

function switchStatus(value) {
  if (status.value === value || loading.value) return;
  status.value = value;
  reports.value = [];
  loadReports();
}

function reportStatus(item) {
  const value = String(item.status || '').toLowerCase();
  return ['resolved', 'dismissed', 'closed'].includes(value) ? 'resolved' : 'pending';
}
function statusLabel(item) { return reportStatus(item) === 'pending' ? '待处理' : '已处理'; }
function reasonLabel(reason) {
  return {
    unclear: '题目显示不完整',
    sign_bracket: '正负号或括号错误',
    question_error: '题目或选项与原卷不一致',
    answer_error: '答案或解析可能有误',
    duplicate: '重复题',
    other: '其他问题',
  }[reason] || reason || '题目或答案有问题';
}
function resolutionLabel(item) {
  if (item.stop_question || item.question_stopped || Number(item.question_is_active) === 0 || item.resolution === 'question_stopped') return '已停用题目，后续不会继续发给学生。';
  return item.resolution_note || item.teacher_note || '已核对，题目与答案无误。';
}
function questionImage(item) {
  const url = item.question_image_url || item.question_url || item.question?.question_image_url || item.question?.question_url || item.question?.image_url || '';
  return url ? api.assetUrl(url) : '';
}
function previewQuestion(item) {
  const url = questionImage(item);
  if (url) uni.previewImage({ urls: [url], current: url });
}
function formatTime(value) {
  if (!value) return '时间未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function resolveReport(item, stopQuestion) {
  if (processingId.value) return;
  const teacherNote = await askResolution(stopQuestion);
  if (teacherNote === null) return;
  processingId.value = item.id;
  try {
    const url = sourceType.value === 'choice'
      ? `/choice-king/reports/${item.id}`
      : `/calculation-reports/${item.id}`;
    await api.put(url, {
      status: 'resolved',
      resolution: stopQuestion ? 'question_stopped' : 'no_issue',
      stop_question: stopQuestion,
      teacher_note: teacherNote || (stopQuestion ? '教师确认题目有误' : '已核对，题目与答案无误'),
    });
    uni.showToast({ title: stopQuestion ? '题目已停用' : '已标记核对无误', icon: 'success' });
    await loadReports();
  } catch (err) {
    uni.showToast({ title: err?.error || '处理失败，请重试', icon: 'none' });
    logError('choiceReports.resolve', err);
  } finally { processingId.value = null; }
}

function askResolution(stopQuestion) {
  return new Promise((resolve) => {
    uni.showModal({
      title: stopQuestion ? '确认停用这道题？' : '确认核对无误？',
      content: stopQuestion ? '停用后新练习不再抽到，历史成绩只生成复核记录，不会自动改分。' : '',
      editable: true,
      placeholderText: stopQuestion ? '填写停用原因（选填）' : '填写处理说明（选填）',
      confirmText: stopQuestion ? '确认停用' : '确认完成',
      confirmColor: stopQuestion ? '#D94B45' : '#15946D',
      success: (result) => resolve(result.confirm ? String(result.content || '').trim() : null),
      fail: () => resolve(null),
    });
  });
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(54rpx + env(safe-area-inset-bottom));background:#F3F7F5}.hero{margin:0 -24rpx;padding:46rpx 34rpx 42rpx;background:#FFFFFF;color:#fff}.eyebrow{display:block;color:#B5DDD3;font-size:19rpx;font-weight:760;letter-spacing: 0}.hero-title{display:block;margin-top:8rpx;font-size:42rpx;font-weight:820}.hero-sub{display:block;margin-top:8rpx;color:#D4E9E3;font-size:22rpx;line-height:1.55}.source-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:9rpx;margin-top:20rpx}.source-tab{min-height:68rpx;margin:0;padding:8rpx;border:1rpx solid #D8E5E1;border-radius:13rpx;background:#fff;color:#5A6A62;font-size:21rpx;font-weight:680}.source-tab.active{border-color:#15946D;background:#E8F5EF;color:#15946D}.source-tab::after{border:0}.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8rpx;margin-top:12rpx;padding:7rpx;border:1rpx solid #D8E5E1;border-radius:17rpx;background:#fff}.tab{min-height:68rpx;margin:0;border-radius:12rpx;background:transparent;color:#5A6A62;font-size:22rpx;font-weight:680}.tab::after,.review-actions button::after{border:0}.tab.active{background:#20B486;color:#fff}.report-skeleton,.state-card{margin-top:18rpx}.skeleton-card{margin-bottom:16rpx;padding:24rpx;border:1rpx solid #DDE8E4;border-radius:22rpx;background:#fff}.skeleton-line,.skeleton-box{background:linear-gradient(100deg,#EAF1EF 20%,#F9FBFA 40%,#EAF1EF 60%);background-size:200% 100%;animation:shimmer 1.2s linear infinite}.skeleton-line{width:78%;height:26rpx;border-radius:8rpx}.skeleton-line.short{width:34%;margin-bottom:15rpx}.skeleton-box{height:150rpx;margin-top:22rpx;border-radius:14rpx}@keyframes shimmer{to{background-position:-200% 0}}.state-card{border:1rpx solid #DDE8E4;border-radius:22rpx;background:#fff}.report-card{margin-top:18rpx;padding:25rpx;border:1rpx solid #D9E6E2;border-radius:22rpx;background:#fff;box-shadow:0 8rpx 26rpx rgba(24,58,54,.055)}.report-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.student-copy{min-width:0}.student-name,.report-meta{display:block}.student-name{color:#26352F;font-size:27rpx;font-weight:760}.report-meta{margin-top:3rpx;color:#5A6A62;font-size:20rpx}.status-stack{display:flex;align-items:flex-end;flex-direction:column;gap:6rpx}.priority-tag{padding:6rpx 10rpx;border-radius:8rpx;background:#FFF0EE;color:#D94B45;font-size:18rpx;font-weight:760}.status-tag{flex:none;padding:7rpx 12rpx;border-radius:9rpx;background:#EEF8F3;color:#15946D;font-size:19rpx;font-weight:720}.status-tag.resolved{background:#E8F5EF;color:#29695A}.reason-box{margin-top:18rpx;padding:18rpx;border-radius:14rpx;background:#FFF7F0}.reason-label,.reason-title,.reason-note{display:block}.reason-label{color:#A35C3C;font-size:18rpx;font-weight:730}.reason-title{margin-top:3rpx;color:#5A6A62;font-size:24rpx;font-weight:720}.reason-note{margin-top:6rpx;color:#5A6A62;font-size:21rpx;line-height:1.55}.question-box{margin-top:16rpx;padding:18rpx;border:1rpx solid #E0E9E6;border-radius:15rpx;background:#FAFCFB}.question-top{display:flex;justify-content:space-between;gap:14rpx}.question-id{color:#285F54;font-size:20rpx;font-weight:730}.question-source{overflow:hidden;color:#5A6A62;font-size:19rpx;text-overflow:ellipsis;white-space:nowrap}.question-image{width:100%;margin-top:14rpx;border-radius:11rpx;background:#fff}.question-stem{display:block;margin-top:13rpx;color:#26352F;font-size:23rpx;line-height:1.6}.answer-row{display:flex;justify-content:space-between;gap:14rpx;margin-top:14rpx;padding-top:13rpx;border-top:1rpx solid #E1EAE7;color:#536C66;font-size:20rpx}.review-actions{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:18rpx}.review-actions button{min-height:80rpx;margin:0;border-radius:14rpx;font-size:23rpx;font-weight:720}.no-issue{border:1rpx solid #BDD1CB;background:#fff;color:#49645D}.stop-question{background:#D94B45;color:#fff}.resolution-box{margin-top:18rpx;padding:16rpx 18rpx;border-radius:13rpx;background:#E8F5EF}.resolution-label,.resolution-copy{display:block}.resolution-label{color:#15946D;font-size:19rpx;font-weight:730}.resolution-copy{margin-top:3rpx;color:#48645D;font-size:21rpx;line-height:1.5}@media(prefers-reduced-motion:reduce){.skeleton-line,.skeleton-box{animation:none}}
.question-stem,.answer-math{display:flex;align-items:center;flex-wrap:wrap}.answer-inline{width:auto;flex:none}
.page {
  background-color: var(--page-bg, #F8FCF9);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(32, 180, 134, .028) 64rpx 65rpx
  );
}
.source-tab { border-color: var(--border); color: var(--text-secondary); }
.source-tab.active {
  border-color: #BFE4D4;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.tabs { border-color: var(--border); }
.tab.active { background: var(--primary-strong); color: #FFFFFF; }
.report-card,
.skeleton-card,
.state-card {
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}
.student-name { color: var(--ink); }
.question-id { color: var(--primary-strong); }
.status-tag.resolved,
.resolution-box { background: var(--accent-soft); color: var(--accent-strong); }
.resolution-label { color: var(--accent-strong); }
.no-issue {
  border-color: #BFE4D4;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.stop-question { background: var(--danger); color: #FFFFFF; }
.source-tab,
.tab,
.report-card,
.review-actions button {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}
.source-tab:active,
.tab:active,
.report-card:active,
.review-actions button:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}
@media (prefers-reduced-motion: reduce) {
  .source-tab,
  .tab,
  .report-card,
  .review-actions button,
  .skeleton-line,
  .skeleton-box {
    animation: none !important;
    transition: none !important;
  }
  .source-tab:active,
  .tab:active,
  .report-card:active,
  .review-actions button:active { transform: none; }
}
/* Bright Panpan review desk: final visible layer. */
.page {
  background-color: #F7FBF7;
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(32, 180, 134, .035) 64rpx 65rpx
  );
}
.hero {
  padding: 34rpx 34rpx 30rpx;
  border-bottom: 6rpx solid #20B486;
  background: #FFFFFF !important;
  color: #243029;
  box-shadow: 0 6rpx 18rpx rgba(36, 48, 41, .055);
}
.hero::after {
  top: 0;
  right: 34rpx;
  bottom: auto;
  width: 116rpx;
  height: 9rpx;
  border-radius: 0;
  background: #20B486;
}
.hero-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 7rpx;
}
.hero-icon {
  width: 54rpx;
  height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 10rpx;
  background: #E8F5EF;
}
.hero-title { margin-top: 0; color: #243029; }
.hero-sub { color: #5A6A62; }
.eyebrow { color: #15946D; }
.source-tabs { gap: 8rpx; }
.source-tab,
.tab {
  height: 68rpx;
  min-height: 0;
  padding: 0 10rpx;
  border-radius: 10rpx;
  line-height: 68rpx;
}
.source-tab {
  border-color: #D9E7DF;
  background: #FFFFFF;
  color: #5A6A62;
}
.source-tab.active {
  border-color: #9EDAC6;
  background: #E8F5EF;
  color: #15946D;
}
.tabs {
  padding: 5rpx;
  border-color: #D9E7DF;
  border-radius: 12rpx;
  background: #F1F7F3;
  box-shadow: none;
}
.tab.active { background: #20B486; color: #15946D; }
.skeleton-card,
.state-card,
.report-card {
  border-color: #D9E7DF;
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 5rpx 16rpx rgba(36, 48, 41, .05);
}
.skeleton-line,
.skeleton-box { background: #E8F5EF; }
.student-name,
.reason-title,
.question-stem { color: #243029; }
.reason-box {
  border-color: #FFD0CB;
  border-radius: 12rpx;
  background: #FFF0EE;
}
.reason-label { color: #D94B45; }
.reason-note { color: #5A6A62; }
.question-box {
  border-color: #D9E7DF;
  border-radius: 12rpx;
  background: #F8FCF9;
}
.question-id { color: #15946D; }
.status-tag { background: #EEF8F3; color: #15946D; }
.status-tag.resolved,
.resolution-box { background: #E8F5EF; color: #15946D; }
.resolution-label { color: #15946D; }
.review-actions button {
  height: 80rpx;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16rpx;
  border-radius: 11rpx;
}
.no-issue {
  border-color: #9EDAC6;
  background: #E8F5EF;
  color: #15946D;
}
.stop-question { background: #D94B45; color: #FFFFFF; }
/* mei final pass: question triage on light paper */
.page {
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(32, 180, 134, .028) 64rpx 65rpx
  );
}
.hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1rpx solid rgba(32, 180, 134, .16);
  background:
    linear-gradient(rgba(32, 180, 134, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(32, 180, 134, .05) 1rpx, transparent 1rpx),
    linear-gradient(145deg, #FFFFFF, #E8F5EF 72%, #EEF8F3);
  background-size: 34rpx 34rpx, 34rpx 34rpx, auto;
  color: var(--ink);
  box-shadow: 0 12rpx 28rpx rgba(38, 53, 47, .07);
  animation: report-surface-in var(--motion-slow) var(--ease-out) both;
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
.source-tabs,
.tabs { position: relative; z-index: 1; }
.source-tab,
.tab { min-height: 80rpx; }
.source-tab.active {
  border-color: #BFE4D4;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.tabs {
  border-color: var(--border);
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}
.tab.active { background: var(--primary-strong); color: #FFFFFF; }
.skeleton-card,
.state-card,
.report-card {
  border-color: var(--border);
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}
.skeleton-line,
.skeleton-box {
  background: #E8F1EC;
  animation: report-skeleton-pulse 1s ease-in-out infinite alternate;
}
.report-card {
  border-radius: 18rpx;
  animation: report-surface-in var(--motion-slow) var(--ease-out) both;
}
.reason-box {
  border: 1rpx solid rgba(233, 133, 119, .24);
  background: var(--coral-soft);
}
.reason-label { color: #D94B45; }
.reason-title { color: var(--ink); }
.reason-note { color: var(--text-secondary); }
.question-box {
  border-color: var(--border);
  background:
    linear-gradient(rgba(32, 180, 134, .04) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(32, 180, 134, .04) 1rpx, transparent 1rpx),
    #F8FCF9;
  background-size: 30rpx 30rpx;
}
.question-stem { color: var(--ink); }
.answer-row { border-color: var(--border); color: var(--text-secondary); }
.status-tag.resolved,
.resolution-box { background: var(--success-soft); color: var(--success); }
.resolution-label { color: var(--success); }
.no-issue {
  min-height: 88rpx;
  border-color: #CDE9E1;
  background: var(--success-soft);
  color: var(--success);
}
.stop-question {
  min-height: 88rpx;
  background: var(--danger);
  color: #FFFFFF;
}
.source-tab,
.tab,
.review-actions button {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}
.report-card { transition: none; }
.report-card:active { transform: none; opacity: 1; }
.source-tab:active,
.tab:active,
.review-actions button:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}
@keyframes report-surface-in {
  from { transform: translateY(12rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes report-skeleton-pulse {
  from { opacity: .48; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .hero,
  .report-card,
  .skeleton-line,
  .skeleton-box,
  .source-tab,
  .tab,
  .review-actions button {
    animation: none !important;
    transition: none !important;
  }
  .source-tab:active,
  .tab:active,
  .review-actions button:active { transform: none; }
}

/* Student challenge theme v3: warm paper and one energetic teaching green. */
.student-challenge-page {
  --page-bg: #F8FCF9;
  --surface: #FFFFFF;
  --surface-muted: #F1F8F4;
  --ink: #26352F;
  --text-secondary: #5A6A62;
  --text-muted: #6D7C74;
  --primary: #20B486;
  --primary-strong: #15946D;
  --primary-soft: #E8F5EF;
  --coral: #FF7468;
  --coral-soft: #FFF0EE;
  --danger: #D94B45;
  --border: #D5E6DE;
  --hairline: #E4EFE9;
  min-height: 100vh;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(0deg, transparent 0 55rpx, rgba(32, 180, 134, .05) 56rpx 57rpx);
  color: var(--ink);
}
.student-challenge-page .hero {
  min-height: 0;
  padding: 34rpx 30rpx 28rpx;
  border-bottom: 6rpx solid var(--primary);
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}
.student-challenge-page .hero::after { background: var(--primary); }
.student-challenge-page .eyebrow,
.student-challenge-page .hero-icon { color: var(--primary-strong); }
.student-challenge-page .hero-title { color: var(--ink); }
.student-challenge-page .hero-sub { color: var(--text-secondary); }
.student-challenge-page .source-tabs,
.student-challenge-page .tabs,
.student-challenge-page .report-card,
.student-challenge-page .state-card,
.student-challenge-page .skeleton-card {
  min-height: 0;
  border-color: var(--border);
  border-radius: 16rpx;
  background: var(--surface);
  box-shadow: 0 6rpx 18rpx rgba(38, 53, 47, .06);
}
.student-challenge-page .source-tab.active,
.student-challenge-page .tab.active {
  background: var(--primary);
  color: #FFFFFF;
}
.student-challenge-page .reason-box,
.student-challenge-page .question-box,
.student-challenge-page .resolution-box {
  min-height: 0;
  border-color: var(--border);
  border-radius: 14rpx;
  background: var(--surface-muted);
}
.student-challenge-page .review-actions { align-items: start; }
.student-challenge-page .review-actions button {
  min-height: 84rpx;
  padding: 0 18rpx;
  border-radius: 14rpx;
}
.student-challenge-page .no-issue { background: var(--primary); color: #FFFFFF; }
.student-challenge-page .stop-question { background: var(--coral-soft); color: var(--danger); }

.student-challenge-page .report-student-icon {
  width: 50rpx;
  height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 11rpx;
  background: var(--primary-soft);
}

.student-challenge-page .reason-label-row {
  display: flex;
  align-items: center;
  gap: 7rpx;
}
</style>
