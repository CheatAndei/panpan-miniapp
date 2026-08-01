<template>
  <view class="page page-bottom-safe learning-page student-challenge-page">
    <view class="page-hero learning-hero">
      <view class="hero-top">
        <view class="workbook-label">
          <view class="workbook-label-mark" aria-hidden="true"></view>
          <text class="eyebrow">LEARNING HUB</text>
        </view>
        <view class="hero-tools" aria-hidden="true">
          <view class="hero-tool hero-tool--blue"><pp-icon name="pencil" :size="32" motion="pop" :delay="80" /></view>
          <view class="hero-tool hero-tool--mint"><pp-icon name="calculator" :size="32" motion="bob" :delay="160" /></view>
        </view>
      </view>
      <view class="hero-copy">
        <text class="hero-title">学习中心</text>
        <text class="hero-sub">短练习、错题巩固与阶段挑战，都收在这里</text>
      </view>
      <view class="hero-foot">
        <view class="subject-chip"><view class="subject-dot"></view><text>数学分层练习</text></view>
        <text class="hero-foot-note">每天进步一点点</text>
      </view>
    </view>

    <view class="section-nav-shell">
      <view class="section-nav" aria-label="家长端学习导航">
        <button class="nav-item" @tap="goToday"><pp-icon name="calendar" :size="25" decorative />今日</button>
        <button class="nav-item active" aria-current="page"><pp-icon name="book" :size="25" decorative />学习</button>
        <button class="nav-item" @tap="goGrowth"><pp-icon name="trophy" :size="25" decorative />成长</button>
      </view>
      <view class="notebook-rule" aria-hidden="true"></view>
    </view>

    <view class="grade-panel">
      <view class="grade-panel-head">
        <view>
          <text class="grade-panel-kicker">练习册页签</text>
          <text class="grade-panel-title">选择学习阶段</text>
        </view>
        <view class="math-mark" aria-hidden="true"><text>x²</text><view class="math-mark-line"></view></view>
      </view>
      <view class="grade-switch" role="tablist" aria-label="学习学段">
        <button
          v-for="item in gradeTabs"
          :key="item.value"
          :class="['grade-tab',{active:selectedGrade===item.value}]"
          :disabled="loading"
          @tap="changeGrade(item.value)"
        >
          <view class="grade-tab-pin" aria-hidden="true"></view>
          <text>{{ item.label }}</text>
          <text class="grade-tab-sub">{{ item.sub }}</text>
        </button>
      </view>
    </view>

    <view v-if="loading && !catalog" class="state-sheet">
      <pp-state type="loading" title="正在整理学习内容" />
    </view>
    <view v-else-if="error && !catalog" class="state-sheet state-sheet--error">
      <pp-state type="error" title="学习内容加载失败" :description="error" action-text="重新加载" @action="loadCatalog" />
    </view>
    <view v-else-if="!studentId && !catalog" class="state-sheet">
      <pp-state type="empty" title="请先选择孩子" description="返回今日页选择孩子后，再进入学习中心" action-text="返回今日" @action="goToday" />
    </view>

    <template v-if="catalog">
      <view v-if="loading" class="refresh-status" role="status">
        <view class="refresh-status-dot"></view>
        <text>正在更新学习内容</text>
      </view>
      <view v-if="error" class="inline-error" role="alert">
        <view class="inline-error-copy">
          <pp-icon name="bell" :size="30" motion="ring" />
          <text>{{ error }}</text>
        </view>
        <button :disabled="loading" @tap="loadCatalog">重新加载</button>
      </view>

      <view class="overview-card ruled-card">
        <view class="overview-icon"><pp-icon name="target" :size="38" motion="breathe" :delay="240" /></view>
        <view class="overview-copy">
          <text class="overview-label">今日建议</text>
          <text class="overview-title">先热身，再做一项重点练习</text>
        </view>
        <view class="wrong-pill">
          <text class="wrong-pill-label">待巩固</text>
          <view><text class="num">{{ catalog.open_wrong_count }}</text><text> 道待掌握</text></view>
        </view>
      </view>

      <view v-if="selectedGrade==='g8'&&catalog.content_scope?.empty" class="scope-paused-note" role="status">
        <view class="scope-paused-icon"><pp-icon name="bell" :size="30" /></view>
        <view>
          <text class="scope-paused-title">老师暂未开放学习范围</text>
          <text class="scope-paused-copy">客观题与压轴挑战已暂停；每日打卡和试卷库仍可使用。</text>
        </view>
      </view>

      <button v-if="catalog.features?.choice_king" class="choice-king-card" :disabled="loading" aria-label="开始选择刷题王" @tap="openChoiceKing">
        <view class="choice-king-icon"><pp-icon name="exam" :size="46" motion="shine" :delay="320" /></view>
        <view class="choice-king-copy">
          <text class="choice-king-kicker">原卷选择题专项</text>
          <text class="choice-king-title">选择刷题王</text>
          <text class="choice-king-desc">单题即时判分，答错自动进入错题复习</text>
        </view>
        <view class="choice-king-action">
          <text>开始刷题</text>
          <pp-icon name="arrow" :size="30" />
        </view>
      </button>

      <view class="section-head">
        <view class="section-heading">
          <view class="section-heading-icon"><pp-icon name="pencil" :size="30" motion="pop" :delay="400" /></view>
          <view>
            <text class="section-kicker">每天都能做</text>
            <text class="section-title">轻量练习</text>
          </view>
        </view>
        <text class="section-note">5–15 分钟</text>
      </view>
      <view class="learning-grid">
        <button
          v-for="item in dailySections"
          :key="item.type"
          :class="['learning-card', `tone-${item.accent}`]"
          :disabled="loading"
          :aria-label="item.title"
          @tap="openSection(item)"
        >
          <view class="card-top">
            <view class="card-icon"><pp-icon :name="iconFor(item.type)" :size="38" /></view>
            <view class="card-rule-mark" aria-hidden="true"><view></view><view></view><view></view></view>
          </view>
          <text class="card-title">{{ item.title }}</text>
          <text class="card-desc">{{ item.description }}</text>
          <view class="card-foot"><text>{{ item.count ? `${item.count} 题` : '进入' }}</text><pp-icon name="arrow" :size="30" /></view>
        </button>
      </view>

      <view class="section-head spaced">
        <view class="section-heading">
          <view class="section-heading-icon section-heading-icon--reward"><pp-icon name="trophy" :size="30" motion="shine" :delay="480" /></view>
          <view>
            <text class="section-kicker">阶段提升</text>
            <text class="section-title">挑战与测评</text>
          </view>
        </view>
        <text class="section-note">按节奏选择</text>
      </view>
      <view class="challenge-list">
        <button
          v-for="item in challengeSections"
          :key="item.type"
          :class="['challenge-card', { locked:item.locked }]"
          :disabled="loading"
          :aria-disabled="item.locked ? 'true' : 'false'"
          :aria-label="item.title"
          @tap="openSection(item)"
        >
          <view :class="['challenge-mark', `tone-${item.accent}`]"><pp-icon :name="iconFor(item.type)" :size="42" /></view>
          <view class="challenge-copy">
            <text class="challenge-title">{{ item.title }}</text>
            <text class="challenge-desc">{{ item.locked ? item.lock_text : item.description }}</text>
          </view>
          <text v-if="item.locked" class="lock-label">周末</text>
          <pp-icon v-else name="arrow" :size="32" />
        </button>
      </view>

      <view v-if="!(catalog.sections || []).length && !catalog.features?.choice_king" class="state-sheet state-sheet--empty">
        <pp-state type="empty" title="这个学段的内容正在整理" description="稍后再来看看" />
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const studentId = ref(0);
const catalog = ref(null);
const loading = ref(false);
const error = ref('');
const selectedGrade=ref('');
const gradeTabs=[
  {value:'g7',label:'七年级',sub:'口算王'},
  {value:'g8',label:'八年级',sub:'知识点大全'},
  {value:'g9',label:'冲刺中考',sub:'全科一模'},
];
const dailyTypes = new Set(['warmup', 'weakness', 'wrong', 'practice', 'knowledge']);
const dailySections = computed(() => (catalog.value?.sections || []).filter((item) => dailyTypes.has(item.type)));
const challengeSections = computed(() => (catalog.value?.sections || []).filter((item) => !dailyTypes.has(item.type)));
const sectionIcons = Object.freeze({
  warmup: 'lightbulb',
  weakness: 'target',
  wrong: 'history',
  practice: 'pencil',
  arena: 'calculator',
  weekend: 'report',
  weekly: 'trophy',
  exams: 'exam',
  knowledge: 'lightbulb',
});

onLoad((query) => {
  studentId.value = Number(query.student_id || uni.getStorageSync('activeChildId') || 0);
  selectedGrade.value=['g7','g8','g9'].includes(String(query.grade||''))?String(query.grade):'';
});
onShow(() => { if (studentId.value) loadCatalog(); });
onPullDownRefresh(async () => { try { await loadCatalog(); } finally { uni.stopPullDownRefresh(); } });

async function loadCatalog() {
  if (!studentId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const gradeQuery=selectedGrade.value?`&grade=${selectedGrade.value}`:'';
    catalog.value = await api.get(`/learning/catalog?student_id=${studentId.value}${gradeQuery}`);
    selectedGrade.value=catalog.value.grade_code||selectedGrade.value||'g7';
  }
  catch (e) { error.value = e?.error || '请检查网络后重试'; logError('learning.catalog', e); }
  finally { loading.value = false; }
}

async function changeGrade(grade){
  if(loading.value||selectedGrade.value===grade)return;
  selectedGrade.value=grade;
  catalog.value=null;
  try{await api.put('/learning/preferences',{student_id:studentId.value,grade,subject:'math'});}
  catch(e){logError('learning.preference',e);}
  await loadCatalog();
}

function iconFor(type) {
  return sectionIcons[type] || 'book';
}

function openSection(item) {
  if (item.locked) return uni.showToast({ title: item.lock_text || '暂未开放', icon: 'none' });
  if (item.route === 'practice') return uni.navigateTo({ url: `/pages/practice-parent/index?student_id=${studentId.value}` });
  if (item.route === 'arena') return uni.navigateTo({ url: `/pages/mental-arena/index?student_id=${studentId.value}` });
  if (item.route === 'weekly_challenge') return uni.navigateTo({ url: `/pages/weekly-challenge/index?student_id=${studentId.value}&grade=${selectedGrade.value}` });
  if (item.route === 'exams') return uni.navigateTo({ url: `/pages/exam-library/index?student_id=${studentId.value}&grade=${selectedGrade.value}` });
  if (item.route === 'knowledge_challenge') return uni.navigateTo({ url: `/pages/knowledge-challenge/index?student_id=${studentId.value}&grade=${selectedGrade.value}` });
  if (!item.type) return;
  uni.navigateTo({ url: `/pages/learning-session/index?student_id=${studentId.value}&type=${item.type}&grade=${selectedGrade.value}` });
}

function openChoiceKing() {
  if (!studentId.value || loading.value) return;
  uni.navigateTo({ url: `/pages/choice-king/index?student_id=${studentId.value}&grade=${selectedGrade.value}` });
}

function goToday() { uni.switchTab({ url: '/pages/index/index' }); }
function goGrowth() { uni.navigateTo({ url: `/pages/growth/index?student_id=${studentId.value}` }); }
</script>

<style scoped>
.learning-page {
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--ink, #050505);
  background-color: var(--page-bg, #F7FCFE);
  background-image: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 55rpx,
    rgba(153, 222, 244, .045) 56rpx
  );
}

.scope-paused-note {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  margin: 18rpx 24rpx 0;
  padding: 19rpx 20rpx;
  border: 1rpx solid #F1C6BF;
  border-left: 6rpx solid #F79BC0;
  border-radius: 16rpx;
  color: #050505;
  background: #FFF7F5;
}

.scope-paused-icon {
  width: 54rpx;
  height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 14rpx;
  color: #A24E43;
  background: #FFF0F6;
}

.scope-paused-title { display: block; font-size: 25rpx; font-weight: 760; }
.scope-paused-copy { display: block; margin-top: 5rpx; color: #50545B; font-size: 21rpx; line-height: 1.5; }

.learning-hero {
  position: relative;
  box-sizing: border-box;
  margin: 20rpx 24rpx 0;
  padding: 28rpx 30rpx 30rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-left: 8rpx solid var(--primary, #0B789A);
  border-radius: 24rpx;
  background:
    linear-gradient(rgba(153, 222, 244, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(153, 222, 244, .05) 1rpx, transparent 1rpx),
    var(--surface, #FFFFFF);
  background-size: 36rpx 36rpx, 36rpx 36rpx, auto;
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
}

.learning-hero::before {
  content: '';
  position: absolute;
  left: 23rpx;
  top: 0;
  bottom: 0;
  width: 1rpx;
  background: rgba(247, 155, 192, .28);
  pointer-events: none;
}

.learning-hero::after {
  content: '';
  position: absolute;
  top: 18rpx;
  right: -18rpx;
  width: 112rpx;
  height: 24rpx;
  border-radius: 5rpx;
  background: var(--gold, #0B789A);
  opacity: .72;
  transform: rotate(2deg);
  pointer-events: none;
}

.hero-top,
.hero-foot,
.section-heading,
.inline-error-copy {
  display: flex;
  align-items: center;
}

.hero-top {
  position: relative;
  z-index: 1;
  justify-content: space-between;
  gap: 20rpx;
}

.workbook-label {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.workbook-label-mark {
  width: 26rpx;
  height: 8rpx;
  border-radius: 2rpx;
  background: var(--accent, #0B789A);
}

.learning-hero .eyebrow {
  color: var(--primary-strong, #050505);
  font-size: 20rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.hero-tools {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding-right: 52rpx;
}

.hero-tool {
  width: 58rpx;
  height: 58rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(153, 222, 244, .14);
  border-radius: 14rpx;
}

.hero-tool--blue { background: var(--primary-soft, #EDF9FC); }
.hero-tool--mint { background: var(--accent-soft, #EDF9FC); }

.hero-copy {
  position: relative;
  z-index: 1;
  margin-top: 22rpx;
}

.hero-title {
  display: block;
  color: var(--ink, #050505);
  font-size: 46rpx;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0;
}

.hero-sub {
  display: block;
  max-width: 560rpx;
  margin-top: 8rpx;
  color: var(--text-secondary, #50545B);
  font-size: 25rpx;
  line-height: 1.6;
}

.hero-foot {
  position: relative;
  z-index: 1;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 24rpx;
  padding-top: 18rpx;
  border-top: 1rpx dashed #DCE9ED;
}

.subject-chip {
  min-height: 46rpx;
  display: flex;
  align-items: center;
  gap: 9rpx;
  padding: 0 14rpx;
  border: 1rpx solid #DCE9ED;
  border-radius: 10rpx;
  background: var(--primary-soft, #EDF9FC);
  color: var(--primary-strong, #050505);
  font-size: 20rpx;
  font-weight: 700;
}

.subject-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--primary, #0B789A);
}

.hero-foot-note {
  color: var(--text-muted, #50545B);
  font-size: 20rpx;
}

.section-nav-shell {
  position: relative;
  margin: 18rpx 24rpx 0;
}

.section-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  padding: 8rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-radius: 18rpx;
  background: var(--surface, #FFFFFF);
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
}

.nav-item {
  position: relative;
  min-height: 76rpx;
  padding: 0 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border-radius: 12rpx;
  background: transparent;
  color: var(--text-muted, #50545B);
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.2;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.nav-item.active {
  background: var(--primary, #0B789A);
  color: #FFFFFF;
  box-shadow: 0 7rpx 18rpx rgba(5, 5, 5, .18);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 9rpx;
  width: 26rpx;
  height: 4rpx;
  border-radius: 4rpx;
  background: var(--gold, #0B789A);
  transform: translateX(-50%);
}

.nav-item:active { transform: scale(var(--tap-scale, .975)); opacity: .9; }

.notebook-rule {
  width: calc(100% - 28rpx);
  height: 5rpx;
  margin: 0 auto;
  border-radius: 0 0 4rpx 4rpx;
  background: #DCE9ED;
}

.grade-panel {
  box-sizing: border-box;
  margin: 18rpx 24rpx 0;
  padding: 22rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-top: 5rpx solid var(--gold, #0B789A);
  border-radius: 20rpx;
  background: var(--surface, #FFFFFF);
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
}

.grade-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.grade-panel-kicker {
  display: block;
  color: var(--accent-strong, #050505);
  font-size: 18rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.grade-panel-title {
  display: block;
  margin-top: 2rpx;
  color: var(--ink, #050505);
  font-size: 27rpx;
  font-weight: 750;
}

.math-mark {
  width: 62rpx;
  height: 54rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: var(--warning-soft, #EDF9FC);
  color: #050505;
  font-size: 24rpx;
  font-weight: 800;
  transform: rotate(2deg);
}

.math-mark-line {
  width: 32rpx;
  height: 3rpx;
  margin-top: 1rpx;
  border-radius: 2rpx;
  background: var(--gold, #0B789A);
}

.grade-switch {
  display: grid;
  grid-template-columns: 1fr 1fr 1.18fr;
  gap: 10rpx;
}

.grade-tab {
  position: relative;
  min-width: 0;
  min-height: 112rpx;
  margin: 0;
  padding: 14rpx 8rpx 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-radius: 14rpx 14rpx 10rpx 10rpx;
  background: var(--surface-muted, #F7FCFE);
  color: var(--text-secondary, #50545B);
  font-size: 24rpx;
  font-weight: 750;
  line-height: 1.25;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.grade-tab-pin {
  position: absolute;
  left: 18rpx;
  right: 18rpx;
  top: 0;
  height: 4rpx;
  border-radius: 0 0 4rpx 4rpx;
  background: #DCE9ED;
}

.grade-tab-sub {
  display: block;
  margin-top: 5rpx;
  color: var(--text-muted, #50545B);
  font-size: 17rpx;
  font-weight: 550;
}

.grade-tab.active {
  border-color: #CADCF2;
  background: var(--primary-soft, #EDF9FC);
  color: var(--primary-strong, #050505);
  box-shadow: inset 0 0 0 1rpx rgba(153, 222, 244, .08);
}

.grade-tab.active .grade-tab-pin { background: var(--primary, #0B789A); }
.grade-tab.active .grade-tab-sub { color: #050505; }
.grade-tab:active { transform: scale(var(--tap-scale, .975)); opacity: .9; }

.state-sheet {
  margin: 20rpx 24rpx 0;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-top: 5rpx solid var(--accent, #0B789A);
  border-radius: 20rpx;
  background: var(--surface, #FFFFFF);
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
}

.state-sheet--error { border-top-color: var(--coral, #F79BC0); }
.state-sheet--empty { margin-top: 18rpx; }
.state-sheet :deep(.pp-state) { padding: 48rpx 30rpx; }
.state-sheet :deep(.pp-state__action) {
  min-height: 112rpx;
  border-color: #CADCF2;
  background: #FFFFFF;
  color: var(--primary-strong, #050505);
}

.refresh-status {
  min-height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin: 14rpx 24rpx 0;
  color: var(--primary-strong, #050505);
  font-size: 21rpx;
  font-weight: 650;
}

.refresh-status-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: var(--primary, #0B789A);
}

.inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin: 16rpx 24rpx 0;
  padding: 14rpx 14rpx 14rpx 20rpx;
  border: 1rpx solid #F0C7C1;
  border-radius: 16rpx;
  background: var(--danger-soft, #FFF0F6);
  color: var(--danger, #B53A52);
  font-size: 22rpx;
}

.inline-error-copy {
  flex: 1;
  min-width: 0;
  gap: 10rpx;
}

.inline-error button {
  flex: none;
  min-height: 88rpx;
  padding: 0 20rpx;
  border: 1rpx solid #E9B7B0;
  border-radius: 12rpx;
  background: #FFFFFF;
  color: var(--danger, #B53A52);
  font-size: 21rpx;
  font-weight: 700;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.inline-error button:active { transform: scale(var(--tap-scale, .975)); opacity: .88; }

.overview-card {
  position: relative;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 72rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 18rpx;
  margin: 20rpx 24rpx 0;
  padding: 24rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-left: 6rpx solid var(--accent, #0B789A);
  border-radius: 20rpx;
  background: var(--surface, #FFFFFF);
  color: var(--ink, #050505);
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
}

.ruled-card::after {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  bottom: 13rpx;
  height: 1rpx;
  background: #DCE9ED;
  pointer-events: none;
}

.overview-icon {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: var(--accent-soft, #EDF9FC);
}

.overview-copy { min-width: 0; }

.overview-label {
  display: block;
  color: var(--accent-strong, #050505);
  font-size: 19rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.overview-title {
  display: block;
  margin-top: 4rpx;
  color: var(--ink, #050505);
  font-size: 28rpx;
  font-weight: 750;
  line-height: 1.45;
}

.wrong-pill {
  flex: none;
  min-width: 120rpx;
  padding: 10rpx 14rpx;
  border: 1rpx solid #F1C4BE;
  border-radius: 13rpx;
  background: var(--coral-soft, #FFF0F6);
  color: #B53A52;
  font-size: 19rpx;
  line-height: 1.35;
  text-align: center;
}

.wrong-pill-label {
  display: block;
  margin-bottom: 2rpx;
  color: var(--text-muted, #50545B);
  font-size: 17rpx;
}

.wrong-pill .num {
  color: var(--danger, #B53A52);
  font-size: 30rpx;
  font-weight: 800;
}

.choice-king-card {
  box-sizing: border-box;
  width: calc(100% - 48rpx);
  min-height: 184rpx;
  margin: 18rpx 24rpx 0;
  padding: 24rpx;
  display: grid;
  grid-template-columns: 82rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 18rpx;
  border: 1rpx solid #CADCF2;
  border-left: 6rpx solid var(--gold, #0B789A);
  border-radius: 20rpx;
  background: var(--warning-soft, #EDF9FC);
  color: var(--ink, #050505);
  text-align: left;
  box-shadow: 0 7rpx 20rpx rgba(154, 106, 18, .08);
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.choice-king-card::after { border: 0; }
.choice-king-card:active { transform: scale(var(--tap-scale, .975)); opacity: .92; }

.choice-king-icon {
  width: 82rpx;
  height: 82rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #DCE9ED;
  border-radius: 18rpx;
  background: #FFFFFF;
}

.choice-king-copy {
  min-width: 0;
}

.choice-king-kicker,
.choice-king-title,
.choice-king-desc {
  display: block;
}

.choice-king-kicker {
  color: #050505;
  font-size: 18rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.choice-king-title {
  margin-top: 3rpx;
  color: var(--primary-strong, #050505);
  font-size: 32rpx;
  font-weight: 800;
}

.choice-king-desc {
  margin-top: 5rpx;
  color: var(--text-secondary, #50545B);
  font-size: 21rpx;
  line-height: 1.5;
}

.choice-king-action {
  min-width: 126rpx;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5rpx;
  flex: none;
  padding: 0 14rpx;
  border-radius: 13rpx;
  background: var(--primary-strong, #050505);
  color: #FFFFFF;
  font-size: 21rpx;
  font-weight: 700;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin: 34rpx 28rpx 16rpx;
}

.section-head.spaced { margin-top: 42rpx; }
.section-heading { gap: 14rpx; }

.section-heading-icon {
  width: 58rpx;
  height: 58rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #DCE9ED;
  border-radius: 14rpx;
  background: var(--primary-soft, #EDF9FC);
}

.section-heading-icon--reward {
  border-color: #CADCF2;
  background: var(--warning-soft, #EDF9FC);
}

.section-kicker {
  display: block;
  color: var(--accent-strong, #050505);
  font-size: 18rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.section-title {
  display: block;
  margin-top: 1rpx;
  color: var(--ink, #050505);
  font-size: 32rpx;
  font-weight: 780;
  line-height: 1.3;
}

.section-note {
  flex: none;
  padding: 7rpx 12rpx;
  border: 1rpx solid #DCE9ED;
  border-radius: 9rpx;
  background: rgba(255, 255, 255, .75);
  color: var(--text-muted, #50545B);
  font-size: 20rpx;
}

.learning-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16rpx;
  margin: 0 24rpx;
}

.learning-card {
  --tone-color: var(--primary, #0B789A);
  --tone-soft: var(--primary-soft, #EDF9FC);
  position: relative;
  min-width: 0;
  min-height: 302rpx;
  padding: 22rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-top: 6rpx solid var(--tone-color);
  border-radius: 18rpx;
  background: var(--surface, #FFFFFF);
  text-align: left;
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.learning-card:active,
.challenge-card:active {
  transform: scale(var(--tap-scale, .975));
  opacity: .9;
}

.card-top {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.card-icon,
.challenge-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  background: var(--tone-soft);
}

.card-icon {
  width: 70rpx;
  height: 70rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-radius: 17rpx;
}

.card-rule-mark {
  display: flex;
  align-items: center;
  gap: 5rpx;
  padding-top: 8rpx;
}

.card-rule-mark view {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: #DCE9ED;
}

.tone-mint,
.tone-green {
  --tone-color: var(--accent, #0B789A);
  --tone-soft: var(--accent-soft, #EDF9FC);
}

.tone-blue,
.tone-navy {
  --tone-color: var(--primary, #0B789A);
  --tone-soft: var(--primary-soft, #EDF9FC);
}

.tone-amber,
.tone-rose {
  --tone-color: var(--coral, #F79BC0);
  --tone-soft: var(--coral-soft, #FFF0F6);
}

.tone-purple,
.tone-gold {
  --tone-color: var(--gold, #0B789A);
  --tone-soft: var(--warning-soft, #EDF9FC);
}

.card-title {
  display: block;
  margin-top: 17rpx;
  color: var(--ink, #050505);
  font-size: 27rpx;
  font-weight: 760;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.card-desc {
  display: block;
  margin-top: 6rpx;
  min-height: 72rpx;
  color: var(--text-muted, #50545B);
  font-size: 21rpx;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.card-foot {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
  margin-top: auto;
  padding-top: 14rpx;
  border-top: 1rpx solid #E6EDF5;
  color: var(--primary-strong, #050505);
  font-size: 21rpx;
  font-weight: 700;
}

.challenge-list {
  margin: 0 24rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.challenge-card {
  --tone-color: var(--primary, #0B789A);
  --tone-soft: var(--primary-soft, #EDF9FC);
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-height: 126rpx;
  padding: 20rpx 22rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-left: 5rpx solid var(--tone-color);
  border-radius: 17rpx;
  background: var(--surface, #FFFFFF);
  text-align: left;
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.challenge-card.locked {
  border-left-color: #DCE9ED;
  background: #F7FCFE;
  box-shadow: none;
}

.challenge-mark {
  width: 76rpx;
  height: 76rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-radius: 17rpx;
}

.challenge-copy {
  flex: 1;
  min-width: 0;
}

.challenge-title {
  display: block;
  color: var(--ink, #050505);
  font-size: 27rpx;
  font-weight: 750;
  line-height: 1.35;
}

.challenge-desc {
  display: block;
  margin-top: 4rpx;
  color: var(--text-muted, #50545B);
  font-size: 21rpx;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.lock-label {
  flex: none;
  padding: 7rpx 12rpx;
  border: 1rpx solid #CADCF2;
  border-radius: 9rpx;
  background: var(--warning-soft, #EDF9FC);
  color: #050505;
  font-size: 19rpx;
  font-weight: 700;
}

@media (max-width: 360px) {
  .learning-hero { margin-left: 20rpx; margin-right: 20rpx; padding-left: 26rpx; padding-right: 24rpx; }
  .hero-tool--mint { display: none; }
  .hero-tools { padding-right: 42rpx; }
  .hero-foot-note { display: none; }
  .section-nav-shell,
  .grade-panel,
  .state-sheet,
  .overview-card,
  .inline-error,
  .refresh-status,
  .challenge-list { margin-left: 20rpx; margin-right: 20rpx; }
  .learning-grid { margin-left: 20rpx; margin-right: 20rpx; gap: 12rpx; }
  .grade-panel { padding-left: 18rpx; padding-right: 18rpx; }
  .grade-tab { padding-left: 5rpx; padding-right: 5rpx; font-size: 23rpx; }
  .overview-card { grid-template-columns: 64rpx minmax(0, 1fr); gap: 14rpx; padding: 22rpx; }
  .overview-icon { width: 64rpx; height: 64rpx; }
  .wrong-pill { grid-column: 2; justify-self: start; min-width: 150rpx; }
  .choice-king-card {
    width: calc(100% - 40rpx);
    margin-left: 20rpx;
    margin-right: 20rpx;
    grid-template-columns: 72rpx minmax(0, 1fr) 78rpx;
    gap: 14rpx;
    padding: 20rpx;
  }
  .choice-king-icon { width: 72rpx; height: 72rpx; }
  .choice-king-action { min-width: 0; width: 78rpx; padding: 0; }
  .choice-king-action text { display: none; }
  .section-head { margin-left: 24rpx; margin-right: 24rpx; }
  .section-note { font-size: 18rpx; }
  .learning-card { min-height: 316rpx; padding: 19rpx; }
  .card-title { font-size: 25rpx; }
  .card-desc { font-size: 20rpx; }
}

@media (prefers-reduced-motion: reduce) {
  .nav-item,
  .grade-tab,
  .inline-error button,
  .choice-king-card,
  .learning-card,
  .challenge-card {
    transition-duration: .01ms;
  }

  .nav-item:active,
  .grade-tab:active,
  .inline-error button:active,
  .choice-king-card:active,
  .learning-card:active,
  .challenge-card:active {
    transform: none;
    opacity: 1;
  }
}

/* Student challenge theme v3: warm paper and one energetic teaching green. */
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
  --accent: #F79BC0;
  --accent-strong: #9B2F5F;
  --accent-soft: #FFF0F6;
  --coral: #F79BC0;
  --coral-soft: #FFF0F6;
  --danger: #B53A52;
  --border: #DCE9ED;
  --hairline: #EDF3F5;
  min-height: 100vh;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(0deg, transparent 0 55rpx, rgba(153, 222, 244, .05) 56rpx 57rpx);
  color: var(--ink);
}
.student-challenge-page .learning-hero {
  min-height: 0;
  padding: 34rpx 30rpx 28rpx;
  border: 0;
  border-bottom: 6rpx solid var(--brand-sky);
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}
.student-challenge-page .learning-hero::before,
.student-challenge-page .learning-hero::after { display: none; }
.student-challenge-page .learning-hero .eyebrow,
.student-challenge-page .section-kicker,
.student-challenge-page .grade-panel-kicker,
.student-challenge-page .choice-king-kicker { color: var(--primary-strong); }
.student-challenge-page .hero-title,
.student-challenge-page .section-title,
.student-challenge-page .grade-panel-title,
.student-challenge-page .choice-king-title,
.student-challenge-page .learning-card-title { color: var(--ink); }
.student-challenge-page .hero-sub,
.student-challenge-page .section-note,
.student-challenge-page .choice-king-desc,
.student-challenge-page .learning-card-desc { color: var(--text-secondary); }
.student-challenge-page .hero-tool--blue,
.student-challenge-page .hero-tool--mint,
.student-challenge-page .section-heading-icon,
.student-challenge-page .section-heading-icon--reward,
.student-challenge-page .overview-icon,
.student-challenge-page .choice-king-icon {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.student-challenge-page .overview-card,
.student-challenge-page .grade-panel,
.student-challenge-page .choice-king-card,
.student-challenge-page .learning-card,
.student-challenge-page .challenge-card,
.student-challenge-page .state-sheet {
  min-height: 0;
  border-color: var(--border);
  border-radius: 16rpx;
  background: var(--surface);
  box-shadow: 0 6rpx 18rpx rgba(5, 5, 5, .06);
}
.student-challenge-page .learning-grid,
.student-challenge-page .grade-switch { align-items: start; }
.student-challenge-page .grade-tab {
  min-height: 76rpx;
  padding: 10rpx 14rpx;
  border-color: var(--border);
  background: var(--surface-muted);
  color: var(--text-secondary);
}
.student-challenge-page .grade-tab.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.student-challenge-page .choice-king-action,
.student-challenge-page .challenge-action {
  min-height: 84rpx;
  border-radius: 14rpx;
  background: var(--primary);
  color: #FFFFFF;
}
.student-challenge-page .nav-item {
  min-height: 76rpx;
  padding-block: 0;
}
.student-challenge-page .nav-item.active {
  box-shadow: 0 7rpx 18rpx rgba(5, 5, 5, .18);
}
.student-challenge-page .wrong-pill,
.student-challenge-page .inline-error {
  background: var(--coral-soft);
  color: var(--danger);
}

/* Workbook-cover palette: flat color panels, strong black type, no soft blend. */
.student-challenge-page .learning-hero {
  border: 3rpx solid #050505;
  border-top: 14rpx solid #99DEF4;
  border-bottom: 14rpx solid #99DEF4;
}
.student-challenge-page .workbook-label { background: #F79BC0; color: #050505; }
.student-challenge-page .hero-tool--blue { background: #99DEF4; color: #050505; }
.student-challenge-page .hero-tool--mint { background: #FFF48A; color: #050505; }
.student-challenge-page .section-nav { border: 2rpx solid #050505; }
.student-challenge-page .nav-item.active { background: #99DEF4; color: #050505; box-shadow: none; }
.student-challenge-page .grade-panel { border-top: 10rpx solid #F79BC0; }
.student-challenge-page .math-mark { background: #FFF48A; color: #050505; }
.student-challenge-page .grade-tab.active { border: 3rpx solid #050505; background: #99DEF4; color: #050505; }
.student-challenge-page .overview-card { border-left: 10rpx solid #99DEF4; }
.student-challenge-page .wrong-pill { border-color: #F79BC0; background: #FFF0F6; }
.student-challenge-page .choice-king-card { border-left: 10rpx solid #F79BC0; }
.student-challenge-page .choice-king-action { background: #050505; }
.student-challenge-page .learning-card:nth-child(3n + 1) { border-top: 8rpx solid #99DEF4; }
.student-challenge-page .learning-card:nth-child(3n + 2) { border-top: 8rpx solid #F79BC0; }
.student-challenge-page .learning-card:nth-child(3n) { border-top: 8rpx solid #FFF48A; }
.student-challenge-page .challenge-card:nth-child(3n + 1) { border-left: 10rpx solid #FFF48A; }
.student-challenge-page .challenge-card:nth-child(3n + 2) { border-left: 10rpx solid #99DEF4; }
.student-challenge-page .challenge-card:nth-child(3n) { border-left: 10rpx solid #F79BC0; }
</style>
