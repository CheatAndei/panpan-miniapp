<template>
  <view class="page page-bottom-safe">
    <view class="hero">
      <text class="eyebrow">SUBMISSION ARCHIVE</text>
      <text class="hero-title">{{ student.name || '学生' }}的提交档案</text>
      <text class="hero-sub">{{ student.class_name || '学习记录' }} · 按时间查阅全部学习提交</text>
      <view class="hero-counts">
        <view><text class="count-number num">{{ submissionCount }}</text><text>学习提交</text></view>
        <view><text class="count-number num">{{ reportCount }}</text><text>题目报错</text></view>
      </view>
    </view>

    <view class="tabs" role="tablist" aria-label="提交档案分类">
      <button :class="{active:kind==='submissions'}" @tap="switchKind('submissions')">学习提交</button>
      <button :class="{active:kind==='reports'}" @tap="switchKind('reports')">题目报错</button>
    </view>

    <view v-if="loading && !items.length" class="state-card"><pp-state type="loading" title="正在整理提交档案" /></view>
    <view v-else-if="error && !items.length" class="state-card"><pp-state type="error" title="提交档案加载失败" :description="error" action-text="重新加载" @action="refresh" /></view>
    <view v-else-if="!items.length" class="state-card"><pp-state :title="kind==='reports'?'没有题目报错记录':'还没有学习提交'" description="学生完成并提交后会按时间保存在这里。" /></view>

    <view v-else class="timeline">
      <view v-for="item in items" :key="`${item.source_type}-${item.source_id}`" class="timeline-item">
        <view class="timeline-rail"><view class="timeline-dot"><pp-icon :name="sourceIcon(item.source_type)" :size="26" decorative /></view></view>
        <button :class="['archive-card',{clickable:item.route}]" @tap="openItem(item)">
          <view class="archive-head">
            <view class="archive-copy"><text class="archive-title">{{ item.title }}</text><text class="archive-sub">{{ item.subtitle }}</text></view>
            <text :class="['status-tag',statusTone(item)]">{{ statusLabel(item) }}</text>
          </view>
          <view class="archive-meta">
            <text>{{ formatTime(item.occurred_at) }}</text>
            <text v-if="kind==='submissions' && item.question_count">{{ scoreLabel(item) }}</text>
            <text v-if="item.photo_count">{{ item.photo_count }} 张照片</text>
          </view>
          <text v-if="item.detail" class="archive-detail">{{ item.detail }}</text>
          <view v-if="item.route" class="archive-link"><text>查看完整记录</text><pp-icon name="arrow" :size="25" decorative /></view>
        </button>
      </view>
    </view>

    <button v-if="hasMore" class="load-more" :disabled="loadingMore" @tap="loadMore">{{ loadingMore ? '加载中…' : '继续加载' }}</button>
    <text v-else-if="items.length" class="list-end">已显示全部 {{ total }} 条记录</text>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const studentId=ref(0),student=ref({}),kind=ref('submissions'),items=ref([]);
const page=ref(1),total=ref(0),submissionCount=ref(0),reportCount=ref(0),hasMore=ref(false);
const loading=ref(false),loadingMore=ref(false),error=ref('');

onLoad((query)=>{studentId.value=Number(query?.student_id||0);refresh();});
onPullDownRefresh(async()=>{try{await refresh();}finally{uni.stopPullDownRefresh();}});
onReachBottom(()=>{if(hasMore.value)loadMore();});

async function requestPage(targetPage){
  return api.get(`/students/${studentId.value}/submissions?type=${kind.value}&page=${targetPage}&limit=20`);
}
async function refresh(){
  if(!studentId.value||loading.value)return;
  loading.value=true;error.value='';
  try{const result=await requestPage(1);student.value=result.student||{};items.value=result.items||[];page.value=1;total.value=Number(result.total||0);submissionCount.value=Number(result.submission_count||0);reportCount.value=Number(result.report_count||0);hasMore.value=Boolean(result.has_more);}
  catch(requestError){error.value=requestError?.error||'请检查网络后重试';logError('studentSubmissions.refresh',requestError);}
  finally{loading.value=false;}
}
async function loadMore(){
  if(!hasMore.value||loadingMore.value)return;
  loadingMore.value=true;
  try{const next=page.value+1;const result=await requestPage(next);items.value.push(...(result.items||[]));page.value=next;total.value=Number(result.total||total.value);hasMore.value=Boolean(result.has_more);}
  catch(requestError){uni.showToast({title:requestError?.error||'加载失败',icon:'none'});}
  finally{loadingMore.value=false;}
}
function switchKind(value){if(kind.value===value||loading.value)return;kind.value=value;items.value=[];page.value=1;refresh();}
function openItem(item){if(item.route)uni.navigateTo({url:item.route});}
function sourceIcon(source){return {homework:'document',practice:'clipboard',challenge:'trophy',weekend_mastery:'target',choice:'check',mental:'calculator',learning:'book',knowledge:'lightbulb',choice_report:'report',calculation_report:'report'}[source]||'history';}
function statusLabel(item){const value=String(item.status||'').toLowerCase();if(['reviewed','confirmed','completed','resolved'].includes(value))return value==='resolved'?'已处理':'已完成';if(value==='dismissed')return '已忽略';if(['correction_required','reviewed_wrong'].includes(value))return '待订正';if(['submitted','open'].includes(value))return value==='open'?'待处理':'待批阅';return '已提交';}
function statusTone(item){const label=statusLabel(item);return label.includes('待')?'pending':label==='已忽略'?'muted':'done';}
function scoreLabel(item){return statusTone(item)==='done'?`${item.correct_count}/${item.question_count} 题`:`${item.question_count} 题`;}
function formatTime(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value||'');const pad=(n)=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx 52rpx;box-sizing:border-box;background-color:#F7FCFE;background-image:repeating-linear-gradient(0deg,transparent 0 63rpx,rgba(153,222,244,.035) 64rpx 65rpx);color:#050505}.hero{position:relative;margin:0 -24rpx;padding:34rpx 32rpx 28rpx 40rpx;border-bottom:1rpx solid #DCE9ED;border-left:8rpx solid #0B789A;background:#fff}.hero::after{position:absolute;top:0;right:32rpx;width:112rpx;height:8rpx;background:#F79BC0;content:""}.eyebrow{display:block;font-size:18rpx;font-weight:780}.hero-title{display:block;margin-top:8rpx;font-size:40rpx;font-weight:840;line-height:1.3}.hero-sub{display:block;margin-top:7rpx;color:#50545B;font-size:22rpx}.hero-counts{display:grid;grid-template-columns:1fr 1fr;gap:8rpx;margin-top:22rpx}.hero-counts>view{display:flex;align-items:baseline;gap:8rpx;padding:13rpx 15rpx;border-radius:10rpx;background:#F8FCFD;color:#6B7078;font-size:19rpx}.hero-counts>view:last-child{background:#FFF0F6}.count-number{color:#050505;font-size:32rpx;font-weight:850}.tabs{display:grid;grid-template-columns:1fr 1fr;gap:6rpx;margin-top:18rpx;padding:6rpx;border:1rpx solid #DCE9ED;border-radius:14rpx;background:#FBFDFE}.tabs button{height:68rpx;min-height:0;margin:0;border-radius:10rpx;background:transparent;color:#50545B;font-size:23rpx}.tabs button::after,.archive-card::after,.load-more::after{border:0}.tabs button.active{background:#0B789A;color:#fff}.state-card{margin-top:18rpx;border:1rpx solid #DCE9ED;border-radius:14rpx;background:#fff}.timeline{margin-top:22rpx}.timeline-item{display:grid;grid-template-columns:54rpx minmax(0,1fr)}.timeline-rail{position:relative;display:flex;justify-content:center}.timeline-rail::after{position:absolute;top:48rpx;bottom:-6rpx;width:2rpx;background:#CDE8F0;content:""}.timeline-item:last-child .timeline-rail::after{display:none}.timeline-dot{position:relative;z-index:1;width:42rpx;height:42rpx;display:flex;align-items:center;justify-content:center;border:1rpx solid #C7DDE4;border-radius:50%;background:#E5F8FE}.archive-card{width:100%;display:block;margin:0 0 14rpx;padding:18rpx;border:1rpx solid #DCE9ED;border-left:5rpx solid #0B789A;border-radius:13rpx;background:#fff;color:#050505;text-align:left;box-shadow:0 5rpx 15rpx rgba(5,5,5,.045)}.archive-card.clickable:active{transform:scale(.985)}.archive-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12rpx}.archive-copy{min-width:0;flex:1}.archive-title,.archive-sub{display:block}.archive-title{font-size:27rpx;font-weight:780}.archive-sub{margin-top:3rpx;overflow:hidden;color:#6B7078;font-size:19rpx;text-overflow:ellipsis;white-space:nowrap}.status-tag{flex:none;padding:5rpx 9rpx;border-radius:7rpx;font-size:18rpx;font-weight:720}.status-tag.pending{background:#FFF0F6;color:#B53A52}.status-tag.done{background:#E5F8FE;color:#050505}.status-tag.muted{background:#F1F3F4;color:#6B7078}.archive-meta{display:flex;flex-wrap:wrap;gap:8rpx 16rpx;margin-top:13rpx;padding-top:12rpx;border-top:1rpx solid #EDF3F5;color:#6B7078;font-size:18rpx}.archive-detail{display:block;margin-top:10rpx;padding:10rpx 12rpx;border-left:4rpx solid #F79BC0;background:#FFF7FB;color:#50545B;font-size:20rpx;line-height:1.5}.archive-link{display:flex;align-items:center;justify-content:flex-end;gap:4rpx;margin-top:11rpx;color:#0B789A;font-size:20rpx;font-weight:720}.load-more{width:100%;height:72rpx;min-height:0;margin-top:8rpx;border:1rpx solid #C7DDE4;border-radius:11rpx;background:#fff;color:#0B789A;font-size:22rpx}.list-end{display:block;padding:20rpx 0 4rpx;color:#939AA1;font-size:19rpx;text-align:center}@media(prefers-reduced-motion:reduce){.archive-card{transition:none}.archive-card.clickable:active{transform:none}}
</style>
