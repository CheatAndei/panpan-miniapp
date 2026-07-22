<template>
  <view :class="['page',{ 'intro-finished': introDone }]">
    <view v-if="loading" class="state"><pp-state type="loading" title="正在结算战绩" /></view>
    <view v-else-if="error" class="state"><pp-state type="error" title="战绩加载失败" :description="error" action-text="重试" @action="loadResult" /></view>
    <template v-else-if="challenge">
      <view class="result-hero">
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
        <view class="metric primary"><text class="metric-label">正确率</text><text class="metric-number">{{ accuracy }}%</text></view>
        <view class="metric"><text class="metric-label">答对</text><text class="metric-number">{{ challenge.correct_count }}<text class="metric-unit">/{{ challenge.total_questions }}</text></text></view>
        <view class="metric"><text class="metric-label">完成用时</text><text class="metric-number">{{ timeText }}</text></view>
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
          <view>
            <text class="section-kicker">ANSWER REVIEW</text>
            <text class="section-title">二十题战况</text>
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
.page{min-height:100vh;padding:0 24rpx calc(64rpx + env(safe-area-inset-bottom));overflow:hidden;background:radial-gradient(circle at 80% 18%,rgba(220,175,70,.1),transparent 32%),#EEF3F0;color:#173A34}.state{margin-top:24rpx;padding:28rpx;border-radius:22rpx;background:#fff}.result-hero{position:relative;min-height:580rpx;margin:0 -24rpx;padding:48rpx 32rpx 78rpx;overflow:hidden;border-radius:0 0 52rpx 18rpx;background:#102E28;color:#fff;text-align:center}.hero-grid{position:absolute;inset:0;opacity:.18;background-image:linear-gradient(rgba(176,216,205,.13) 1rpx,transparent 1rpx),linear-gradient(90deg,rgba(176,216,205,.13) 1rpx,transparent 1rpx);background-size:66rpx 66rpx;transform:perspective(500rpx) rotateX(58deg) scale(1.45) translateY(74rpx);transform-origin:center bottom}.hero-glow{position:absolute;left:50%;top:72rpx;width:520rpx;height:520rpx;border-radius:50%;background:radial-gradient(circle,rgba(231,195,101,.2),rgba(55,116,101,.08) 42%,transparent 68%);transform:translateX(-50%)}.particle{position:absolute;color:#E7C365;font-size:19rpx;opacity:0;animation:particlePulse 1.8s ease-in-out infinite}.skip-intro{position:absolute;z-index:4;right:26rpx;top:24rpx;min-height:54rpx;margin:0;padding:0 18rpx;border:1rpx solid rgba(255,255,255,.2);border-radius:10rpx;background:rgba(4,20,17,.32);color:#CBE2DC;font-size:20rpx;line-height:54rpx}.skip-intro::after{border:0}.award-orbit{position:relative;width:184rpx;height:184rpx;display:flex;align-items:center;justify-content:center;margin:8rpx auto 0}.orbit-ring{position:absolute;border:1rpx solid rgba(231,195,101,.44);border-radius:50%}.orbit-ring.outer{inset:0;animation:orbitTurn 8s linear infinite}.orbit-ring.outer::before,.orbit-ring.outer::after{content:'';position:absolute;width:10rpx;height:10rpx;border-radius:50%;background:#E7C365;box-shadow:0 0 20rpx rgba(231,195,101,.8)}.orbit-ring.outer::before{left:19rpx;top:22rpx}.orbit-ring.outer::after{right:9rpx;bottom:40rpx}.orbit-ring.inner{inset:21rpx;border-style:dashed;opacity:.56;animation:orbitTurn 10s linear infinite reverse}.award-symbol{position:relative;z-index:1;font-size:88rpx;filter:drop-shadow(0 12rpx 20rpx rgba(0,0,0,.28));animation:awardFloat 2.8s ease-in-out infinite}.result-kicker{display:block;margin-top:13rpx;color:#A7D1C7;font-size:20rpx;font-weight:750;letter-spacing:3rpx}.score-lockup{display:flex;align-items:flex-end;justify-content:center;gap:14rpx;margin-top:2rpx}.score{color:#FFF7E6;font-size:122rpx;font-weight:950;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-7rpx;text-shadow:0 16rpx 40rpx rgba(0,0,0,.32)}.score-label{padding-bottom:16rpx;color:#90B9AF;font-size:20rpx;writing-mode:vertical-rl;letter-spacing:3rpx}.award-headline{display:block;margin-top:6rpx;color:#E7C365;font-size:28rpx;font-weight:750;letter-spacing:1rpx}.fish-tag{display:inline-flex;margin-top:14rpx;padding:8rpx 14rpx;border-left:4rpx solid #E7C365;background:rgba(231,195,101,.12);color:#F4D989;font-size:20rpx;font-weight:750}.motion-block{opacity:0;transform:translateY(30rpx) scale(.94);transition:opacity .48s ease,transform .58s cubic-bezier(.2,.8,.2,1)}.motion-block.show{opacity:1;transform:translateY(0) scale(1)}.metrics{position:relative;z-index:2;display:grid;grid-template-columns:1.18fr 1fr 1fr;margin:-40rpx 6rpx 0;padding:28rpx 20rpx 22rpx;border-radius:16rpx 32rpx 18rpx 32rpx;background:#F7F4EB;box-shadow:0 22rpx 45rpx rgba(24,58,52,.13)}.metric{min-width:0;padding:3rpx 16rpx;border-left:1rpx solid #D9DED8;text-align:left}.metric:first-child{border:0}.metric-label{display:block;color:#7B8D87;font-size:19rpx;letter-spacing:1rpx}.metric-number{display:block;margin-top:8rpx;color:#173A34;font-size:35rpx;font-weight:880;line-height:1;font-variant-numeric:tabular-nums}.metric.primary .metric-number{color:#B07616;font-size:46rpx}.metric-unit{font-size:22rpx;font-weight:650}.score-formula{grid-column:1/-1;margin:24rpx 0 0;padding-top:17rpx;border-top:1rpx solid #D9DED8;color:#62766F;font-size:20rpx;text-align:center}.score-formula text{padding:0 8rpx;color:#C18A28}.motion-panel{opacity:0;transform:translateY(42rpx);pointer-events:none;transition:opacity .55s ease,transform .62s cubic-bezier(.2,.8,.2,1)}.motion-panel.show{opacity:1;transform:translateY(0);pointer-events:auto}.action-zone{margin-top:22rpx}.action-grid{display:grid;grid-template-columns:.92fr 1.08fr;gap:12rpx}.rank-btn,.again-btn,.poster-btn{display:flex;align-items:center;justify-content:center;margin:0;border:0;border-radius:14rpx;font-weight:800}.rank-btn::after,.again-btn::after,.poster-btn::after{border:0}.rank-btn:active,.again-btn:active,.poster-btn:active,.save-poster:active,.share-poster:active{transform:scale(.98)}.rank-btn,.again-btn{min-height:90rpx;font-size:25rpx}.rank-btn{background:#DDE8E4;color:#284D45}.again-btn{background:#173A34;color:#fff;box-shadow:0 14rpx 24rpx rgba(23,58,52,.16)}.poster-btn{min-height:88rpx;margin-top:12rpx;background:#E5BD5B;color:#3E2D08;font-size:25rpx;box-shadow:0 12rpx 25rpx rgba(181,132,28,.17)}.poster-btn[disabled]{opacity:.7}.poster-spark{margin-right:10rpx;font-size:25rpx}.review-card{margin-top:24rpx;padding:30rpx 26rpx 10rpx;border-radius:32rpx 16rpx 32rpx 16rpx;background:#fff;box-shadow:0 18rpx 40rpx rgba(42,76,68,.07)}.section-head{display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:22rpx}.section-kicker{display:block;color:#95A59F;font-size:17rpx;font-weight:750;letter-spacing:3rpx}.section-title{display:block;margin-top:6rpx;color:#173A34;font-size:34rpx;font-weight:880;letter-spacing:-1rpx}.wrong-count{padding:9rpx 13rpx;border-radius:8rpx;background:#F7E4DF;color:#A54940;font-size:20rpx;font-weight:750}.wrong-count.perfect{background:#E2EFEA;color:#2D6D5E}.perfect-note{margin-bottom:8rpx;padding:25rpx;border-left:5rpx solid #D7AD49;background:#F8F3E5}.perfect-mark{display:block;color:#8B6110;font-size:27rpx;font-weight:850}.perfect-copy{display:block;margin-top:6rpx;color:#6C766F;font-size:21rpx}.answer-row{display:flex;gap:16rpx;padding:22rpx 0;border-top:1rpx solid #E7ECE9}.answer-no{width:44rpx;height:44rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:10rpx;background:#F4DFDA;color:#A14940;font-size:22rpx;font-weight:850}.answer-row.correct .answer-no{background:#DDECE7;color:#276B5B}.answer-copy{flex:1;min-width:0}.answer-stem{display:block;color:#173A34;font-size:26rpx;font-weight:680;line-height:1.55}.answer-meta{display:flex;flex-wrap:wrap;gap:8rpx 20rpx;margin-top:9rpx}.your-answer,.correct-answer{display:flex;align-items:center;flex-wrap:wrap;color:#A14940;font-size:21rpx}.answer-row.correct .your-answer,.correct-answer{color:#276B5B}.your-answer>text,.correct-answer>text{margin-right:7rpx;color:#899791;font-size:18rpx}.answer-inline{width:auto;flex:none;font-weight:720}.question-report{min-height:46rpx;margin:7rpx 0 0;padding:0;background:transparent;color:#74837E;font-size:19rpx;line-height:46rpx;text-align:left;text-decoration:underline}.question-report::after{border:0}.answer-row-motion{opacity:0;transform:translateY(24rpx);animation:rowReveal .44s cubic-bezier(.2,.8,.2,1) forwards}.answer-row-motion.instant{opacity:1;transform:none;animation:none}.poster-overlay{position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-top:80rpx;background:rgba(5,20,17,.78)}.poster-sheet{position:relative;width:100%;max-height:92vh;padding:32rpx 24rpx calc(30rpx + env(safe-area-inset-bottom));overflow-y:auto;border-radius:34rpx 34rpx 0 0;background:#F2F0E8;box-shadow:0 -24rpx 60rpx rgba(0,0,0,.24)}.poster-close{position:absolute;z-index:2;right:22rpx;top:20rpx;width:64rpx;height:64rpx;margin:0;padding:0;border-radius:50%;background:#173A34;color:#fff;font-size:42rpx;font-weight:400;line-height:58rpx}.poster-close::after{border:0}.poster-sheet-head{padding:6rpx 78rpx 22rpx 6rpx}.poster-eyebrow{display:block;color:#9B762A;font-size:18rpx;font-weight:800;letter-spacing:3rpx}.poster-title{display:block;margin-top:5rpx;color:#173A34;font-size:38rpx;font-weight:900;letter-spacing:-1rpx}.poster-sub{display:block;margin-top:8rpx;color:#6F7E79;font-size:20rpx;line-height:1.55}.poster-loading,.poster-error{min-height:520rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:18rpx;background:#102E28;color:#D8EAE5;text-align:center}.loading-crown{font-size:96rpx;animation:awardFloat 2s ease-in-out infinite}.poster-loading text{margin-top:22rpx;font-size:22rpx}.poster-error{padding:50rpx}.poster-error-title{color:#F6F0E1;font-size:30rpx;font-weight:850}.poster-error-copy{margin-top:10rpx;color:#A9C6BE;font-size:21rpx;line-height:1.55}.retry-poster{min-height:76rpx;margin-top:25rpx;padding:0 34rpx;border-radius:12rpx;background:#E5BD5B;color:#3E2D08;font-size:23rpx;font-weight:800}.retry-poster::after{border:0}.poster-preview{width:100%;display:block;border-radius:18rpx;background:#102E28;box-shadow:0 18rpx 38rpx rgba(20,48,42,.18)}.poster-actions{display:grid;grid-template-columns:1fr 1fr;gap:12rpx;margin-top:16rpx}.save-poster,.share-poster{min-height:86rpx;display:flex;align-items:center;justify-content:center;margin:0;border-radius:14rpx;font-size:24rpx;font-weight:800}.save-poster{background:#E5BD5B;color:#3E2D08}.share-poster{background:#173A34;color:#fff}.save-poster::after,.share-poster::after{border:0}.share-note{display:block;margin-top:13rpx;color:#798780;font-size:19rpx;line-height:1.5;text-align:center}.poster-canvas{position:fixed;left:-2000px;top:0;width:750px;height:1000px;pointer-events:none}
@keyframes rowReveal{to{opacity:1;transform:translateY(0)}}@keyframes awardFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10rpx) rotate(2deg)}}@keyframes orbitTurn{to{transform:rotate(360deg)}}@keyframes particlePulse{0%,100%{opacity:0;transform:scale(.5) rotate(0)}50%{opacity:.75;transform:scale(1.15) rotate(45deg)}}
</style>
