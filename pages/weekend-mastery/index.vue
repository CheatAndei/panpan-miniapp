<template>
  <view class="page page-bottom-safe mastery-page">
    <view class="mastery-hero">
      <view class="hero-grid" aria-hidden="true"></view>
      <view class="hero-route" aria-hidden="true"><view></view><view></view><view></view></view>
      <text class="hero-kicker">WEEKEND MASTERY</text>
      <text class="hero-title">周末攻坚战</text>
      <text class="hero-sub">同一方法，两级难度。先练熟，再升级。</text>
      <view v-if="campaign?.set" class="hero-topic">
        <text>本周主题</text>
        <text>{{ campaign.set.topic_title || campaign.set.title }}</text>
      </view>
    </view>

    <pp-state v-if="loading && !campaign" type="loading" title="正在布置本周战场" />
    <pp-state v-else-if="error && !campaign" type="error" title="攻坚战加载失败" :description="error" action-text="重试" @action="loadCurrent" />

    <view v-else-if="campaign && !campaign.eligible" class="empty-card">
      <view class="empty-mark"><pp-icon name="school" :size="40" motion="pop" /></view>
      <text class="empty-title">当前仅七年级开放</text>
      <text class="empty-copy">周末攻坚战首发内容按七年级进度编排，其他年级暂不显示。</text>
    </view>

    <view v-else-if="campaign && !campaign.available" class="empty-card">
      <view class="empty-mark"><pp-icon name="calendar" :size="40" motion="pop" /></view>
      <text class="empty-title">首战尚未开始</text>
      <text class="empty-copy">{{ campaign.message || nextCycleText }}</text>
      <text class="empty-note">周五 01:00 更新，每组题保留整整 7 天。</text>
    </view>

    <template v-else-if="campaign?.available">
      <view class="cycle-strip">
        <view>
          <text class="cycle-label">本期作战时间</text>
          <text class="cycle-date">{{ cycleText }}</text>
        </view>
        <text :class="['cycle-badge', { required: campaign.gate?.active }]">
          {{ campaign.gate?.active ? '周末必做' : '可继续订正' }}
        </text>
      </view>

      <view class="stage-map" aria-label="两关挑战进度">
        <view :class="['stage-node', stageClass(1)]">
          <view class="stage-index">1</view>
          <view><text class="stage-name">方法熟练</text><text class="stage-state">{{ stageStatusText(1) }}</text></view>
        </view>
        <view :class="['stage-bridge', { active: stagePassed(1) }]">
          <view class="bridge-line"></view><text>难度升级</text>
        </view>
        <view :class="['stage-node', stageClass(2)]">
          <view class="stage-index">2</view>
          <view><text class="stage-name">进阶攻坚</text><text class="stage-state">{{ stageStatusText(2) }}</text></view>
        </view>
      </view>

      <view v-if="!stageOne" class="brief-card surface-enter">
        <view class="brief-number">01</view>
        <text class="brief-kicker">READY FOR ACTION</text>
        <text class="brief-title">先把方法练到手</text>
        <text class="brief-copy">第一题难度适中，完整写出过程并拍照提交。老师判对后，第二关才会解锁。</text>
        <button class="primary-action" :disabled="busy" @tap="startCampaign">
          {{ busy ? '正在进入…' : '进入第一关' }}
        </button>
      </view>

      <view v-else-if="upgradeReady" class="upgrade-card surface-enter">
        <view class="upgrade-rays" aria-hidden="true"><view></view><view></view><view></view></view>
        <view class="upgrade-check"><pp-icon name="check" :size="42" motion="pop" /></view>
        <text class="upgrade-kicker">STAGE 01 CLEARED</text>
        <text class="upgrade-title">方法已经掌握</text>
        <text class="upgrade-copy">第二题沿用同一方法，但条件更绕、分类更多。准备好再进入。</text>
        <button class="upgrade-action" :disabled="busy" @tap="advanceCampaign">
          {{ busy ? '正在升级…' : '难度升级' }}
        </button>
      </view>

      <template v-if="currentAssignment">
        <view class="question-card surface-enter">
          <view class="question-head">
            <view>
              <text class="question-kicker">STAGE {{ String(currentAssignment.stage || 1).padStart(2, '0') }}</text>
              <text class="question-title">{{ questionTitle }}</text>
            </view>
            <text :class="['difficulty', `stage-${currentAssignment.stage || 1}`]">
              {{ Number(currentAssignment.stage) === 2 ? '偏难' : '适中' }}
            </text>
          </view>
          <pp-problem-sheet :render="questionRender" />
          <text v-if="questionSource" class="question-source">题型来源：{{ questionSource }}</text>
        </view>

        <view class="submission-card surface-enter">
          <view class="submission-head">
            <view><text class="submission-title">上传完整解题过程</text><text class="submission-copy">可上传 1–4 张，确认提交后老师才会收到。</text></view>
            <text v-if="photoCount" class="photo-count">{{ photoCountLabel }}</text>
          </view>

          <view v-if="localPhotos.length" class="photo-grid">
            <image v-for="(src, index) in localPhotos" :key="src" :src="src" mode="aspectFill" @tap="previewPhotos(index)" />
          </view>

          <view v-if="currentAssignment.status === 'reviewed_wrong'" class="correction-alert" role="alert">
            <text class="correction-title">这关还要订正</text>
            <text class="correction-copy">{{ currentAssignment.correction_note || currentSubmission?.teacher_note || '请检查过程中的关键步骤，修改后重新上传。' }}</text>
          </view>

          <view v-if="canEdit" class="submission-form">
            <button class="upload-action" :disabled="uploading || submitting || draftPhotoCount >= 4" @tap="chooseAndUpload">
              {{ uploading ? `正在暂存 ${uploadProgress}` : draftPhotoCount >= 4 ? '已上传 4 张' : draftPhotoCount ? '继续添加图片' : currentAssignment.status === 'reviewed_wrong' ? '重新拍照或选择图片' : '拍照或选择图片' }}
            </button>
            <textarea v-model="studentNote" class="student-note-input" maxlength="500" placeholder="补充说明（选填）" @input="markStudentNoteDirty" />
            <text v-if="draftPhotoCount" class="draft-tip">照片已安全暂存，点击“确认提交”才会进入老师批改台。</text>
            <button class="submit-action" :disabled="uploading || submitting || draftPhotoCount < 1" @tap="submitAnswer">
              {{ submitting ? '正在提交…' : '确认提交给老师' }}
            </button>
          </view>

          <view v-else-if="currentAssignment.status === 'submitted'" class="state-panel pending">
            <text class="state-title">已提交，等待老师批改</text>
            <text class="state-copy">{{ Number(currentAssignment.stage) === 2 ? '你已完成本周要求，现在可以进入压轴挑战。' : '第一关批对后会出现“难度升级”按钮。' }}</text>
            <button v-if="Number(currentAssignment.stage) === 2" class="terminal-action" @tap="openTerminal">进入压轴挑战</button>
          </view>

          <view v-else-if="currentAssignment.status === 'passed'" class="state-panel passed">
            <text class="state-title">本关通过</text>
            <text class="state-copy">老师已确认你的解题过程。</text>
          </view>

        </view>
      </template>

      <view v-if="campaign.poster_ready" class="complete-card surface-enter">
        <view class="complete-burst" aria-hidden="true">✦</view>
        <text class="complete-kicker">DOUBLE CLEAR</text>
        <text class="complete-title">两关全部通过</text>
        <text class="complete-copy">{{ campaign.student_name }}，你已经把本周方法练熟并完成升级。</text>
        <button class="poster-action" :disabled="posterGenerating" @tap="openPoster">
          {{ posterGenerating ? '正在生成…' : '生成专属通关海报' }}
        </button>
        <button class="terminal-action dark" @tap="openTerminal">继续压轴挑战</button>
      </view>
    </template>

    <view v-if="posterOpen" class="poster-mask" @tap="closePoster">
      <view class="poster-sheet" @tap.stop>
        <button class="poster-close" aria-label="关闭海报" @tap="closePoster">×</button>
        <text class="poster-sheet-kicker">PRIVATE VICTORY POSTER</text>
        <text class="poster-sheet-title">保存本周通关时刻</text>
        <text class="poster-sheet-copy">海报使用学生完整姓名，仅在本机生成，由家长自行保存。</text>
        <view v-if="posterGenerating" class="poster-loading"><pp-icon name="trophy" :size="72" motion="shine" /><text>正在绘制高清海报…</text></view>
        <view v-else-if="posterError" class="poster-error"><text>{{ posterError }}</text><button @tap="generatePoster">重新生成</button></view>
        <image v-else-if="posterPath" class="poster-preview" :src="posterPath" mode="widthFix" @tap="previewPoster" />
        <view v-if="posterPath" class="poster-actions">
          <button :disabled="posterSaving" @tap="savePoster">{{ posterSaving ? '保存中…' : '保存到相册' }}</button>
          <button @tap="previewPoster">查看大图</button>
        </view>
      </view>
    </view>

    <canvas canvas-id="weekendMasteryPosterCanvas" id="weekendMasteryPosterCanvas" class="poster-canvas" />
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, ref } from 'vue';
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import {
  albumPermissionDenied,
  renderWeekendMasteryPoster,
  saveWeekendMasteryPoster,
} from '@/utils/weekend-mastery-poster';

const pageInstance = getCurrentInstance()?.proxy;
const studentId = ref('');
const campaign = ref(null);
const loading = ref(false);
const error = ref('');
const busy = ref(false);
const uploading = ref(false);
const submitting = ref(false);
const uploadProgress = ref('');
const localPhotos = ref([]);
const studentNote = ref('');
const noteDirty = ref(false);
const noteAssignmentId = ref('');
const posterOpen = ref(false);
const posterGenerating = ref(false);
const posterSaving = ref(false);
const posterPath = ref('');
const posterError = ref('');
let loadedOnce = false;

const stages = computed(() => Array.isArray(campaign.value?.stages) ? campaign.value.stages : []);
const stageOne = computed(() => stages.value.find((item) => Number(item.stage) === 1) || null);
const stageTwo = computed(() => stages.value.find((item) => Number(item.stage) === 2) || null);
const currentAssignment = computed(() => campaign.value?.current_assignment || (
  [stageTwo.value, stageOne.value].find((item) => item && ['active', 'submitted', 'reviewed_wrong'].includes(item.status)) || null
));
const currentSubmission = computed(() => currentAssignment.value?.submission || null);
const photoCount = computed(() => currentSubmission.value?.attachments?.length || 0);
const draftPhotoCount = computed(() => currentSubmission.value?.status === 'draft' ? photoCount.value : 0);
const photoCountLabel = computed(() => (
  currentAssignment.value?.status === 'reviewed_wrong' && currentSubmission.value?.status !== 'draft'
    ? `上次 ${photoCount.value} 张`
    : `${photoCount.value} 张`
));
const canEdit = computed(() => ['active', 'reviewed_wrong'].includes(currentAssignment.value?.status));
const upgradeReady = computed(() => stageOne.value?.status === 'passed' && !stageTwo.value);
const question = computed(() => currentAssignment.value?.question || {});
const questionTitle = computed(() => question.value.title || currentAssignment.value?.title || `第 ${currentAssignment.value?.stage || 1} 关`);
const questionRender = computed(() => question.value.render || currentAssignment.value?.render || { sections: [] });
const questionSource = computed(() => question.value.source_label || currentAssignment.value?.source_label || '七年级同型题改编');
const cycleText = computed(() => campaign.value?.cycle_start && campaign.value?.cycle_end
  ? `${shortDate(campaign.value.cycle_start)}—${shortDate(campaign.value.cycle_end)}`
  : '周五 01:00 更新');
const nextCycleText = computed(() => campaign.value?.next_cycle_start
  ? `${shortDate(campaign.value.next_cycle_start)} 01:00 开启第一期攻坚战`
  : '下一期题组正在审核中');

onLoad((options) => { studentId.value = String(options?.student_id || ''); });
onShow(() => {
  if (!studentId.value || loading.value) return;
  if (!loadedOnce) loadedOnce = true;
  loadCurrent();
});
onPullDownRefresh(async () => { try { await loadCurrent(); } finally { uni.stopPullDownRefresh(); } });

function shortDate(value) {
  const parts = String(value || '').split('-');
  return parts.length === 3 ? `${Number(parts[1])}月${Number(parts[2])}日` : String(value || '');
}

function assignmentFor(stage) { return stages.value.find((item) => Number(item.stage) === Number(stage)); }
function stagePassed(stage) { return assignmentFor(stage)?.status === 'passed'; }
function stageClass(stage) {
  const assignment = assignmentFor(stage);
  if (!assignment) return stage === 1 ? 'ready' : 'locked';
  if (assignment.status === 'passed') return 'passed';
  if (assignment.status === 'reviewed_wrong') return 'correction';
  if (assignment.status === 'submitted') return 'pending';
  return 'active';
}
function stageStatusText(stage) {
  const assignment = assignmentFor(stage);
  if (!assignment) return stage === 1 ? '等待开始' : stagePassed(1) ? '可以升级' : '通过第一关后解锁';
  return ({ active:'进行中', submitted:'等待批改', reviewed_wrong:'需要订正', passed:'已通过' })[assignment.status] || '进行中';
}

async function loadCurrent() {
  if (!studentId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await api.get(`/weekend-mastery/current?student_id=${studentId.value}`);
    campaign.value = data;
    const latest = data.current_assignment?.submission || null;
    const nextAssignmentId = String(data.current_assignment?.id || '');
    if (nextAssignmentId !== noteAssignmentId.value) {
      noteAssignmentId.value = nextAssignmentId;
      noteDirty.value = false;
      studentNote.value = latest?.student_note || '';
    } else if (!noteDirty.value) {
      studentNote.value = latest?.student_note || '';
    }
    localPhotos.value = await Promise.all((latest?.attachments || []).map((item) => api.downloadPrivate(item.url).catch(() => '')))
      .then((items) => items.filter(Boolean));
    if (!data.poster_ready) {
      posterPath.value = '';
      posterOpen.value = false;
    }
  } catch (requestError) {
    error.value = requestError?.error || '请检查网络后重试';
  } finally {
    loading.value = false;
  }
}

async function startCampaign() {
  if (busy.value) return;
  busy.value = true;
  try {
    await api.post('/weekend-mastery/assignments', { student_id: studentId.value });
    await loadCurrent();
  } catch (requestError) {
    uni.showToast({ title: requestError?.error || '进入失败', icon: 'none' });
  } finally { busy.value = false; }
}

async function advanceCampaign() {
  if (!stageOne.value || busy.value) return;
  busy.value = true;
  try {
    await api.post(`/weekend-mastery/assignments/${stageOne.value.id}/advance`, {});
    await loadCurrent();
    uni.pageScrollTo({ scrollTop: 430, duration: 260 });
  } catch (requestError) {
    uni.showToast({ title: requestError?.error || '暂时无法升级', icon: 'none' });
  } finally { busy.value = false; }
}

function chooseImages() {
  return new Promise((resolve, reject) => {
    const count = Math.max(1, 4 - draftPhotoCount.value);
    if (uni.chooseMedia) {
      uni.chooseMedia({ count, mediaType:['image'], sourceType:['camera','album'],
        success: (result) => resolve((result.tempFiles || []).map((file) => file.tempFilePath)), fail: reject });
    } else {
      uni.chooseImage({ count, sourceType:['camera','album'], success: (result) => resolve(result.tempFilePaths || []), fail: reject });
    }
  });
}

async function chooseAndUpload() {
  if (!currentAssignment.value || uploading.value) return;
  try {
    const files = await chooseImages();
    if (!files.length) return;
    uploading.value = true;
    for (let index = 0; index < files.length; index += 1) {
      uploadProgress.value = `${index + 1}/${files.length}`;
      await api.upload(`/weekend-mastery/assignments/${currentAssignment.value.id}/upload?upload_complete=0`, files[index], 'image');
    }
    uni.showToast({ title:'图片已暂存', icon:'success' });
    await loadCurrent();
  } catch (requestError) {
    if (!/cancel/i.test(requestError?.errMsg || '')) uni.showToast({ title:requestError?.error || '上传失败', icon:'none' });
  } finally {
    uploading.value = false;
    uploadProgress.value = '';
  }
}

async function submitAnswer() {
  if (!currentAssignment.value || submitting.value || draftPhotoCount.value < 1) return;
  submitting.value = true;
  try {
    await api.post(`/weekend-mastery/assignments/${currentAssignment.value.id}/submit`, { student_note: studentNote.value.trim() });
    noteDirty.value = false;
    uni.showToast({ title:'已送达老师', icon:'success' });
    await loadCurrent();
  } catch (requestError) {
    uni.showToast({ title:requestError?.error || '提交失败', icon:'none' });
  } finally { submitting.value = false; }
}

function previewPhotos(index) { uni.previewImage({ urls:localPhotos.value, current:localPhotos.value[index] }); }
function markStudentNoteDirty() { noteDirty.value = true; }
function openTerminal() { uni.redirectTo({ url:`/pages/weekly-challenge/index?student_id=${studentId.value}&grade=g7` }); }

async function generatePoster() {
  if (!campaign.value?.poster_ready || posterGenerating.value) return;
  posterGenerating.value = true;
  posterError.value = '';
  try {
    await nextTick();
    posterPath.value = await renderWeekendMasteryPoster({
      page: pageInstance,
      studentName: campaign.value.student_name,
      periodStart: campaign.value.cycle_start,
      periodEnd: campaign.value.cycle_end,
      stages: stages.value.map((item) => ({ title:item.title || item.question?.title, difficulty:Number(item.stage) === 2 ? '偏难' : '适中' })),
    });
  } catch (posterFailure) {
    posterError.value = posterFailure?.message || posterFailure?.error || '海报生成失败，请重试';
  } finally { posterGenerating.value = false; }
}
function openPoster() { posterOpen.value = true; if (!posterPath.value) generatePoster(); }
function closePoster() { posterOpen.value = false; }
function previewPoster() { if (posterPath.value) uni.previewImage({ urls:[posterPath.value], current:posterPath.value }); }
async function savePoster() {
  if (!posterPath.value || posterSaving.value) return;
  posterSaving.value = true;
  try {
    await saveWeekendMasteryPoster(posterPath.value);
    uni.showToast({ title:'已保存到相册', icon:'success' });
  } catch (saveError) {
    if (albumPermissionDenied(saveError)) {
      uni.showModal({ title:'需要相册权限', content:'请在设置中允许保存到相册后重试。', confirmText:'去设置',
        success:(result) => result.confirm && uni.openSetting() });
    } else uni.showToast({ title:'保存失败，请重试', icon:'none' });
  } finally { posterSaving.value = false; }
}
</script>

<style scoped>
.mastery-page {
  min-height: 100vh;
  padding: 0 24rpx calc(56rpx + env(safe-area-inset-bottom));
  overflow-x: hidden;
  color: #050505;
  background-color: #FFFDF0;
  background-image: linear-gradient(rgba(5,5,5,.035) 1rpx, transparent 1rpx), linear-gradient(90deg, rgba(5,5,5,.035) 1rpx, transparent 1rpx);
  background-size: 44rpx 44rpx;
}
.mastery-hero { position: relative; min-height: 360rpx; margin: 0 -24rpx 22rpx; padding: 44rpx 32rpx 34rpx; overflow: hidden; border-bottom: 9rpx solid #FFF48A; background: #050505; color: #FFFFFF; animation: hero-in 420ms var(--ease-out) both; }
.hero-grid { position:absolute; inset:0; opacity:.12; background-image:linear-gradient(#99DEF4 1rpx,transparent 1rpx),linear-gradient(90deg,#99DEF4 1rpx,transparent 1rpx); background-size:42rpx 42rpx; transform:perspective(620rpx) rotateX(55deg) scale(1.25) translateY(82rpx); transform-origin:center bottom; }
.hero-route { position:absolute; right:25rpx; top:34rpx; width:198rpx; height:112rpx; }
.hero-route::before { position:absolute; left:20rpx; right:20rpx; top:49rpx; height:4rpx; background:#99DEF4; content:''; }
.hero-route view { position:absolute; top:36rpx; width:26rpx; height:26rpx; border:5rpx solid #99DEF4; border-radius:50%; background:#050505; }
.hero-route view:nth-child(1){left:6rpx}.hero-route view:nth-child(2){left:84rpx;border-color:#FFF48A}.hero-route view:nth-child(3){right:6rpx}
.hero-kicker,.hero-title,.hero-sub,.hero-topic { position:relative; z-index:1; display:block; }
.hero-kicker { color:#FFF48A; font-size:18rpx; font-weight:900; letter-spacing:2rpx; }
.hero-title { margin-top:12rpx; font-size:52rpx; font-weight:920; line-height:1.14; }
.hero-sub { margin-top:12rpx; color:#D9E6EA; font-size:23rpx; }
.hero-topic { display:flex; align-items:center; gap:12rpx; width:fit-content; max-width:100%; margin-top:28rpx; padding:12rpx 16rpx; border-left:6rpx solid #99DEF4; background:#191919; font-size:21rpx; }
.hero-topic text:first-child { color:#99DEF4; font-weight:800; }.hero-topic text:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cycle-strip,.stage-map,.brief-card,.question-card,.submission-card,.upgrade-card,.complete-card,.empty-card { border:1rpx solid rgba(5,5,5,.17); background:#FFFFFF; box-shadow:0 8rpx 22rpx rgba(5,5,5,.07); }
.cycle-strip { display:flex; align-items:center; justify-content:space-between; gap:14rpx; margin-bottom:16rpx; padding:18rpx 20rpx; }
.cycle-label,.cycle-date{display:block}.cycle-label{color:#6B7078;font-size:19rpx}.cycle-date{margin-top:3rpx;font-size:24rpx;font-weight:780}.cycle-badge{flex:none;padding:8rpx 12rpx;background:#E5F8FE;color:#0B789A;font-size:19rpx;font-weight:850}.cycle-badge.required{background:#FFF48A;color:#050505}
.stage-map { display:grid; grid-template-columns:1fr 108rpx 1fr; align-items:center; margin-bottom:18rpx; padding:20rpx; }
.stage-node{display:flex;align-items:center;gap:10rpx;min-width:0;opacity:.42}.stage-node.ready,.stage-node.active,.stage-node.pending,.stage-node.correction,.stage-node.passed{opacity:1}.stage-index{width:48rpx;height:48rpx;display:flex;align-items:center;justify-content:center;flex:none;border:3rpx solid #050505;background:#FFFFFF;font-size:22rpx;font-weight:900}.stage-node.active .stage-index{background:#99DEF4}.stage-node.pending .stage-index{background:#FFF48A}.stage-node.correction .stage-index{background:#FFF0F3;color:#B53A52}.stage-node.passed .stage-index{background:#050505;color:#FFF48A}.stage-name,.stage-state{display:block}.stage-name{font-size:21rpx;font-weight:820}.stage-state{margin-top:2rpx;color:#6B7078;font-size:17rpx;line-height:1.3}
.stage-bridge{text-align:center;color:#939AA1;font-size:16rpx;font-weight:760}.bridge-line{height:3rpx;margin-bottom:5rpx;background:#DCE9ED}.stage-bridge.active{color:#050505}.stage-bridge.active .bridge-line{background:#FFF48A;animation:bridge-fill 460ms var(--ease-out) both}
.surface-enter{animation:surface-in 360ms var(--ease-out) both}.brief-card,.upgrade-card,.complete-card,.empty-card{margin-bottom:18rpx;padding:34rpx 28rpx;text-align:center}.brief-number{color:#99DEF4;font-size:76rpx;font-weight:950;line-height:1}.brief-kicker,.upgrade-kicker,.complete-kicker{display:block;margin-top:10rpx;color:#0B789A;font-size:18rpx;font-weight:900;letter-spacing:1rpx}.brief-title,.upgrade-title,.complete-title,.empty-title{display:block;margin-top:8rpx;font-size:36rpx;font-weight:900}.brief-copy,.upgrade-copy,.complete-copy,.empty-copy,.empty-note{display:block;margin-top:9rpx;color:#50545B;font-size:22rpx;line-height:1.65}.primary-action,.upgrade-action,.poster-action{min-height:96rpx;margin-top:24rpx;background:#050505;color:#FFFFFF;font-size:27rpx;font-weight:860}.primary-action:active,.upgrade-action:active,.poster-action:active,.upload-action:active,.submit-action:active,.terminal-action:active{transform:scale(var(--tap-scale))}
.upgrade-card{position:relative;overflow:hidden;border-top:9rpx solid #FFF48A}.upgrade-check,.empty-mark{width:76rpx;height:76rpx;display:flex;align-items:center;justify-content:center;margin:0 auto;background:#FFF48A}.upgrade-rays{position:absolute;inset:0;pointer-events:none}.upgrade-rays>view{position:absolute;left:50%;top:8rpx;width:4rpx;height:50rpx;background:#99DEF4;transform-origin:center 150rpx;animation:ray-in 520ms var(--ease-out) both}.upgrade-rays>view:nth-child(1){transform:rotate(-42deg)}.upgrade-rays>view:nth-child(2){transform:rotate(0)}.upgrade-rays>view:nth-child(3){transform:rotate(42deg)}.upgrade-action{background:#FFF48A;color:#050505;box-shadow:7rpx 7rpx 0 #050505}
.question-card,.submission-card{margin-bottom:18rpx;padding:26rpx}.question-head,.submission-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx;margin-bottom:22rpx}.question-kicker{display:block;color:#0B789A;font-size:18rpx;font-weight:900}.question-title,.submission-title{display:block;margin-top:5rpx;font-size:31rpx;font-weight:880;line-height:1.35}.difficulty{flex:none;padding:8rpx 13rpx;background:#E5F8FE;font-size:20rpx;font-weight:850}.difficulty.stage-2{background:#050505;color:#FFF48A}.question-source{display:block;margin-top:24rpx;padding-top:14rpx;border-top:1rpx solid #EDF3F5;color:#6B7078;font-size:18rpx;line-height:1.5}.submission-copy{display:block;margin-top:5rpx;color:#50545B;font-size:20rpx;line-height:1.5}.photo-count{flex:none;padding:7rpx 11rpx;background:#FFFBE0;font-size:19rpx;font-weight:800}.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9rpx;margin-bottom:16rpx}.photo-grid image{width:100%;height:176rpx;border:1rpx solid #DCE9ED;background:#F7FCFE}.upload-action,.submit-action,.terminal-action{min-height:88rpx;margin-top:14rpx;font-size:24rpx;font-weight:820}.upload-action{border:2rpx solid #050505;background:#FFFFFF;color:#050505}.submit-action{background:#0B789A;color:#FFFFFF}.student-note-input{box-sizing:border-box;width:100%;min-height:132rpx;margin-top:14rpx;padding:16rpx;border:1rpx solid #DCE9ED;background:#F7FCFE;color:#050505;font-size:23rpx}.draft-tip{display:block;margin-top:10rpx;color:#6B7078;font-size:19rpx;line-height:1.5}.state-panel{margin-top:10rpx;padding:20rpx;border-left:7rpx solid #FFF48A;background:#FFFDF0}.state-panel.passed{border-color:#99DEF4;background:#F7FCFE}.state-title,.state-copy{display:block}.state-title{font-size:25rpx;font-weight:850}.state-copy{margin-top:6rpx;color:#50545B;font-size:21rpx;line-height:1.55}.terminal-action{width:100%;background:#FFF48A;color:#050505}.terminal-action.dark{background:#050505;color:#FFFFFF}.correction-alert{margin-top:16rpx;padding:20rpx;border:2rpx solid #E49BA9;background:#FFF0F3}.correction-title,.correction-copy{display:block}.correction-title{color:#B53A52;font-size:26rpx;font-weight:900}.correction-copy{margin-top:7rpx;color:#7D2F3E;font-size:22rpx;line-height:1.6}
.complete-card{position:relative;border:4rpx solid #050505;background:#FFF48A;box-shadow:9rpx 9rpx 0 #050505}.complete-burst{font-size:82rpx;line-height:1;animation:finish-pop 520ms var(--ease-out) both}.complete-kicker{color:#050505}.poster-action{background:#0B789A}.empty-card{margin-top:40rpx}.empty-note{font-size:19rpx}
.poster-mask{position:fixed;z-index:40;inset:0;display:flex;align-items:flex-end;background:rgba(5,5,5,.64)}.poster-sheet{position:relative;width:100%;max-height:92vh;padding:30rpx 24rpx calc(28rpx + env(safe-area-inset-bottom));overflow-y:auto;background:#FFFDF0;animation:sheet-in 300ms var(--ease-out) both}.poster-close{position:absolute;right:20rpx;top:18rpx;width:60rpx;height:60rpx;padding:0;background:#050505;color:#FFFFFF;font-size:38rpx}.poster-sheet-kicker,.poster-sheet-title,.poster-sheet-copy{display:block;padding-right:70rpx}.poster-sheet-kicker{color:#0B789A;font-size:17rpx;font-weight:900}.poster-sheet-title{margin-top:5rpx;font-size:34rpx;font-weight:900}.poster-sheet-copy{margin-top:7rpx;color:#50545B;font-size:20rpx;line-height:1.55}.poster-loading,.poster-error{min-height:480rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18rpx;text-align:center}.poster-preview{width:100%;display:block;margin-top:22rpx;border:2rpx solid #050505}.poster-actions{display:grid;grid-template-columns:1fr 1fr;gap:10rpx;margin-top:14rpx}.poster-actions button,.poster-error button{min-height:86rpx;background:#050505;color:#FFFFFF;font-size:23rpx;font-weight:800}.poster-actions button:first-child{background:#0B789A}.poster-canvas{position:fixed;left:-2200px;top:0;width:720px;height:960px;pointer-events:none}
@keyframes hero-in{from{transform:translateY(-20rpx);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes surface-in{from{transform:translateY(22rpx);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes bridge-fill{from{transform:scaleX(0);transform-origin:left}to{transform:scaleX(1);transform-origin:left}}@keyframes ray-in{from{opacity:0;transform:scaleY(.2)}to{opacity:1}}@keyframes finish-pop{from{transform:scale(.45) rotate(-20deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}@keyframes sheet-in{from{transform:translateY(34rpx);opacity:0}to{transform:translateY(0);opacity:1}}
@media(max-width:360px){.stage-map{grid-template-columns:1fr 68rpx 1fr;padding:14rpx}.stage-node{gap:6rpx}.stage-index{width:42rpx;height:42rpx}.stage-name{font-size:18rpx}.question-head,.submission-head{flex-direction:column}.difficulty,.photo-count{align-self:flex-start}}
@media(prefers-reduced-motion:reduce){.mastery-hero,.surface-enter,.upgrade-rays>view,.complete-burst,.poster-sheet,.stage-bridge.active .bridge-line{animation:none!important}.primary-action:active,.upgrade-action:active,.poster-action:active,.upload-action:active,.submit-action:active,.terminal-action:active{transform:none}}
</style>
