<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="eyebrow">PRACTICE STUDIO</text>
        <text class="hero-title">打卡计划</text>
        <text class="hero-sub">建计划、查历史、导出学生专属练习</text>
      </view>
      <button class="review-entry" @tap="openReview">
        <text class="review-number">{{ todoCount }}</text>
        <text>进入批改台</text>
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
        <text class="preview-title">{{ preview.students }} 名学生 · {{ preview.days }} 天</text>
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
          <view v-else v-for="record in reviewedHistory.slice(0,12)" :key="record.id" class="history-row">
            <view><text class="history-name">{{ record.student_name }}</text><text class="history-date">{{ record.practice_date }}</text></view>
            <text class="history-result">{{ wrongNumbers(record).length ? `错 ${wrongNumbers(record).join('、')}` : '全对' }}</text>
          </view>
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
  if(item.status!=='published'||item.end_date<today)return'ended';
  if(item.start_date>today)return'upcoming';
  return'current';
}
function planStatusText(item){return planStatus(item)==='current'?'进行中':planStatus(item)==='upcoming'?'未开始':'已结束';}
async function togglePlan(item){
  if(selectedPlanId.value===item.id){selectedPlanId.value=0;reviewedHistory.value=[];return;}
  selectedPlanId.value=item.id;
  historyLoading.value=true;
  try{
    const result=await api.get(`/practice/submissions?plan_id=${item.id}&status=reviewed&limit=50&page=1`);
    reviewedHistory.value=result.submissions||[];
  }catch(error){uni.showToast({title:error?.error||'历史加载失败',icon:'none'});}
  finally{historyLoading.value=false;}
}
function wrongNumbers(record){return(record.items||[]).filter((item)=>Number(item.is_correct)===0).map((item)=>item.position);}
function openReview(item){uni.navigateTo({url:item?.id?`/pages/practice-review/index?plan_id=${item.id}`:'/pages/practice-review/index'});}
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
.page{min-height:100vh;padding:0 24rpx calc(60rpx + env(safe-area-inset-bottom));background:var(--bg)}
.hero{display:flex;align-items:center;justify-content:space-between;gap:24rpx;margin:0 -24rpx 22rpx;padding:50rpx 34rpx 42rpx;background:linear-gradient(145deg,#173A36,#315D56);color:#fff}.eyebrow{display:block;color:#BBD9D1;font-size:19rpx;font-weight:750;letter-spacing:4rpx}.hero-title{display:block;margin-top:10rpx;font-size:42rpx;font-weight:780}.hero-sub{display:block;margin-top:7rpx;color:#D6E7E3;font-size:23rpx}.review-entry{width:150rpx;min-height:116rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none;margin:0;padding:10rpx;border:1rpx solid rgba(255,255,255,.2);border-radius:22rpx;background:rgba(255,255,255,.11);color:#fff;font-size:20rpx}.review-entry::after{border:0}.review-number{font-size:39rpx;font-weight:820;line-height:1.1}
.card{margin-bottom:20rpx;padding:28rpx;border:1rpx solid var(--border);border-radius:22rpx;background:#fff;box-shadow:var(--shadow-sm)}.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20rpx;margin-bottom:22rpx}.section-title{display:block;color:var(--ink);font-size:30rpx;font-weight:740}.section-desc{display:block;margin-top:4rpx;color:var(--text-muted);font-size:21rpx}.step-mark{flex:none;color:var(--accent);font-size:20rpx;letter-spacing:1rpx}
.field-label{display:block;margin:20rpx 0 9rpx;color:var(--ink);font-size:24rpx;font-weight:660}.field{box-sizing:border-box;width:100%;min-height:88rpx;padding:0 22rpx;border:1rpx solid var(--border);border-radius:14rpx;background:var(--surface-muted);color:var(--ink);font-size:27rpx}.picker-field{display:flex;align-items:center;justify-content:space-between}.grid-two{display:grid;grid-template-columns:1fr 1fr;gap:16rpx}
.fixed-scope{margin-top:22rpx;padding:22rpx;border:1rpx solid #CFE5DE;border-radius:16rpx;background:var(--accent-soft)}.fixed-scope-title{display:block;color:var(--accent-strong);font-size:27rpx;font-weight:730}.fixed-scope-copy{display:block;margin-top:7rpx;color:var(--text-secondary);font-size:22rpx;line-height:1.55}.topic-grid{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:17rpx}.topic-option{min-height:92rpx;display:flex;align-items:center;gap:11rpx;margin:0;padding:13rpx;border:1rpx solid #C9DDD7;border-radius:14rpx;background:rgba(255,255,255,.72);text-align:left}.topic-option::after{border:0}.topic-option.selected{border-color:var(--primary);background:#fff}.topic-check{width:33rpx;height:33rpx;display:flex;align-items:center;justify-content:center;flex:none;border:2rpx solid #9BB9B0;border-radius:9rpx;color:#fff}.topic-option.selected .topic-check{border-color:var(--primary);background:var(--primary)}.topic-copy{min-width:0}.topic-name{display:block;color:var(--ink);font-size:23rpx;font-weight:700}.topic-count{display:block;margin-top:2rpx;color:var(--text-muted);font-size:19rpx}.topic-help{display:block;margin-top:12rpx;color:var(--accent-strong);font-size:20rpx}
.preview-box{margin-top:22rpx;padding:19rpx;border-left:6rpx solid var(--accent);border-radius:12rpx;background:var(--accent-soft)}.preview-title{display:block;color:var(--accent-strong);font-size:26rpx;font-weight:730}.preview-copy{display:block;margin-top:6rpx;color:var(--text-secondary);font-size:22rpx}.action-row{display:grid;grid-template-columns:1fr 1.35fr;gap:13rpx;margin-top:22rpx}.primary-btn,.secondary-btn{min-height:88rpx;margin:0;border-radius:14rpx;font-size:27rpx;font-weight:720}.primary-btn{background:var(--primary);color:#fff}.secondary-btn{border:1rpx solid var(--primary);background:#fff;color:var(--primary)}button::after{border:0}
.search-row{display:flex;gap:11rpx}.search-input{flex:1;height:80rpx;padding:0 18rpx;border:1rpx solid var(--border);border-radius:13rpx;background:#FAFCFB;font-size:24rpx}.search-btn{width:112rpx;min-height:80rpx;margin:0;border-radius:13rpx;background:var(--primary);color:#fff;font-size:24rpx}.filter-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9rpx;margin-top:12rpx}.filter-field{min-height:70rpx;display:flex;align-items:center;justify-content:space-between;gap:6rpx;padding:0 12rpx;border-radius:12rpx;background:var(--surface-muted);color:var(--text-secondary);font-size:21rpx}
.plan-item{margin-top:15rpx;border:1rpx solid var(--border);border-radius:17rpx;background:#fff;overflow:hidden}.plan-item.active{border-color:#A9CFC4;box-shadow:0 8rpx 22rpx rgba(24,58,54,.08)}.plan-summary{display:flex;align-items:center;gap:13rpx;padding:20rpx}.plan-main{flex:1;min-width:0}.plan-title-line{display:flex;align-items:center;gap:10rpx}.plan-name{overflow:hidden;color:var(--ink);font-size:27rpx;font-weight:730;text-overflow:ellipsis;white-space:nowrap}.status-pill{flex:none;padding:4rpx 10rpx;border-radius:8rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:18rpx;font-weight:700}.status-pill.upcoming{background:var(--info-soft);color:var(--info)}.status-pill.ended{background:var(--surface-muted);color:var(--text-muted)}.plan-meta{display:block;margin-top:5rpx;color:var(--text-muted);font-size:20rpx;line-height:1.45}.expand-arrow{color:var(--accent-strong);font-size:25rpx}.plan-detail{padding:0 20rpx 20rpx;border-top:1rpx solid var(--hairline);background:#FCFEFD}.plan-actions{display:grid;grid-template-columns:1fr 1fr;gap:11rpx;padding:17rpx 0}.plan-action{min-height:74rpx;margin:0;border-radius:12rpx;font-size:23rpx;font-weight:700}.plan-action.review{background:#F7E7BE;color:#6C4C0B}.plan-action.pdf{background:var(--accent-soft);color:var(--accent-strong)}.history-title{display:block;margin:7rpx 0 5rpx;color:var(--ink);font-size:23rpx;font-weight:720}.history-row{display:flex;align-items:center;justify-content:space-between;gap:14rpx;padding:13rpx 0;border-top:1rpx solid var(--hairline)}.history-name{color:var(--ink);font-size:23rpx;font-weight:680}.history-date{display:block;color:var(--text-muted);font-size:19rpx}.history-result{color:var(--accent-strong);font-size:21rpx;font-weight:700}.empty-history{display:block;padding:18rpx 0;color:var(--text-muted);font-size:21rpx}.old-toggle{min-height:78rpx;margin:18rpx 0 0;border-radius:13rpx;background:var(--surface-muted);color:var(--text-secondary);font-size:23rpx}
.pdf-plan-name{display:block;padding:16rpx;border-radius:13rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:25rpx;font-weight:700}.pdf-help{display:block;margin-top:16rpx;color:var(--text-muted);font-size:22rpx;line-height:1.6}.pdf-download{width:100%;margin-top:22rpx}
@media(max-width:380px){.filter-grid{grid-template-columns:1fr 1fr}.filter-grid picker:last-child{grid-column:1/-1}.topic-grid{grid-template-columns:1fr}.hero-sub{max-width:390rpx}}
</style>
