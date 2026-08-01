<template>
  <view class="page page-bottom-safe">
    <view class="exam-hero">
      <text class="eyebrow">GUANGZHOU PAPERS</text>
      <view class="hero-title-row">
        <view class="title-icon tone-green"><pp-icon name="exam" :size="34" motion="pop" /></view>
        <text class="hero-title">{{ gradeCode==='g9'?'中考一模卷库':'广州真题大全' }}</text>
      </view>
      <text class="hero-sub">{{ gradeCode==='g9'?'九年级七科原卷 · 按年份、学科和地区筛选':'七、八年级原卷 · 按考试类型和年份筛选' }}</text>
    </view>

    <view class="filter-card">
      <view class="grade-switch" role="tablist" aria-label="试卷年级">
        <button
          v-for="item in gradeTypes"
          :key="item.value"
          :class="['grade-tab',{on:gradeCode===item.value}]"
          :disabled="loading || initializing"
          @tap="setGrade(item.value)"
        >{{ item.label }}</button>
      </view>
      <view class="filter-row">
        <button v-for="item in examTypes" :key="item.value" :class="['chip',{on:filters.exam_type===item.value}]" @tap="setFilter('exam_type',item.value)">{{ item.label }}</button>
      </view>
      <view class="filter-row">
        <button v-for="item in yearTypes" :key="item.value" :class="['chip',{on:filters.year_bucket===item.value}]" @tap="setFilter('year_bucket',item.value)">{{ item.label }}</button>
      </view>
      <view v-if="gradeCode==='g9'" class="filter-row">
        <button v-for="item in subjectTypes" :key="item.value" :class="['chip',{on:filters.subject===item.value}]" @tap="setFilter('subject',item.value)">{{ item.label }}</button>
      </view>
      <view v-if="gradeCode==='g9'&&serverFilters.years.length" class="filter-row">
        <button :class="['chip',{on:!filters.year}]" @tap="setFilter('year','')">全部年份</button>
        <button v-for="year in serverFilters.years" :key="year" :class="['chip',{on:String(filters.year)===String(year)}]" @tap="setFilter('year',year)">{{ year }}</button>
      </view>
      <view v-if="gradeCode==='g9'&&serverFilters.districts.length" class="filter-row">
        <button :class="['chip',{on:!filters.district}]" @tap="setFilter('district','')">全部地区</button>
        <button v-for="district in serverFilters.districts" :key="district" :class="['chip',{on:filters.district===district}]" @tap="setFilter('district',district)">{{ district }}</button>
      </view>
      <view class="search-row">
        <input v-model="keyword" class="search-input" placeholder="搜索学校或试卷名称" confirm-type="search" @confirm="search" />
        <button class="search-btn" @tap="search"><pp-icon name="search" :size="26" /><text>搜索</text></button>
      </view>
    </view>

    <view v-if="isTeacher" class="teacher-summary" @tap="activityExpanded=!activityExpanded">
      <view class="summary-copy"><view class="summary-title"><pp-icon name="report" :size="26" :motion="activity.requests?.some(item=>item.status==='pending') ? 'ring' : 'none'" /><text>家长下载与答案申请</text></view><text class="summary-desc">{{ activity.requests?.filter(item=>item.status==='pending').length || 0 }} 条待处理 · {{ activity.downloads?.length || 0 }} 条最近下载</text></view>
      <text class="summary-toggle">{{ activityExpanded?'收起':'展开' }}</text>
    </view>
    <view v-if="isTeacher && activityExpanded" class="activity-panel">
      <text class="panel-title">答案申请</text>
      <view v-for="item in activity.requests" :key="item.id" class="activity-row">
        <view class="activity-copy"><text class="activity-name">{{ item.student_name }} · {{ item.display_title }}</text><text class="activity-meta">{{ item.status==='pending'?'等待处理':item.status==='sent'?'已发送':'已忽略' }} · {{ formatTime(item.created_at) }}</text></view>
        <view v-if="item.status==='pending'" class="activity-actions">
          <button class="mini-btn secondary" @tap="previewAnswer(item)">先看答案</button>
          <button class="mini-btn" @tap="approveAnswer(item)">批准发放</button>
        </view>
      </view>
      <pp-state v-if="!activity.requests?.length" title="暂无答案申请" />
      <text class="panel-title downloads-title">最近下载</text>
      <view v-for="item in activity.downloads?.slice(0,20)" :key="item.id" class="download-log">
        <text>{{ item.student_name || item.parent_name || '教师' }} · {{ item.display_title }}</text>
        <text>{{ item.repeat_count>1 ? `已下载 ${item.repeat_count} 次` : formatTime(item.created_at) }}</text>
      </view>
    </view>

    <pp-state v-if="initializing || (loading && !papers.length)" type="loading" title="正在整理真题" />
    <pp-state v-else-if="error && !papers.length" type="error" title="真题加载失败" :description="error" action-text="重试" @action="loadPapers(true)" />
    <pp-state v-else-if="!papers.length" title="没有符合条件的真题" description="换一个考试类型或年份试试。" />

    <view v-for="paper in papers" :key="paper.id" class="paper-card">
      <view class="paper-tags"><text>{{ examLabel(paper.exam_type) }}</text><text>{{ paper.exam_year || '往年' }}</text><text v-if="paper.has_answer">含答案</text></view>
      <view class="paper-title"><pp-icon name="book" :size="28" /><text>{{ paper.display_title }}</text></view>
      <text class="paper-meta">{{ subjectLabel(paper.subject_code) }} · {{ paper.district || paper.school_name || paper.grade }} · {{ paper.semester }}</text>
      <view class="paper-actions">
        <button class="paper-primary" :disabled="busyId===paper.id" @tap="downloadPaper(paper,'paper')"><pp-icon name="book" :size="26" /><text>{{ busyId===paper.id?'打开中…':'打开原卷' }}</text></button>
        <button v-if="isTeacher && paper.has_answer" class="paper-secondary" @tap="downloadPaper(paper,'answer')"><pp-icon name="check" :size="26" /><text>教师看答案</text></button>
        <button v-else-if="!isTeacher" :class="['paper-secondary',{done:paper.answer_request_status==='pending',ready:paper.answer_request_status==='sent'}]" @tap="paper.answer_request_status==='sent'?downloadPaper(paper,'answer'):requestAnswer(paper)"><pp-icon :name="paper.answer_request_status==='sent'?'check':'message'" :size="26" /><text>{{ requestLabel(paper) }}</text></button>
      </view>
    </view>
    <button v-if="page<pages" class="load-more" :disabled="loading" @tap="loadMore"><pp-icon name="plus" :size="26" /><text>{{ loading?'加载中…':'加载更多' }}</text></button>
    <view class="privacy-note">原卷仅向已绑定家长开放；答案由老师按申请处理，下载行为会记录用于教学服务。</view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { getUser } from '@/utils/auth';
import { buildQuery } from '@/utils/query';

const isTeacher = ref(getUser()?.role === 'teacher');
const studentId = ref(0);
const gradeCode = ref('g7');
const papers = ref([]);
const loading = ref(false);
const initializing = ref(true);
const error = ref('');
const busyId = ref(0);
const keyword = ref('');
const page = ref(1);
const pages = ref(1);
const activityExpanded = ref(false);
const activity = reactive({ requests: [], downloads: [] });
const filters = reactive({ exam_type: '', year_bucket: '', subject:'', district:'', year:'' });
const serverFilters=reactive({subjects:[],districts:[],years:[]});
const gradeTypes = [{value:'g7',label:'七年级'},{value:'g8',label:'八年级'},{value:'g9',label:'九年级'}];
const examTypes = [{value:'',label:'全部'},{value:'midterm',label:'期中'},{value:'final',label:'期末'},{value:'monthly',label:'月考'},{value:'mock',label:'一模'}];
const yearTypes = [{value:'',label:'全部年份'},{value:'recent',label:'2024-2025'},{value:'older',label:'2024 以前'}];
const subjectTypes=[{value:'',label:'全部学科'},{value:'chinese',label:'语文'},{value:'math',label:'数学'},{value:'english',label:'英语'},{value:'physics',label:'物理'},{value:'chemistry',label:'化学'},{value:'history',label:'历史'},{value:'morality',label:'道德与法治'}];

onLoad((query) => { initialize(query); });
async function initialize(query) {
  studentId.value = Number(query.student_id || uni.getStorageSync('activeChildId') || 0);
  if (isTeacher.value && query.teacher_tab === 'requests') activityExpanded.value = true;
  const requestedGrade = String(query.grade || '');
  if (gradeTypes.some(item => item.value === requestedGrade)) gradeCode.value = requestedGrade;
  else if (isTeacher.value) gradeCode.value = 'g9';
  else if (studentId.value) {
    try {
      const catalog = await api.get(`/learning/catalog?student_id=${studentId.value}`);
      if (gradeTypes.some(item => item.value === catalog.grade_code)) gradeCode.value = catalog.grade_code;
    } catch (_) {}
  }
  filters.exam_type = gradeCode.value === 'g9' ? 'mock' : '';
  filters.subject = '';
  try { await Promise.all([loadPapers(true), isTeacher.value ? loadActivity() : Promise.resolve()]); }
  finally { initializing.value = false; }
}
onPullDownRefresh(async () => { try { await Promise.all([loadPapers(true), isTeacher.value ? loadActivity() : Promise.resolve()]); } finally { uni.stopPullDownRefresh(); } });

function params(nextPage=1) {
  return buildQuery({
    page: nextPage,
    limit: 20,
    student_id: isTeacher.value ? undefined : studentId.value,
    grade:gradeCode.value,
    exam_type: filters.exam_type,
    year_bucket: filters.year_bucket,
    subject:filters.subject,
    district:filters.district,
    year:filters.year,
    keyword: keyword.value.trim(),
  });
}
async function loadPapers(reset=false) {
  if (loading.value) return;
  if (!isTeacher.value && !studentId.value) { error.value='请先绑定孩子'; return; }
  loading.value=true; error.value='';
  try {
    const nextPage = reset ? 1 : page.value;
    const data = await api.get(`/exams?${params(nextPage)}`);
    papers.value = reset ? data.papers : papers.value.concat(data.papers || []);
    Object.assign(serverFilters,data.filters||{});
    page.value = Number(data.pagination?.page || nextPage);
    pages.value = Number(data.pagination?.pages || 1);
  } catch (e) { error.value=e?.error || '请检查网络后重试'; }
  finally { loading.value=false; }
}
async function loadActivity() { const data=await api.get('/exams/teacher/activity'); activity.requests=data.requests||[]; activity.downloads=data.downloads||[]; }
function setFilter(key,value){ filters[key]=value; loadPapers(true); }
async function setGrade(value){
  if(loading.value || initializing.value || gradeCode.value===value)return;
  gradeCode.value=value;
  papers.value=[];
  page.value=1;
  pages.value=1;
  keyword.value='';
  Object.assign(filters,{exam_type:value==='g9'?'mock':'',year_bucket:'',subject:'',district:'',year:''});
  Object.assign(serverFilters,{subjects:[],districts:[],years:[]});
  await loadPapers(true);
}
function search(){ loadPapers(true); }
function loadMore(){ if(page.value<pages.value){ page.value+=1; loadPapers(false); } }
function examLabel(type){ return type==='midterm'?'期中':type==='final'?'期末':type==='mock'?'一模':'月考'; }
function subjectLabel(code){return subjectTypes.find(item=>item.value===code)?.label||'数学';}
function requestLabel(paper){ return paper.answer_request_status==='sent'?'打开答案':paper.answer_request_status==='pending'?'等待老师批准':'向老师申请答案'; }
function formatTime(value){ return String(value||'').replace('T',' ').slice(0,16); }
async function downloadPaper(paper,assetKind){
  if(busyId.value)return false; busyId.value=paper.id;
  let created;
  try{
    created=await api.post(`/exams/${paper.id}/download`,{student_id:studentId.value,asset_kind:assetKind});
    await api.openDocument(created.download_url,created.file_type);
    await api.post(`/exams/${paper.id}/download/${created.event_id}/complete`,{opened:true});
    return true;
  }catch(e){
    if(created?.event_id) await api.post(`/exams/${paper.id}/download/${created.event_id}/complete`,{success:false,error:e?.error||e?.errMsg||'open failed'}).catch(()=>{});
    uni.showToast({title:e?.error||'文件打开失败',icon:'none'});
    return false;
  }finally{busyId.value=0;}
}
async function requestAnswer(paper){
  if(paper.answer_request_status)return;
  try{await api.post(`/exams/${paper.id}/answer-requests`,{student_id:studentId.value});paper.answer_request_status='pending';uni.showToast({title:'老师已收到申请',icon:'success'});}
  catch(e){uni.showToast({title:e?.error||'申请失败',icon:'none'});}
}
async function previewAnswer(item){await downloadPaper({id:item.exam_id},'answer');}
async function approveAnswer(item){
  try{await api.put(`/exams/teacher/answer-requests/${item.id}`,{status:'sent'});uni.showToast({title:'家长已可查看答案',icon:'success'});await loadActivity();}
  catch(e){uni.showToast({title:e?.error||'处理失败',icon:'none'});}
}
</script>

<style scoped>
.page {
  --panpan-green: #0B789A;
  --panpan-green-strong: #050505;
  --panpan-sprout: #0B789A;
  --panpan-coral: #F79BC0;
  --panpan-leaf: #050505;
  --panpan-paper: #F7FCFE;
  --panpan-ink: #050505;
  --panpan-muted: #50545B;
  min-height: 100vh;
  padding: 0 24rpx 48rpx;
  background: var(--panpan-paper);
}

.exam-hero {
  margin: 0 -24rpx 17rpx;
  padding: 40rpx 32rpx 32rpx;
  border-bottom: 1rpx solid #DCE9ED;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(153, 222, 244, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 72%, #E5F8FE 100%);
  color: var(--panpan-ink);
  animation: exam-enter var(--motion-slow) var(--ease-out) both;
}

.eyebrow { display: inline-flex; padding: 5rpx 12rpx; border-radius: 7rpx; background: #E5F8FE; color: var(--panpan-green-strong); font-size: 19rpx; font-weight: 800; letter-spacing: 0; }
.hero-title-row { display: flex; align-items: center; gap: 12rpx; margin-top: 9rpx; }
.title-icon { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; }
.title-icon.tone-green { background: #E5F8FE; }
.hero-title { max-width: 570rpx; color: var(--panpan-ink); font-size: 40rpx; font-weight: 790; }
.hero-title-row::after { content: ''; width: 54rpx; height: 7rpx; flex: none; border-radius: 4rpx; background: var(--panpan-sprout); }
.hero-sub { display: block; max-width: 590rpx; margin-top: 10rpx; color: var(--panpan-muted); font-size: 22rpx; line-height: 1.52; }

.filter-card,
.activity-panel {
  margin-bottom: 15rpx;
  padding: 19rpx;
  border: 1rpx solid #D9E5F3;
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 20rpx rgba(5, 5, 5, .06);
}

.filter-card { border-top: 6rpx solid var(--panpan-green); animation: exam-panel-enter var(--motion-slow) 40ms var(--ease-out) both; }
.grade-switch { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6rpx; margin-bottom: 15rpx; padding: 6rpx; border-radius: 11rpx; background: #EEF7F1; }

.grade-tab {
  min-height: 74rpx;
  margin: 0;
  padding: 0 8rpx;
  border-radius: 9rpx;
  background: transparent;
  color: var(--panpan-muted);
  font-size: 22rpx;
  font-weight: 700;
  transition: transform var(--motion-fast) var(--ease-out), background-color var(--motion-base) var(--ease-out), color var(--motion-base) var(--ease-out);
}

.grade-tab::after,
.chip::after,
.search-btn::after,
.paper-actions button::after,
.mini-btn::after,
.load-more::after { border: 0; }
.grade-tab.on { background: var(--panpan-green-strong); color: #FFFFFF; box-shadow: 0 6rpx 12rpx rgba(5, 5, 5, .18); }
.grade-tab:active,
.chip:active,
.search-btn:active,
.mini-btn:active,
.paper-actions button:active,
.load-more:active { transform: scale(var(--tap-scale)); }

.filter-row { display: flex; gap: 8rpx; overflow-x: auto; margin-bottom: 10rpx; padding-bottom: 2rpx; white-space: nowrap; }

.chip {
  min-height: 56rpx;
  flex: none;
  margin: 0;
  padding: 0 16rpx;
  border: 1rpx solid transparent;
  border-radius: 8rpx;
  background: #F2F7F3;
  color: var(--panpan-muted);
  font-size: 21rpx;
  transition: transform var(--motion-fast) var(--ease-out), background-color var(--motion-base) var(--ease-out), color var(--motion-base) var(--ease-out);
}

.chip.on { border-color: rgba(153, 222, 244, .28); background: #E5F8FE; color: var(--panpan-green-strong); font-weight: 700; }
.search-row { display: flex; gap: 10rpx; }
.search-input { flex: 1; height: 78rpx; box-sizing: border-box; padding: 0 16rpx; border: 1rpx solid #D9E5F3; border-radius: 10rpx; background: #F7FCFE; color: var(--panpan-ink); font-size: 23rpx; }
.search-btn { width: 118rpx; min-height: 78rpx; display: flex; align-items: center; justify-content: center; gap: 5rpx; margin: 0; border-radius: 10rpx; background: var(--panpan-green-strong); color: #FFFFFF; font-size: 23rpx; font-weight: 700; transition: transform var(--motion-fast) var(--ease-out); }

.teacher-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
  padding: 17rpx 20rpx;
  border: 1rpx solid rgba(153, 222, 244, .45);
  border-left: 5rpx solid var(--panpan-sprout);
  border-radius: 10rpx;
  background: #E5F8FE;
  transition: transform var(--motion-fast) var(--ease-out);
}

.teacher-summary:active { transform: scale(var(--tap-scale)); }
.summary-copy { flex: 1; min-width: 0; }
.summary-title,
.panel-title { display: block; color: var(--panpan-ink); font-size: 26rpx; font-weight: 750; }
.summary-title { display: flex; align-items: center; gap: 7rpx; }
.summary-desc { display: block; margin-top: 4rpx; color: #050505; font-size: 20rpx; line-height: 1.48; }
.summary-toggle { flex: none; color: var(--panpan-green-strong); font-size: 21rpx; font-weight: 700; }
.activity-panel { border-top: 5rpx solid var(--panpan-leaf); animation: exam-panel-enter var(--motion-slow) var(--ease-out) both; }
.panel-title { margin-bottom: 9rpx; }
.downloads-title { margin-top: 20rpx; }
.activity-row { min-height: 78rpx; display: flex; align-items: center; gap: 10rpx; padding: 11rpx 0; border-bottom: 1rpx solid #EDF3F5; }
.activity-copy { flex: 1; min-width: 0; }
.activity-name { display: block; color: var(--panpan-ink); font-size: 22rpx; font-weight: 680; line-height: 1.48; }
.activity-meta { display: block; margin-top: 3rpx; color: var(--panpan-muted); font-size: 19rpx; }
.activity-actions { display: flex; flex-direction: column; gap: 7rpx; }

.mini-btn {
  min-height: 56rpx;
  flex: none;
  max-width: 210rpx;
  margin: 0;
  padding: 5rpx 12rpx;
  border-radius: 8rpx;
  background: var(--panpan-green-strong);
  color: #FFFFFF;
  font-size: 19rpx;
  transition: transform var(--motion-fast) var(--ease-out);
}

.mini-btn.secondary { border: 1rpx solid rgba(153, 222, 244, .28); background: #E5F8FE; color: #050505; }
.download-log { min-height: 56rpx; display: flex; justify-content: space-between; gap: 16rpx; padding: 10rpx 0; border-bottom: 1rpx solid #EDF3F5; color: var(--panpan-muted); font-size: 19rpx; }
.download-log text:first-child { flex: 1; color: var(--panpan-ink); }

.paper-card {
  margin-bottom: 13rpx;
  padding: 21rpx 22rpx;
  border: 1rpx solid #D9E5F3;
  border-left: 6rpx solid var(--panpan-green);
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 20rpx rgba(5, 5, 5, .06);
  animation: exam-card-enter var(--motion-slow) var(--ease-out) both;
}

.paper-tags { display: flex; flex-wrap: wrap; gap: 7rpx; }
.paper-tags text { padding: 5rpx 10rpx; border-radius: 7rpx; background: #E5F8FE; color: #050505; font-size: 18rpx; font-weight: 700; }
.paper-tags text:nth-child(2) { background: #E5F8FE; color: #050505; }
.paper-tags text:last-child { background: #E5F8FE; color: var(--panpan-green-strong); }
.paper-title { display: flex; align-items: flex-start; gap: 8rpx; margin-top: 11rpx; color: var(--panpan-ink); font-size: 27rpx; font-weight: 730; line-height: 1.48; }
.paper-title text { flex: 1; min-width: 0; }
.paper-meta { display: block; margin-top: 5rpx; color: var(--panpan-muted); font-size: 20rpx; line-height: 1.48; }
.paper-actions { display: flex; gap: 10rpx; margin-top: 16rpx; }

.paper-actions button {
  min-height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  flex: 1;
  margin: 0;
  border-radius: 10rpx;
  font-size: 22rpx;
  font-weight: 700;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.paper-primary { background: var(--panpan-green-strong); color: #FFFFFF; box-shadow: 0 7rpx 14rpx rgba(5, 5, 5, .17); }
.paper-secondary { border: 1rpx solid rgba(153, 222, 244, .28); background: #E5F8FE; color: #050505; }
.paper-secondary.done { border-color: #DCE9ED; background: #F2F7F3; color: var(--panpan-muted); }
.paper-secondary.ready { border-color: rgba(153, 222, 244, .28); background: #E5F8FE; color: var(--panpan-green-strong); }
.load-more { min-height: 82rpx; display: flex; align-items: center; justify-content: center; gap: 6rpx; margin: 18rpx 0; border: 1rpx solid #D9E5F3; border-radius: 10rpx; background: #FFFFFF; color: var(--panpan-green-strong); font-size: 23rpx; font-weight: 700; transition: transform var(--motion-fast) var(--ease-out); }
.privacy-note { padding: 20rpx 10rpx; color: var(--panpan-muted); font-size: 19rpx; line-height: 1.55; text-align: center; }

@keyframes exam-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes exam-panel-enter {
  from { opacity: 0; transform: translateY(12rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes exam-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 360px) {
  .activity-row { align-items: flex-start; flex-direction: column; }
  .activity-actions { width: 100%; flex-direction: row; }
  .mini-btn { flex: 1; max-width: none; }
}

@media (prefers-reduced-motion: reduce) {
  .exam-hero,
  .filter-card,
  .activity-panel,
  .paper-card { animation: none; }
  .grade-tab,
  .chip,
  .search-btn,
  .teacher-summary,
  .mini-btn,
  .paper-actions button,
  .load-more { transition: none; }
}
</style>
