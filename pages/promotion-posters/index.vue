<template>
  <view class="studio-page">
    <view class="studio-hero">
      <view class="studio-icon"><pp-icon name="trophy" :size="34" motion="shine" /></view>
      <view class="studio-serial">PP / {{ String(promotions.length).padStart(2,'0') }}</view>
      <text class="studio-kicker">PANPAN PUBLICITY DESK</text>
      <text class="studio-title">把真实进步，<br/>做成值得分享的海报</text>
      <view class="studio-rule" />
      <text class="studio-copy">仅记录真实登顶和压轴通关。公开海报自动隐藏全名、学校与班级。</text>
    </view>

    <pp-state v-if="loading && promotions.length===0" type="loading" title="正在整理宣传素材" />
    <pp-state v-else-if="error && promotions.length===0" type="error" title="宣传素材加载失败" :description="error" action-text="重新加载" @action="loadPromotions" />

    <template v-else-if="promotions.length">
      <view class="event-section">
        <view class="section-heading">
          <view>
            <text class="section-kicker">真实事件档案</text>
            <text class="section-title">选择一张海报</text>
          </view>
          <text class="archive-count">{{ promotions.length }} 份</text>
        </view>
        <scroll-view scroll-x class="event-scroll" :show-scrollbar="false">
          <view class="event-track">
            <button
              v-for="item in promotions"
              :key="item.id"
              :class="['event-ticket',item.event_type,{active:selected&&selected.id===item.id}]"
              @tap="selectPromotion(item)"
            >
              <view class="ticket-index">{{ item.event_type==='mental_first' ? '01' : '√' }}</view>
              <view class="ticket-copy">
                <text class="ticket-type">{{ item.event_type==='mental_first' ? '本周新榜首' : '压轴已通关' }}</text>
                <text class="ticket-name">{{ item.student_name }}</text>
                <text class="ticket-date">{{ dateLabel(item.created_at) }}</text>
              </view>
              <text v-if="!item.seen" class="ticket-new">NEW</text>
            </button>
          </view>
        </scroll-view>
      </view>

      <view v-if="selected" class="poster-workspace">
        <view class="workspace-head">
          <view>
            <text class="workspace-label">POSTER PREVIEW</text>
            <text class="workspace-title">{{ selected.event_type==='mental_first' ? '本周口算王' : '压轴通关喜报' }}</text>
          </view>
          <view :class="['privacy-stamp',selected.event_type]">隐私已处理</view>
        </view>

        <view :class="['poster-preview',selected.event_type]">
          <template v-if="selected.event_type==='mental_first'">
            <view class="mental-grid" />
            <view class="poster-gold-spine" />
            <view class="poster-topline" />
            <text class="mental-en">PANPAN · MATH LEAGUE / WEEK 01</text>
            <text class="mental-cn">本周口算王</text>
            <view class="rank-badge">
              <text class="rank-number">01</text>
              <text class="rank-caption">CHAMPION</text>
            </view>
            <text class="battle-label">{{ selected.battle_label }}</text>
            <text class="mental-name">{{ selected.student_name }}</text>
            <text class="mental-proof">20 题快算 · 排名由真实成绩生成</text>
            <text class="mental-score">{{ selected.score }}</text>
            <text class="score-caption">SCORE / 本局得分</text>
            <view class="score-aside">
              <text class="score-aside-eyebrow">WEEKLY BEST</text>
              <text class="score-aside-title">本周榜首</text>
              <text class="score-aside-detail">{{ selected.correct_count }}/{{ selected.total_questions }} 全部答对</text>
            </view>
            <view class="mental-metrics">
              <view><text>正确率</text><text class="metric-strong">{{ selected.accuracy }}%</text></view>
              <view><text>答对</text><text class="metric-strong">{{ selected.correct_count }}/{{ selected.total_questions }}</text></view>
              <view><text>用时</text><text class="metric-strong">{{ selected.elapsed_seconds }}秒</text></view>
            </view>
            <view class="mental-motto">
              <text>把速度练成底气，每一次认真练习都算数</text>
            </view>
            <view class="poster-cta mental-cta">
              <view class="qr-shell"><image v-if="posterCodePath" :src="posterCodePath" mode="aspectFit"/><view v-else class="qr-placeholder"><view class="qr-corner c1"/><view class="qr-corner c2"/><view class="qr-corner c3"/><text>番</text></view></view>
              <view class="cta-copy"><text class="cta-title">扫码挑战本周榜首</text><text>20 道题 · 比正确，也比速度</text><text class="cta-brand">潘潘老师数学课堂</text></view>
            </view>
            <text class="poster-privacy mental-privacy">公开海报不展示全名、学校和班级</text>
          </template>

          <template v-else>
            <view class="challenge-grid" />
            <view class="challenge-head">
              <text>PANPAN · BREAKTHROUGH REPORT</text>
              <text class="challenge-head-title">压轴通关喜报</text>
            </view>
            <view class="challenge-spine" />
            <view class="solved-seal"><text>VERIFIED</text><text>通 关</text></view>
            <text class="challenge-type">{{ selected.question_type_label }}</text>
            <text class="challenge-name">{{ selected.student_name }}</text>
            <text class="challenge-proof">独立思考 · 完整作答 · 成功通关</text>
            <text class="challenge-headline">{{ selected.headline }}</text>
            <text class="question-title">{{ selected.question_title }}</text>
            <view class="challenge-question-media">
              <image v-if="questionImagePath" :src="questionImagePath" mode="aspectFill" />
              <view v-else class="question-image-placeholder">原题图片</view>
              <text>原题节选 · 放大展示</text>
            </view>
            <view class="challenge-data">
              <view class="passed-data"><text>累计通关</text><text class="passed-number">{{ selected.passed_count }}</text><text class="passed-unit">道压轴题</text></view>
              <view class="source-data"><text>题目来源</text><text class="source-name">{{ selected.source_label }}</text></view>
            </view>
            <view class="poster-cta challenge-cta">
              <view class="qr-shell"><image v-if="posterCodePath" :src="posterCodePath" mode="aspectFit"/><view v-else class="qr-placeholder"><view class="qr-corner c1"/><view class="qr-corner c2"/><view class="qr-corner c3"/><text>番</text></view></view>
              <view class="cta-copy"><text class="cta-title">扫码体验真实数学挑战</text><text>思路比答案更重要</text><text class="cta-brand">潘潘老师数学课堂</text></view>
            </view>
            <text class="poster-privacy challenge-privacy">公开海报不展示全名、学校和班级</text>
          </template>
        </view>

        <view v-if="generating" class="generation-strip"><view class="generation-line"/><text>正在生成高清分享图</text></view>
        <view v-else-if="posterError" class="generation-error">
          <text>{{ posterError }}</text><button @tap="generatePoster">重试生成</button>
        </view>
        <view v-else class="poster-ready">高清海报已就绪 · 1080 × 1440</view>

        <view class="poster-actions">
          <button class="save-action" :disabled="!posterFile||saving" @tap="savePoster">{{ saving ? '保存中…' : '保存到相册' }}</button>
          <button class="share-action" open-type="share" :disabled="!posterFile">微信分享</button>
        </view>
        <text class="share-tip">朋友圈请先保存到相册；微信好友可直接使用“微信分享”。</text>
      </view>
    </template>

    <view v-else-if="!loading" class="empty-archive">
      <text class="empty-index">00</text>
      <text class="empty-title">真实进步发生后，海报会出现在这里</text>
      <text class="empty-copy">学生首次成为本周口算榜首，或压轴挑战批改正确时，系统自动建立一份宣传素材。</text>
    </view>

    <canvas canvas-id="promotionPosterCanvas" id="promotionPosterCanvas" class="poster-canvas" />
  </view>
</template>

<script setup>
import { getCurrentInstance, nextTick, ref } from 'vue';
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError, toastError } from '@/utils/ui';
import { promotionPosterPermissionDenied, renderPromotionPoster, savePromotionPoster } from '@/utils/promotion-poster';

const promotions = ref([]);
const selected = ref(null);
const loading = ref(false);
const error = ref('');
const generating = ref(false);
const saving = ref(false);
const posterError = ref('');
const posterCodePath = ref('');
const questionImagePath = ref('');
const posterFile = ref('');
const requestedEventId = ref(0);
const previewMode = ref(false);
const instance = getCurrentInstance();

const previewPromotions = [
  { id:9001,event_type:'mental_first',student_name:'曾同学',battle_label:'初中战场',score:2099,accuracy:100,correct_count:20,total_questions:20,elapsed_seconds:57,seen:false,created_at:'2026-07-23T08:30:00Z' },
  { id:9002,event_type:'challenge_pass',student_name:'欧阳同学',question_type_label:'解答题',headline:'成功攻下一道压轴题',question_title:'二次函数与动点综合压轴挑战',source_label:'广州中考真题改编',passed_count:12,seen:true,created_at:'2026-07-22T11:20:00Z' },
];

onLoad((query) => {
  requestedEventId.value = Number(query.event_id || 0);
  previewMode.value = Boolean(import.meta.env.DEV && String(query.preview || '') === '1');
  if (previewMode.value) {
    promotions.value = previewPromotions;
    const type = String(query.type || 'mental');
    selected.value = type === 'challenge' ? previewPromotions[1] : previewPromotions[0];
    questionImagePath.value = String(query.question_image || '');
  }
});
onShow(() => { if (!previewMode.value) loadPromotions(); });
onShareAppMessage(() => ({
  title:selected.value?.event_type === 'mental_first'
    ? `${selected.value.student_name}成为本周口算王` : `${selected.value?.student_name || '同学'}成功攻下一道压轴题`,
  path:'/pages/guest-experience/index',
  imageUrl:posterFile.value || undefined,
}));

function dateLabel(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
}

async function loadPromotions() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await api.get('/promotions?limit=50');
    promotions.value = result.promotions || [];
    const target = promotions.value.find(item => Number(item.id) === requestedEventId.value)
      || promotions.value.find(item => !item.seen)
      || promotions.value[0]
      || null;
    if (target && (!selected.value || Number(selected.value.id) !== Number(target.id))) await selectPromotion(target);
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('promotionPosters.load', err);
  } finally {
    loading.value = false;
  }
}

async function selectPromotion(item) {
  selected.value = item;
  posterCodePath.value = '';
  questionImagePath.value = '';
  posterFile.value = '';
  posterError.value = '';
  if (previewMode.value) return;
  if (!item.seen) {
    api.post(`/promotions/${item.id}/seen`, {}).catch(err => logError('promotionPosters.seen', err));
    item.seen = true;
  }
  await generatePoster();
}

async function generatePoster() {
  if (!selected.value || generating.value || previewMode.value) return;
  generating.value = true;
  posterError.value = '';
  posterFile.value = '';
  try {
    const [codePath, questionPath] = await Promise.all([
      api.downloadPrivate(`/api/promotions/${selected.value.id}/code`),
      selected.value.event_type === 'challenge_pass' && selected.value.question_url
        ? api.downloadPrivate(selected.value.question_url)
        : Promise.resolve(''),
    ]);
    posterCodePath.value = codePath;
    questionImagePath.value = questionPath;
    await nextTick();
    posterFile.value = await renderPromotionPoster({
      page:instance?.proxy,
      promotion:selected.value,
      codePath:posterCodePath.value,
      questionImagePath:questionImagePath.value,
    });
  } catch (err) {
    posterError.value = err?.error || err?.message || '高清海报生成失败，请重试';
    logError('promotionPosters.generate', err);
  } finally {
    generating.value = false;
  }
}

async function savePoster() {
  if (!posterFile.value || saving.value) return;
  saving.value = true;
  try {
    await savePromotionPoster(posterFile.value);
    uni.showToast({ title:'已保存到相册', icon:'success' });
  } catch (err) {
    if (promotionPosterPermissionDenied(err)) {
      uni.showModal({
        title:'需要相册权限', content:'请在设置中允许保存图片到相册。', confirmText:'去设置',
        success:(result) => { if (result.confirm) uni.openSetting({}); },
      });
    } else toastError(err, '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
/* Light poster studio: bright Panpan math paper with energetic learning states. */
.studio-page {
  --panpan-green: #20B486;
  --panpan-green-strong: #15946D;
  --panpan-sprout: #20B486;
  --panpan-coral: #FF7468;
  --panpan-leaf: #15946D;
  --panpan-paper: #F8FCF9;
  --panpan-ink: #26352F;
  min-height: 100vh;
  padding: 0 24rpx calc(54rpx + env(safe-area-inset-bottom));
  overflow-x: hidden;
  background-color: var(--panpan-paper);
  background-image: repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(32, 180, 134, .045) 64rpx 65rpx);
  color: var(--panpan-ink);
}

.studio-page,
.studio-page text,
.studio-page button {
  letter-spacing: 0;
}

.studio-hero {
  position: relative;
  margin: 0 -24rpx;
  padding: 44rpx 34rpx 34rpx;
  box-sizing: border-box;
  overflow: hidden;
  border: 1rpx solid #CFE6D8;
  border-top: 8rpx solid var(--panpan-sprout);
  border-left: 7rpx solid var(--panpan-green);
  border-radius: 0 0 16rpx 16rpx;
  background-color: #FFFFFF;
  background-image:
    linear-gradient(rgba(32, 180, 134, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(32, 180, 134, .05) 1rpx, transparent 1rpx);
  background-size: 40rpx 40rpx;
  box-shadow: 0 10rpx 24rpx rgba(36, 48, 41, .07);
  animation: studio-enter 240ms ease-out both;
}

.studio-kicker,
.studio-title,
.studio-copy,
.studio-rule,
.studio-serial,
.studio-icon {
  position: relative;
  z-index: 1;
  display: block;
}

.studio-icon {
  width: 58rpx;
  height: 58rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14rpx;
  border: 1rpx solid rgba(32, 180, 134, .28);
  border-radius: 12rpx;
  background: #E7F8F1;
}

.studio-kicker {
  color: #15946D;
  font-size: 18rpx;
  font-weight: 800;
}

.studio-title {
  max-width: 600rpx;
  margin-top: 20rpx;
  color: #26352F;
  font-size: 44rpx;
  font-weight: 900;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.studio-rule {
  width: 92rpx;
  height: 7rpx;
  margin-top: 22rpx;
  background: var(--panpan-coral);
}

.studio-copy {
  max-width: 570rpx;
  margin-top: 15rpx;
  color: #5A6A62;
  font-size: 22rpx;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.studio-serial {
  position: absolute;
  right: 34rpx;
  top: 32rpx;
  padding: 7rpx 12rpx;
  border: 1rpx solid rgba(32, 180, 134, .4);
  border-radius: 8rpx;
  background: #E7F8F1;
  color: #15946D;
  font-family: "DIN Alternate", monospace;
  font-size: 18rpx;
}

.event-section {
  margin: 30rpx -24rpx 0;
  padding-bottom: 28rpx;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  padding: 0 28rpx;
}

.section-heading > view {
  min-width: 0;
}

.section-kicker,
.section-title {
  display: block;
}

.section-kicker,
.workspace-label {
  color: #15946D;
  font-size: 17rpx;
  font-weight: 800;
}

.section-title {
  margin-top: 7rpx;
  color: #26352F;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.25;
}

.archive-count {
  flex: none;
  padding-bottom: 4rpx;
  border-bottom: 3rpx solid var(--panpan-leaf);
  color: #15946D;
  font-size: 21rpx;
}

.event-scroll {
  margin-top: 20rpx;
  white-space: nowrap;
}

.event-track {
  display: inline-flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 0 28rpx;
}

.event-ticket {
  position: relative;
  width: 328rpx;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin: 0;
  padding: 16rpx;
  border: 1rpx solid #CFE6D8;
  border-radius: 8rpx;
  background: #FFFFFF;
  text-align: left;
  box-shadow: 0 7rpx 18rpx rgba(36, 48, 41, .06);
  transition: transform 120ms ease-out, border-color 120ms ease-out, background-color 120ms ease-out;
}

.event-ticket::after,
.poster-actions button::after,
.generation-error button::after {
  border: 0;
}

.event-ticket:active {
  transform: scale(.975);
}

.event-ticket.active {
  border-color: var(--panpan-green);
  background: #E7F8F1;
}

.event-ticket.challenge_pass.active {
  border-color: #9FE3CC;
  background: #E7F8F1;
}

.ticket-index {
  width: 74rpx;
  height: 78rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 8rpx;
  background: #E7F8F1;
  color: #15946D;
  font-family: "DIN Alternate", monospace;
  font-size: 37rpx;
  font-weight: 900;
}

.challenge_pass .ticket-index {
  background: #E7F8F1;
  color: #15946D;
}

.ticket-copy {
  min-width: 0;
  overflow: hidden;
}

.ticket-type,
.ticket-name,
.ticket-date {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ticket-type {
  color: #15946D;
  font-size: 18rpx;
  font-weight: 800;
}

.challenge_pass .ticket-type {
  color: #15946D;
}

.ticket-name {
  margin-top: 5rpx;
  color: #26352F;
  font-size: 27rpx;
  font-weight: 850;
}

.ticket-date {
  margin-top: 6rpx;
  color: #5A6A62;
  font-family: monospace;
  font-size: 18rpx;
}

.ticket-new {
  position: absolute;
  right: 12rpx;
  top: 10rpx;
  color: #20B486;
  font-size: 13rpx;
  font-weight: 900;
}

.poster-workspace {
  margin-top: 2rpx;
  padding: 26rpx 20rpx 28rpx;
  border: 1rpx solid #CFE6D8;
  border-top: 7rpx solid var(--panpan-green);
  border-radius: 8rpx;
  background: #FFFFFF;
  box-shadow: 0 12rpx 30rpx rgba(36, 48, 41, .08);
  animation: studio-enter 240ms ease-out both;
}

.workspace-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  padding: 0 4rpx 20rpx;
}

.workspace-head > view:first-child {
  min-width: 0;
}

.workspace-label,
.workspace-title {
  display: block;
}

.workspace-title {
  margin-top: 6rpx;
  color: #26352F;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.privacy-stamp {
  flex: none;
  padding: 8rpx 12rpx;
  border: 1rpx solid #9FE3CC;
  border-radius: 8rpx;
  background: #E7F8F1;
  color: #15946D;
  font-size: 17rpx;
  font-weight: 750;
}

.privacy-stamp.challenge_pass {
  border-color: #9FE3CC;
  background: #E7F8F1;
  color: #15946D;
}

.poster-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  box-sizing: border-box;
  border: 1rpx solid #CFE6D8;
  background: #FFFFFF;
  box-shadow: 0 18rpx 42rpx rgba(37, 70, 124, .14);
}

.poster-preview text,
.poster-preview strong,
.poster-preview em {
  position: absolute;
  z-index: 2;
  display: block;
  max-width: 100%;
  box-sizing: border-box;
}

.poster-preview.mental_first {
  background-color: #F8FCF9;
  background-image: linear-gradient(180deg, #FFFFFF 0 28%, #E7F8F1 28% 58%, #F8FCF9 58% 100%);
  color: #26352F;
}

.mental-grid {
  position: absolute;
  inset: 0;
  opacity: .72;
  background-image:
    linear-gradient(rgba(32, 180, 134, .06) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(32, 180, 134, .06) 1rpx, transparent 1rpx);
  background-size: 44rpx 44rpx;
}

.poster-gold-spine {
  position: absolute;
  inset: 0 auto 0 0;
  width: 10rpx;
  background: #20B486;
}

.poster-topline {
  position: absolute;
  left: 6.4%;
  top: 5.2%;
  width: 13%;
  height: 6rpx;
  background: #20B486;
}

.mental-en {
  left: 6.4%;
  top: 7.5%;
  color: #20B486;
  font-size: 13rpx;
  font-weight: 800;
}

.mental-cn {
  left: 6.4%;
  top: 11.7%;
  color: #26352F;
  font-size: 34rpx;
  font-weight: 900;
}

.rank-badge {
  position: absolute;
  z-index: 2;
  right: 6.4%;
  top: 5.2%;
  width: 19%;
  height: 12.5%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1rpx solid #9FE3CC;
  border-radius: 8rpx;
  background: #E7F8F1;
}

.rank-badge text {
  position: static !important;
}

.rank-number {
  color: #15946D;
  font-family: "DIN Alternate", monospace;
  font-size: 48rpx !important;
  font-weight: 900;
  line-height: .9;
}

.rank-caption {
  margin-top: 8rpx;
  color: #15946D;
  font-size: 9rpx !important;
  font-weight: 800;
}

.battle-label {
  left: 6.4%;
  top: 17.2%;
  padding: 6rpx 12rpx;
  border-radius: 6rpx;
  background: #E7F8F1;
  color: #15946D;
  font-size: 14rpx;
  font-weight: 800;
}

.mental-name {
  left: 6.4%;
  right: 28%;
  top: 22%;
  color: #26352F;
  font-size: 49rpx;
  font-weight: 900;
  line-height: 1.12;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mental-proof {
  left: 6.4%;
  right: 6.4%;
  top: 28.8%;
  color: #5A6A62;
  font-size: 15rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poster-preview.mental_first::before {
  content: "";
  position: absolute;
  z-index: 1;
  left: 5.4%;
  right: 5.4%;
  top: 33%;
  height: 23%;
  box-sizing: border-box;
  border: 1rpx solid #9FE3CC;
  border-left: 8rpx solid #20B486;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, .92);
}

.score-caption {
  left: 8.8%;
  top: 35%;
  color: #15946D;
  font-size: 12rpx;
  font-weight: 800;
}

/* Score dashboard: score, weekly best, and supporting metrics form one module. */
.mental-score {
  left: 8.2%;
  top: 38%;
  color: #26352F;
  font-family: Arial, "Helvetica Neue", sans-serif;
  font-size: 102rpx;
  font-weight: 900;
  font-variant-numeric:tabular-nums;
  line-height: .92;
}

.score-aside {
  position: absolute;
  z-index: 2;
  right: 7.4%;
  top: 35.2%;
  width: 28%;
  height: 10.2%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1rpx solid #9FE3CC;
  border-radius: 8rpx;
  background: #E7F8F1;
}

.score-aside text {
  position: static !important;
  max-width: 92%;
  text-align: center;
  white-space: nowrap;
}

.score-aside-eyebrow {
  color: #15946D;
  font-size: 9rpx;
  font-weight: 800;
}

.score-aside-title {
  margin-top: 3rpx;
  color: #26352F;
  font-size: 20rpx;
  font-weight: 900;
}

.score-aside-detail {
  margin-top: 4rpx;
  color: #5A6A62;
  font-family: Arial, "Helvetica Neue", sans-serif;
  font-size: 10rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.mental-metrics {
  position: absolute;
  z-index: 2;
  left: 8%;
  right: 8%;
  top: 47.2%;
  height: 7.3%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 0 8rpx;
  border-top: 1rpx solid #CFE6D8;
}

.mental-metrics view {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 7rpx 12rpx;
  box-sizing: border-box;
  border-left: 1rpx solid #CFE6D8;
}

.mental-metrics view:first-child {
  border-left: 0;
}

.mental-metrics text {
  position: static !important;
  color: #5A6A62;
  font-size: 12rpx;
  text-align: center;
  white-space: nowrap;
}

.mental-metrics .metric-strong {
  margin-top: 3rpx;
  color: #26352F;
  font-family: Arial, "Helvetica Neue", sans-serif;
  font-size: 23rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.mental-motto {
  position: absolute;
  z-index: 2;
  left: 5.4%;
  right: 5.4%;
  top: 59.5%;
  height: 6.4%;
  display: flex;
  align-items: center;
  padding: 0 22rpx;
  box-sizing: border-box;
  border-left: 7rpx solid #20B486;
  background: #E7F8F1;
}

.mental-motto text {
  position: static !important;
  color: #15946D;
  font-size: 14rpx;
  font-weight: 700;
  line-height: 1.35;
}

.poster-cta {
  position: absolute;
  z-index: 2;
  left: 5.4%;
  right: 5.4%;
  bottom: 5.8%;
  display: flex;
  align-items: center;
  gap: 18rpx;
  box-sizing: border-box;
}

.mental-cta {
  height: 24%;
  padding: 4%;
  border: 1rpx solid #CFE6D8;
  border-radius: 8rpx;
  background: #FFFFFF;
}

.qr-shell {
  width: 25%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  padding: 7rpx;
  box-sizing: border-box;
  border: 1rpx solid #CFE6D8;
  border-radius: 6rpx;
  background: #FFFFFF;
}

.qr-shell image {
  width: 100%;
  height: 100%;
}

.qr-placeholder {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: repeating-linear-gradient(45deg, #20B486 0 3rpx, #FFFFFF 3rpx 7rpx);
}

.qr-placeholder::after {
  content: "";
  position: absolute;
  inset: 27%;
  background: #FFFFFF;
}

.qr-corner {
  position: absolute;
  z-index: 2;
  width: 25%;
  height: 25%;
  box-sizing: border-box;
  border: 5rpx solid #20B486;
  background: #FFFFFF;
}

.qr-corner.c1 { left: 5%; top: 5%; }
.qr-corner.c2 { right: 5%; top: 5%; }
.qr-corner.c3 { left: 5%; bottom: 5%; }

.qr-placeholder text {
  inset: 37% 0 auto !important;
  color: #15946D;
  font-size: 17rpx !important;
  font-weight: 900;
  text-align: center;
}

.cta-copy {
  position: relative;
  min-width: 0;
  flex: 1;
  align-self: center;
}

.cta-copy text {
  position: static !important;
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.cta-copy .cta-title {
  margin-top: 0;
  color: #26352F;
  font-size: 21rpx;
  font-weight: 800;
  line-height: 1.3;
}

.cta-copy > text:not(.cta-title):not(.cta-brand) {
  margin-top: 6rpx;
  color: #5A6A62;
  font-size: 13rpx;
}

.cta-copy .cta-brand {
  margin-top: 6rpx;
  color: #20B486;
  font-size: 12rpx;
  font-weight: 750;
}

.poster-privacy {
  left: 6.4%;
  right: 6.4%;
  bottom: 1.5%;
  color: #5A6A62;
  font-size: 10rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poster-preview.challenge_pass {
  background-color: #F8FCF9;
  background-image: linear-gradient(180deg, #E7F8F1 0 14%, #FFFFFF 14% 100%);
  color: #26352F;
}

.challenge-grid {
  position: absolute;
  inset: 14% 0 0;
  opacity: .72;
  background-image:
    linear-gradient(rgba(32, 180, 134, .045) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(32, 180, 134, .045) 1rpx, transparent 1rpx);
  background-size: 48rpx 48rpx;
}

.challenge-head {
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  top: 0;
  height: 14%;
  box-sizing: border-box;
  padding: 4.6% 6.4%;
  border-bottom: 1rpx solid #9FE3CC;
  background: #E7F8F1;
}

.challenge-head text {
  position: static !important;
  color: #20B486;
  font-size: 13rpx;
  font-weight: 800;
}

.challenge-head .challenge-head-title {
  margin-top: 6rpx;
  color: #26352F;
  font-size: 34rpx;
  font-weight: 900;
}

.challenge-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 10rpx;
  background: #20B486;
}

.solved-seal {
  position: absolute;
  z-index: 2;
  right: 6.1%;
  top: 4.7%;
  width: 18%;
  height: 7.8%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1rpx solid #9FE3CC;
  border-radius: 8rpx;
  background: #E7F8F1;
  color: #15946D;
}

.solved-seal text {
  position: static !important;
  color: inherit;
  font-weight: 900;
  line-height: 1.25;
}

.solved-seal text:first-child { font-size: 9rpx; }
.solved-seal text:last-child { font-size: 16rpx; }

.challenge-type {
  left: 6.4%;
  top: 15.5%;
  padding: 6rpx 12rpx;
  border-radius: 6rpx;
  background: #E7F8F1;
  color: #15946D;
  font-size: 14rpx;
  font-weight: 800;
}

.challenge-name {
  left: 6.4%;
  right: 6.4%;
  top: 20.4%;
  color: #26352F;
  font-size: 46rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.challenge-proof {
  left: 6.4%;
  right: 6.4%;
  top: 27.2%;
  color: #5A6A62;
  font-size: 14rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.challenge-headline {
  left: 6.4%;
  right: 6.4%;
  top: 30.2%;
  color: #26352F;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-title {
  left: 6.4%;
  right: 6.4%;
  top: 34.3%;
  color: #5A6A62;
  font-size: 13rpx;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.challenge-question-media {
  position: absolute;
  z-index: 2;
  left: 5.6%;
  right: 5.6%;
  top: 37.2%;
  height: 30%;
  overflow: hidden;
  box-sizing: border-box;
  border: 7rpx solid #FFFFFF;
  border-radius: 8rpx;
  background: #E7F8F1;
  box-shadow: 0 8rpx 18rpx rgba(21, 148, 109, .1);
}

.challenge-question-media image,
.question-image-placeholder {
  width: 100%;
  height: 100%;
}

.question-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5A6A62;
  font-size: 18rpx;
}

.challenge-question-media text {
  left: 8rpx;
  top: 8rpx;
  padding: 6rpx 10rpx;
  border-radius: 5rpx;
  background: rgba(30, 78, 168, .9);
  color: #FFFFFF;
  font-size: 11rpx;
  font-weight: 750;
}

.challenge-data {
  position: absolute;
  z-index: 2;
  left: 5.6%;
  right: 5.6%;
  top: 70%;
  height: 10.8%;
  display: grid;
  grid-template-columns: .7fr 1.5fr;
  gap: 12rpx;
}

.passed-data,
.source-data {
  min-width: 0;
  padding: 14rpx 16rpx;
  box-sizing: border-box;
  border: 1rpx solid #CFE6D8;
  border-radius: 8rpx;
  background: #FFFFFF;
  overflow: hidden;
}

.challenge-data text {
  position: static !important;
  color: #5A6A62;
  font-size: 11rpx;
}

.passed-data .passed-number {
  display: inline-block !important;
  margin-top: 2rpx;
  color: #26352F;
  font-family: "DIN Alternate", monospace;
  font-size: 33rpx;
  font-weight: 900;
}

.passed-data .passed-unit {
  display: inline-block !important;
  margin-left: 6rpx;
  color: #26352F;
  font-size: 12rpx;
  font-weight: 750;
}

.source-data .source-name {
  margin-top: 5rpx;
  color: #26352F;
  font-size: 13rpx;
  line-height: 1.25;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.challenge-cta {
  bottom: 4.4%;
  height: 12%;
  padding: 2.8%;
  border: 1rpx solid #9FE3CC;
  border-radius: 8rpx;
  background: #E7F8F1;
}

.challenge-cta .qr-shell {
  width: 21%;
}

.challenge-cta .cta-copy .cta-title {
  color: #26352F;
  font-size: 18rpx;
}

.challenge-cta .cta-copy .cta-brand {
  color: #15946D;
}

.challenge-privacy {
  bottom: 1%;
}

.generation-strip,
.generation-error,
.poster-ready {
  min-height: 66rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  box-sizing: border-box;
  border: 1rpx solid #CFE6D8;
  border-radius: 8rpx;
  background: #F8FCF9;
  color: #15946D;
  font-size: 19rpx;
}

.generation-strip {
  position: relative;
  overflow: hidden;
}

.generation-line {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 42%;
  height: 4rpx;
  background: #20B486;
  animation: generation 1.2s ease-in-out infinite;
}

.generation-error {
  justify-content: space-between;
  gap: 12rpx;
  padding: 10rpx 16rpx;
  border-color: #FFC4BF;
  background: #FFF0EE;
  color: #D94B45;
}

.generation-error text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.generation-error button {
  min-height: 48rpx;
  flex: none;
  margin: 0;
  padding: 0 17rpx;
  border-radius: 7rpx;
  background: #FF7468;
  color: #FFFFFF;
  font-size: 18rpx;
}

.poster-actions {
  display: grid;
  grid-template-columns: 1.1fr .9fr;
  gap: 12rpx;
  margin-top: 14rpx;
}

.poster-actions button {
  min-width: 0;
  min-height: 84rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.25;
  transition: transform 120ms ease-out, opacity 120ms ease-out;
}

.poster-actions button:active,
.generation-error button:active {
  transform: scale(.975);
  opacity: .9;
}

.save-action {
  background: var(--panpan-green-strong);
  color: #FFFFFF;
  box-shadow: 0 8rpx 18rpx rgba(21, 148, 109, .2);
}

.share-action {
  border: 1rpx solid rgba(32, 180, 134, .35);
  background: #E7F8F1;
  color: #15946D;
}

.poster-actions button[disabled] {
  opacity: .46;
}

.share-tip {
  display: block;
  margin-top: 14rpx;
  color: #5A6A62;
  font-size: 18rpx;
  line-height: 1.5;
  text-align: center;
  overflow-wrap: anywhere;
}

.empty-archive {
  margin-top: 34rpx;
  padding: 64rpx 38rpx;
  border: 1rpx solid #CFE6D8;
  border-left: 8rpx solid #20B486;
  border-radius: 8rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 22rpx rgba(21, 148, 109, .07);
}

.empty-index,
.empty-title,
.empty-copy {
  display: block;
}

.empty-index {
  color: #20B486;
  font-family: "DIN Alternate", monospace;
  font-size: 80rpx;
  font-weight: 900;
}

.empty-title {
  margin-top: 16rpx;
  color: #26352F;
  font-size: 30rpx;
  font-weight: 850;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.empty-copy {
  margin-top: 12rpx;
  color: #5A6A62;
  font-size: 21rpx;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.poster-canvas {
  position: fixed;
  left: -2000px;
  top: 0;
  width: 750px;
  height: 1000px;
  pointer-events: none;
}

@keyframes generation {
  0% { transform: translateX(-110%); }
  100% { transform: translateX(340%); }
}

@keyframes studio-enter {
  from { opacity: 0; transform: translateY(12rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 360px) {
  .studio-hero {
    padding-right: 30rpx;
    padding-left: 30rpx;
  }

  .studio-title {
    max-width: 560rpx;
    font-size: 40rpx;
  }

  .workspace-head {
    align-items: flex-start;
  }

  .privacy-stamp {
    max-width: 150rpx;
    text-align: center;
  }

  .poster-actions {
    grid-template-columns: 1fr;
  }

  .mental-name,
  .challenge-name {
    font-size: 43rpx;
  }

  .mental-score {
    font-size: 92rpx;
  }

  .cta-copy .cta-title {
    font-size: 18rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .studio-hero,
  .poster-workspace,
  .event-ticket,
  .poster-actions button,
  .generation-error button,
  .generation-line {
    animation: none !important;
    transition: none !important;
  }

  .event-ticket:active,
  .poster-actions button:active,
  .generation-error button:active {
    transform: none;
  }
}
</style>
