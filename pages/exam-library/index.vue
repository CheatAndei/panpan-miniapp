<template>
  <view class="page page-bottom-safe">
    <view class="exam-hero">
      <text class="eyebrow">GUANGZHOU PAPERS</text>
      <text class="hero-title">广州真题大全</text>
      <text class="hero-sub">七年级上学期原卷 · 按考试类型和年份筛选</text>
    </view>

    <view class="filter-card">
      <view class="filter-row">
        <button v-for="item in examTypes" :key="item.value" :class="['chip',{on:filters.exam_type===item.value}]" @tap="setFilter('exam_type',item.value)">{{ item.label }}</button>
      </view>
      <view class="filter-row">
        <button v-for="item in yearTypes" :key="item.value" :class="['chip',{on:filters.year_bucket===item.value}]" @tap="setFilter('year_bucket',item.value)">{{ item.label }}</button>
      </view>
      <view class="search-row">
        <input v-model="keyword" class="search-input" placeholder="搜索学校或试卷名称" confirm-type="search" @confirm="search" />
        <button class="search-btn" @tap="search">搜索</button>
      </view>
    </view>

    <view v-if="isTeacher" class="teacher-summary" @tap="activityExpanded=!activityExpanded">
      <view><text class="summary-title">家长下载与答案申请</text><text class="summary-desc">{{ activity.requests?.filter(item=>item.status==='pending').length || 0 }} 条待处理 · {{ activity.downloads?.length || 0 }} 条最近下载</text></view>
      <text class="summary-toggle">{{ activityExpanded?'收起':'展开' }}</text>
    </view>
    <view v-if="isTeacher && activityExpanded" class="activity-panel">
      <text class="panel-title">答案申请</text>
      <view v-for="item in activity.requests" :key="item.id" class="activity-row">
        <view class="activity-copy"><text class="activity-name">{{ item.student_name }} · {{ item.display_title }}</text><text class="activity-meta">{{ item.status==='pending'?'等待处理':item.status==='sent'?'已发送':'已忽略' }} · {{ formatTime(item.created_at) }}</text></view>
        <button v-if="item.status==='pending'" class="mini-btn" @tap="sendAnswer(item)">打开答案并标记已发</button>
      </view>
      <pp-state v-if="!activity.requests?.length" title="暂无答案申请" />
      <text class="panel-title downloads-title">最近下载</text>
      <view v-for="item in activity.downloads?.slice(0,20)" :key="item.id" class="download-log">
        <text>{{ item.student_name || item.parent_name || '教师' }} · {{ item.display_title }}</text>
        <text>{{ item.repeat_count>1 ? `已下载 ${item.repeat_count} 次` : formatTime(item.created_at) }}</text>
      </view>
    </view>

    <pp-state v-if="loading && !papers.length" type="loading" title="正在整理真题" />
    <pp-state v-else-if="error && !papers.length" type="error" title="真题加载失败" :description="error" action-text="重试" @action="loadPapers(true)" />
    <pp-state v-else-if="!papers.length" title="没有符合条件的真题" description="换一个考试类型或年份试试。" />

    <view v-for="paper in papers" :key="paper.id" class="paper-card">
      <view class="paper-tags"><text>{{ examLabel(paper.exam_type) }}</text><text>{{ paper.exam_year || '往年' }}</text><text v-if="paper.has_answer">含答案</text></view>
      <text class="paper-title">{{ paper.display_title }}</text>
      <text class="paper-meta">{{ paper.school_name || '广州七年级数学' }} · {{ paper.semester }}</text>
      <view class="paper-actions">
        <button class="paper-primary" :disabled="busyId===paper.id" @tap="downloadPaper(paper,'paper')">{{ busyId===paper.id?'打开中…':'打开原卷' }}</button>
        <button v-if="isTeacher && paper.has_answer" class="paper-secondary" @tap="downloadPaper(paper,'answer')">教师看答案</button>
        <button v-else-if="!isTeacher" :class="['paper-secondary',{done:paper.answer_request_status==='pending'||paper.answer_request_status==='sent'}]" @tap="requestAnswer(paper)">{{ requestLabel(paper) }}</button>
      </view>
    </view>
    <button v-if="page<pages" class="load-more" :disabled="loading" @tap="loadMore">{{ loading?'加载中…':'加载更多' }}</button>
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
const papers = ref([]);
const loading = ref(false);
const error = ref('');
const busyId = ref(0);
const keyword = ref('');
const page = ref(1);
const pages = ref(1);
const activityExpanded = ref(false);
const activity = reactive({ requests: [], downloads: [] });
const filters = reactive({ exam_type: '', year_bucket: '' });
const examTypes = [{value:'',label:'全部'},{value:'midterm',label:'期中'},{value:'final',label:'期末'},{value:'monthly',label:'月考'}];
const yearTypes = [{value:'',label:'全部年份'},{value:'recent',label:'2024-2025'},{value:'older',label:'2024 以前'}];

onLoad((query) => {
  studentId.value = Number(query.student_id || uni.getStorageSync('activeChildId') || 0);
  loadPapers(true);
  if (isTeacher.value) loadActivity();
});
onPullDownRefresh(async () => { try { await Promise.all([loadPapers(true), isTeacher.value ? loadActivity() : Promise.resolve()]); } finally { uni.stopPullDownRefresh(); } });

function params(nextPage=1) {
  return buildQuery({
    page: nextPage,
    limit: 20,
    student_id: isTeacher.value ? undefined : studentId.value,
    exam_type: filters.exam_type,
    year_bucket: filters.year_bucket,
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
    page.value = Number(data.pagination?.page || nextPage);
    pages.value = Number(data.pagination?.pages || 1);
  } catch (e) { error.value=e?.error || '请检查网络后重试'; }
  finally { loading.value=false; }
}
async function loadActivity() { const data=await api.get('/exams/teacher/activity'); activity.requests=data.requests||[]; activity.downloads=data.downloads||[]; }
function setFilter(key,value){ filters[key]=value; loadPapers(true); }
function search(){ loadPapers(true); }
function loadMore(){ if(page.value<pages.value){ page.value+=1; loadPapers(false); } }
function examLabel(type){ return type==='midterm'?'期中':type==='final'?'期末':'月考'; }
function requestLabel(paper){ return paper.answer_request_status==='sent'?'老师已处理':paper.answer_request_status==='pending'?'已申请答案':'向老师申请答案'; }
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
async function sendAnswer(item){
  try{const opened=await downloadPaper({id:item.exam_id},'answer');if(!opened)return;await api.put(`/exams/teacher/answer-requests/${item.id}`,{status:'sent'});await loadActivity();}
  catch(e){uni.showToast({title:e?.error||'处理失败',icon:'none'});}
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx 48rpx;background:var(--page-bg)}.exam-hero{margin:0 -24rpx 20rpx;padding:48rpx 34rpx 42rpx;background:linear-gradient(145deg,#173A36,#2F6E61);color:#fff;border-radius:0 0 32rpx 32rpx}.eyebrow{display:block;color:#B8DDD3;font-size:19rpx;font-weight:800;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:42rpx;font-weight:780}.hero-sub{display:block;margin-top:7rpx;color:#D6ECE6;font-size:23rpx}.filter-card,.activity-panel{margin-bottom:18rpx;padding:22rpx;background:#fff;border:1rpx solid var(--border);border-radius:20rpx}.filter-row{display:flex;gap:10rpx;overflow-x:auto;margin-bottom:12rpx}.chip{flex:none;min-height:58rpx;margin:0;padding:0 20rpx;border-radius:999rpx;background:var(--surface-muted);color:var(--text-muted);font-size:22rpx}.chip::after,.search-btn::after,.paper-actions button::after,.mini-btn::after,.load-more::after{border:0}.chip.on{background:var(--primary);color:#fff}.search-row{display:flex;gap:12rpx}.search-input{flex:1;height:72rpx;padding:0 18rpx;border:1rpx solid var(--border);border-radius:13rpx;background:#FAFCFB;font-size:24rpx}.search-btn{width:120rpx;min-height:72rpx;margin:0;border-radius:13rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:24rpx}.teacher-summary{display:flex;align-items:center;justify-content:space-between;margin-bottom:16rpx;padding:22rpx 24rpx;border-radius:18rpx;background:#FFF8E7;border:1rpx solid #EACD83}.summary-title,.panel-title{display:block;color:var(--ink);font-size:27rpx;font-weight:750}.summary-desc{display:block;margin-top:4rpx;color:#866719;font-size:21rpx}.summary-toggle{color:#866719;font-size:22rpx;font-weight:700}.panel-title{margin-bottom:10rpx}.downloads-title{margin-top:24rpx}.activity-row{display:flex;gap:12rpx;align-items:center;padding:15rpx 0;border-bottom:1rpx solid var(--hairline)}.activity-copy{flex:1;min-width:0}.activity-name{display:block;color:var(--ink);font-size:23rpx;font-weight:680}.activity-meta{display:block;margin-top:3rpx;color:var(--text-muted);font-size:20rpx}.mini-btn{flex:none;max-width:220rpx;min-height:62rpx;margin:0;padding:8rpx 14rpx;border-radius:11rpx;background:var(--primary);color:#fff;font-size:20rpx}.download-log{display:flex;justify-content:space-between;gap:18rpx;padding:12rpx 0;border-bottom:1rpx solid var(--hairline);color:var(--text-muted);font-size:20rpx}.download-log text:first-child{flex:1;color:var(--ink)}.paper-card{margin-bottom:16rpx;padding:25rpx;border-radius:21rpx;background:#fff;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}.paper-tags{display:flex;gap:8rpx}.paper-tags text{padding:5rpx 11rpx;border-radius:7rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:19rpx;font-weight:700}.paper-title{display:block;margin-top:13rpx;color:var(--ink);font-size:28rpx;font-weight:730;line-height:1.5}.paper-meta{display:block;margin-top:6rpx;color:var(--text-muted);font-size:21rpx}.paper-actions{display:flex;gap:12rpx;margin-top:20rpx}.paper-actions button{flex:1;min-height:74rpx;margin:0;border-radius:13rpx;font-size:23rpx;font-weight:700}.paper-primary{background:var(--primary);color:#fff}.paper-secondary{background:var(--accent-soft);color:var(--accent-strong)}.paper-secondary.done{color:var(--text-muted);background:var(--surface-muted)}.load-more{min-height:82rpx;margin:22rpx 0;border-radius:15rpx;background:#fff;color:var(--accent-strong);font-size:24rpx}.privacy-note{padding:24rpx 12rpx;color:var(--text-muted);font-size:20rpx;line-height:1.6;text-align:center}
</style>
