<template>
  <view :class="['page','student-challenge-page',{ 'intro-finished': introDone }]">
    <view v-if="loading" class="state"><pp-state type="loading" title="正在结算战绩" /></view>
    <view v-else-if="error" class="state"><pp-state type="error" title="战绩加载失败" :description="error" action-text="重试" @action="loadResult" /></view>
    <template v-else-if="challenge">
      <view class="result-hero">
        <view class="result-icon">
          <pp-icon name="trophy" :size="52" motion="shine" :delay="120" />
        </view>
        <view class="hero-grid" />
        <view class="hero-glow" />
        <view class="particle-field" aria-hidden="true">
          <text v-for="item in particles" :key="item.id" class="particle" :style="item.style">✦</text>
        </view>
        <button v-if="!introDone" class="skip-intro" @tap="skipIntro">跳过动画</button>

        <view :class="['award-orbit','motion-block',{show:revealStage>=1}]">
          <view class="orbit-ring outer" />
          <view class="orbit-ring inner" />
          <text class="award-symbol">{{ award.symbol }}</text>
        </view>
        <text :class="['result-kicker','motion-block',{show:revealStage>=1}]">{{ challenge.battle_label }} · {{ award.label }}</text>
        <view :class="['score-lockup','motion-block',{show:revealStage>=2}]">
          <text class="score">{{ challenge.score }}</text>
          <text class="score-label">本局得分</text>
        </view>
        <text :class="['award-headline','motion-block',{show:revealStage>=2}]">{{ award.headline }}</text>
        <text v-if="challenge.is_fishing" :class="['fish-tag','motion-block',{show:revealStage>=2}]">跨级挑战 · 炸鱼选手</text>
      </view>

      <view :class="['metrics','motion-panel',{show:revealStage>=3}]">
        <view class="metric primary"><pp-icon name="target" :size="30" motion="pop" :delay="840" :stagger="80" :index="0" /><text class="metric-label">正确率</text><text class="metric-number">{{ accuracy }}%</text></view>
        <view class="metric"><pp-icon name="check" :size="30" motion="pop" :delay="840" :stagger="80" :index="1" /><text class="metric-label">答对</text><text class="metric-number">{{ challenge.correct_count }}<text class="metric-unit">/{{ challenge.total_questions }}</text></text></view>
        <view class="metric"><pp-icon name="history" :size="30" motion="pop" :delay="840" :stagger="80" :index="2" /><text class="metric-label">完成用时</text><text class="metric-number">{{ timeText }}</text></view>
        <view class="score-formula">{{ challenge.correct_count }} × 100 正确分 <text>＋</text> {{ challenge.speed_bonus }} 速度奖</view>
      </view>

      <view :class="['action-zone','motion-panel',{show:revealStage>=4}]">
        <view class="action-grid">
          <button class="rank-btn" @tap="openLeaderboard">查看排行榜</button>
          <button class="again-btn" @tap="playAgain">再来一局</button>
        </view>
        <button class="poster-btn" :disabled="posterGenerating" @tap="openPoster">
          <text class="poster-spark">✦</text>{{ posterGenerating ? '正在生成专属海报' : '打开本局专属海报' }}
        </button>
      </view>

      <view :class="['review-card','motion-panel',{show:revealStage>=4}]">
        <view class="section-head">
          <view class="section-title-row">
            <view class="section-icon"><pp-icon name="report" :size="30" motion="ring" :delay="1180" /></view>
            <view>
              <text class="section-kicker">ANSWER REVIEW</text>
              <text class="section-title">二十题战况</text>
            </view>
          </view>
          <text :class="['wrong-count',{perfect:!wrongAnswers.length}]">{{ wrongAnswers.length ? `错 ${wrongAnswers.length} 题` : '全部答对' }}</text>
        </view>
        <view v-if="!wrongAnswers.length" :class="['perfect-note','answer-row-motion',{instant:introDone}]" :style="rowDelayStyle(0)">
          <text class="perfect-mark">满分完成</text>
          <text class="perfect-copy">准确与速度都在线，这一局值得保存。</text>
        </view>
        <view
          v-for="(item,index) in answerRows"
          :key="item.question_id"
          :class="['answer-row','answer-row-motion',{correct:item.is_correct,instant:introDone}]"
          :style="rowDelayStyle(index + 1)"
        >
          <text class="answer-no">{{ item.is_correct ? '✓' : item.position }}</text>
          <view class="answer-copy">
            <pp-math-text class="answer-stem" :value="item.stem" />
            <view class="answer-meta">
              <view class="your-answer"><text>作答</text><pp-math-text class="answer-inline" :value="item.answer || '未作答'" /></view>
              <view v-if="!item.is_correct" class="correct-answer"><text>答案</text><pp-math-text class="answer-inline" :value="item.correct_answer" /></view>
            </view>
            <button class="question-report" @tap="reportQuestion=item">题目有问题</button>
          </view>
        </view>
      </view>
    </template>

    <view v-if="posterOpen" class="poster-overlay" @tap="closePoster">
      <view class="poster-sheet" @tap.stop>
        <button class="poster-close" aria-label="关闭海报" @tap="closePoster">×</button>
        <view class="poster-sheet-head">
          <text class="poster-eyebrow">本局专属战报</text>
          <text class="poster-title">保存这一刻</text>
          <text class="poster-sub">公开海报只显示“姓＋同学”，不包含学校和班级。</text>
        </view>
        <view v-if="posterGenerating" class="poster-loading">
          <view class="loading-crown">{{ award.symbol }}</view>
          <text>正在写入真实成绩和小程序码</text>
        </view>
        <view v-else-if="posterError" class="poster-error">
          <text class="poster-error-title">海报暂未生成</text>
          <text class="poster-error-copy">{{ posterError }}</text>
          <button class="retry-poster" @tap="generatePoster(false)">重新生成</button>
        </view>
        <image v-else-if="posterPath" class="poster-preview" :src="posterPath" mode="widthFix" @tap="previewPoster" />
        <view v-if="posterPath" class="poster-actions">
          <button class="save-poster" :disabled="posterSaving" @tap="savePoster">{{ posterSaving ? '保存中…' : '保存海报' }}</button>
          <button class="share-poster" open-type="share">分享小程序</button>
        </view>
        <text v-if="posterPath" class="share-note">分享按钮发送小程序卡片；图片请先保存，再从相册发送。</text>
      </view>
    </view>

    <canvas canvas-id="mentalArenaPosterCanvas" id="mentalArenaPosterCanvas" class="poster-canvas" />
    <question-report-sheet
      :visible="Boolean(reportQuestion)"
      source-type="mental_challenge"
      :source-id="challengeId"
      :student-id="challenge?.student_id || 0"
      :question-id="reportQuestion?.question_id || ''"
      @close="reportQuestion=null"
    />
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, ref } from 'vue';
import { onLoad, onShareAppMessage, onUnload } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
import {
  mentalArenaAward,
  mentalPosterPermissionDenied,
  renderMentalArenaPoster,
  saveMentalArenaPoster,
} from '@/utils/mental-arena-poster';
import QuestionReportSheet from '@/components/question-report-sheet/question-report-sheet.vue';

const pageInstance = getCurrentInstance()?.proxy;
const challengeId = ref('');
const challenge = ref(null);
const loading = ref(false);
const error = ref('');
const reportQuestion = ref(null);
const revealStage = ref(0);
const introDone = ref(false);
const posterOpen = ref(false);
const posterGenerating = ref(false);
const posterSaving = ref(false);
const posterPath = ref('');
const posterError = ref('');
const displayName = ref('同学');
const introTimers = [];
let posterRequested = false;

const particles = [
  { id:1, style:'left:8%;top:24%;animation-delay:.1s' },
  { id:2, style:'left:17%;top:61%;animation-delay:.45s' },
  { id:3, style:'left:30%;top:14%;animation-delay:.8s' },
  { id:4, style:'left:73%;top:19%;animation-delay:.25s' },
  { id:5, style:'left:88%;top:45%;animation-delay:.7s' },
  { id:6, style:'left:79%;top:72%;animation-delay:1s' },
  { id:7, style:'left:12%;top:82%;animation-delay:1.2s' },
  { id:8, style:'left:92%;top:79%;animation-delay:.35s' },
];

const accuracy = computed(() => challenge.value ? Math.round(challenge.value.correct_count * 100 / challenge.value.total_questions) : 0);
const award = computed(() => mentalArenaAward(accuracy.value));
const wrongAnswers = computed(() => (challenge.value?.answers || []).filter((item) => !item.is_correct));
const answerRows = computed(() => challenge.value?.answers || []);
const timeText = computed(() => {
  const seconds = Number(challenge.value?.elapsed_seconds || 0);
  return seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});

onLoad((options) => {
  challengeId.value = String(options?.id || '');
  loadResult();
});
onUnload(clearIntroTimers);
onShareAppMessage(() => ({
  title: `${displayName.value}完成口算王：${challenge.value?.score || 0}分`,
  path: '/pages/guest-experience/index',
  imageUrl: posterPath.value || undefined,
}));

function clearIntroTimers() {
  while (introTimers.length) clearTimeout(introTimers.pop());
}

function rowDelayStyle(index) {
  return introDone.value ? '' : `animation-delay:${1180 + Math.min(index, 21) * 58}ms`;
}

function startIntro() {
  clearIntroTimers();
  revealStage.value = 0;
  introDone.value = false;
  const stage = (value, delay) => introTimers.push(setTimeout(() => { revealStage.value = value; }, delay));
  stage(1, 80);
  stage(2, 430);
  stage(3, 820);
  stage(4, 1120);
  const finishDelay = 1650 + Math.min(answerRows.value.length, 20) * 58;
  introTimers.push(setTimeout(() => {
    introDone.value = true;
    generatePoster(true);
  }, finishDelay));
}

function skipIntro() {
  clearIntroTimers();
  revealStage.value = 4;
  introDone.value = true;
  generatePoster(true);
}

async function loadResult() {
  if (!challengeId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await api.get(`/mental-arena/challenges/${challengeId.value}`);
    challenge.value = result.challenge;
    if (challenge.value.status !== 'completed') throw { error: '这局还没有交卷' };
    await nextTick();
    startIntro();
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('mentalArena.result', err);
  } finally {
    loading.value = false;
  }
}

async function generatePoster(isAutomatic) {
  if (!challenge.value || posterGenerating.value) return;
  if (posterPath.value) {
    posterOpen.value = true;
    return;
  }
  if (isAutomatic && posterRequested) return;
  posterRequested = true;
  posterOpen.value = true;
  posterGenerating.value = true;
  posterError.value = '';
  try {
    const data = await api.get(`/achievements?student_id=${challenge.value.student_id}`);
    const items = data.achievements || [];
    const achievement = items.find((item) => item.category === 'mental' && Number(item.challenge_id) === Number(challengeId.value))
      || items.find((item) => item.category === 'mental');
    if (!achievement) throw new Error('本局成就记录尚未同步，请稍后重试');
    displayName.value = achievement.display_name || data.student_name || '同学';
    const codePath = await api.downloadPrivate(`/api/achievements/${achievement.id}/code?student_id=${challenge.value.student_id}`);
    await nextTick();
    posterPath.value = await renderMentalArenaPoster({
      page: pageInstance,
      codePath,
      result: {
        ...challenge.value,
        display_name: displayName.value,
        rank: achievement.rank,
        participant_count: achievement.participant_count,
      },
    });
    api.post(`/achievements/${achievement.id}/seen`, { student_id: challenge.value.student_id }).catch(() => {});
  } catch (err) {
    posterError.value = err?.error || err?.message || '请检查网络后重试';
    posterRequested = false;
    logError('mentalArena.poster', err);
  } finally {
    posterGenerating.value = false;
  }
}

function openLeaderboard() {
  uni.navigateTo({ url: `/pages/mental-arena/leaderboard?student_id=${challenge.value.student_id}&battle=${challenge.value.battle}` });
}
function playAgain() {
  uni.redirectTo({ url: `/pages/mental-arena/index?student_id=${challenge.value.student_id}` });
}
function openPoster() {
  posterOpen.value = true;
  if (!posterPath.value) generatePoster(false);
}
function closePoster() {
  posterOpen.value = false;
}
function previewPoster() {
  if (posterPath.value) uni.previewImage({ current: posterPath.value, urls: [posterPath.value] });
}
async function savePoster() {
  if (!posterPath.value || posterSaving.value) return;
  posterSaving.value = true;
  try {
    await saveMentalArenaPoster(posterPath.value);
    uni.showToast({ title:'已保存到相册', icon:'success' });
  } catch (err) {
    if (mentalPosterPermissionDenied(err)) {
      uni.showModal({
        title:'需要相册权限',
        content:'请在设置中允许保存到相册后重试。',
        confirmText:'去设置',
        success:(result) => result.confirm && uni.openSetting(),
      });
    } else uni.showToast({ title:'保存失败，请重试', icon:'none' });
  } finally {
    posterSaving.value = false;
  }
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(64rpx + env(safe-area-inset-bottom));overflow:hidden}.state{margin-top:24rpx;padding:28rpx}.result-hero{position:relative;min-height:580rpx;margin:0 -24rpx;padding:48rpx 32rpx 78rpx;overflow:hidden;text-align:center}.hero-grid{position:absolute;inset:0;opacity:.18;transform:perspective(500rpx) rotateX(58deg) scale(1.45) translateY(74rpx);transform-origin:center bottom}.hero-glow{position:absolute;left:50%;top:72rpx;width:520rpx;height:520rpx;transform:translateX(-50%)}.particle{position:absolute;font-size:19rpx;opacity:0}.skip-intro{position:absolute;z-index:4;right:26rpx;top:24rpx;min-height:54rpx;margin:0;padding:0 18rpx;font-size:20rpx;line-height:54rpx}.award-orbit{position:relative;width:184rpx;height:184rpx;display:flex;align-items:center;justify-content:center;margin:8rpx auto 0}.orbit-ring{position:absolute}.orbit-ring.outer{inset:0}.orbit-ring.outer::before,.orbit-ring.outer::after{content:'';position:absolute;width:10rpx;height:10rpx}.orbit-ring.outer::before{left:19rpx;top:22rpx}.orbit-ring.outer::after{right:9rpx;bottom:40rpx}.orbit-ring.inner{inset:21rpx;opacity:.56}.award-symbol{position:relative;z-index:1;font-size:88rpx}.result-kicker{display:block;margin-top:13rpx;font-size:20rpx;font-weight:750}.score-lockup{display:flex;align-items:flex-end;justify-content:center;gap:14rpx;margin-top:2rpx}.score{font-size:122rpx;font-weight:950;line-height:1;font-variant-numeric:tabular-nums}.score-label{padding-bottom:16rpx;font-size:20rpx;writing-mode:vertical-rl}.award-headline{display:block;margin-top:6rpx;font-size:28rpx;font-weight:750}.fish-tag{display:inline-flex;margin-top:14rpx;padding:8rpx 14rpx;font-size:20rpx;font-weight:750}.motion-block{opacity:0;transform:translateY(30rpx) scale(.94)}.motion-block.show{opacity:1;transform:translateY(0) scale(1)}.metrics{position:relative;z-index:2;display:grid;grid-template-columns:1.18fr 1fr 1fr;margin:-40rpx 6rpx 0;padding:28rpx 20rpx 22rpx}.metric{min-width:0;padding:3rpx 16rpx;text-align:left}.metric-label{display:block;font-size:19rpx}.metric-number{display:block;margin-top:8rpx;font-size:35rpx;font-weight:880;line-height:1;font-variant-numeric:tabular-nums}.metric.primary .metric-number{font-size:46rpx}.metric-unit{font-size:22rpx;font-weight:650}.score-formula{grid-column:1/-1;margin:24rpx 0 0;padding-top:17rpx;font-size:20rpx;text-align:center}.score-formula text{padding:0 8rpx}.motion-panel{opacity:0;transform:translateY(42rpx);pointer-events:none}.motion-panel.show{opacity:1;transform:translateY(0);pointer-events:auto}.action-zone{margin-top:22rpx}.action-grid{display:grid;grid-template-columns:.92fr 1.08fr;gap:12rpx}.rank-btn,.again-btn,.poster-btn{display:flex;align-items:center;justify-content:center;margin:0;font-weight:800}.rank-btn:active,.again-btn:active,.poster-btn:active,.save-poster:active,.share-poster:active{transform:scale(.98)}.rank-btn,.again-btn{min-height:90rpx;font-size:25rpx}.poster-btn{min-height:88rpx;margin-top:12rpx;font-size:25rpx}.poster-btn[disabled]{opacity:.7}.poster-spark{margin-right:10rpx;font-size:25rpx}.review-card{margin-top:24rpx;padding:30rpx 26rpx 10rpx}.section-head{display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:22rpx}.section-kicker{display:block;font-size:17rpx;font-weight:750}.section-title{display:block;margin-top:6rpx;font-size:34rpx;font-weight:880}.wrong-count{padding:9rpx 13rpx;font-size:20rpx;font-weight:750}.perfect-note{margin-bottom:8rpx;padding:25rpx}.perfect-mark{display:block;font-size:27rpx;font-weight:850}.perfect-copy{display:block;margin-top:6rpx;font-size:21rpx}.answer-row{display:flex;gap:16rpx;padding:22rpx 0}.answer-no{width:44rpx;height:44rpx;display:flex;align-items:center;justify-content:center;flex:none;font-size:22rpx;font-weight:850}.answer-copy{flex:1;min-width:0}.answer-stem{display:block;font-size:26rpx;font-weight:680;line-height:1.55}.answer-meta{display:flex;flex-wrap:wrap;gap:8rpx 20rpx;margin-top:9rpx}.your-answer,.correct-answer{display:flex;align-items:center;flex-wrap:wrap;font-size:21rpx}.your-answer>text,.correct-answer>text{margin-right:7rpx;font-size:18rpx}.answer-inline{width:auto;flex:none;font-weight:720}.question-report{min-height:46rpx;margin:7rpx 0 0;padding:0;font-size:19rpx;line-height:46rpx;text-align:left;text-decoration:underline}.answer-row-motion{opacity:0;transform:translateY(24rpx)}.answer-row-motion.instant{opacity:1;transform:none}.poster-overlay{position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-top:80rpx}.poster-sheet{position:relative;width:100%;max-height:92vh;padding:32rpx 24rpx calc(30rpx + env(safe-area-inset-bottom));overflow-y:auto}.poster-close{position:absolute;z-index:2;right:22rpx;top:20rpx;width:64rpx;height:64rpx;margin:0;padding:0;font-size:42rpx;font-weight:400;line-height:58rpx}.poster-sheet-head{padding:6rpx 78rpx 22rpx 6rpx}.poster-eyebrow{display:block;font-size:18rpx;font-weight:800}.poster-title{display:block;margin-top:5rpx;font-size:38rpx;font-weight:900}.poster-sub{display:block;margin-top:8rpx;font-size:20rpx;line-height:1.55}.poster-loading,.poster-error{min-height:520rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.loading-crown{font-size:96rpx}.poster-loading text{margin-top:22rpx;font-size:22rpx}.poster-error{padding:50rpx}.poster-error-title{font-size:30rpx;font-weight:850}.poster-error-copy{margin-top:10rpx;font-size:21rpx;line-height:1.55}.retry-poster{min-height:76rpx;margin-top:25rpx;padding:0 34rpx;font-size:23rpx;font-weight:800}.poster-preview{width:100%;display:block}.poster-actions{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:16rpx}.save-poster,.share-poster{min-height:86rpx;display:flex;align-items:center;justify-content:center;margin:0;font-size:24rpx;font-weight:800}.share-note{display:block;margin-top:13rpx;font-size:19rpx;line-height:1.5;text-align:center}.poster-canvas{position:fixed;left:-2000px;top:0;width:750px;height:1000px;pointer-events:none}

/* 结果页：浅色奖状式揭晓，庆祝只播放一次。 */
.page {
  overflow-x: hidden;
  overflow-y: visible;
}

.result-hero {
  min-height: 530rpx;
  margin: 0 -24rpx;
  padding: 42rpx 32rpx 72rpx;
}

.hero-grid {
  opacity: .38;
}

.skip-intro {
  min-height: 88rpx;
  padding: 0 22rpx;
  line-height: 88rpx;
}

.award-orbit {
  width: 178rpx;
  height: 178rpx;
}
.score-label {
  padding-bottom: 12rpx;
  writing-mode: horizontal-tb;
}

.metrics {
  margin-top: -34rpx;
}

.rank-btn,
.again-btn,
.poster-btn,
.save-poster,
.share-poster,
.retry-poster {
  min-height: 112rpx;
}

.poster-close {
  min-width: 88rpx;
  min-height: 88rpx;
  line-height: 82rpx;
}

.rank-btn:active,
.again-btn:active,
.poster-btn:active,
.save-poster:active,
.share-poster:active,
.retry-poster:active { transform: scale(var(--tap-scale)); }

@media (max-width: 360px) {
  .score { font-size: 104rpx; }
  .metrics { padding-left: 10rpx; padding-right: 10rpx; }
  .metric { padding-left: 10rpx; padding-right: 10rpx; }
  .action-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .motion-block,
  .motion-panel,
  .answer-row-motion {
    opacity: 1 !important;
    transform: none !important;
    pointer-events: auto;
  }
  .rank-btn:active,
  .again-btn:active,
  .poster-btn:active,
  .save-poster:active,
  .share-poster:active,
  .retry-poster:active { transform: none; }
}

/* Student challenge theme v3: warm paper and one energetic teaching green. */
.student-challenge-page {
  --page-bg: #F6FAFF;
  --surface: #FFFFFF;
  --surface-muted: #F8FBFF;
  --ink: #24324A;
  --text-secondary: #5C6C84;
  --text-muted: #6E7D91;
  --primary: #527CC9;
  --primary-strong: #315EA8;
  --primary-soft: #EDF5FF;
  --accent: #527CC9;
  --accent-strong: #315EA8;
  --accent-soft: #EDF5FF;
  --coral: #E98577;
  --coral-soft: #FFF0ED;
  --danger: #D66D62;
  --border: #DDE7F2;
  --hairline: #E9F0F8;
  --r: 16rpx;
  --r-sm: 14rpx;
  --r-xs: 10rpx;
  --r-lg: 16rpx;
  --shadow-sm: 0 6rpx 18rpx rgba(36, 50, 74, .06);
  --shadow: 0 10rpx 28rpx rgba(36, 50, 74, .08);
  overflow-x: hidden;
  overflow-y: visible;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 55rpx,
    rgba(82, 124, 201, .045) 56rpx 57rpx
  );
  color: var(--ink);
}

.student-challenge-page .state {
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .result-hero {
  min-height: 0;
  margin: 0 -24rpx;
  padding: 32rpx 30rpx 28rpx;
  border-bottom: 7rpx solid var(--primary);
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}

.student-challenge-page .result-icon {
  width: 84rpx;
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12rpx;
  border: 1rpx solid #FCEEEB;
  border-radius: 16rpx;
  background: var(--coral-soft);
}

.student-challenge-page .hero-grid,
.student-challenge-page .hero-glow,
.student-challenge-page .particle-field,
.student-challenge-page .orbit-ring {
  display: none;
}

.student-challenge-page .skip-intro {
  right: 24rpx;
  top: 20rpx;
  min-height: 58rpx;
  padding: 0 16rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-xs);
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.student-challenge-page .award-orbit {
  width: 112rpx;
  height: 112rpx;
  margin-top: 6rpx;
  border: 1rpx solid #DDEEFF;
  border-top: 7rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
}

.student-challenge-page .award-symbol {
  color: var(--ink);
  font-size: 62rpx;
  filter: none;
  animation: none;
}

.student-challenge-page .result-kicker {
  margin-top: 16rpx;
  color: var(--primary-strong);
  letter-spacing: 0;
}

.student-challenge-page .score-lockup {
  align-items: baseline;
  gap: 10rpx;
  margin-top: 6rpx;
}

.student-challenge-page .score {
  color: var(--ink);
  font-size: 104rpx;
  letter-spacing: 0;
  text-shadow: none;
}

.student-challenge-page .score-label {
  padding-bottom: 0;
  color: var(--text-muted);
  writing-mode: horizontal-tb;
  letter-spacing: 0;
}

.student-challenge-page .award-headline {
  margin-top: 5rpx;
  color: var(--accent-strong);
  letter-spacing: 0;
}

.student-challenge-page .fish-tag {
  margin-top: 13rpx;
  padding: 8rpx 12rpx;
  border: 1rpx solid #EFC9C2;
  border-left: 5rpx solid var(--coral);
  border-radius: var(--r-xs);
  background: var(--coral-soft);
  color: #D66D62;
}

.student-challenge-page .motion-block {
  transform: translateY(16rpx);
  transition:
    opacity var(--motion-slow) var(--ease-out),
    transform var(--motion-slow) var(--ease-out);
}

.student-challenge-page .motion-block.show {
  transform: translateY(0);
}

.student-challenge-page .metrics {
  z-index: auto;
  margin: 18rpx 0 0;
  padding: 22rpx 18rpx 18rpx;
  border: 1rpx solid var(--border);
  border-left: 7rpx solid var(--accent);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .metric {
  padding: 4rpx 14rpx;
  border-left-color: var(--hairline);
}

.student-challenge-page .metric .pp-icon {
  margin: 0 auto 7rpx;
}

.student-challenge-page .metric-label {
  color: var(--text-muted);
  letter-spacing: 0;
}

.student-challenge-page .metric-number,
.student-challenge-page .metric.primary .metric-number {
  color: var(--ink);
}

.student-challenge-page .metric.primary .metric-number {
  color: var(--primary-strong);
}

.student-challenge-page .score-formula {
  border-top-color: var(--hairline);
  color: var(--text-secondary);
}

.student-challenge-page .score-formula text {
  color: var(--primary-strong);
}

.student-challenge-page .motion-panel {
  transform: translateY(20rpx);
  transition:
    opacity var(--motion-slow) var(--ease-out),
    transform var(--motion-slow) var(--ease-out);
}

.student-challenge-page .motion-panel.show {
  transform: translateY(0);
}

.student-challenge-page .action-zone {
  margin-top: 16rpx;
}

.student-challenge-page .rank-btn,
.student-challenge-page .again-btn,
.student-challenge-page .poster-btn {
  min-height: 94rpx;
  border-radius: var(--r-sm);
  box-shadow: none;
}

.student-challenge-page .rank-btn {
  border: 1rpx solid #CADCF2;
  background: var(--surface);
  color: var(--primary-strong);
}

.student-challenge-page .again-btn {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .poster-btn {
  min-height: 112rpx;
  border: 1rpx solid #E6CF88;
  border-radius: 14rpx;
  background: #FFF5D7;
  color: #765410;
  box-shadow: none;
  transition: transform 120ms cubic-bezier(.16, 1, .3, 1), opacity 120ms cubic-bezier(.16, 1, .3, 1);
}

.student-challenge-page .poster-spark {
  color: inherit;
}

.student-challenge-page .review-card {
  margin-top: 18rpx;
  padding: 26rpx 24rpx 8rpx;
  border: 1rpx solid var(--border);
  border-top: 7rpx solid var(--primary);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .section-head {
  padding-bottom: 18rpx;
}

.student-challenge-page .section-title-row {
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

.student-challenge-page .section-kicker {
  color: var(--primary-strong);
  letter-spacing: 0;
}

.student-challenge-page .section-title {
  color: var(--ink);
  font-size: 34rpx;
  letter-spacing: 0;
}

.student-challenge-page .wrong-count {
  border-radius: var(--r-xs);
  background: var(--coral-soft);
  color: #D66D62;
}

.student-challenge-page .wrong-count.perfect {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.student-challenge-page .perfect-note {
  margin-bottom: 8rpx;
  padding: 22rpx;
  border: 1rpx solid #DDEEFF;
  border-left: 6rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
}

.student-challenge-page .perfect-mark {
  color: var(--ink);
}

.student-challenge-page .perfect-copy {
  color: var(--text-secondary);
}

.student-challenge-page .answer-row {
  border-top-color: var(--hairline);
}

.student-challenge-page .answer-row-motion {
  opacity: 0;
  transform: translateY(10rpx);
  animation: result-row-in var(--motion-slow) var(--ease-out) forwards;
}

.student-challenge-page .answer-row-motion.instant {
  opacity: 1;
  transform: none;
  animation: none;
}

.student-challenge-page .answer-no {
  border-radius: var(--r-xs);
  background: var(--coral-soft);
  color: #D66D62;
}

.student-challenge-page .answer-row.correct .answer-no {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.student-challenge-page .answer-stem {
  color: var(--ink);
}

.student-challenge-page .your-answer,
.student-challenge-page .correct-answer {
  color: #D66D62;
}

.student-challenge-page .answer-row.correct .your-answer,
.student-challenge-page .correct-answer {
  color: var(--accent-strong);
}

.student-challenge-page .your-answer > text,
.student-challenge-page .correct-answer > text,
.student-challenge-page .question-report {
  color: var(--text-muted);
}

.student-challenge-page .question-report {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: auto;
  min-height: 48rpx;
  margin-top: 6rpx;
  padding: 0;
  border: 0;
  background-color: transparent !important;
  background-image: none !important;
  text-decoration: underline;
}

.student-challenge-page .question-report::after {
  border: 0;
}

.student-challenge-page .poster-overlay {
  background: rgba(36, 50, 74, .56);
}

.student-challenge-page .poster-sheet {
  padding: 32rpx 24rpx calc(30rpx + env(safe-area-inset-bottom));
  border-radius: 30rpx 30rpx 0 0;
  background: #F6FAFF;
  box-shadow: 0 -24rpx 60rpx rgba(36, 50, 74, .2);
}

.student-challenge-page .poster-close {
  width: 88rpx;
  height: 88rpx;
  min-width: 88rpx;
  min-height: 88rpx;
  border: 1rpx solid #DDE7F2;
  border-radius: 50%;
  background: #FFFFFF;
  color: #315EA8;
  line-height: 82rpx;
}

.student-challenge-page .poster-eyebrow {
  color: #C48A20;
  letter-spacing: 3rpx;
}

.student-challenge-page .poster-title {
  color: #24324A;
  letter-spacing: -1rpx;
}

.student-challenge-page .poster-sub,
.student-challenge-page .share-note {
  color: #6E7D91;
}

.student-challenge-page .poster-loading,
.student-challenge-page .poster-error {
  min-height: 520rpx;
  border: 1rpx solid #DDE7F2;
  border-radius: 18rpx;
  background: #FFFFFF;
  color: #5C6C84;
}

.student-challenge-page .loading-crown {
  font-size: 96rpx;
  animation: none;
}

.student-challenge-page .poster-error-title {
  color: #24324A;
}

.student-challenge-page .poster-error-copy {
  color: #5C6C84;
}

.student-challenge-page .retry-poster,
.student-challenge-page .save-poster,
.student-challenge-page .share-poster {
  min-height: 112rpx;
  border-radius: 14rpx;
  transition: transform 120ms cubic-bezier(.16, 1, .3, 1), opacity 120ms cubic-bezier(.16, 1, .3, 1);
}

.student-challenge-page .retry-poster,
.student-challenge-page .save-poster {
  background: #F4C75B;
  color: #493000;
}

.student-challenge-page .share-poster {
  background: #315EA8;
  color: #FFFFFF;
}

.student-challenge-page .poster-preview {
  border: 0;
  border-radius: 18rpx;
  background: #F9FBFF;
  box-shadow: 0 14rpx 38rpx rgba(49, 94, 168, .09);
}

@keyframes result-row-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
