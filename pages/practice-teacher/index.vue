<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="eyebrow">PRACTICE STUDIO</text>
        <text class="hero-title">打卡计划</text>
        <text class="hero-sub">建计划、查历史、导出学生专属练习</text>
      </view>
      <button class="review-entry" @tap="openReview">
        <pp-icon name="bell" :size="30" :motion="todoCount > 0 ? 'ring' : 'none'" />
        <view class="review-entry-copy">
          <text class="review-number">{{ todoCount }}</text>
          <text>进入批改台</text>
        </view>
      </button>
    </view>

    <view class="card builder-card">
      <view class="section-head">
        <view><text class="section-title">新建连续计划</text><text class="section-desc">固定初中计算题 · 每天约 20 分钟</text></view>
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
        <text class="fixed-scope-copy">按学生当前进度勾选模块；尚未学习的内容可以暂时取消。</text>
        <view class="topic-grid">
          <button v-for="topic in topics" :key="topic.key" :class="['topic-option',{selected:form.topic_keys.includes(topic.key)}]" @tap="toggleTopic(topic.key)">
            <text class="topic-check">{{ form.topic_keys.includes(topic.key) ? '✓' : '' }}</text>
            <view class="topic-copy"><text class="topic-name">{{ topic.label }}</text><text class="topic-count">题库 {{ topic.question_count }} 题</text></view>
          </button>
        </view>
        <text class="topic-help">已选 {{ form.topic_keys.length }} / {{ topics.length }} 类</text>
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
        <view class="preview-title-line">
          <pp-icon name="check" :size="28" motion="pop" />
          <text class="preview-title">{{ preview.students }} 名学生 · {{ preview.days }} 天</text>
        </view>
        <text class="preview-copy">{{ (preview.topic_labels||[]).join('、') }} · 可用 {{ preview.available_questions }} 题</text>
      </view>
      <view class="action-row">
        <button class="secondary-btn" :disabled="busy" @tap="previewPlan">预览范围</button>
        <button class="primary-btn" :disabled="busy || !preview" @tap="publishPlan">{{ busy ? '处理中…' : '发布计划' }}</button>
      </view>
    </view>

    <view class="card plan-card">
      <view class="section-head">
        <view><text class="section-title">计划与历史</text><text class="section-desc">最近 5 个默认展开，旧计划可搜索</text></view>
        <text class="step-mark">02 / 管理</text>
      </view>

      <view class="search-row">
        <input v-model="filters.keyword" class="search-input" placeholder="搜索计划、班级或学生姓名" confirm-type="search" @confirm="searchPlans" />
        <button class="search-btn" @tap="searchPlans">搜索</button>
      </view>
      <view class="filter-grid">
        <picker :range="classFilterOptions" range-key="name" :value="classFilterIndex" @change="changeClassFilter">
          <view class="filter-field">{{ classFilterOptions[classFilterIndex]?.name || '全部小组' }}<text>⌄</text></view>
        </picker>
        <picker :range="statusOptions" range-key="label" :value="statusFilterIndex" @change="changeStatusFilter">
          <view class="filter-field">{{ statusOptions[statusFilterIndex].label }}<text>⌄</text></view>
        </picker>
        <picker :range="monthOptions" range-key="label" :value="monthFilterIndex" @change="changeMonthFilter">
          <view class="filter-field">{{ monthOptions[monthFilterIndex]?.label || '全部月份' }}<text>⌄</text></view>
        </picker>
      </view>

      <pp-state v-if="loadingPlans" type="loading" title="正在整理计划" />
      <pp-state v-else-if="!visiblePlans.length" title="没有符合条件的计划" description="换一个关键词或筛选条件试试。" />
      <view v-for="item in visiblePlans" :key="item.id" :class="['plan-item',{active:selectedPlanId===item.id}]">
        <view class="plan-summary" @tap="togglePlan(item)">
          <view class="plan-main">
            <view class="plan-title-line">
              <text class="plan-name">{{ item.title }}</text>
              <text :class="['status-pill',planStatus(item)]">{{ planStatusText(item) }}</text>
            </view>
            <text class="plan-meta">{{ item.class_name }} · {{ item.start_date }} 至 {{ item.end_date }}</text>
            <text class="plan-meta">{{ item.student_count }} 人 · {{ item.submission_count }} 份提交 · {{ item.pending_submission_count }} 待批</text>
          </view>
          <text class="expand-arrow">{{ selectedPlanId===item.id?'⌃':'⌄' }}</text>
        </view>
        <view v-if="selectedPlanId===item.id" class="plan-detail">
          <view class="plan-actions">
            <button class="plan-action review" @tap="openReview(item)">批改 {{ item.pending_submission_count }}</button>
            <button class="plan-action pdf" @tap="openPdfPicker(item)">导出学生 PDF</button>
          </view>
          <text class="history-title">已批改记录</text>
          <pp-state v-if="historyLoading" type="loading" title="正在读取历史" />
          <text v-else-if="!reviewedHistory.length" class="empty-history">暂无已批改记录</text>
          <button
            v-else
            v-for="record in reviewedHistory.slice(0,12)"
            :key="record.id"
            class="history-row"
            @tap.stop="openSavedReview(record)"
          >
            <view><text class="history-name">{{ record.student_name }}</text><text class="history-date">{{ record.practice_date }}</text></view>
            <view class="history-result-box">
              <text class="history-result">{{ wrongNumbers(record).length ? `错 ${wrongNumbers(record).join('、')}` : '全对' }}</text>
              <text class="history-link">查看 / 补存海报</text>
            </view>
          </button>
        </view>
      </view>

      <button v-if="plans.length>5 && !filters.keyword" class="old-toggle" @tap="showOld=!showOld">
        {{ showOld ? '收起旧计划' : `展开其余 ${plans.length-5} 个旧计划` }}
      </button>
    </view>

    <view v-if="pdfPlan" class="modal-mask" @tap="closePdfPicker">
      <view class="modal pdf-modal" @tap.stop>
        <text class="modal-title">导出学生专属练习</text>
        <text class="pdf-plan-name">{{ pdfPlan.title }}</text>
        <text class="field-label">选择学生</text>
        <picker :range="pdfStudents" range-key="student_name" :value="pdfStudentIndex" @change="pdfStudentIndex=Number($event.detail.value)">
          <view class="field picker-field">{{ pdfStudents[pdfStudentIndex]?.student_name || '正在读取学生' }}<text>›</text></view>
        </picker>
        <text class="pdf-help">将导出该学生计划内全部日期：每天 1 张练习页，末尾教师答案紧凑排版。</text>
        <button class="primary-btn pdf-download" :disabled="!pdfStudents.length || pdfBusy" @tap="downloadStudentPdf">{{ pdfBusy?'正在生成…':'打开 PDF' }}</button>
        <button class="btn-cancel" @tap="closePdfPicker">取消</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';

function dateText(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 10);
}

const classes = ref([]);
const topics = ref([]);
const plans = ref([]);
const todoCount = ref(0);
const serverFilters = ref({ classes: [], months: [] });
const selectedPlanId = ref(0);
const reviewedHistory = ref([]);
const historyLoading = ref(false);
const loadingPlans = ref(false);
const showOld = ref(false);
const preview = ref(null);
const busy = ref(false);
const pdfPlan = ref(null);
const pdfStudents = ref([]);
const pdfStudentIndex = ref(0);
const pdfBusy = ref(false);
const form = reactive({
  title: '初中计算打卡',
  class_id: '',
  grade_band: '初中',
  module: '综合计算',
  difficulty: 3,
  start_date: dateText(0),
  end_date: dateText(4),
  target_minutes: 20,
  auto_advance: false,
  question_types: [],
  topic_keys: ['rational_numbers', 'absolute_value', 'algebra', 'linear_equation'],
});
const filters = reactive({ keyword: '', class_id: '', status: 'all', month: '' });
const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'current', label: '进行中' },
  { value: 'upcoming', label: '未开始' },
  { value: 'ended', label: '已结束' },
];
const selectedClass = computed(() => classes.value.find((item) => Number(item.id) === Number(form.class_id)));
const classIndex = computed(() => Math.max(0, classes.value.findIndex((item) => Number(item.id) === Number(form.class_id))));
const classFilterOptions = computed(() => [{ id: '', name: '全部小组' }, ...(serverFilters.value.classes || [])]);
const classFilterIndex = computed(() => Math.max(0, classFilterOptions.value.findIndex((item) => String(item.id) === String(filters.class_id))));
const statusFilterIndex = computed(() => Math.max(0, statusOptions.findIndex((item) => item.value === filters.status)));
const monthOptions = computed(() => [{ value: '', label: '全部月份' }, ...(serverFilters.value.months || []).map((value) => ({ value, label: value }))]);
const monthFilterIndex = computed(() => Math.max(0, monthOptions.value.findIndex((item) => item.value === filters.month)));
const visiblePlans = computed(() => (showOld.value || filters.keyword ? plans.value : plans.value.slice(0, 5)));

onShow(() => loadBase());
onPullDownRefresh(async () => { try { await loadBase(); } finally { uni.stopPullDownRefresh(); } });

async function loadBase() {
  try {
    const [classData, catalogData, todos] = await Promise.all([
      api.get('/classes'),
      api.get('/practice/catalog'),
      api.get('/practice/todos?limit=1'),
    ]);
    classes.value = classData.classes || [];
    topics.value = catalogData.topics || [];
    todoCount.value = Number(todos.count || 0);
    if (!form.class_id && classes.value[0]) form.class_id = classes.value[0].id;
    await loadPlans();
  } catch (error) {
    uni.showToast({ title: error?.error || '打卡计划加载失败', icon: 'none' });
  }
}

function queryString() {
  return [
    ['keyword', filters.keyword.trim()],
    ['class_id', filters.class_id],
    ['status', filters.status],
    ['month', filters.month],
    ['limit', 100],
  ].filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}
async function loadPlans() {
  loadingPlans.value = true;
  try {
    const result = await api.get(`/practice/plans?${queryString()}`);
    plans.value = result.plans || [];
    serverFilters.value = result.filters || { classes: [], months: [] };
    if (filters.keyword) showOld.value = true;
  } finally {
    loadingPlans.value = false;
  }
}

function searchPlans(){loadPlans();}
function changeClassFilter(event){filters.class_id=classFilterOptions.value[Number(event.detail.value)]?.id||'';loadPlans();}
function changeStatusFilter(event){filters.status=statusOptions[Number(event.detail.value)]?.value||'all';loadPlans();}
function changeMonthFilter(event){filters.month=monthOptions.value[Number(event.detail.value)]?.value||'';loadPlans();}
function selectClass(event){form.class_id=classes.value[Number(event.detail.value)]?.id||'';preview.value=null;}
function toggleTopic(key){
  const index=form.topic_keys.indexOf(key);
  if(index>=0){
    if(form.topic_keys.length===1)return uni.showToast({title:'至少保留一个计算模块',icon:'none'});
    form.topic_keys.splice(index,1);
  }else form.topic_keys.push(key);
  preview.value=null;
}
async function previewPlan(){
  busy.value=true;preview.value=null;
  try{preview.value=await api.post('/practice/plans/preview',{...form});}
  catch(error){uni.showToast({title:error?.errors?.[0]||error?.error||'范围不可用',icon:'none'});}
  finally{busy.value=false;}
}
async function publishPlan(){
  if(!preview.value||busy.value)return;
  busy.value=true;
  try{
    const result=await api.post('/practice/plans',{...form});
    uni.showToast({title:`已发布给 ${result.students} 名学生`,icon:'success'});
    preview.value=null;
    await loadPlans();
  }catch(error){uni.showToast({title:error?.error||'发布失败',icon:'none'});}
  finally{busy.value=false;}
}
function planStatus(item){
  const today=dateText(0);
  if(!['published','student_curriculum'].includes(item.status)||item.end_date<today)return'ended';
  if(item.start_date>today)return'upcoming';
  return'current';
}
function planStatusText(item){return planStatus(item)==='current'?'进行中':planStatus(item)==='upcoming'?'未开始':'已结束';}
async function togglePlan(item){
  if(selectedPlanId.value===item.id){selectedPlanId.value=0;reviewedHistory.value=[];return;}
  selectedPlanId.value=item.id;
  historyLoading.value=true;
  try{
    const [reviewed,correctionRequired]=await Promise.all([
      api.get(`/practice/submissions?plan_id=${item.id}&status=reviewed&limit=50&page=1`),
      api.get(`/practice/submissions?plan_id=${item.id}&status=correction_required&limit=50&page=1`),
    ]);
    reviewedHistory.value=[...(reviewed.submissions||[]),...(correctionRequired.submissions||[])]
      .sort((left,right)=>String(right.reviewed_at||'').localeCompare(String(left.reviewed_at||'')));
  }catch(error){uni.showToast({title:error?.error||'历史加载失败',icon:'none'});}
  finally{historyLoading.value=false;}
}
function wrongNumbers(record){return(record.items||[]).filter((item)=>Number(item.is_correct)===0).map((item)=>item.position);}
function openReview(item){uni.navigateTo({url:item?.id?`/pages/practice-review/index?plan_id=${item.id}`:'/pages/practice-review/index'});}
function openSavedReview(record){
  const planId=Number(record?.plan_id||selectedPlanId.value||0);
  const submissionId=Number(record?.id||0);
  if(!planId||!submissionId)return;
  uni.navigateTo({url:`/pages/practice-review/index?plan_id=${planId}&submission_id=${submissionId}&history=1`});
}
async function openPdfPicker(item){
  pdfPlan.value=item;pdfStudents.value=[];pdfStudentIndex.value=0;
  try{const result=await api.get(`/practice/plans/${item.id}/settings`);pdfStudents.value=result.settings||[];}
  catch(error){uni.showToast({title:error?.error||'学生列表加载失败',icon:'none'});}
}
function closePdfPicker(){if(pdfBusy.value)return;pdfPlan.value=null;pdfStudents.value=[];}
async function downloadStudentPdf(){
  const student=pdfStudents.value[pdfStudentIndex.value];
  if(!pdfPlan.value||!student||pdfBusy.value)return;
  pdfBusy.value=true;
  try{await api.openPdf(`/api/practice/plans/${pdfPlan.value.id}/pdf?student_id=${student.student_id}`);}
  catch(error){uni.showToast({title:error?.error||'PDF 打开失败',icon:'none'});}
  finally{pdfBusy.value=false;}
}
</script>

<style scoped>
.page {
  --panpan-green: #527CC9;
  --panpan-green-strong: #315EA8;
  --panpan-coral: #E98577;
  --panpan-coral-strong: #D66D62;
  --panpan-paper: #F6FAFF;
  --panpan-ink: #24324A;
  --panpan-muted: #5C6C84;
  min-height: 100vh;
  padding: 0 24rpx calc(56rpx + env(safe-area-inset-bottom));
  background-color: var(--panpan-paper);
  background-image: repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(82, 124, 201, .045) 64rpx 65rpx);
}
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin: 0 -24rpx 17rpx;
  padding: 38rpx 32rpx 30rpx;
  border-bottom: 1rpx solid #DDE7F2;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(82, 124, 201, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 72%, #EAF2FF 100%);
  color: var(--panpan-ink);
  animation: practice-enter var(--motion-slow) var(--ease-out) both;
}
.eyebrow { display: inline-flex; padding: 5rpx 11rpx; border-radius: 7rpx; background: #EAF2FF; color: var(--panpan-green-strong); font-size: 18rpx; font-weight: 760; letter-spacing: 0; }
.hero-title { display: block; margin-top: 8rpx; color: var(--panpan-ink); font-size: 39rpx; font-weight: 790; }
.hero-sub { display: block; max-width: 410rpx; margin-top: 6rpx; color: var(--panpan-muted); font-size: 22rpx; line-height: 1.48; }
.review-entry { width: 170rpx; min-height: 82rpx; display: flex; align-items: center; justify-content: center; gap: 9rpx; flex: none; margin: 0; padding: 7rpx 10rpx; border: 2rpx solid var(--panpan-coral); border-radius: 12rpx; background: #FFF0ED; color: var(--panpan-coral-strong); font-size: 19rpx; box-shadow: 0 7rpx 16rpx rgba(217, 75, 69, .1); }
.review-entry::after { border: 0; }
.review-entry-copy { display: flex; flex-direction: column; align-items: flex-start; }
.review-number { font-size: 34rpx; font-weight: 820; line-height: 1.05; }

.card { margin-bottom: 15rpx; padding: 23rpx 24rpx; border: 1rpx solid #DDE7F2; border-radius: 14rpx; background: #FFFFFF; box-shadow: 0 8rpx 20rpx rgba(36, 50, 74, .06); }
.builder-card { border-top: 6rpx solid var(--panpan-green-strong); }
.plan-card { border-top: 6rpx solid var(--panpan-green); }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; margin-bottom: 18rpx; }
.section-title { display: block; color: var(--panpan-ink); font-size: 29rpx; font-weight: 740; }
.section-desc { display: block; margin-top: 4rpx; color: var(--panpan-muted); font-size: 20rpx; }
.step-mark { flex: none; color: var(--panpan-green-strong); font-size: 19rpx; font-weight: 750; letter-spacing: 0; }

.field-label { display: block; margin: 17rpx 0 8rpx; color: #5C6C84; font-size: 23rpx; font-weight: 680; }
.field { box-sizing: border-box; width: 100%; min-height: 82rpx; padding: 0 18rpx; border: 1rpx solid #DDE7F2; border-radius: 10rpx; background: #F6FAFF; color: var(--panpan-ink); font-size: 26rpx; }
.picker-field { display: flex; align-items: center; justify-content: space-between; }
.grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; }

.fixed-scope { margin-top: 19rpx; padding: 16rpx 0 16rpx 18rpx; border: 0; border-left: 6rpx solid var(--panpan-green); border-radius: 0; background: #EAF2FF; }
.fixed-scope-title { display: block; color: var(--panpan-green-strong); font-size: 26rpx; font-weight: 730; }
.fixed-scope-copy { display: block; margin-top: 6rpx; padding-right: 18rpx; color: #5C6C84; font-size: 21rpx; line-height: 1.52; }
.topic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9rpx; margin: 14rpx 18rpx 0 0; }
.topic-option { min-height: 78rpx; display: flex; align-items: center; gap: 9rpx; margin: 0; padding: 9rpx 11rpx; border: 1rpx solid #DDE7F2; border-radius: 10rpx; background: #FFFFFF; text-align: left; }
.topic-option::after { border: 0; }
.topic-option.selected { border-color: var(--panpan-green); background: #EAF2FF; }
.topic-check { width: 30rpx; height: 30rpx; display: flex; align-items: center; justify-content: center; flex: none; border: 2rpx solid #BFD0EC; border-radius: 8rpx; color: #FFFFFF; }
.topic-option.selected .topic-check { border-color: var(--panpan-green-strong); background: var(--panpan-green-strong); }
.topic-copy { min-width: 0; }
.topic-name { display: block; color: var(--panpan-ink); font-size: 22rpx; font-weight: 700; }
.topic-count { display: block; margin-top: 2rpx; color: var(--panpan-muted); font-size: 18rpx; }
.topic-help { display: block; margin-top: 10rpx; color: var(--panpan-green-strong); font-size: 19rpx; }

.preview-box { margin-top: 18rpx; padding: 15rpx 17rpx; border-left: 6rpx solid var(--panpan-green); border-radius: 9rpx; background: #EAF2FF; }
.preview-title-line { display: flex; align-items: center; gap: 8rpx; }
.preview-title { display: block; color: var(--panpan-green-strong); font-size: 25rpx; font-weight: 730; }
.preview-copy { display: block; margin-top: 5rpx; color: #5C6C84; font-size: 21rpx; }
.action-row { display: grid; grid-template-columns: 1fr 1.35fr; gap: 11rpx; margin-top: 18rpx; }
.primary-btn,
.secondary-btn { min-height: 84rpx; margin: 0; border-radius: 11rpx; font-size: 26rpx; font-weight: 720; }
.primary-btn { background: var(--panpan-green-strong); color: #FFFFFF; box-shadow: 0 8rpx 18rpx rgba(49, 94, 168, .18); }
.secondary-btn { border: 1rpx solid var(--panpan-green); background: #FFFFFF; color: var(--panpan-green-strong); }
button::after { border: 0; }

.search-row { display: flex; gap: 9rpx; }
.search-input { flex: 1; height: 76rpx; padding: 0 16rpx; border: 1rpx solid #DDE7F2; border-radius: 10rpx; background: #F6FAFF; color: var(--panpan-ink); font-size: 23rpx; }
.search-btn { width: 108rpx; min-height: 76rpx; display: flex; align-items: center; justify-content: center; box-sizing: border-box; margin: 0; padding: 0; border-radius: 10rpx; background: var(--panpan-green-strong); color: #FFFFFF; font-size: 23rpx; }
.filter-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8rpx; margin-top: 10rpx; }
.filter-field { min-height: 66rpx; display: flex; align-items: center; justify-content: space-between; gap: 5rpx; padding: 0 10rpx; border: 1rpx solid #DDE7F2; border-radius: 9rpx; background: #F8FBFF; color: #5C6C84; font-size: 20rpx; }

.plan-item { margin-top: 0; border: 0; border-bottom: 1rpx solid #DDE7F2; border-radius: 0; background: transparent; overflow: hidden; }
.plan-item.active { border-left: 5rpx solid var(--panpan-green); background: #F8FBFF; box-shadow: none; }
.plan-summary { display: flex; align-items: center; gap: 11rpx; padding: 17rpx 14rpx; }
.plan-main { flex: 1; min-width: 0; }
.plan-title-line { display: flex; align-items: center; gap: 8rpx; }
.plan-name { overflow: hidden; color: var(--panpan-ink); font-size: 26rpx; font-weight: 730; text-overflow: ellipsis; white-space: nowrap; }
.status-pill { flex: none; padding: 4rpx 9rpx; border-radius: 7rpx; background: #EAF2FF; color: var(--panpan-green-strong); font-size: 17rpx; font-weight: 700; }
.status-pill.upcoming { background: #EAF2FF; color: var(--panpan-green-strong); }
.status-pill.ended { background: #F8FBFF; color: #5C6C84; }
.plan-meta { display: block; margin-top: 4rpx; color: var(--panpan-muted); font-size: 19rpx; line-height: 1.42; }
.expand-arrow { color: var(--panpan-green-strong); font-size: 24rpx; }
.plan-detail { padding: 0 14rpx 14rpx; border-top: 1rpx solid #DDE7F2; background: transparent; }
.plan-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9rpx; padding: 13rpx 0; }
.plan-action { min-height: 68rpx; margin: 0; border-radius: 9rpx; font-size: 22rpx; font-weight: 700; }
.plan-action.review { border: 1rpx solid #EFC9C2; background: #FFF0ED; color: var(--panpan-coral-strong); }
.plan-action.pdf { background: #EAF2FF; color: var(--panpan-green-strong); }
.history-title { display: block; margin: 6rpx 0 4rpx; color: var(--panpan-ink); font-size: 22rpx; font-weight: 720; }
.history-row { box-sizing: border-box; width: 100%; min-height: 74rpx; display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin: 0; padding: 10rpx 0; border: 0; border-top: 1rpx solid #DDE7F2; border-radius: 0; background: transparent; line-height: 1.38; text-align: left; }
.history-row::after { border: 0; }
.history-name { color: var(--panpan-ink); font-size: 22rpx; font-weight: 680; }
.history-date { display: block; color: var(--panpan-muted); font-size: 18rpx; }
.history-result-box { min-width: 170rpx; text-align: right; }
.history-result { display: block; color: var(--panpan-green-strong); font-size: 20rpx; font-weight: 700; }
.history-link { display: block; margin-top: 3rpx; color: var(--panpan-green-strong); font-size: 17rpx; font-weight: 700; }
.empty-history { display: block; padding: 15rpx 0; color: var(--panpan-muted); font-size: 20rpx; }
.old-toggle { min-height: 72rpx; margin: 15rpx 0 0; border: 1rpx dashed #BFD0EC; border-radius: 9rpx; background: #F6FAFF; color: var(--panpan-green-strong); font-size: 22rpx; }

.modal-mask { background: rgba(36, 50, 74, .42); }
.modal { border-radius: 16rpx 16rpx 0 0; background: #FFFFFF; }
.modal-title { color: var(--panpan-ink); }
.pdf-plan-name { display: block; padding: 14rpx 16rpx; border-left: 5rpx solid var(--panpan-green); border-radius: 8rpx; background: #EAF2FF; color: var(--panpan-green-strong); font-size: 24rpx; font-weight: 700; }
.pdf-help { display: block; margin-top: 14rpx; color: var(--panpan-muted); font-size: 21rpx; line-height: 1.55; }
.pdf-download { width: 100%; margin-top: 18rpx; }
.btn-cancel { min-height: 76rpx; margin: 12rpx 0 0; border-radius: 10rpx; background: #F8FBFF; color: var(--panpan-muted); font-size: 24rpx; }

@media (max-width: 380px) {
  .filter-grid { grid-template-columns: 1fr 1fr; }
  .filter-grid picker:last-child { grid-column: 1 / -1; }
  .topic-grid { grid-template-columns: 1fr; }
  .hero-sub { max-width: 360rpx; }
}
.review-entry:active,
.topic-option:active,
.primary-btn:active,
.secondary-btn:active,
.search-btn:active,
.plan-action:active,
.history-row:active,
.old-toggle:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}

.topic-option,
.primary-btn,
.secondary-btn,
.search-btn,
.plan-action,
.history-row,
.old-toggle {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}

@keyframes practice-enter {
  from { opacity: 0; transform: translateY(10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .review-entry,
  .topic-option,
  .primary-btn,
  .secondary-btn,
  .search-btn,
  .plan-action,
  .history-row,
  .old-toggle {
    animation: none !important;
    transition: none !important;
  }

  .review-entry:active,
  .topic-option:active,
  .primary-btn:active,
  .secondary-btn:active,
  .search-btn:active,
  .plan-action:active,
  .history-row:active,
  .old-toggle:active {
    transform: none;
  }
}
</style>
