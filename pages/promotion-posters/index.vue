<template>
  <view class="studio-page">
    <view class="studio-hero">
      <view class="hero-orbit orbit-one" />
      <view class="hero-orbit orbit-two" />
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
            <text class="workspace-title">{{ selected.event_type==='mental_first' ? '本周榜首播报' : '压轴通关喜报' }}</text>
          </view>
          <view :class="['privacy-stamp',selected.event_type]">隐私已处理</view>
        </view>

        <view :class="['poster-preview',selected.event_type]">
          <template v-if="selected.event_type==='mental_first'">
            <view class="mental-grid" />
            <view class="poster-gold-spine" />
            <view class="poster-topline" />
            <text class="mental-en">PANPAN WEEKLY MENTAL CHAMPION</text>
            <text class="mental-cn">本周口算王 · 新榜首</text>
            <view class="rank-orbit">
              <text class="rank-number">01</text>
              <text class="rank-caption">WEEKLY RANK</text>
            </view>
            <text class="battle-label">{{ selected.battle_label }}</text>
            <text class="mental-name">{{ selected.student_name }}</text>
            <text class="mental-proof">凭真实成绩登上本周榜首</text>
            <text class="mental-score">{{ selected.score }}</text>
            <text class="score-caption">SCORE / 本局得分</text>
            <view class="mental-metrics">
              <view><text>正确率</text><text class="metric-strong">{{ selected.accuracy }}%</text></view>
              <view><text>答对</text><text class="metric-strong">{{ selected.correct_count }}/{{ selected.total_questions }}</text></view>
              <view><text>用时</text><text class="metric-strong">{{ selected.elapsed_seconds }}秒</text></view>
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
              <text>PANPAN · PROBLEM SOLVED</text>
              <text class="challenge-head-title">压轴挑战 · 通关记录</text>
            </view>
            <view class="challenge-spine" />
            <view class="solved-seal"><text>已</text><text>攻</text><text>克</text></view>
            <text class="challenge-type">{{ selected.question_type_label }}</text>
            <text class="challenge-name">{{ selected.student_name }}</text>
            <text class="challenge-proof">独立思考，完整作答，成功通关</text>
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
.studio-page{min-height:100vh;padding:0 24rpx calc(64rpx + env(safe-area-inset-bottom));overflow-x:hidden;background:#E9EEEB;color:#153630}.studio-hero{position:relative;min-height:490rpx;margin:0 -24rpx;padding:62rpx 38rpx 54rpx;box-sizing:border-box;overflow:hidden;border-radius:0 0 54rpx 18rpx;background:#0C2B26;color:#fff}.studio-hero::after{content:'';position:absolute;inset:0;opacity:.16;background-image:radial-gradient(circle at 20% 20%,#E5C36B 0 2rpx,transparent 3rpx);background-size:52rpx 52rpx}.studio-kicker,.studio-title,.studio-copy,.studio-rule,.studio-serial{position:relative;z-index:2;display:block}.studio-kicker{color:#9CC8BD;font-size:18rpx;font-weight:800;letter-spacing:4rpx}.studio-title{max-width:610rpx;margin-top:24rpx;color:#F5F0E4;font-size:53rpx;font-weight:900;line-height:1.18;letter-spacing:-2rpx}.studio-rule{width:94rpx;height:7rpx;margin-top:30rpx;background:#E3BB58}.studio-copy{max-width:560rpx;margin-top:18rpx;color:#B8D2CC;font-size:22rpx;line-height:1.65}.studio-serial{position:absolute;z-index:3;right:34rpx;top:48rpx;color:#E3BB58;font-family:"DIN Alternate",monospace;font-size:20rpx;letter-spacing:2rpx}.hero-orbit{position:absolute;z-index:1;border:1rpx solid rgba(227,187,88,.22);border-radius:50%}.orbit-one{right:-122rpx;bottom:-158rpx;width:450rpx;height:450rpx}.orbit-two{right:-56rpx;bottom:-92rpx;width:318rpx;height:318rpx;border-style:dashed}.event-section{margin:30rpx -24rpx 0;padding:0 0 28rpx}.section-heading{display:flex;align-items:flex-end;justify-content:space-between;padding:0 28rpx}.section-kicker,.section-title{display:block}.section-kicker{color:#8C6A20;font-size:18rpx;font-weight:800;letter-spacing:3rpx}.section-title{margin-top:7rpx;color:#153630;font-size:38rpx;font-weight:900;letter-spacing:-1rpx}.archive-count{color:#72817C;font-size:22rpx}.event-scroll{margin-top:20rpx;white-space:nowrap}.event-track{display:inline-flex;gap:14rpx;padding:0 28rpx}.event-ticket{position:relative;width:330rpx;min-height:154rpx;display:flex;align-items:center;gap:17rpx;margin:0;padding:20rpx;border:1rpx solid transparent;border-radius:16rpx 30rpx 16rpx 30rpx;background:#F6F3EA;text-align:left;box-shadow:0 12rpx 32rpx rgba(22,54,48,.08);transition:transform .18s ease,border-color .18s ease}.event-ticket::after{border:0}.event-ticket:active{transform:scale(.975)}.event-ticket.active{border-color:#D5AA44;background:#FFF9E8}.event-ticket.challenge_pass.active{border-color:#B95A3A;background:#FFF5EC}.ticket-index{width:78rpx;height:98rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:10rpx 24rpx 10rpx 24rpx;background:#163A33;color:#E6C46B;font-family:"DIN Alternate",monospace;font-size:39rpx;font-weight:900}.challenge_pass .ticket-index{background:#B65437;color:#FFF3E5}.ticket-copy{min-width:0}.ticket-type,.ticket-name,.ticket-date{display:block}.ticket-type{color:#8D6A1F;font-size:19rpx;font-weight:800}.challenge_pass .ticket-type{color:#A14E35}.ticket-name{margin-top:5rpx;color:#173A34;font-size:28rpx;font-weight:850}.ticket-date{margin-top:6rpx;color:#89938F;font-family:monospace;font-size:18rpx}.ticket-new{position:absolute;right:13rpx;top:12rpx;color:#B55536;font-size:14rpx;font-weight:900;letter-spacing:1rpx}.poster-workspace{margin-top:2rpx;padding:26rpx 20rpx 28rpx;border-radius:30rpx 14rpx 30rpx 14rpx;background:#F7F4EC;box-shadow:0 22rpx 48rpx rgba(17,51,45,.12)}.workspace-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20rpx;padding:0 4rpx 20rpx}.workspace-label,.workspace-title{display:block}.workspace-label{color:#967022;font-size:16rpx;font-weight:850;letter-spacing:3rpx}.workspace-title{margin-top:6rpx;color:#173A34;font-size:32rpx;font-weight:900}.privacy-stamp{padding:8rpx 12rpx;border:1rpx solid #A88742;color:#80611D;font-size:17rpx;font-weight:750;transform:rotate(-3deg)}.privacy-stamp.challenge_pass{border-color:#B75B40;color:#A34D34}.poster-preview{position:relative;width:100%;aspect-ratio:3/4;overflow:hidden;box-sizing:border-box;box-shadow:0 22rpx 50rpx rgba(9,34,29,.2)}.poster-preview text,.poster-preview strong,.poster-preview em{position:absolute;z-index:2;display:block}.poster-preview.mental_first{background:radial-gradient(circle at 78% 24%,rgba(224,184,86,.13),transparent 27%),linear-gradient(150deg,#103831 0%,#09241F 62%,#061714 100%);color:#fff}.mental-grid{position:absolute;inset:0;opacity:.14;background-image:linear-gradient(rgba(190,220,211,.24) 1rpx,transparent 1rpx),linear-gradient(90deg,rgba(190,220,211,.24) 1rpx,transparent 1rpx);background-size:56rpx 56rpx}.poster-gold-spine{position:absolute;inset:0 auto 0 0;width:10rpx;background:#E4BE62}.poster-topline{position:absolute;left:7%;top:6.2%;width:12%;height:5rpx;background:#E4BE62}.mental-en{left:7%;top:9.6%;color:#A8D0C6;font-size:15rpx;font-weight:750;letter-spacing:1rpx}.mental-cn{left:7%;top:14.3%;color:#F5EDDC;font-size:29rpx;font-weight:850}.rank-orbit{position:absolute;z-index:1;right:5%;top:13%;width:38%;aspect-ratio:1;border:1rpx solid rgba(228,190,98,.5);border-radius:50%;background:rgba(228,190,98,.08)}.rank-orbit::before{content:'';position:absolute;inset:15%;border:1rpx dashed rgba(228,190,98,.32);border-radius:50%}.rank-number{inset:22% 0 auto!important;color:#E4BE62;font-family:"DIN Alternate",monospace;font-size:90rpx!important;font-weight:900;text-align:center}.rank-caption{inset:auto 0 20%!important;color:#E4BE62;font-size:11rpx!important;font-weight:800;letter-spacing:2rpx;text-align:center}.battle-label{left:7%;top:24%;color:#E4BE62;font-size:17rpx}.mental-name{left:7%;top:29%;color:#fff;font-size:51rpx;font-weight:900}.mental-proof{left:7%;top:37%;color:#A7C8C0;font-size:17rpx}.mental-score{left:6%;top:41%;color:#FFF6E2;font-family:"DIN Alternate",monospace;font-size:112rpx;font-weight:950;letter-spacing:-5rpx}.score-caption{left:7%;top:59.3%;color:#E4BE62;font-size:14rpx;font-weight:800;letter-spacing:1rpx}.mental-metrics{position:absolute;z-index:2;left:7%;right:7%;top:64%;display:grid;grid-template-columns:repeat(3,1fr)}.mental-metrics view{min-width:0;padding-left:14rpx;border-left:1rpx solid rgba(168,208,198,.2)}.mental-metrics view:first-child{padding-left:0;border:0}.mental-metrics text,.mental-metrics strong{position:static!important}.mental-metrics text{color:#7FA89E;font-size:14rpx}.mental-metrics strong{margin-top:4rpx;color:#F5EDDC;font-family:"DIN Alternate",monospace;font-size:27rpx}.poster-cta{position:absolute;z-index:2;left:5.5%;right:5.5%;bottom:6.4%;display:flex;align-items:center;gap:19rpx;box-sizing:border-box}.mental-cta{height:19%;padding:4%;border-radius:19rpx;background:#EFE6D4}.qr-shell{width:25%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;flex:none;padding:7rpx;box-sizing:border-box;border-radius:12rpx;background:#fff}.qr-shell image{width:100%;height:100%}.qr-placeholder{position:relative;width:100%;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#173A34 0 3rpx,#fff 3rpx 7rpx)}.qr-placeholder::after{content:'';position:absolute;inset:27%;background:#fff}.qr-placeholder i{position:absolute;z-index:2;width:25%;height:25%;border:5rpx solid #173A34;background:#fff}.qr-placeholder i:nth-child(1){left:5%;top:5%}.qr-placeholder i:nth-child(2){right:5%;top:5%}.qr-placeholder i:nth-child(3){left:5%;bottom:5%}.qr-placeholder text{inset:37% 0 auto!important;color:#173A34;font-size:17rpx!important;font-weight:900;text-align:center}.cta-copy{position:relative;flex:1;align-self:center}.cta-copy strong,.cta-copy text,.cta-copy em{position:static!important}.cta-copy strong{color:#173A34;font-size:22rpx;font-style:normal}.cta-copy text{margin-top:7rpx;color:#60736D;font-size:14rpx}.cta-copy em{margin-top:7rpx;color:#98701B;font-size:13rpx;font-style:normal;font-weight:750}.poster-privacy{left:7%;bottom:2%;font-size:11rpx}.mental-privacy{color:#76968E}.poster-preview.challenge_pass{background:#F3EADC;color:#173A34}.challenge-grid{position:absolute;inset:0;opacity:.42;background-image:linear-gradient(rgba(47,66,59,.1) 1rpx,transparent 1rpx),linear-gradient(90deg,rgba(47,66,59,.1) 1rpx,transparent 1rpx);background-size:36rpx 36rpx}.challenge-head{position:absolute;z-index:2;left:0;right:0;top:0;height:15.4%;box-sizing:border-box;padding:5.2% 6.5%;background:#173A34}.challenge-head text,.challenge-head strong{position:static!important}.challenge-head text{color:#A9CFC5;font-size:14rpx;font-weight:750;letter-spacing:1rpx}.challenge-head strong{margin-top:7rpx;color:#fff;font-size:29rpx}.challenge-spine{position:absolute;left:0;top:15.4%;bottom:0;width:11rpx;background:#C85F3B}.solved-seal{position:absolute;z-index:2;right:8%;top:19%;width:19%;aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:11rpx;background:#C85F3B;color:#FFF5E7}.solved-seal text{position:static!important;font-size:19rpx;font-weight:900;line-height:1.34}.challenge-type{left:7%;top:21%;color:#A84D32;font-size:15rpx;font-weight:800}.challenge-name{left:7%;top:26%;color:#173A34;font-size:51rpx;font-weight:900}.challenge-proof{left:7%;top:34%;color:#5F6E68;font-size:17rpx}.challenge-headline{left:7%;right:7%;top:41%;color:#173A34;font-size:34rpx;font-weight:900;line-height:1.25}.question-title{left:7%;right:8%;top:50.5%;color:#725F4E;font-size:16rpx;line-height:1.5}.challenge-data{position:absolute;z-index:2;left:7%;right:7%;top:62%;display:grid;grid-template-columns:.9fr 1.2fr;gap:28rpx;padding-top:16rpx;border-top:5rpx solid #C85F3B}.challenge-data text,.challenge-data strong,.challenge-data em{position:static!important}.challenge-data text{color:#7D6A59;font-size:14rpx}.passed-data strong{display:inline-block!important;margin-top:3rpx;color:#173A34;font-family:"DIN Alternate",monospace;font-size:50rpx}.passed-data em{display:inline-block!important;margin-left:8rpx;color:#173A34;font-size:16rpx;font-style:normal;font-weight:750}.source-data strong{margin-top:9rpx;color:#173A34;font-size:17rpx;line-height:1.35}.challenge-cta{height:15.5%;padding:3.4%;border-radius:15rpx;background:#173A34}.challenge-cta .qr-shell{width:22%}.challenge-cta .cta-copy strong{color:#fff;font-size:20rpx}.challenge-cta .cta-copy text{color:#B9D8D0}.challenge-cta .cta-copy em{color:#E1B95B}.challenge-privacy{color:#806E5E}.generation-strip,.generation-error,.poster-ready{min-height:66rpx;display:flex;align-items:center;justify-content:center;margin-top:16rpx;border-radius:12rpx;background:#E4ECE8;color:#4B665F;font-size:19rpx}.generation-strip{position:relative;overflow:hidden}.generation-line{position:absolute;left:0;bottom:0;width:42%;height:4rpx;background:#D3A83F;animation:generation 1.2s ease-in-out infinite}.generation-error{justify-content:space-between;padding:10rpx 16rpx;background:#F8E7E0;color:#9E4B36}.generation-error button{min-height:48rpx;margin:0;padding:0 17rpx;border-radius:8rpx;background:#A85139;color:#fff;font-size:18rpx}.generation-error button::after{border:0}.poster-ready{background:#E0ECE7;color:#2D695A}.poster-actions{display:grid;grid-template-columns:1.1fr .9fr;gap:12rpx;margin-top:14rpx}.poster-actions button{min-height:88rpx;margin:0;border-radius:14rpx;font-size:25rpx;font-weight:800;transition:transform .18s ease}.poster-actions button::after{border:0}.poster-actions button:active{transform:scale(.98)}.save-action{background:#DDB855;color:#3C2D0E}.share-action{background:#173A34;color:#fff}.poster-actions button[disabled]{opacity:.46}.share-tip{display:block;margin-top:14rpx;color:#7B8883;font-size:18rpx;line-height:1.5;text-align:center}.empty-archive{margin-top:34rpx;padding:70rpx 40rpx;border-left:9rpx solid #D2A640;background:#F5F1E7}.empty-index,.empty-title,.empty-copy{display:block}.empty-index{color:#D2A640;font-family:"DIN Alternate",monospace;font-size:84rpx;font-weight:900}.empty-title{margin-top:16rpx;color:#173A34;font-size:31rpx;font-weight:850;line-height:1.4}.empty-copy{margin-top:12rpx;color:#6D7B76;font-size:22rpx;line-height:1.65}.poster-canvas{position:fixed;left:-2000px;top:0;width:750px;height:1000px;pointer-events:none}@keyframes generation{0%{transform:translateX(-110%)}100%{transform:translateX(340%)}}
.mental-metrics .metric-strong{margin-top:4rpx;color:#F5EDDC;font-family:"DIN Alternate",monospace;font-size:27rpx}.qr-corner{position:absolute;z-index:2;width:25%;height:25%;box-sizing:border-box;border:5rpx solid #173A34;background:#fff}.qr-corner.c1{left:5%;top:5%}.qr-corner.c2{right:5%;top:5%}.qr-corner.c3{left:5%;bottom:5%}.cta-copy .cta-title{margin-top:0;color:#173A34;font-size:22rpx;font-weight:800}.cta-copy .cta-brand{color:#98701B;font-size:13rpx;font-weight:750}.challenge-head .challenge-head-title{margin-top:7rpx;color:#fff;font-size:29rpx;font-weight:800;letter-spacing:0}.passed-data .passed-number{display:inline-block!important;margin-top:3rpx;color:#173A34;font-family:"DIN Alternate",monospace;font-size:50rpx}.passed-data .passed-unit{display:inline-block!important;margin-left:8rpx;color:#173A34;font-size:16rpx;font-weight:750}.source-data .source-name{margin-top:9rpx;color:#173A34;font-size:17rpx;line-height:1.35;font-weight:800}.challenge-cta .cta-copy .cta-title{color:#fff;font-size:20rpx}.challenge-cta .cta-copy .cta-brand{color:#E1B95B}
.question-title{top:46%;font-size:14rpx;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.challenge-question-media{position:absolute;z-index:2;left:6.5%;right:6.5%;top:51.5%;height:19.3%;overflow:hidden;border:9rpx solid #fff;border-radius:16rpx;background:#E8DED0;box-shadow:0 8rpx 20rpx rgba(67,48,35,.12)}.challenge-question-media image,.question-image-placeholder{width:100%;height:100%}.question-image-placeholder{display:flex;align-items:center;justify-content:center;color:#806E5E;font-size:18rpx}.challenge-question-media text{left:9rpx;top:9rpx;padding:6rpx 10rpx;border-radius:7rpx;background:rgba(23,58,52,.88);color:#fff;font-size:12rpx;font-weight:750}.challenge-data{top:73.4%;grid-template-columns:.75fr 1.45fr;gap:22rpx;padding-top:12rpx}.challenge-data text{font-size:12rpx}.passed-data .passed-number{margin-top:2rpx;font-size:34rpx}.passed-data .passed-unit{margin-left:7rpx;font-size:13rpx}.source-data .source-name{margin-top:5rpx;font-size:14rpx;line-height:1.25}.challenge-cta{bottom:5.5%;height:11.2%;padding:2.6%}.challenge-cta .qr-shell{width:19%}.challenge-cta .cta-copy .cta-title{font-size:18rpx}
</style>
