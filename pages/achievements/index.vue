<template>
  <view class="page page-bottom-safe achievement-page student-challenge-page">
    <view class="hero page-hero">
      <view class="hero-tab" aria-hidden="true"></view>
      <view class="hero-mark"><pp-icon name="trophy" :size="44" motion="shine" :delay="80" /></view>
      <text class="eyebrow">PANPAN · LEARNING NOTES</text>
      <text class="hero-title">学习成就海报</text>
      <text class="hero-sub">把真实努力装进一张校园成长卡，保存后再由你选择分享。</text>
      <view class="hero-privacy">
        <view class="privacy-dot" aria-hidden="true"></view>
        <text>只显示“姓＋同学”，不展示学校和班级</text>
      </view>
    </view>

    <view class="content-shell">
      <view v-if="loading" class="state-card">
        <pp-state type="loading" title="正在整理真实成就" description="正在读取孩子已经完成的学习记录。" />
      </view>
      <view v-else-if="error" class="state-card">
        <pp-state type="error" title="成就加载失败" :description="error" action-text="重新加载" @action="load" />
      </view>
      <view v-else-if="!items.length" class="state-card">
        <pp-state title="还没有可生成的成就" description="完成口算挑战、压轴通关或达到选择题里程碑后会自动出现。" />
      </view>

      <template v-else>
        <view class="privacy-strip" role="status" aria-live="polite">
          <view class="privacy-mark" aria-hidden="true">隐</view>
          <view class="privacy-copy">
            <text class="privacy-title">公开海报已做匿名处理</text>
            <text class="privacy-detail">{{ studentName }} · 不含学生照片、全名、学校、班级</text>
          </view>
        </view>

        <view class="section-heading">
          <view class="section-title-row">
            <view class="section-icon"><pp-icon name="target" :size="30" motion="pop" :delay="180" /></view>
            <view>
              <text class="section-kicker">01 / 选择内容</text>
              <text class="section-title">哪一次进步值得记录？</text>
            </view>
          </view>
          <text class="section-count">共 {{ items.length }} 项</text>
        </view>

        <view class="achievement-list">
          <button
            v-for="item in items"
            :key="item.id"
            :class="['achievement-card', `category-${item.category}`, { selected: selected?.id === item.id }]"
            :disabled="busy"
            :aria-pressed="selected?.id === item.id"
            :aria-label="`${categoryLabel(item.category)}，${item.headline}，${metricText(item)}`"
            @tap="select(item)"
          >
            <view class="card-accent" aria-hidden="true"></view>
            <view class="card-topline">
              <text class="category">{{ categoryLabel(item.category) }}</text>
              <view class="selected-mark" aria-hidden="true">{{ selected?.id === item.id ? '✓' : '' }}</view>
            </view>
            <text class="headline">{{ item.headline }}</text>
            <text class="meta">{{ metricText(item) }}</text>
            <text class="date">{{ dateText(item.achieved_at) }}</text>
          </button>
        </view>

        <view v-if="selected" class="workspace">
          <view class="workspace-head">
            <view class="section-title-row">
              <view class="section-icon"><pp-icon name="report" :size="30" motion="breathe" :delay="300" /></view>
              <view>
                <text class="section-kicker">02 / 生成与保存</text>
                <text class="workspace-title">制作高清成长卡</text>
              </view>
            </view>
            <view :class="['workspace-chip', `category-${selected.category}`]">{{ categoryLabel(selected.category) }}</view>
          </view>

          <view v-if="generating" class="operation-status is-busy" role="status" aria-live="polite">
            <view class="status-spinner" aria-hidden="true"></view>
            <view>
              <text class="status-title">正在生成海报</text>
              <text class="status-detail">正在准备小程序码与 1080 × 1440 高清图片…</text>
            </view>
          </view>
          <view v-else-if="saving" class="operation-status is-busy" role="status" aria-live="polite">
            <view class="status-spinner" aria-hidden="true"></view>
            <view>
              <text class="status-title">正在保存到相册</text>
              <text class="status-detail">请稍候，不要重复点击。</text>
            </view>
          </view>
          <view v-else-if="albumPermissionBlocked" class="operation-status is-permission" role="alert">
            <view class="status-badge" aria-hidden="true">!</view>
            <view class="status-copy">
              <text class="status-title">相册权限尚未开启</text>
              <text class="status-detail">请允许保存图片，返回后会自动重试。</text>
            </view>
            <button class="permission-action" @tap="openAlbumSettings">打开设置</button>
          </view>
          <view v-else-if="operationError" class="operation-status is-error" role="alert">
            <view class="status-badge" aria-hidden="true">!</view>
            <view class="status-copy">
              <text class="status-title">{{ lastFailedAction === 'save' ? '海报保存失败' : '海报生成失败' }}</text>
              <text class="status-detail">{{ operationError }}</text>
            </view>
            <button class="retry-action" @tap="retryOperation">重试</button>
          </view>
          <view v-else-if="posterPath" class="operation-status is-ready" role="status" aria-live="polite">
            <view class="status-badge" aria-hidden="true"><pp-icon name="check" :size="28" motion="pop" /></view>
            <view>
              <text class="status-title">高清海报已准备好</text>
              <text class="status-detail">可以先预览，确认后再保存到相册。</text>
            </view>
          </view>

          <button class="generate" :disabled="busy || !selected" @tap="generate">
            {{ generating ? '正在生成小程序码与海报…' : posterPath ? '重新生成海报' : '生成海报' }}
          </button>
          <view v-if="posterPath" class="secondary-actions">
            <button class="preview" :disabled="busy" @tap="preview">预览海报</button>
            <button class="save" :disabled="busy" @tap="save">{{ saving ? '保存中…' : '保存到相册' }}</button>
          </view>
          <text class="save-note">公开海报只使用真实学习数据。微信不能自动替你发朋友圈；保存后由你自行选择分享。</text>
        </view>
      </template>
    </view>

    <canvas canvas-id="achievementPosterCanvas" id="achievementPosterCanvas" class="poster-canvas" />
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { renderAchievementPoster, saveAchievementPoster, albumPermissionDenied } from '@/utils/achievement-poster';
import { logError } from '@/utils/ui';

const studentId = ref(0);
const requestedId = ref(0);
const studentName = ref('同学');
const items = ref([]);
const selected = ref(null);
const loading = ref(false);
const error = ref('');
const generating = ref(false);
const saving = ref(false);
const posterPath = ref('');
const operationError = ref('');
const lastFailedAction = ref('');
const albumPermissionBlocked = ref(false);
const busy = computed(() => generating.value || saving.value);

onLoad((query) => {
  studentId.value = Number(query.student_id || uni.getStorageSync('activeChildId') || 0);
  requestedId.value = Number(query.achievement_id || 0);
  load();
});

async function load() {
  if (loading.value) return;
  if (!studentId.value) {
    error.value = '未找到学生信息，请返回选择孩子后重试。';
    items.value = [];
    selected.value = null;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const data = await api.get(`/achievements?student_id=${studentId.value}`);
    studentName.value = data.student_name || '同学';
    items.value = data.achievements || [];
    selected.value = items.value.find((item) => item.id === requestedId.value) || items.value[0] || null;
    resetOperationState();
  } catch (loadError) {
    error.value = loadError?.error || '请检查网络后重试';
    logError('achievements.load', loadError);
  } finally {
    loading.value = false;
  }
}

function resetOperationState() {
  posterPath.value = '';
  operationError.value = '';
  lastFailedAction.value = '';
  albumPermissionBlocked.value = false;
}

function select(item) {
  if (busy.value || selected.value?.id === item.id) return;
  selected.value = item;
  resetOperationState();
}

function categoryLabel(value) {
  return value === 'choice' ? '选择刷题王' : value === 'mental' ? '口算王' : '压轴挑战';
}

function metricText(item) {
  if (item.category === 'mental') return `正确率 ${item.accuracy || 0}% · ${item.elapsed_seconds || 0} 秒 · ${item.score || 0} 分`;
  if (item.category === 'challenge') return `${item.source_label || '潘潘老师精选'} · 累计通关 ${item.passed_count || 1} 题`;
  return `完成 ${item.completed_count || 0} 题 · 正确 ${item.correct_count || 0} 题`;
}

function dateText(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN');
}

async function generate() {
  if (!selected.value || busy.value) return;
  generating.value = true;
  operationError.value = '';
  lastFailedAction.value = '';
  albumPermissionBlocked.value = false;
  try {
    const code = await api.downloadPrivate(`/api/achievements/${selected.value.id}/code?student_id=${studentId.value}`);
    const page = getCurrentInstance()?.proxy;
    posterPath.value = await renderAchievementPoster({ page, achievement: selected.value, codePath: code });
    try {
      await api.post(`/achievements/${selected.value.id}/seen`, { student_id: studentId.value });
    } catch (seenError) {
      logError('achievements.seen', seenError);
    }
    uni.showToast({ title: '海报已生成', icon: 'success' });
  } catch (generateError) {
    const message = generateError?.error || generateError?.message || '海报生成失败，请重试';
    operationError.value = message;
    lastFailedAction.value = 'generate';
    uni.showToast({ title: message, icon: 'none' });
    logError('achievements.generate', generateError);
  } finally {
    generating.value = false;
  }
}

function preview() {
  if (posterPath.value && !busy.value) {
    uni.previewImage({ current: posterPath.value, urls: [posterPath.value] });
  }
}

async function save() {
  if (!posterPath.value || busy.value) return;
  saving.value = true;
  operationError.value = '';
  lastFailedAction.value = '';
  albumPermissionBlocked.value = false;
  try {
    await saveAchievementPoster(posterPath.value);
    uni.showToast({ title: '已保存到相册', icon: 'success' });
  } catch (saveError) {
    lastFailedAction.value = 'save';
    if (albumPermissionDenied(saveError)) {
      albumPermissionBlocked.value = true;
      operationError.value = '请在微信设置中允许保存图片到相册。';
      uni.showModal({
        title: '需要相册权限',
        content: '请在设置中允许保存图片到相册，返回后会自动重试。',
        confirmText: '去设置',
        success: (result) => {
          if (result.confirm) openAlbumSettings();
        },
      });
    } else {
      operationError.value = saveError?.message || '保存失败，请检查网络后重试。';
      uni.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
    logError('achievements.save', saveError);
  } finally {
    saving.value = false;
  }
}

function openAlbumSettings() {
  if (typeof uni.openSetting !== 'function') {
    operationError.value = '当前微信版本无法打开设置，请在小程序设置中手动开启相册权限。';
    albumPermissionBlocked.value = true;
    return;
  }
  uni.openSetting({
    success: (settings) => {
      const allowed = settings?.authSetting?.['scope.writePhotosAlbum'] === true;
      if (!allowed) {
        operationError.value = '相册权限仍未开启，请允许保存图片后再试。';
        albumPermissionBlocked.value = true;
        return;
      }
      albumPermissionBlocked.value = false;
      operationError.value = '';
      save();
    },
    fail: (settingError) => {
      operationError.value = '设置打开失败，请稍后重试。';
      albumPermissionBlocked.value = true;
      logError('achievements.album-settings', settingError);
    },
  });
}

function retryOperation() {
  if (lastFailedAction.value === 'save' && posterPath.value) save();
  else generate();
}
</script>

<style scoped>
.achievement-page {
  min-height: 100vh;
  padding: 0 24rpx calc(64rpx + env(safe-area-inset-bottom));
  overflow-x: hidden;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(153, 222, 244, .028) 64rpx 65rpx
  );
}

.hero {
  position: relative;
  margin: 0 -24rpx;
  padding: 50rpx 36rpx 38rpx;
  overflow: hidden;
  border-bottom: 1rpx solid #DCE9ED;
  background:
    linear-gradient(rgba(153, 222, 244, .055) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(153, 222, 244, .055) 1rpx, transparent 1rpx),
    linear-gradient(150deg, #FFFFFF 0%, #EDF9FC 100%);
  background-size: 38rpx 38rpx, 38rpx 38rpx, auto;
  color: #050505;
}

.hero::after {
  content: '';
  position: absolute;
  right: 36rpx;
  bottom: 0;
  width: 118rpx;
  height: 8rpx;
  border: 0;
  border-radius: 0;
  background: #0B789A;
  pointer-events: none;
}

.hero-tab {
  position: absolute;
  top: 0;
  left: 36rpx;
  width: 106rpx;
  height: 12rpx;
  border-radius: 0 0 10rpx 10rpx;
  background: #0B789A;
}

.eyebrow,
.hero-title,
.hero-sub {
  position: relative;
  z-index: 1;
  display: block;
}

.eyebrow {
  color: #050505;
  font-size: 20rpx;
  font-weight: 760;
  letter-spacing: 0;
}

.hero-title {
  margin-top: 10rpx;
  color: #050505;
  font-size: 48rpx;
  font-weight: 850;
  line-height: 1.25;
  letter-spacing: 0;
}

.hero-sub {
  max-width: 580rpx;
  margin-top: 11rpx;
  color: #50545B;
  font-size: 24rpx;
  line-height: 1.65;
}

.hero-privacy {
  position: relative;
  z-index: 1;
  width: fit-content;
  max-width: 100%;
  min-height: 54rpx;
  margin-top: 20rpx;
  padding: 9rpx 16rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  box-sizing: border-box;
  border: 1rpx solid #DCE9ED;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, .82);
  color: #050505;
  font-size: 20rpx;
  font-weight: 650;
}

.privacy-dot {
  width: 12rpx;
  height: 12rpx;
  flex: none;
  border-radius: 50%;
  background: #0B789A;
  box-shadow: 0 0 0 6rpx rgba(153, 222, 244, .32);
}

.content-shell {
  padding-top: 24rpx;
}

.state-card {
  overflow: hidden;
  border-radius: 22rpx;
}

.privacy-strip {
  min-height: 116rpx;
  padding: 20rpx 22rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  box-sizing: border-box;
  border: 1rpx solid #DCE9ED;
  border-radius: 20rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 24rpx rgba(5, 5, 5, .06);
}

.privacy-mark {
  width: 62rpx;
  height: 62rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 18rpx;
  background: #EDF9FC;
  color: #050505;
  font-size: 23rpx;
  font-weight: 820;
}

.privacy-copy {
  min-width: 0;
  flex: 1;
}

.privacy-title,
.privacy-detail {
  display: block;
}

.privacy-title {
  color: #050505;
  font-size: 24rpx;
  font-weight: 750;
}

.privacy-detail {
  margin-top: 4rpx;
  color: #50545B;
  font-size: 21rpx;
  line-height: 1.55;
}

.section-heading {
  margin-top: 32rpx;
  padding: 0 4rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
}

.section-kicker,
.section-title,
.section-count,
.workspace-title {
  display: block;
}

.section-kicker {
  color: #0B789A;
  font-size: 19rpx;
  font-weight: 780;
  letter-spacing: 0;
}

.section-title {
  margin-top: 4rpx;
  color: #050505;
  font-size: 32rpx;
  font-weight: 820;
  line-height: 1.35;
}

.section-count {
  flex: none;
  color: #50545B;
  font-size: 21rpx;
}

.achievement-list {
  margin-top: 16rpx;
}

.achievement-card {
  --tone: #0B789A;
  --tone-soft: #EDF9FC;
  position: relative;
  width: 100%;
  min-height: 190rpx;
  margin: 14rpx 0 0;
  padding: 24rpx 24rpx 22rpx 34rpx;
  overflow: hidden;
  box-sizing: border-box;
  border: 2rpx solid #DCE9ED;
  border-radius: 22rpx;
  background:
    linear-gradient(rgba(153, 222, 244, .035) 1rpx, transparent 1rpx),
    #FFFFFF;
  background-size: 100% 36rpx;
  color: #050505;
  text-align: left;
  box-shadow: 0 8rpx 24rpx rgba(5, 5, 5, .055);
  transition: transform 120ms ease, opacity 120ms ease;
}

.achievement-card::after {
  border: 0;
}

.achievement-card.category-choice,
.workspace-chip.category-choice {
  --tone: #0B789A;
  --tone-soft: #EDF9FC;
}

.achievement-card.category-mental,
.workspace-chip.category-mental {
  --tone: #050505;
  --tone-soft: #EDF9FC;
}

.achievement-card.category-challenge,
.workspace-chip.category-challenge {
  --tone: #B53A52;
  --tone-soft: #FFF0F6;
}

.achievement-card:active {
  transform: scale(.982);
}

.achievement-card.selected {
  border-color: var(--tone);
  box-shadow: 0 13rpx 32rpx rgba(5, 5, 5, .1);
}

.achievement-card[disabled] {
  opacity: .6;
}

.card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 10rpx;
  background: var(--tone);
}

.card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.category,
.workspace-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: var(--tone-soft);
  color: var(--tone);
  font-weight: 760;
}

.category {
  min-height: 42rpx;
  padding: 4rpx 14rpx;
  font-size: 19rpx;
}

.selected-mark {
  width: 42rpx;
  height: 42rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 2rpx solid #DCE9ED;
  border-radius: 50%;
  background: #FFFFFF;
  color: #FFFFFF;
  font-size: 23rpx;
  font-weight: 850;
}

.selected .selected-mark {
  border-color: var(--tone);
  background: var(--tone);
}

.headline,
.meta,
.date {
  display: block;
}

.headline {
  margin-top: 13rpx;
  color: #050505;
  font-size: 30rpx;
  font-weight: 810;
  line-height: 1.42;
}

.meta {
  margin-top: 7rpx;
  color: #50545B;
  font-size: 23rpx;
  line-height: 1.55;
}

.date {
  margin-top: 9rpx;
  color: #50545B;
  font-size: 19rpx;
}

.workspace {
  margin-top: 26rpx;
  padding: 28rpx 24rpx 24rpx;
  box-sizing: border-box;
  border: 1rpx solid #DCE9ED;
  border-radius: 26rpx;
  background: #FFFFFF;
  box-shadow: 0 16rpx 42rpx rgba(5, 5, 5, .08);
}

.workspace-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx dashed #DCE9ED;
}

.workspace-title {
  margin-top: 4rpx;
  color: #050505;
  font-size: 31rpx;
  font-weight: 820;
}

.workspace-chip {
  --tone: #0B789A;
  --tone-soft: #EDF9FC;
  min-height: 48rpx;
  padding: 5rpx 15rpx;
  flex: none;
  font-size: 19rpx;
}

.operation-status {
  min-height: 116rpx;
  margin-top: 20rpx;
  padding: 18rpx 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  box-sizing: border-box;
  border: 1rpx solid #DCE9ED;
  border-radius: 18rpx;
  background: #F7FCFE;
}

.operation-status.is-error,
.operation-status.is-permission {
  border-color: #F1D4CF;
  background: #FFF8F7;
}

.operation-status.is-ready {
  border-color: #DDEEFF;
  background: #F7FCFA;
}

.status-spinner {
  width: 42rpx;
  height: 42rpx;
  flex: none;
  box-sizing: border-box;
  border: 4rpx solid rgba(153, 222, 244, .18);
  border-top-color: #0B789A;
  border-radius: 50%;
  animation: achievement-spin .75s linear infinite;
}

.status-badge {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 15rpx;
  background: #FFF0F6;
  color: #B53A52;
  font-size: 26rpx;
  font-weight: 850;
}

.is-ready .status-badge {
  background: #EDF9FC;
  color: #050505;
}

.status-copy {
  min-width: 0;
  flex: 1;
}

.status-title,
.status-detail {
  display: block;
}

.status-title {
  color: #050505;
  font-size: 24rpx;
  font-weight: 750;
}

.status-detail {
  margin-top: 3rpx;
  color: #50545B;
  font-size: 20rpx;
  line-height: 1.5;
}

.permission-action,
.retry-action {
  min-width: 144rpx;
  min-height: 112rpx;
  margin: -16rpx -14rpx -16rpx 0;
  padding: 12rpx 20rpx;
  flex: none;
  border-radius: 14rpx;
  background: #B53A52;
  color: #FFFFFF;
  font-size: 22rpx;
  font-weight: 740;
}

.permission-action::after,
.retry-action::after {
  border: 0;
}

.generate,
.preview,
.save {
  min-height: 112rpx;
  margin: 16rpx 0 0;
  padding: 18rpx 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 16rpx;
  font-size: 27rpx;
  font-weight: 760;
  line-height: 1.35;
  transition: transform 120ms ease, opacity 120ms ease;
}

.generate::after,
.preview::after,
.save::after {
  border: 0;
}

.generate {
  background: #050505;
  color: #FFFFFF;
  box-shadow: 0 10rpx 24rpx rgba(5, 5, 5, .18);
}

.secondary-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
}

.preview {
  border: 1rpx solid #CADCF2;
  background: #EDF9FC;
  color: #050505;
}

.save {
  background: #0B789A;
  color: #FFFFFF;
}

.generate:active,
.preview:active,
.save:active,
.permission-action:active,
.retry-action:active {
  transform: scale(.975);
}

.generate[disabled],
.preview[disabled],
.save[disabled] {
  background: #DCE9ED;
  color: #FFFFFF;
  box-shadow: none;
  opacity: .74;
}

.save-note {
  display: block;
  margin-top: 17rpx;
  padding-top: 17rpx;
  border-top: 1rpx dashed #DCE9ED;
  color: #50545B;
  font-size: 20rpx;
  line-height: 1.62;
}

.poster-canvas {
  position: fixed;
  left: -2000px;
  top: 0;
  width: 750px;
  height: 1000px;
  pointer-events: none;
}

@keyframes achievement-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .achievement-card,
  .generate,
  .preview,
  .save,
  .permission-action,
  .retry-action {
    transition: none;
  }

  .achievement-card:active,
  .generate:active,
  .preview:active,
  .save:active,
  .permission-action:active,
  .retry-action:active {
    transform: none;
  }

  .status-spinner {
    animation: none;
  }
}

/* Student challenge theme v3: achievement studio in warm paper and teaching green. */
.student-challenge-page {
  --page-bg: #F7FCFE;
  --surface: #FFFFFF;
  --surface-muted: #FBFDFE;
  --ink: #050505;
  --text-secondary: #50545B;
  --text-muted: #6B7078;
  --primary: #0B789A;
  --primary-strong: #050505;
  --primary-soft: #E5F8FE;
  --coral: #F79BC0;
  --coral-soft: #FFF0F6;
  --danger: #B53A52;
  --border: #DCE9ED;
  min-height: 100vh;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(0deg, transparent 0 55rpx, rgba(153, 222, 244, .05) 56rpx 57rpx);
  color: var(--ink);
}
.student-challenge-page .hero {
  min-height: 0;
  padding: 34rpx 30rpx 28rpx;
  border: 0;
  border-bottom: 6rpx solid var(--brand-sky);
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}
.student-challenge-page .hero::after { background: var(--primary); }
.student-challenge-page .eyebrow,
.student-challenge-page .section-kicker,
.student-challenge-page .workspace-chip { color: var(--primary-strong); }
.student-challenge-page .hero-title,
.student-challenge-page .section-title,
.student-challenge-page .workspace-title,
.student-challenge-page .headline { color: var(--ink); }
.student-challenge-page .hero-sub,
.student-challenge-page .meta,
.student-challenge-page .date,
.student-challenge-page .status-copy,
.student-challenge-page .status-detail { color: var(--text-secondary); }
.student-challenge-page .hero-tab,
.student-challenge-page .workspace,
.student-challenge-page .achievement-card,
.student-challenge-page .state-card,
.student-challenge-page .operation-status,
.student-challenge-page .privacy-strip {
  min-height: 0;
  border-color: var(--border);
  border-radius: 16rpx;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 6rpx 18rpx rgba(5, 5, 5, .06);
}
.student-challenge-page .achievement-list,
.student-challenge-page .secondary-actions { align-items: start; }
.student-challenge-page .card-accent,
.student-challenge-page .selected-mark,
.student-challenge-page .is-ready .status-badge {
  background: var(--primary);
  color: #FFFFFF;
}
.student-challenge-page .category,
.student-challenge-page .status-badge,
.student-challenge-page .privacy-mark {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.student-challenge-page .generate,
.student-challenge-page .save {
  min-height: 88rpx;
  border-radius: 14rpx;
  background: var(--primary);
  color: #FFFFFF;
}
.student-challenge-page .preview,
.student-challenge-page .retry-action,
.student-challenge-page .permission-action {
  min-height: 80rpx;
  border-radius: 14rpx;
  border-color: var(--border);
  background: var(--surface-muted);
  color: var(--primary-strong);
}

.student-challenge-page .hero {
  position: relative;
}

.student-challenge-page .hero-mark {
  position: absolute;
  top: 24rpx;
  right: 28rpx;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #FCEEEB;
  border-radius: 14rpx;
  background: var(--coral-soft);
}

.student-challenge-page .section-title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.student-challenge-page .section-icon {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1rpx solid #CADCF2;
  border-radius: 12rpx;
  background: var(--primary-soft);
}
</style>
