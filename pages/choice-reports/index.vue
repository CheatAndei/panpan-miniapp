<template>
  <view class="page page-bottom-safe">
    <view class="hero">
      <text class="eyebrow">QUESTION REPORTS</text>
      <text class="hero-title">题目报错处理</text>
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
        <text class="reason-label">反馈原因</text>
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
      confirmColor: stopQuestion ? '#A94F48' : '#2F7D6B',
      success: (result) => resolve(result.confirm ? String(result.content || '').trim() : null),
      fail: () => resolve(null),
    });
  });
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(54rpx + env(safe-area-inset-bottom));background:#F3F7F5}.hero{margin:0 -24rpx;padding:46rpx 34rpx 42rpx;background:linear-gradient(145deg,#173A36,#315D56);color:#fff}.eyebrow{display:block;color:#B5DDD3;font-size:19rpx;font-weight:760;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:42rpx;font-weight:820}.hero-sub{display:block;margin-top:8rpx;color:#D4E9E3;font-size:22rpx;line-height:1.55}.source-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:9rpx;margin-top:20rpx}.source-tab{min-height:68rpx;margin:0;padding:8rpx;border:1rpx solid #D8E5E1;border-radius:13rpx;background:#fff;color:#697B76;font-size:21rpx;font-weight:680}.source-tab.active{border-color:#2F7D6B;background:#EAF4F1;color:#205F51}.source-tab::after{border:0}.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8rpx;margin-top:12rpx;padding:7rpx;border:1rpx solid #D8E5E1;border-radius:17rpx;background:#fff}.tab{min-height:68rpx;margin:0;border-radius:12rpx;background:transparent;color:#697B76;font-size:22rpx;font-weight:680}.tab::after,.review-actions button::after{border:0}.tab.active{background:#183A36;color:#fff}.report-skeleton,.state-card{margin-top:18rpx}.skeleton-card{margin-bottom:16rpx;padding:24rpx;border:1rpx solid #DDE8E4;border-radius:22rpx;background:#fff}.skeleton-line,.skeleton-box{background:linear-gradient(100deg,#EAF1EF 20%,#F9FBFA 40%,#EAF1EF 60%);background-size:200% 100%;animation:shimmer 1.2s linear infinite}.skeleton-line{width:78%;height:26rpx;border-radius:8rpx}.skeleton-line.short{width:34%;margin-bottom:15rpx}.skeleton-box{height:150rpx;margin-top:22rpx;border-radius:14rpx}@keyframes shimmer{to{background-position:-200% 0}}.state-card{border:1rpx solid #DDE8E4;border-radius:22rpx;background:#fff}.report-card{margin-top:18rpx;padding:25rpx;border:1rpx solid #D9E6E2;border-radius:22rpx;background:#fff;box-shadow:0 8rpx 26rpx rgba(24,58,54,.055)}.report-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.student-copy{min-width:0}.student-name,.report-meta{display:block}.student-name{color:#183A36;font-size:27rpx;font-weight:760}.report-meta{margin-top:3rpx;color:#758680;font-size:20rpx}.status-stack{display:flex;align-items:flex-end;flex-direction:column;gap:6rpx}.priority-tag{padding:6rpx 10rpx;border-radius:8rpx;background:#FCE9E5;color:#A7463F;font-size:18rpx;font-weight:760}.status-tag{flex:none;padding:7rpx 12rpx;border-radius:9rpx;background:#FFF1D8;color:#865B08;font-size:19rpx;font-weight:720}.status-tag.resolved{background:#E6F2EE;color:#29695A}.reason-box{margin-top:18rpx;padding:18rpx;border-radius:14rpx;background:#FFF7F0}.reason-label,.reason-title,.reason-note{display:block}.reason-label{color:#A35C3C;font-size:18rpx;font-weight:730}.reason-title{margin-top:3rpx;color:#613A28;font-size:24rpx;font-weight:720}.reason-note{margin-top:6rpx;color:#805F4F;font-size:21rpx;line-height:1.55}.question-box{margin-top:16rpx;padding:18rpx;border:1rpx solid #E0E9E6;border-radius:15rpx;background:#FAFCFB}.question-top{display:flex;justify-content:space-between;gap:14rpx}.question-id{color:#285F54;font-size:20rpx;font-weight:730}.question-source{overflow:hidden;color:#7B8B87;font-size:19rpx;text-overflow:ellipsis;white-space:nowrap}.question-image{width:100%;margin-top:14rpx;border-radius:11rpx;background:#fff}.question-stem{display:block;margin-top:13rpx;color:#263D38;font-size:23rpx;line-height:1.6}.answer-row{display:flex;justify-content:space-between;gap:14rpx;margin-top:14rpx;padding-top:13rpx;border-top:1rpx solid #E1EAE7;color:#536C66;font-size:20rpx}.review-actions{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:18rpx}.review-actions button{min-height:80rpx;margin:0;border-radius:14rpx;font-size:23rpx;font-weight:720}.no-issue{border:1rpx solid #BDD1CB;background:#fff;color:#49645D}.stop-question{background:#A94F48;color:#fff}.resolution-box{margin-top:18rpx;padding:16rpx 18rpx;border-radius:13rpx;background:#EAF4F1}.resolution-label,.resolution-copy{display:block}.resolution-label{color:#2F7D6B;font-size:19rpx;font-weight:730}.resolution-copy{margin-top:3rpx;color:#48645D;font-size:21rpx;line-height:1.5}@media(prefers-reduced-motion:reduce){.skeleton-line,.skeleton-box{animation:none}}
.question-stem,.answer-math{display:flex;align-items:center;flex-wrap:wrap}.answer-inline{width:auto;flex:none}
</style>
