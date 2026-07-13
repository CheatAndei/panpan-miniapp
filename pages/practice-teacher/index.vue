<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">PRACTICE STUDIO</text>
      <text class="hero-title">打卡计划</text>
      <text class="hero-sub">设置范围，生成每天约 20 分钟的个性化练习</text>
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

      <view class="grid-two">
        <view>
          <text class="field-label">学段</text>
          <picker :range="gradeBands" :value="gradeIndex" @change="selectGrade">
            <view class="field picker-field">{{ form.grade_band }}<text>›</text></view>
          </picker>
        </view>
        <view>
          <text class="field-label">模块</text>
          <picker :range="moduleOptions" :value="moduleIndex" @change="selectModule">
            <view class="field picker-field">{{ form.module }}<text>›</text></view>
          </picker>
        </view>
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

      <text class="field-label">题型范围</text>
      <view class="type-chips">
        <button :class="['type-chip', form.question_types.length===0?'active':'']" @tap="selectAllTypes">全部题型</button>
        <button v-for="type in typeOptions" :key="type" :class="['type-chip', form.question_types.includes(type)?'active':'']" @tap="toggleType(type)">{{ type }}</button>
      </view>

      <text class="field-label">难度 {{ form.difficulty }}</text>
      <slider :value="form.difficulty" min="1" max="5" step="1" activeColor="#2F7D6B" block-size="20" @change="form.difficulty=Number($event.detail.value)" />
      <label class="switch-row">
        <view><text class="switch-title">自动推进模块</text><text class="switch-help">仅在至少 2 天、20 道复核题且正确率达标后推进</text></view>
        <switch :checked="form.auto_advance" color="#2F7D6B" @change="form.auto_advance=$event.detail.value" />
      </label>

      <view v-if="preview" class="preview-box">
        <text class="preview-title">{{ preview.students }} 名学生 · {{ preview.days }} 天</text>
        <text class="preview-copy">题库 {{ preview.available_questions }} 题，其中广州原创情境题 {{ preview.guangzhou_questions || 0 }} 题；生成时本地题优先穿插，并按 60% 当前模块、25% 易错、15% 间隔复习。</text>
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
        <picker mode="date" :value="item.start_date" :start="item.start_date" :end="item.end_date" @tap.stop @change="downloadPdf(item,$event.detail.value)">
          <view class="pdf-btn" aria-label="选择起始日并下载教师版五日练习 PDF">五日 PDF</view>
        </picker>
      </view>
    </view>

    <view v-if="selectedPlanId" class="card settings-card">
      <view class="section-head">
        <view><text class="section-title">学生个性化范围</text><text class="section-desc">修改后从尚未生成的下一次练习生效</text></view>
        <text class="step-mark">03 / 调整</text>
      </view>
      <view v-for="setting in studentSettings" :key="setting.student_id" class="setting-row">
        <text class="setting-name">{{ setting.student_name }}</text>
        <view class="setting-grid">
          <view>
            <text class="mini-label">当前模块</text>
            <picker :range="settingModules" :value="Math.max(0,settingModules.indexOf(setting.current_module))" @change="changeSettingModule(setting,$event)">
              <view class="mini-field">{{ setting.current_module }} ›</view>
            </picker>
          </view>
          <view>
            <text class="mini-label">难度</text>
            <picker :range="difficultyOptions" :value="Math.max(0,difficultyOptions.indexOf(Number(setting.difficulty)))" @change="changeSettingDifficulty(setting,$event)">
              <view class="mini-field">难度 {{ setting.difficulty }} ›</view>
            </picker>
          </view>
        </view>
        <view class="setting-switches">
          <label><text>自动推进</text><switch :checked="Boolean(setting.auto_advance)" color="#2F7D6B" @change="setting.auto_advance=$event.detail.value?1:0;setting._dirty=true" /></label>
          <label><text>锁定模块</text><switch :checked="Boolean(setting.is_locked)" color="#2F7D6B" @change="setting.is_locked=$event.detail.value?1:0;setting._dirty=true" /></label>
        </view>
        <button class="setting-save" :disabled="!setting._dirty || setting._saving" @tap="saveSetting(setting)">{{ setting._saving ? '保存中…' : setting._dirty ? '保存调整' : '已保存' }}</button>
      </view>
    </view>

    <view v-if="selectedPlanId" class="card review-card">
      <view class="section-head">
        <text class="section-title">提交与复核</text>
        <text class="step-mark">04 / 复核</text>
      </view>
      <pp-state v-if="!submissions.length" title="暂时没有提交" description="家长上传照片后会出现在这里。" />
      <view v-for="submission in submissions" :key="submission.id" class="submission">
        <view class="submission-head">
          <view><text class="student-name">{{ submission.student_name }}</text><text class="submission-date">{{ submission.practice_date }}</text></view>
          <button class="photo-btn" :disabled="!submission.attachments.length" @tap="previewPhotos(submission)">查看照片 {{ submission.attachments.length }}</button>
        </view>
        <view v-for="item in submission.items" :key="item.id" class="review-item">
          <view class="review-copy">
            <text class="question-text">{{ item.position }}. {{ item.stem }}</text>
            <text class="answer-text">答案：{{ item.answer }}</text>
          </view>
          <view class="judge-row">
            <button :class="['judge-btn', item._correct===true?'selected correct':'']" @tap="item._correct=true">正确</button>
            <button :class="['judge-btn', item._correct===false?'selected wrong':'']" @tap="item._correct=false">需巩固</button>
          </view>
        </view>
        <textarea v-model="submission._teacherNote" class="note-field" maxlength="500" placeholder="给家长的复核说明（可选）" />
        <button class="save-btn" :disabled="submission._saving" @tap="saveReview(submission)">{{ submission._saving ? '保存中…' : '保存复核' }}</button>
      </view>
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
import { onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

function dateText(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

const gradeBands = ['小学', '初中'];
const moduleMap = ref({ 小学: ['四则运算', '乘除法', '应用题'], 初中: ['有理数', '一元一次方程', '整式运算'] });
const catalogScopes = ref([]);
const classes = ref([]);
const plans = ref([]);
const submissions = ref([]);
const submissionPage = ref(1);
const submissionPagination = ref({ page: 1, limit: 20, total: 0, pages: 0 });
const studentSettings = ref([]);
const settingModules = ref([]);
const difficultyOptions = [1, 2, 3, 4, 5];
const preview = ref(null);
const busy = ref(false);
const selectedPlanId = ref(null);
const form = reactive({
  title: '五日个性化打卡', class_id: '', grade_band: '小学', module: '四则运算', difficulty: 2,
  start_date: dateText(0), end_date: dateText(4), target_minutes: 20, auto_advance: true, question_types: [],
});

const selectedClass = computed(() => classes.value.find((item) => Number(item.id) === Number(form.class_id)));
const classIndex = computed(() => Math.max(0, classes.value.findIndex((item) => Number(item.id) === Number(form.class_id))));
const gradeIndex = computed(() => Math.max(0, gradeBands.indexOf(form.grade_band)));
const moduleOptions = computed(() => moduleMap.value[form.grade_band] || []);
const moduleIndex = computed(() => Math.max(0, moduleOptions.value.indexOf(form.module)));
const typeOptions = computed(() => [...new Set(catalogScopes.value
  .filter((item) => item.grade_band === form.grade_band && item.module === form.module)
  .map((item) => item.question_type))]);

onShow(() => loadBase());

async function loadBase() {
  try {
    const [classData, catalog, planData] = await Promise.all([
      api.get('/classes'), api.get('/practice/catalog'), api.get('/practice/plans'),
    ]);
    classes.value = classData.classes || [];
    if (!form.class_id && classes.value[0]) form.class_id = classes.value[0].id;
    moduleMap.value = catalog.modules || moduleMap.value;
    catalogScopes.value = catalog.scopes || [];
    plans.value = planData.plans || [];
    if (selectedPlanId.value) await loadSelectedPlan();
  } catch (err) {
    logError('practiceTeacher.loadBase', err);
    uni.showToast({ title: err?.error || '打卡计划加载失败', icon: 'none' });
  }
}

function selectClass(event) { form.class_id = classes.value[Number(event.detail.value)]?.id || ''; preview.value = null; }
function selectGrade(event) {
  form.grade_band = gradeBands[Number(event.detail.value)];
  form.module = (moduleMap.value[form.grade_band] || [])[0] || '';
  form.question_types = [];
  preview.value = null;
}
function selectModule(event) { form.module = moduleOptions.value[Number(event.detail.value)] || ''; form.question_types = []; preview.value = null; }
function selectAllTypes() { form.question_types = []; preview.value = null; }
function toggleType(type) {
  const selected = new Set(form.question_types);
  if (selected.has(type)) selected.delete(type); else selected.add(type);
  form.question_types = [...selected];
  preview.value = null;
}

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
  await loadSelectedPlan();
}

async function loadSelectedPlan() {
  await Promise.all([loadSubmissions(), loadSettings()]);
}

async function loadSettings() {
  if (!selectedPlanId.value) return;
  try {
    const result = await api.get(`/practice/plans/${selectedPlanId.value}/settings`);
    settingModules.value = result.modules || [];
    studentSettings.value = (result.settings || []).map((item) => ({ ...item, _dirty: false, _saving: false }));
  } catch (err) { uni.showToast({ title: err?.error || '学生范围加载失败', icon: 'none' }); }
}

function changeSettingModule(setting, event) {
  setting.current_module = settingModules.value[Number(event.detail.value)] || setting.current_module;
  setting._dirty = true;
}

function changeSettingDifficulty(setting, event) {
  setting.difficulty = difficultyOptions[Number(event.detail.value)] || setting.difficulty;
  setting._dirty = true;
}

async function saveSetting(setting) {
  if (!setting._dirty || setting._saving) return;
  setting._saving = true;
  try {
    await api.put(`/practice/plans/${selectedPlanId.value}/students/${setting.student_id}`, {
      module: setting.current_module,
      difficulty: Number(setting.difficulty),
      auto_advance: Boolean(setting.auto_advance),
      is_locked: Boolean(setting.is_locked),
    });
    setting._dirty = false;
    uni.showToast({ title: `${setting.student_name}已更新`, icon: 'success' });
  } catch (err) { uni.showToast({ title: err?.error || '调整保存失败', icon: 'none' }); }
  finally { setting._saving = false; }
}

async function loadSubmissions() {
  if (!selectedPlanId.value) return;
  try {
    const result = await api.get(`/practice/submissions?plan_id=${selectedPlanId.value}&status=all&limit=20&page=${submissionPage.value}`);
    submissionPagination.value = result.pagination || { page: submissionPage.value, limit: 20, total: 0, pages: 0 };
    if (!(result.submissions || []).length && submissionPage.value > 1 && submissionPagination.value.total > 0) {
      submissionPage.value--;
      return loadSubmissions();
    }
    submissions.value = (result.submissions || []).map((submission) => ({
      ...submission,
      _saving: false,
      _teacherNote: submission.teacher_note || '',
      items: submission.items.map((item) => ({ ...item, _correct: item.is_correct === null || item.is_correct === undefined ? null : Boolean(item.is_correct) })),
    }));
  } catch (err) { uni.showToast({ title: err?.error || '提交加载失败', icon: 'none' }); }
}

async function changeSubmissionPage(delta) {
  const target = submissionPage.value + delta;
  if (target < 1 || target > submissionPagination.value.pages) return;
  submissionPage.value = target;
  await loadSubmissions();
}

async function previewPhotos(submission) {
  try {
    uni.showLoading({ title: '读取私有照片' });
    const paths = [];
    for (const file of submission.attachments) paths.push(await api.downloadPrivate(file.url));
    uni.hideLoading();
    if (paths.length) uni.previewImage({ current: paths[0], urls: paths });
  } catch (err) {
    uni.hideLoading();
    uni.showToast({ title: err?.error || '照片读取失败', icon: 'none' });
  }
}

async function saveReview(submission) {
  if (submission.items.some((item) => item._correct === null)) {
    return uni.showToast({ title: '请判断全部题目', icon: 'none' });
  }
  submission._saving = true;
  try {
    const result = await api.put(`/practice/submissions/${submission.id}/review`, {
      teacher_note: submission._teacherNote,
      results: submission.items.map((item) => ({ item_id: item.id, is_correct: item._correct })),
    });
    uni.showToast({ title: result.progression?.advanced ? `已推进到${result.progression.to}` : '复核已保存', icon: 'success' });
    await loadSubmissions();
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
.type-chips{display:flex;gap:12rpx;flex-wrap:wrap}.type-chip{min-height:88rpx;margin:0;padding:0 22rpx;border:1rpx solid var(--border);border-radius:999rpx;background:#fff;color:var(--text-muted);font-size:23rpx}.type-chip.active{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-strong);font-weight:680}
.plan-row{display:flex;align-items:center;gap:16rpx;padding:22rpx 0;border-bottom:1rpx solid var(--hairline)}.plan-row:last-child{border-bottom:0}.plan-row.active{margin:0 -12rpx;padding:22rpx 12rpx;border-radius:14rpx;background:var(--accent-soft)}.plan-main{flex:1;min-width:0}.plan-name{display:block;color:var(--ink);font-size:27rpx;font-weight:700}.plan-meta{display:block;margin-top:5rpx;color:var(--text-muted);font-size:21rpx;line-height:1.4}.pdf-btn,.photo-btn{flex:none;min-height:88rpx;display:flex;align-items:center;justify-content:center;margin:0;padding:0 18rpx;border-radius:12rpx;background:#EDF4F2;color:var(--accent-strong);font-size:23rpx;font-weight:650}
.submission{margin-top:20rpx;padding:22rpx;border:1rpx solid var(--border);border-radius:18rpx}.submission-head{display:flex;align-items:center;justify-content:space-between;gap:14rpx}.student-name{display:block;color:var(--ink);font-size:29rpx;font-weight:720}.submission-date{display:block;margin-top:4rpx;color:var(--text-muted);font-size:21rpx}.review-item{padding:20rpx 0;border-bottom:1rpx solid var(--hairline)}.question-text{display:block;color:var(--ink);font-size:26rpx;line-height:1.55}.answer-text{display:block;margin-top:5rpx;color:var(--accent-strong);font-size:22rpx}.judge-row{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:14rpx}.judge-btn{min-height:88rpx;margin:0;border-radius:12rpx;background:var(--surface-muted);color:var(--text-muted);font-size:24rpx}.judge-btn.selected.correct{background:#E4F3EE;color:#226B57}.judge-btn.selected.wrong{background:#FCEEEB;color:#A94F48}.note-field{box-sizing:border-box;width:100%;height:150rpx;margin-top:20rpx;padding:18rpx;border:1rpx solid var(--border);border-radius:14rpx;background:var(--surface-muted);color:var(--ink);font-size:25rpx}.save-btn{width:100%;margin-top:16rpx}
.section-desc{display:block;margin-top:5rpx;color:var(--text-muted);font-size:21rpx}.setting-row{padding:22rpx 0;border-bottom:1rpx solid var(--hairline)}.setting-row:last-child{border-bottom:0}.setting-name{display:block;color:var(--ink);font-size:28rpx;font-weight:720}.setting-grid{display:grid;grid-template-columns:1fr 1fr;gap:14rpx;margin-top:16rpx}.mini-label{display:block;margin-bottom:7rpx;color:var(--text-muted);font-size:21rpx}.mini-field{min-height:88rpx;display:flex;align-items:center;padding:0 16rpx;border-radius:12rpx;background:var(--surface-muted);color:var(--ink);font-size:23rpx}.setting-switches{display:flex;gap:22rpx;margin-top:16rpx;flex-wrap:wrap}.setting-switches label{min-height:88rpx;display:flex;align-items:center;gap:10rpx;color:var(--ink);font-size:22rpx}.setting-save{min-height:88rpx;width:100%;margin:14rpx 0 0;border-radius:12rpx;background:var(--accent);color:#fff;font-size:24rpx;font-weight:680}
.pager{display:flex;align-items:center;justify-content:space-between;gap:12rpx;margin-top:22rpx}.pager-btn{min-height:88rpx;min-width:150rpx;margin:0;border-radius:12rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:24rpx}.pager-text{color:var(--text-muted);font-size:22rpx}
</style>
