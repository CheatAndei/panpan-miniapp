<template>
  <view class="page page-bottom-safe">
    <view class="page-hero learning-hero">
      <text class="eyebrow">LEARNING HUB</text>
      <text class="hero-title">学习中心</text>
      <text class="hero-sub">短练习、错题巩固与阶段挑战，都收在这里</text>
    </view>

    <view class="section-nav" aria-label="家长端学习导航">
      <button class="nav-item" @tap="goToday">今日</button>
      <button class="nav-item active" aria-current="page">学习</button>
      <button class="nav-item" @tap="goGrowth">成长</button>
    </view>

    <pp-state v-if="loading && !catalog" type="loading" title="正在整理学习内容" />
    <pp-state v-else-if="error && !catalog" type="error" title="学习内容加载失败" :description="error" action-text="重新加载" @action="loadCatalog" />

    <template v-if="catalog">
      <view class="overview-card">
        <view>
          <text class="overview-label">今日建议</text>
          <text class="overview-title">先热身，再做一项重点练习</text>
        </view>
        <view class="wrong-pill"><text class="num">{{ catalog.open_wrong_count }}</text> 道待掌握</view>
      </view>

      <view class="section-head">
        <view>
          <text class="section-kicker">每天都能做</text>
          <text class="section-title">轻量练习</text>
        </view>
        <text class="section-note">5–15 分钟</text>
      </view>
      <view class="learning-grid">
        <button v-for="item in dailySections" :key="item.type" :class="['learning-card', `tone-${item.accent}`]" @tap="openSection(item)">
          <view class="card-icon"><pp-icon :name="iconFor(item.type)" :size="40" /></view>
          <text class="card-title">{{ item.title }}</text>
          <text class="card-desc">{{ item.description }}</text>
          <view class="card-foot"><text>{{ item.count ? `${item.count} 题` : '进入' }}</text><pp-icon name="arrow" :size="30" /></view>
        </button>
      </view>

      <view class="section-head spaced">
        <view>
          <text class="section-kicker">阶段提升</text>
          <text class="section-title">挑战与测评</text>
        </view>
        <text class="section-note">按节奏选择</text>
      </view>
      <view class="challenge-list">
        <button v-for="item in challengeSections" :key="item.type" :class="['challenge-card', { locked:item.locked }]" @tap="openSection(item)">
          <view :class="['challenge-mark', `tone-${item.accent}`]"><pp-icon :name="iconFor(item.type)" :size="42" /></view>
          <view class="challenge-copy">
            <text class="challenge-title">{{ item.title }}</text>
            <text class="challenge-desc">{{ item.locked ? item.lock_text : item.description }}</text>
          </view>
          <text v-if="item.locked" class="lock-label">周末</text>
          <pp-icon v-else name="arrow" :size="32" />
        </button>
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
const dailyTypes = new Set(['warmup', 'weakness', 'wrong', 'practice']);
const dailySections = computed(() => (catalog.value?.sections || []).filter((item) => dailyTypes.has(item.type)));
const challengeSections = computed(() => (catalog.value?.sections || []).filter((item) => !dailyTypes.has(item.type)));

onLoad((query) => {
  studentId.value = Number(query.student_id || uni.getStorageSync('activeChildId') || 0);
});
onShow(() => { if (studentId.value) loadCatalog(); });
onPullDownRefresh(async () => { try { await loadCatalog(); } finally { uni.stopPullDownRefresh(); } });

async function loadCatalog() {
  if (!studentId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try { catalog.value = await api.get(`/learning/catalog?student_id=${studentId.value}`); }
  catch (e) { error.value = e?.error || '请检查网络后重试'; logError('learning.catalog', e); }
  finally { loading.value = false; }
}

function iconFor(type) {
  if (['warmup', 'arena'].includes(type)) return 'check';
  if (['weekly', 'weekend'].includes(type)) return 'calendar';
  if (type === 'wrong') return 'message';
  return type === 'practice' ? 'clipboard' : 'book';
}

function openSection(item) {
  if (item.locked) return uni.showToast({ title: item.lock_text || '暂未开放', icon: 'none' });
  if (item.route === 'practice') return uni.navigateTo({ url: `/pages/practice-parent/index?student_id=${studentId.value}` });
  if (item.route === 'arena') return uni.navigateTo({ url: `/pages/mental-arena/index?student_id=${studentId.value}` });
  if (item.route === 'weekly_challenge') return uni.navigateTo({ url: `/pages/weekly-challenge/index?student_id=${studentId.value}` });
  if (item.route === 'exams') return uni.navigateTo({ url: `/pages/exam-library/index?student_id=${studentId.value}` });
  if (!item.type) return;
  uni.navigateTo({ url: `/pages/learning-session/index?student_id=${studentId.value}&type=${item.type}` });
}

function goToday() { uni.switchTab({ url: '/pages/index/index' }); }
function goGrowth() { uni.navigateTo({ url: `/pages/growth/index?student_id=${studentId.value}` }); }
</script>

<style scoped>
.learning-hero{padding-bottom:44rpx}.hero-title{display:block;margin-top:8rpx;color:var(--ink);font-size:44rpx;font-weight:780;letter-spacing:-1rpx}.hero-sub{display:block;margin-top:8rpx;color:var(--text-secondary);font-size:25rpx}.section-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:8rpx;margin:20rpx 24rpx 0;padding:8rpx;border:1rpx solid var(--border);border-radius:18rpx;background:#fff}.nav-item{min-height:78rpx;border-radius:13rpx;background:transparent;color:var(--text-muted);font-size:27rpx;font-weight:650}.nav-item.active{background:var(--primary);color:#fff;box-shadow:0 7rpx 18rpx rgba(24,58,54,.14)}.overview-card{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin:20rpx 24rpx 0;padding:28rpx;border-radius:24rpx;background:linear-gradient(135deg,#183A36,#2F6E61);color:#fff;box-shadow:0 16rpx 34rpx rgba(24,58,54,.16)}.overview-label{display:block;color:#AED6CA;font-size:21rpx;font-weight:750;letter-spacing:2rpx}.overview-title{display:block;margin-top:4rpx;font-size:29rpx;font-weight:720}.wrong-pill{flex:none;padding:10rpx 16rpx;border-radius:999rpx;background:rgba(255,255,255,.13);font-size:22rpx}.wrong-pill .num{font-size:30rpx;font-weight:800}.section-head{display:flex;align-items:flex-end;justify-content:space-between;margin:34rpx 28rpx 16rpx}.section-head.spaced{margin-top:42rpx}.section-kicker{display:block;color:var(--accent-strong);font-size:20rpx;font-weight:750;letter-spacing:2rpx}.section-title{display:block;margin-top:2rpx;font-size:33rpx;font-weight:760}.section-note{color:var(--text-muted);font-size:22rpx}.learning-grid{display:grid;grid-template-columns:1fr 1fr;gap:16rpx;margin:0 24rpx}.learning-card{min-height:286rpx;padding:24rpx;border:1rpx solid var(--border);border-radius:22rpx;background:#fff;text-align:left;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;align-items:flex-start}.learning-card:active,.challenge-card:active{transform:scale(.975);opacity:.9}.card-icon,.challenge-mark{width:70rpx;height:70rpx;display:flex;align-items:center;justify-content:center;border-radius:20rpx;background:var(--accent-soft)}.tone-amber{background:#FBF1E9!important}.tone-blue{background:#EDF4F2!important}.tone-navy{background:#E8EFED!important}.tone-rose{background:#FCEEEB!important}.tone-purple{background:#F1EDF7!important}.tone-gold{background:#F8F0D9!important}.card-title{display:block;margin-top:18rpx;color:var(--ink);font-size:28rpx;font-weight:740;line-height:1.35}.card-desc{display:block;margin-top:6rpx;min-height:68rpx;color:var(--text-muted);font-size:22rpx;line-height:1.55}.card-foot{width:100%;display:flex;align-items:center;justify-content:space-between;margin-top:auto;color:var(--accent-strong);font-size:22rpx;font-weight:700}.challenge-list{margin:0 24rpx;display:flex;flex-direction:column;gap:14rpx}.challenge-card{width:100%;min-height:116rpx;padding:20rpx 22rpx;display:flex;align-items:center;gap:18rpx;border:1rpx solid var(--border);border-radius:20rpx;background:#fff;text-align:left;box-shadow:var(--shadow-sm)}.challenge-card.locked{opacity:.62}.challenge-copy{flex:1;min-width:0}.challenge-title{display:block;color:var(--ink);font-size:28rpx;font-weight:720}.challenge-desc{display:block;margin-top:3rpx;color:var(--text-muted);font-size:22rpx;line-height:1.45}.lock-label{padding:6rpx 12rpx;border-radius:8rpx;background:var(--surface-muted);color:var(--text-muted);font-size:20rpx;font-weight:700}
</style>
