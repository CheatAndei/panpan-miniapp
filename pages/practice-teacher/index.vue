<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">PRACTICE STUDIO</text>
      <text class="hero-title">打卡计划</text>
      <text class="hero-sub">固定初中计算题，每天生成约 20 分钟练习</text>
    </view>

    <view class="card todo-card">
      <view class="section-head">
        <view>
          <text class="section-title">待批改</text>
          <text class="todo-summary">{{ todoCount ? `还有 ${todoCount} 份学生打卡等待批改` : '当前没有待批改打卡' }}</text>
        </view>
        <text :class="['todo-count', todoCount ? 'pending' : 'done']">{{ todoCount }}</text>
      </view>
      <view v-for="item in todos" :key="item.submission_id" class="todo-row">
        <view class="todo-copy">
          <text class="todo-name">{{ item.student_name }} · {{ item.practice_date }}</text>
          <text class="todo-meta">{{ item.class_name }} · {{ item.plan_title }}</text>
        </view>
        <button class="review-now-btn" @tap="openTodo(item)">批改</button>
      </view>
    </view>

    <view class="card builder-card">
      <view class="section-head">
        <text class="section-title">新建连续计划</text>
        <text class="step-mark">01 / 设置</text>
      </view>
      <text class="field-label">计划名称</text>
      <input v-model="form.title" class="field" maxlength="60" placeholder="如：暑假第一周打卡" />

      <text class="field-label">学习小组</text>
      <picker :range="classes" range-key="name" :value="classIndex" @change="selectClass">
        <view class="field picker-field">{{ selectedClass?.name || '选择学习小组' }}<text>›</text></view>
      </picker>

      <view class="fixed-scope">
        <text class="fixed-scope-title">固定题库 · 初中计算</text>
        <text class="fixed-scope-copy">有理数、绝对值、整式化简与求值、一元一次方程。统一训练层级，无需选择难度。</text>
      </view>

      <view class="grid-two">
        <view>
          <text class="field-label">开始日期</text>
          <picker mode="date" :value="form.start_date" @change="form.start_date=$event.detail.value">
            <view class="field picker-field">{{ form.start_date }}<text>›</text></view>
          </picker>
        </view>
        <view>
          <text class="field-label">结束日期</text>
          <picker mode="date" :value="form.end_date" @change="form.end_date=$event.detail.value">
            <view class="field picker-field">{{ form.end_date }}<text>›</text></view>
          </picker>
        </view>
      </view>

      <view v-if="preview" class="preview-box">
        <text class="preview-title">{{ preview.students }} 名学生 · {{ preview.days }} 天</text>
        <text class="preview-copy">固定计算题库 {{ preview.available_questions }} 题；每天按当天题单生成，标准答案仅在教师复核区显示。</text>
      </view>
      <view class="action-row">
        <button class="secondary-btn" :disabled="busy" @tap="previewPlan">预览范围</button>
        <button class="primary-btn" :disabled="busy || !preview" @tap="publishPlan">{{ busy ? '处理中…' : '发布计划' }}</button>
      </view>
    </view>

    <view class="card">
      <view class="section-head">
        <text class="section-title">已发布计划</text>
        <text class="step-mark">02 / 管理</text>
      </view>
      <pp-state v-if="!plans.length" title="还没有打卡计划" description="先为一个学习小组设置连续日期。" />
      <view v-for="item in plans" :key="item.id" :class="['plan-row', selectedPlanId===item.id?'active':'']" @tap="choosePlan(item)">
        <view class="plan-main">
          <text class="plan-name">{{ item.title }}</text>
          <text class="plan-meta">{{ item.class_name }} · {{ item.start_date }} 至 {{ item.end_date }}</text>
          <text class="plan-meta">{{ item.grade_band }} / {{ item.module }} · {{ item.submission_count }} 份提交</text>
        </view>
        <view class="plan-actions">
          <button v-if="item.pending_submission_count" class="plan-review-btn" @tap.stop="choosePlan(item)">批改 {{ item.pending_submission_count }}</button>
          <picker mode="date" :value="item.start_date" :start="item.start_date" :end="item.end_date" @tap.stop @change="downloadPdf(item,$event.detail.value)">
            <view class="pdf-btn" aria-label="选择起始日并下载教师版五日练习 PDF">五日 PDF</view>
          </picker>
        </view>
      </view>
    </view>

    <view v-if="selectedPlanId" class="card review-card">
      <view class="section-head">
        <text class="section-title">提交与复核</text>
        <text class="step-mark">03 / 复核</text>
      </view>
      <pp-state v-if="!submissions.length" title="暂时没有提交" description="家长上传照片后会出现在这里。" />
      <template v-else-if="activeSubmission">
        <view class="queue-bar">
          <view>
            <text class="queue-title">本页待批 {{ pendingSubmissionCount }} 份</text>
            <text class="queue-meta">第 {{ activeSubmissionIndex + 1 }} / {{ submissions.length }} 份</text>
          </view>
          <view class="queue-actions">
            <button class="queue-btn" :disabled="activeSubmissionIndex <= 0" aria-label="上一份学生作业" @tap="goSubmission(-1)">上一份</button>
            <button class="queue-btn" :disabled="activeSubmissionIndex >= submissions.length - 1" aria-label="下一份学生作业" @tap="goSubmission(1)">下一份</button>
          </view>
        </view>
        <view class="submission review-workbench">
        <view class="submission-head">
          <view><text class="student-name">{{ activeSubmission.student_name }}</text><text class="submission-date">{{ activeSubmission.practice_date }}</text></view>
          <text :class="['review-status', activeSubmission.status === 'reviewed' ? 'reviewed' : 'pending']">
            {{ activeSubmission.status === 'reviewed' ? '已复核，可修改' : '待复核' }}
          </text>
        </view>
        <view class="quick-review-tip">
          <text class="quick-review-title">只点错题</text>
          <text class="quick-review-copy">未点选的题目会按“正确”保存；点错可再次点击取消。</text>
        </view>

        <view class="compare-workspace">
          <view class="photo-pane">
            <view class="pane-head">
              <text class="pane-title">学生照片</text>
              <text class="pane-count">已读 {{ activeSubmission._photoPaths.length }} / {{ activeSubmission.attachments.length }} 张</text>
            </view>
            <view class="photo-stage">
              <view v-if="activeSubmission._photosLoading" class="pane-state"><text>正在读取私有照片…</text></view>
              <swiper v-else-if="activeSubmission._photoPaths.length" class="photo-swiper" :current="activeSubmission._activePhoto" :indicator-dots="activeSubmission._photoPaths.length > 1" indicator-color="#B7C8C3" indicator-active-color="#2F7D6B" @change="changePhoto(activeSubmission,$event)">
                <swiper-item v-for="(photo,index) in activeSubmission._photoPaths" :key="photo">
                  <image :src="photo" mode="aspectFit" class="submission-photo" :aria-label="`${activeSubmission.student_name}第${index + 1}张作业照片`" @tap="previewPhoto(activeSubmission,index)" />
                </swiper-item>
              </swiper>
              <view v-else class="pane-state error">
                <text class="pane-state-title">照片暂未读到</text>
                <text class="pane-state-help">请点击下方“重新读取”，无需让学生重复提交。</text>
              </view>
            </view>
            <view v-if="activeSubmission._photoFailures" class="photo-warning">
              <text>{{ activeSubmission._photoError || `还有 ${activeSubmission._photoFailures} 张照片未读到` }}</text>
            </view>
            <view class="photo-actions">
              <button class="zoom-btn" :disabled="!activeSubmission._photoPaths.length" aria-label="放大当前学生作业照片" @tap="previewPhoto(activeSubmission,activeSubmission._activePhoto)">放大照片</button>
              <button v-if="activeSubmission._photoFailures" class="retry-photo-btn" :disabled="activeSubmission._photosLoading" aria-label="重新读取学生作业照片" @tap="retrySubmissionPhotos(activeSubmission)">重新读取</button>
            </view>
          </view>

          <scroll-view scroll-y class="answer-pane">
            <view class="pane-head answer-head">
              <text class="pane-title">标准答案</text>
              <text class="wrong-total">错 {{ wrongCount(activeSubmission) }} 题</text>
            </view>
            <button v-for="item in activeSubmission.items" :key="item.id" :class="['answer-row', item._correct === false ? 'wrong' : 'correct']" :aria-label="`第${item.position}题，答案${item.answer}，${item._correct === false ? '已标记错题' : '默认正确'}，点击切换`" @tap="toggleWrong(item)">
              <view class="answer-row-top">
                <text class="answer-no">{{ item.position }}</text>
                <text class="answer-state">{{ item._correct === false ? '错题' : '默认正确' }}</text>
              </view>
              <text class="answer-value">{{ item.answer }}</text>
              <text class="answer-stem">{{ item.stem }}</text>
              <text class="answer-action">{{ item._correct === false ? '点击取消标错' : '点击标错' }}</text>
            </button>
          </scroll-view>
        </view>

        <view class="review-footer">
          <view class="review-result-copy">
            <text class="review-result-main">已标错 {{ wrongCount(activeSubmission) }} 题</text>
            <text class="review-result-sub">其余 {{ activeSubmission.items.length - wrongCount(activeSubmission) }} 题按正确保存</text>
          </view>
          <button class="save-next-btn" :disabled="activeSubmission._saving || activeSubmission._photosLoading || !photosReady(activeSubmission)" @tap="saveReview(activeSubmission)">
            {{ activeSubmission._saving ? '保存中…' : activeSubmission.status === 'reviewed' ? '更新并下一位' : '保存并下一位' }}
          </button>
        </view>
      </view>
      </template>
      <view v-if="submissionPagination.pages > 1" class="pager">
        <button class="pager-btn" :disabled="submissionPage <= 1" @tap="changeSubmissionPage(-1)">上一页</button>
        <text class="pager-text">第 {{ submissionPage }} / {{ submissionPagination.pages }} 页</text>
        <button class="pager-btn" :disabled="submissionPage >= submissionPagination.pages" @tap="changeSubmissionPage(1)">下一页</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

function dateText(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

const classes = ref([]);
const plans = ref([]);
const todos = ref([]);
const todoCount = ref(0);
const submissions = ref([]);
const submissionPage = ref(1);
const submissionPagination = ref({ page: 1, limit: 20, total: 0, pages: 0 });
const activeSubmissionIndex = ref(0);
const preview = ref(null);
const busy = ref(false);
const selectedPlanId = ref(null);
const requestedPlanId = ref('');
const requestedSubmissionId = ref('');
const form = reactive({
  title: '初中计算打卡', class_id: '', grade_band: '初中', module: '综合计算', difficulty: 3,
  start_date: dateText(0), end_date: dateText(4), target_minutes: 20, auto_advance: false, question_types: [],
});

const selectedClass = computed(() => classes.value.find((item) => Number(item.id) === Number(form.class_id)));
const classIndex = computed(() => Math.max(0, classes.value.findIndex((item) => Number(item.id) === Number(form.class_id))));
const activeSubmission = computed(() => submissions.value[activeSubmissionIndex.value] || null);
const pendingSubmissionCount = computed(() => submissions.value.filter((item) => item.status !== 'reviewed').length);

onLoad((options) => {
  requestedPlanId.value = String(options?.plan_id || '');
  requestedSubmissionId.value = String(options?.submission_id || '');
});
onShow(() => loadBase());

async function loadBase() {
  try {
    const [classData, planData, todoData] = await Promise.all([
      api.get('/classes'), api.get('/practice/plans'), api.get('/practice/todos?limit=20'),
    ]);
    classes.value = classData.classes || [];
    if (!form.class_id && classes.value[0]) form.class_id = classes.value[0].id;
    plans.value = planData.plans || [];
    todos.value = todoData.todos || [];
    todoCount.value = Number(todoData.count || 0);
    if (requestedPlanId.value) {
      selectedPlanId.value = Number(requestedPlanId.value);
      const submissionId = requestedSubmissionId.value;
      requestedPlanId.value = '';
      requestedSubmissionId.value = '';
      await loadSubmissions(submissionId);
    } else if (selectedPlanId.value) await loadSelectedPlan();
  } catch (err) {
    logError('practiceTeacher.loadBase', err);
    uni.showToast({ title: err?.error || '打卡计划加载失败', icon: 'none' });
  }
}

async function loadTodos() {
  const [result, planData] = await Promise.all([
    api.get('/practice/todos?limit=20'), api.get('/practice/plans'),
  ]);
  todos.value = result.todos || [];
  todoCount.value = Number(result.count || 0);
  plans.value = planData.plans || [];
}

async function openTodo(item) {
  selectedPlanId.value = Number(item.plan_id);
  submissionPage.value = 1;
  activeSubmissionIndex.value = 0;
  await loadSubmissions(item.submission_id);
  setTimeout(() => uni.pageScrollTo({ selector: '.review-card', duration: 280 }), 30);
}

function selectClass(event) { form.class_id = classes.value[Number(event.detail.value)]?.id || ''; preview.value = null; }
async function previewPlan() {
  busy.value = true;
  preview.value = null;
  try { preview.value = await api.post('/practice/plans/preview', { ...form }); }
  catch (err) { uni.showToast({ title: err?.errors?.[0] || err?.error || '范围不可用', icon: 'none' }); }
  finally { busy.value = false; }
}

async function publishPlan() {
  if (!preview.value || busy.value) return;
  busy.value = true;
  try {
    const result = await api.post('/practice/plans', { ...form });
    uni.showToast({ title: `已发布给 ${result.students} 名学生`, icon: 'success' });
    preview.value = null;
    await loadBase();
  } catch (err) { uni.showToast({ title: err?.error || '发布失败', icon: 'none' }); }
  finally { busy.value = false; }
}

async function choosePlan(item) {
  selectedPlanId.value = item.id;
  submissionPage.value = 1;
  activeSubmissionIndex.value = 0;
  await loadSelectedPlan();
}

async function loadSelectedPlan() {
  await loadSubmissions();
}

async function loadSubmissions(preferredId = '') {
  if (!selectedPlanId.value) return;
  try {
    const preferredQuery = preferredId ? `&submission_id=${preferredId}` : '';
    const result = await api.get(`/practice/submissions?plan_id=${selectedPlanId.value}&status=all&limit=20&page=${submissionPage.value}${preferredQuery}`);
    submissionPagination.value = result.pagination || { page: submissionPage.value, limit: 20, total: 0, pages: 0 };
    if (!(result.submissions || []).length && submissionPage.value > 1 && submissionPagination.value.total > 0) {
      submissionPage.value--;
      return loadSubmissions();
    }
    submissions.value = (result.submissions || []).map((submission) => ({
      ...submission,
      _saving: false,
      _teacherNote: submission.teacher_note || '',
      _photosLoading: false,
      _photoFailures: 0,
      _photoError: '',
      _activePhoto: 0,
      _photoPaths: [],
      items: submission.items.map((item) => ({
        ...item,
        _correct: item.is_correct === null || item.is_correct === undefined ? true : Boolean(item.is_correct),
      })),
    }));
    const preferredIndex = preferredId ? submissions.value.findIndex((item) => Number(item.id) === Number(preferredId)) : -1;
    const firstPending = submissions.value.findIndex((item) => item.status !== 'reviewed');
    activeSubmissionIndex.value = preferredIndex >= 0 ? preferredIndex : firstPending >= 0 ? firstPending : 0;
    await ensureSubmissionPhotos(activeSubmission.value);
  } catch (err) { uni.showToast({ title: err?.error || '提交加载失败', icon: 'none' }); }
}

async function changeSubmissionPage(delta) {
  const target = submissionPage.value + delta;
  if (target < 1 || target > submissionPagination.value.pages) return;
  submissionPage.value = target;
  activeSubmissionIndex.value = 0;
  await loadSubmissions();
}

async function ensureSubmissionPhotos(submission) {
  if (!submission || submission._photosLoading || submission._photoPaths.length) return;
  try {
    submission._photosLoading = true;
    submission._photoError = '';
    const results = await Promise.allSettled((submission.attachments || []).map((file) => api.downloadPrivate(file.url)));
    submission._photoPaths = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const failures = results.filter((result) => result.status === 'rejected');
    submission._photoFailures = failures.length;
    submission._photoError = failures[0]?.reason?.error || '';
    if (failures.length) uni.showToast({ title: `已读取 ${submission._photoPaths.length}/${submission.attachments.length} 张，可重新读取`, icon: 'none' });
  } finally {
    submission._photosLoading = false;
  }
}

async function retrySubmissionPhotos(submission) {
  submission._photoPaths = [];
  submission._photoFailures = 0;
  submission._photoError = '';
  await ensureSubmissionPhotos(submission);
}

function photosReady(submission) {
  const total = submission?.attachments?.length || 0;
  return total > 0 && submission?._photoPaths?.length === total;
}

async function goSubmission(delta) {
  const target = activeSubmissionIndex.value + delta;
  if (target < 0 || target >= submissions.value.length) return;
  activeSubmissionIndex.value = target;
  await ensureSubmissionPhotos(activeSubmission.value);
}

function changePhoto(submission, event) {
  submission._activePhoto = Number(event.detail?.current || 0);
}

function previewPhoto(submission, index) {
  const urls = submission._photoPaths || [];
  if (urls.length) uni.previewImage({ current: urls[index] || urls[0], urls });
}

function toggleWrong(item) {
  item._correct = item._correct === false;
}

function wrongCount(submission) {
  return submission?.items?.filter((item) => item._correct === false).length || 0;
}

async function moveToNextSubmission(currentIndex) {
  let nextIndex = submissions.value.findIndex((item, index) => index > currentIndex && item.status !== 'reviewed');
  if (nextIndex < 0) nextIndex = submissions.value.findIndex((item) => item.status !== 'reviewed');
  if (nextIndex >= 0) {
    activeSubmissionIndex.value = nextIndex;
    await ensureSubmissionPhotos(activeSubmission.value);
    return;
  }
  if (submissionPage.value < submissionPagination.value.pages) {
    submissionPage.value += 1;
    activeSubmissionIndex.value = 0;
    await loadSubmissions();
    return;
  }
  uni.showToast({ title: '当前列表已全部复核', icon: 'success' });
}

async function saveReview(submission) {
  if (!photosReady(submission)) return uni.showToast({ title: '请先重新读取全部作业照片', icon: 'none' });
  const currentIndex = activeSubmissionIndex.value;
  submission._saving = true;
  try {
    await api.put(`/practice/submissions/${submission.id}/review`, {
      teacher_note: submission._teacherNote,
      results: submission.items.map((item) => ({ item_id: item.id, is_correct: item._correct })),
    });
    submission.status = 'reviewed';
    submission.items.forEach((item) => { item.is_correct = item._correct ? 1 : 0; });
    uni.showToast({ title: `已保存，错 ${wrongCount(submission)} 题`, icon: 'success' });
    await loadTodos();
    await moveToNextSubmission(currentIndex);
  } catch (err) { uni.showToast({ title: err?.error || '复核保存失败', icon: 'none' }); }
  finally { submission._saving = false; }
}

async function downloadPdf(item, startDate = item.start_date) {
  try { await api.openPdf(`/api/practice/plans/${item.id}/pdf?start_date=${startDate}`); }
  catch (err) { uni.showToast({ title: err?.error || 'PDF 下载失败', icon: 'none' }); }
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(56rpx + env(safe-area-inset-bottom));background:var(--page-bg)}
.hero{margin:0 -24rpx 24rpx;padding:52rpx 36rpx 46rpx;background:linear-gradient(145deg,#173A36,#315D56);color:#fff;border-radius:0 0 34rpx 34rpx}.eyebrow{display:block;font-size:20rpx;letter-spacing:4rpx;color:#BBD9D1;font-weight:700}.hero-title{display:block;margin-top:12rpx;font-size:42rpx;font-weight:760}.hero-sub{display:block;margin-top:10rpx;color:#D6E7E3;font-size:24rpx;line-height:1.55}
.card{margin-bottom:20rpx;padding:28rpx;background:#fff;border:1rpx solid var(--border);border-radius:22rpx;box-shadow:var(--shadow-sm)}.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:22rpx}.section-title{color:var(--ink);font-size:30rpx;font-weight:730}.step-mark{color:var(--accent);font-size:20rpx;letter-spacing:1rpx}.field-label{display:block;margin:20rpx 0 9rpx;color:var(--ink);font-size:24rpx;font-weight:650}.field{box-sizing:border-box;width:100%;min-height:88rpx;padding:0 22rpx;border:1rpx solid var(--border);border-radius:14rpx;background:var(--surface-muted);color:var(--ink);font-size:27rpx}.picker-field{display:flex;align-items:center;justify-content:space-between}.grid-two{display:grid;grid-template-columns:1fr 1fr;gap:16rpx}.switch-row{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin-top:24rpx;padding:20rpx;border-radius:14rpx;background:var(--surface-muted)}.switch-title{display:block;color:var(--ink);font-size:25rpx;font-weight:650}.switch-help{display:block;margin-top:5rpx;color:var(--text-muted);font-size:20rpx;line-height:1.45}.preview-box{margin-top:22rpx;padding:20rpx;border-left:6rpx solid var(--accent);border-radius:12rpx;background:var(--accent-soft)}.preview-title{display:block;color:var(--accent-strong);font-size:26rpx;font-weight:720}.preview-copy{display:block;margin-top:7rpx;color:var(--ink);font-size:22rpx;line-height:1.55}.action-row{display:grid;grid-template-columns:1fr 1.4fr;gap:14rpx;margin-top:24rpx}.primary-btn,.secondary-btn,.save-btn{min-height:88rpx;display:flex;align-items:center;justify-content:center;margin:0;border-radius:15rpx;font-size:27rpx;font-weight:700}.primary-btn,.save-btn{background:var(--primary);color:#fff}.secondary-btn{background:#fff;color:var(--primary);border:1rpx solid var(--primary)}button::after{border:0}button[disabled]{opacity:.42}
.todo-card{border-color:#E8C879;background:linear-gradient(135deg,#FFFBF0,#FFFFFF)}.todo-summary{display:block;margin-top:7rpx;color:var(--text-muted);font-size:22rpx}.todo-count{min-width:64rpx;height:64rpx;display:flex;align-items:center;justify-content:center;border-radius:20rpx;font-size:27rpx;font-weight:800}.todo-count.pending{background:#F5B83D;color:#493000}.todo-count.done{background:var(--accent-soft);color:var(--accent-strong)}.todo-row{display:flex;align-items:center;gap:16rpx;padding:18rpx 0;border-top:1rpx solid #F0E3C4}.todo-copy{flex:1;min-width:0}.todo-name{display:block;color:var(--ink);font-size:27rpx;font-weight:720}.todo-meta{display:block;margin-top:4rpx;overflow:hidden;color:var(--text-muted);font-size:21rpx;text-overflow:ellipsis;white-space:nowrap}.review-now-btn,.plan-review-btn{flex:none;min-height:72rpx;display:flex;align-items:center;justify-content:center;margin:0;padding:0 24rpx;border-radius:14rpx;background:#F5B83D;color:#493000;font-size:24rpx;font-weight:800}.plan-actions{display:flex;flex-direction:column;align-items:stretch;gap:10rpx}.plan-review-btn{min-height:64rpx;padding:0 16rpx;font-size:21rpx}
.fixed-scope{margin-top:22rpx;padding:22rpx;border-radius:16rpx;background:var(--accent-soft);border:1rpx solid #CFE5DE}.fixed-scope-title{display:block;color:var(--accent-strong);font-size:27rpx;font-weight:720}.fixed-scope-copy{display:block;margin-top:8rpx;color:var(--ink);font-size:23rpx;line-height:1.6}
.type-chips{display:flex;gap:12rpx;flex-wrap:wrap}.type-chip{min-height:88rpx;margin:0;padding:0 22rpx;border:1rpx solid var(--border);border-radius:999rpx;background:#fff;color:var(--text-muted);font-size:23rpx}.type-chip.active{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-strong);font-weight:680}
.plan-row{display:flex;align-items:center;gap:16rpx;padding:22rpx 0;border-bottom:1rpx solid var(--hairline)}.plan-row:last-child{border-bottom:0}.plan-row.active{margin:0 -12rpx;padding:22rpx 12rpx;border-radius:14rpx;background:var(--accent-soft)}.plan-main{flex:1;min-width:0}.plan-name{display:block;color:var(--ink);font-size:27rpx;font-weight:700}.plan-meta{display:block;margin-top:5rpx;color:var(--text-muted);font-size:21rpx;line-height:1.4}.pdf-btn,.photo-btn{flex:none;min-height:88rpx;display:flex;align-items:center;justify-content:center;margin:0;padding:0 18rpx;border-radius:12rpx;background:#EDF4F2;color:var(--accent-strong);font-size:23rpx;font-weight:650}
.queue-bar{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin-bottom:18rpx;padding:18rpx 20rpx;border-radius:16rpx;background:var(--surface-muted)}.queue-title{display:block;color:var(--ink);font-size:25rpx;font-weight:700}.queue-meta{display:block;margin-top:4rpx;color:var(--text-muted);font-size:21rpx}.queue-actions{display:flex;gap:12rpx}.queue-btn{min-width:118rpx;min-height:88rpx;display:flex;align-items:center;justify-content:center;margin:0;padding:0 16rpx;border-radius:12rpx;background:#fff;color:var(--accent-strong);font-size:22rpx;font-weight:650}.queue-btn[disabled]{opacity:.38}
.submission{padding:22rpx;border:1rpx solid var(--border);border-radius:18rpx}.submission-head{display:flex;align-items:center;justify-content:space-between;gap:14rpx}.student-name{display:block;color:var(--ink);font-size:30rpx;font-weight:750}.submission-date{display:block;margin-top:4rpx;color:var(--text-muted);font-size:22rpx}.review-status{flex:none;padding:10rpx 16rpx;border-radius:999rpx;font-size:21rpx;font-weight:700}.review-status.pending{background:var(--warning-soft);color:var(--warning)}.review-status.reviewed{background:var(--accent-soft);color:var(--accent-strong)}
.quick-review-tip{display:flex;align-items:center;gap:12rpx;margin-top:18rpx;padding:16rpx 18rpx;border-radius:14rpx;background:var(--accent-soft)}.quick-review-title{flex:none;color:var(--accent-strong);font-size:25rpx;font-weight:750}.quick-review-copy{color:var(--ink);font-size:21rpx;line-height:1.45}
.compare-workspace{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:16rpx;margin-top:18rpx}.photo-pane,.answer-pane{box-sizing:border-box;min-width:0;border:1rpx solid var(--border);border-radius:16rpx;background:var(--surface-muted)}.photo-pane{padding:16rpx}.answer-pane{height:850rpx;padding:16rpx}.pane-head{display:flex;align-items:center;justify-content:space-between;gap:8rpx;min-height:52rpx}.pane-title{color:var(--ink);font-size:25rpx;font-weight:720}.pane-count{color:var(--text-muted);font-size:20rpx}.photo-stage{height:690rpx;margin-top:12rpx;overflow:hidden;border-radius:12rpx;background:#E9EFED}.photo-swiper,.submission-photo{width:100%;height:100%}.pane-state{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24rpx;box-sizing:border-box;color:var(--text-muted);font-size:22rpx;text-align:center}.pane-state.error{color:var(--danger)}.pane-state-title{font-size:25rpx;font-weight:720}.pane-state-help{display:block;margin-top:8rpx;color:var(--text-muted);font-size:20rpx;line-height:1.55}.photo-warning{margin-top:10rpx;padding:12rpx 14rpx;border-radius:10rpx;background:var(--warning-soft);color:var(--warning);font-size:20rpx;line-height:1.45}.photo-actions{display:grid;grid-template-columns:1fr 1fr;gap:10rpx;margin-top:12rpx}.zoom-btn,.retry-photo-btn{width:100%;min-height:88rpx;margin:0;border-radius:12rpx;font-size:23rpx;font-weight:680}.zoom-btn{background:#fff;color:var(--accent-strong)}.retry-photo-btn{background:var(--accent-strong);color:#fff}.photo-actions .zoom-btn:only-child{grid-column:1/-1}.answer-head{position:sticky;top:0;z-index:2;padding-bottom:12rpx;background:var(--surface-muted)}.wrong-total{color:var(--danger);font-size:21rpx;font-weight:700}
.answer-row{box-sizing:border-box;width:100%;min-height:132rpx;margin:0 0 12rpx;padding:14rpx;border:2rpx solid var(--border);border-radius:14rpx;background:#fff;text-align:left;transition:background-color .18s ease,border-color .18s ease}.answer-row::after{border:0}.answer-row.wrong{border-color:var(--danger);background:var(--danger-soft)}.answer-row-top{display:flex;align-items:center;justify-content:space-between;gap:8rpx}.answer-no{width:44rpx;height:44rpx;display:flex;align-items:center;justify-content:center;border-radius:10rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:23rpx;font-weight:750}.answer-row.wrong .answer-no{background:var(--danger);color:#fff}.answer-state{color:var(--accent-strong);font-size:20rpx;font-weight:700}.answer-row.wrong .answer-state{color:var(--danger)}.answer-value{display:block;margin-top:10rpx;color:var(--ink);font-size:29rpx;font-weight:780;line-height:1.35;word-break:break-all}.answer-stem{display:-webkit-box;margin-top:7rpx;overflow:hidden;color:var(--text-muted);font-size:20rpx;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2}.answer-action{display:block;margin-top:8rpx;color:var(--text-muted);font-size:19rpx}.answer-row.wrong .answer-action{color:var(--danger)}
.review-footer{position:sticky;bottom:calc(16rpx + env(safe-area-inset-bottom));z-index:5;display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:18rpx;padding:16rpx;border:1rpx solid var(--border);border-radius:16rpx;background:rgba(255,255,255,.96);box-shadow:0 10rpx 30rpx rgba(24,58,54,.12)}.review-result-copy{min-width:0}.review-result-main{display:block;color:var(--ink);font-size:25rpx;font-weight:750}.review-result-sub{display:block;margin-top:4rpx;color:var(--text-muted);font-size:20rpx}.save-next-btn{flex:none;min-width:230rpx;min-height:88rpx;display:flex;align-items:center;justify-content:center;margin:0;padding:0 22rpx;border-radius:14rpx;background:var(--primary);color:#fff;font-size:25rpx;font-weight:750}.save-next-btn[disabled]{opacity:.42}
.section-desc{display:block;margin-top:5rpx;color:var(--text-muted);font-size:21rpx}.setting-row{padding:22rpx 0;border-bottom:1rpx solid var(--hairline)}.setting-row:last-child{border-bottom:0}.setting-name{display:block;color:var(--ink);font-size:28rpx;font-weight:720}.setting-grid{display:grid;grid-template-columns:1fr 1fr;gap:14rpx;margin-top:16rpx}.mini-label{display:block;margin-bottom:7rpx;color:var(--text-muted);font-size:21rpx}.mini-field{min-height:88rpx;display:flex;align-items:center;padding:0 16rpx;border-radius:12rpx;background:var(--surface-muted);color:var(--ink);font-size:23rpx}.setting-switches{display:flex;gap:22rpx;margin-top:16rpx;flex-wrap:wrap}.setting-switches label{min-height:88rpx;display:flex;align-items:center;gap:10rpx;color:var(--ink);font-size:22rpx}.setting-save{min-height:88rpx;width:100%;margin:14rpx 0 0;border-radius:12rpx;background:var(--accent);color:#fff;font-size:24rpx;font-weight:680}
.pager{display:flex;align-items:center;justify-content:space-between;gap:12rpx;margin-top:22rpx}.pager-btn{min-height:88rpx;min-width:150rpx;margin:0;border-radius:12rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:24rpx}.pager-text{color:var(--text-muted);font-size:22rpx}
@media (max-width: 380px){.compare-workspace{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:10rpx}.photo-pane,.answer-pane{padding:10rpx}.answer-pane{height:790rpx}.photo-stage{height:630rpx}.answer-value{font-size:27rpx}.answer-stem{font-size:19rpx}.review-footer{align-items:stretch;flex-direction:column}.save-next-btn{width:100%}}
</style>
