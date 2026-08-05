<template>
  <view class="page page-bottom-safe review-page">
    <view class="review-hero">
      <view class="hero-code">WM</view>
      <text class="hero-kicker">MASTERY REVIEW DESK</text>
      <text class="hero-title">攻坚战批阅</text>
      <text class="hero-sub">同屏核对题目、标准解法和学生过程</text>
    </view>

    <view class="tabs">
      <button v-for="tab in tabs" :key="tab.value" :class="{ active: status === tab.value }" @tap="selectStatus(tab.value)">{{ tab.label }}</button>
    </view>
    <text v-if="totalCount > items.length" class="queue-note">共 {{ totalCount }} 份，当前显示前 {{ items.length }} 份；批阅后会自动补入后续提交。</text>

    <pp-state v-if="loading && !items.length" type="loading" title="正在读取攻坚提交" />
    <pp-state v-else-if="error" type="error" title="提交加载失败" :description="error" action-text="重试" @action="load" />
    <pp-state v-else-if="!items.length" title="当前没有待批阅攻坚题" description="学生提交后会出现在这里。" />

    <view v-for="item in items" :key="item.submission.id" class="review-card">
      <view class="student-row">
        <view class="student-badge">{{ item.student_name?.slice(0, 1) || '学' }}</view>
        <view class="student-copy">
          <text class="student-name">{{ item.student_name }}</text>
          <text class="student-meta">{{ item.class_name || '未分班' }} · 第 {{ item.stage }} 关 · 第 {{ item.submission.attempt_no }} 次提交</text>
        </view>
        <text :class="['review-status', item.submission.status]">{{ item.submission.status === 'reviewed' ? '已批阅' : '待批阅' }}</text>
      </view>

      <view class="question-heading">
        <view><text class="question-stage">{{ Number(item.stage) === 2 ? '难度升级 · 偏难' : '方法熟练 · 适中' }}</text><text class="question-title">{{ item.question?.title || item.title }}</text></view>
        <text class="cycle">{{ shortDate(item.cycle_start) }}</text>
      </view>
      <pp-problem-sheet class="question-sheet" :render="item.question?.render || item.render" />

      <button class="answer-toggle" @tap="toggleAnswer(item.id)">
        {{ openedAnswer === item.id ? '收起标准解法' : '展开标准解法' }}
      </button>
      <view v-if="openedAnswer === item.id" class="answer-panel">
        <text class="answer-kicker">STANDARD SOLUTION</text>
        <pp-problem-sheet v-if="item.question?.solution?.sections" :render="item.question.solution" />
        <pp-math-text v-else class="answer-text" :value="item.question?.solution?.text || item.question?.answer?.text || '暂未录入标准解法'" />
        <text v-if="item.question?.source?.note" class="verification">复核：{{ item.question.source.note }}</text>
      </view>

      <scroll-view scroll-x class="photos">
        <view class="photo-row">
          <image v-for="(photo, index) in item.localPhotos" :key="photo" :src="photo" mode="aspectFill" @tap="preview(item.localPhotos, index)" />
        </view>
      </scroll-view>
      <view v-if="!canReviewItem(item)" class="photo-error" role="alert">
        <text>作答照片未完整加载，已暂停批阅，避免误判。</text>
        <button @tap="load">重新加载照片</button>
      </view>
      <view v-if="item.submission.student_note" class="student-note"><text>学生说明</text><text>{{ item.submission.student_note }}</text></view>

      <textarea v-model="item.note" class="teacher-note" maxlength="500" placeholder="给家长的批阅说明（可选）" />
      <view v-if="item.submission.status === 'submitted'" class="review-actions">
        <button class="wrong" :disabled="savingId === item.submission.id || !canReviewItem(item)" @tap="review(item, false)">需要订正</button>
        <button class="correct" :disabled="savingId === item.submission.id || !canReviewItem(item)" @tap="review(item, true)">{{ Number(item.stage) === 1 ? '通过并解锁升级' : '双关通关' }}</button>
      </view>
      <view v-else class="reviewed-note">
        <text>{{ item.submission.is_correct ? '已判定通过' : '已打回订正' }}</text>
        <text v-if="item.submission.teacher_note">{{ item.submission.teacher_note }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';

const status = ref('submitted');
const loading = ref(false);
const error = ref('');
const items = ref([]);
const totalCount = ref(0);
const savingId = ref(0);
const openedAnswer = ref(0);
const tabs = [
  { value:'submitted', label:'待批阅' },
  { value:'reviewed', label:'已批阅' },
  { value:'all', label:'全部' },
];
let loadRevision = 0;

onShow(load);
onPullDownRefresh(async () => { try { await load(); } finally { uni.stopPullDownRefresh(); } });

function shortDate(value) {
  const parts = String(value || '').split('-');
  return parts.length === 3 ? `${Number(parts[1])}.${Number(parts[2])}` : String(value || '');
}
function selectStatus(value) { if (status.value === value) return; status.value = value; items.value = []; totalCount.value = 0; error.value = ''; load(); }
function toggleAnswer(id) { openedAnswer.value = openedAnswer.value === id ? 0 : id; }
function preview(urls, index) { uni.previewImage({ urls, current:urls[index] }); }
function canReviewItem(item) {
  const expected = item.submission?.attachments?.length || 0;
  return expected > 0 && item.localPhotos?.length === expected;
}

async function load() {
  const revision = ++loadRevision;
  const requestedStatus = status.value;
  loading.value = true;
  error.value = '';
  try {
    const data = await api.get(`/weekend-mastery/teacher/submissions?status=${requestedStatus}&limit=30`);
    const loadedItems = await Promise.all((data.submissions || []).map(async (item) => ({
      ...item,
      note:item.submission?.teacher_note || '',
      localPhotos:await Promise.all((item.submission?.attachments || []).map((photo) => api.downloadPrivate(photo.url).catch(() => '')))
        .then((list) => list.filter(Boolean)),
    })));
    if (revision !== loadRevision || requestedStatus !== status.value) return;
    totalCount.value = Number(data.count || 0);
    items.value = loadedItems;
  } catch (requestError) {
    if (revision === loadRevision) error.value = requestError?.error || '加载失败';
  } finally {
    if (revision === loadRevision) loading.value = false;
  }
}

async function review(item, isCorrect) {
  if (savingId.value) return;
  if (!canReviewItem(item)) {
    uni.showToast({ title:'照片未完整加载，请先重试', icon:'none' });
    return;
  }
  savingId.value = Number(item.submission.id);
  try {
    const result = await api.put(`/weekend-mastery/teacher/submissions/${item.submission.id}/review`, {
      is_correct:isCorrect,
      teacher_note:item.note,
    });
    const title = isCorrect
      ? Number(item.stage) === 1 ? '第一关通过，已解锁升级' : '两关通过，海报已解锁'
      : '已通知家长订正';
    uni.showToast({ title, icon:isCorrect ? 'success' : 'none' });
    if (result?.poster_ready) openedAnswer.value = 0;
    await load();
  } catch (requestError) {
    uni.showToast({ title:requestError?.error || '保存失败', icon:'none' });
  } finally { savingId.value = 0; }
}
</script>

<style scoped>
.review-page{min-height:100vh;padding:0 24rpx 52rpx;background-color:#FFFDF0;background-image:linear-gradient(rgba(5,5,5,.03) 1rpx,transparent 1rpx);background-size:100% 48rpx;color:#050505}.review-hero{position:relative;margin:0 -24rpx 18rpx;padding:36rpx 30rpx 30rpx;overflow:hidden;border-bottom:9rpx solid #FFF48A;background:#050505;color:#FFFFFF}.hero-code{position:absolute;right:25rpx;top:19rpx;color:#99DEF4;font-size:92rpx;font-weight:950;line-height:1;opacity:.2}.hero-kicker,.hero-title,.hero-sub{position:relative;display:block}.hero-kicker{color:#FFF48A;font-size:17rpx;font-weight:900;letter-spacing:1rpx}.hero-title{margin-top:8rpx;font-size:42rpx;font-weight:900}.hero-sub{margin-top:7rpx;color:#D9E6EA;font-size:22rpx}.tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7rpx;margin-bottom:16rpx;padding:6rpx;border:1rpx solid rgba(5,5,5,.14);background:#FFFFFF}.tabs button{min-height:72rpx;background:transparent;color:#50545B;font-size:22rpx;font-weight:750}.tabs button.active{background:#050505;color:#FFF48A}.queue-note{display:block;margin:-4rpx 0 16rpx;padding:12rpx 15rpx;background:#FFFBE0;color:#50545B;font-size:19rpx;line-height:1.5}.review-card{margin-bottom:18rpx;padding:24rpx;border:1rpx solid rgba(5,5,5,.17);background:#FFFFFF;box-shadow:0 8rpx 22rpx rgba(5,5,5,.07);animation:card-in 300ms var(--ease-out) both}.student-row{display:flex;align-items:center;gap:11rpx}.student-badge{width:52rpx;height:52rpx;display:flex;align-items:center;justify-content:center;flex:none;background:#99DEF4;font-size:24rpx;font-weight:900}.student-copy{min-width:0;flex:1}.student-name,.student-meta{display:block}.student-name{font-size:28rpx;font-weight:850}.student-meta{margin-top:3rpx;color:#6B7078;font-size:19rpx}.review-status{flex:none;padding:7rpx 10rpx;background:#FFF48A;font-size:18rpx;font-weight:820}.review-status.reviewed{background:#E9F8F3;color:#15755F}.question-heading{display:flex;justify-content:space-between;gap:14rpx;margin-top:22rpx;padding-top:20rpx;border-top:2rpx solid #050505}.question-stage,.question-title{display:block}.question-stage{color:#0B789A;font-size:18rpx;font-weight:850}.question-title{margin-top:5rpx;font-size:29rpx;font-weight:860}.cycle{flex:none;color:#6B7078;font-size:19rpx}.question-sheet{margin-top:18rpx}.answer-toggle{width:100%;min-height:76rpx;margin-top:20rpx;border:2rpx solid #050505;background:#FFFBE0;color:#050505;font-size:22rpx;font-weight:820}.answer-panel{margin-top:10rpx;padding:20rpx;border-left:7rpx solid #99DEF4;background:#F7FCFE}.answer-kicker{display:block;margin-bottom:12rpx;color:#0B789A;font-size:16rpx;font-weight:900}.answer-text{font-size:25rpx;line-height:1.7}.verification{display:block;margin-top:14rpx;padding-top:12rpx;border-top:1rpx solid #DCE9ED;color:#50545B;font-size:19rpx;line-height:1.5}.photos{margin-top:18rpx;white-space:nowrap}.photo-row{display:flex;gap:9rpx}.photo-row image{width:214rpx;height:214rpx;flex:none;border:1rpx solid #DCE9ED;background:#F7FCFE}.photo-error{margin-top:12rpx;padding:16rpx;border:2rpx solid #E49BA9;background:#FFF0F3;color:#7D2F3E;font-size:20rpx;line-height:1.5}.photo-error button{min-height:68rpx;margin-top:10rpx;background:#B53A52;color:#FFFFFF;font-size:20rpx;font-weight:800}.student-note{margin-top:14rpx;padding:15rpx;border-left:6rpx solid #FFF48A;background:#FFFDF0}.student-note text{display:block;font-size:21rpx;line-height:1.55}.student-note text:first-child{font-size:18rpx;font-weight:820}.teacher-note{box-sizing:border-box;width:100%;min-height:126rpx;margin-top:16rpx;padding:15rpx;border:1rpx solid #DCE9ED;background:#F7FCFE;color:#050505;font-size:22rpx}.review-actions{display:grid;grid-template-columns:.9fr 1.1fr;gap:10rpx;margin-top:14rpx}.review-actions button{min-height:90rpx;font-size:22rpx;font-weight:850}.wrong{background:#FFF0F3;color:#B53A52}.correct{background:#0B789A;color:#FFFFFF}.reviewed-note{margin-top:14rpx;padding:15rpx;background:#F4F6F7}.reviewed-note text{display:block;font-size:20rpx}.reviewed-note text+text{margin-top:5rpx;color:#50545B}@keyframes card-in{from{transform:translateY(16rpx);opacity:0}to{transform:translateY(0);opacity:1}}@media(prefers-reduced-motion:reduce){.review-card{animation:none}}
</style>
