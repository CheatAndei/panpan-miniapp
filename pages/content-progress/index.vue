<template>
  <view class="page page-bottom-safe">
    <view class="hero">
      <view class="hero-mark"><pp-icon name="target" :size="44" motion="pop" /></view>
      <view class="hero-copy">
        <text class="eyebrow">CURRICULUM CONTROL · 03</text>
        <text class="hero-title">进度控制管理</text>
        <text class="hero-sub">按学习小组控制八年级客观题与压轴题范围</text>
      </view>
    </view>

    <view class="control-card">
      <view class="control-head">
        <view>
          <text class="section-kicker">学习小组</text>
          <text class="section-title">选择需要管理的班级</text>
        </view>
        <text v-if="selectedClass" class="grade-chip">{{ selectedClass.grade || '未设置年级' }}</text>
      </view>
      <picker v-if="classes.length" :range="classes" range-key="name" :value="classIndex" @change="selectClass">
        <view class="class-picker">
          <view>
            <text class="class-name">{{ selectedClass?.name || '选择学习小组' }}</text>
            <text class="class-meta">{{ selectedClass?.grade || '未设置年级' }} · {{ selectedClass?.subject || '数学' }}</text>
          </view>
          <pp-icon name="arrow" :size="28" />
        </view>
      </picker>
      <pp-state
        v-else-if="!loadingClasses"
        title="还没有学习小组"
        description="先建立初二数学学习小组，再设置学习范围。"
        action-text="管理班级"
        @action="openClasses"
      />
    </view>

    <view v-if="loading" class="state-card">
      <pp-state type="loading" title="正在读取班级进度" />
    </view>
    <view v-else-if="error" class="state-card">
      <pp-state type="error" title="进度配置加载失败" :description="error" action-text="重新加载" @action="loadState" />
    </view>
    <view v-else-if="state && !state.supported" class="state-card unsupported-card">
      <pp-state
        title="该班级不是初二数学"
        description="范围控制只对初二数学班级开放。你可以在管理班级中调整年级或学科。"
        action-text="调整班级"
        @action="openClasses"
      />
    </view>

    <template v-else-if="state?.supported">
      <view class="summary-card">
        <view class="summary-copy">
          <text class="section-kicker">当前放行范围</text>
          <text class="summary-title">{{ selectedKeys.length }} / {{ state.topics.length }} 讲</text>
          <text class="summary-desc">{{ scopeDescription }}</text>
        </view>
        <view class="summary-counts" aria-label="题库数量">
          <view><text class="count-number">{{ state.totals.choice }}</text><text>客观</text></view>
          <view><text class="count-number">{{ state.totals.fill }}</text><text>填空</text></view>
          <view><text class="count-number">{{ state.totals.subjective }}</text><text>大题</text></view>
        </view>
      </view>

      <view class="toolbar">
        <button class="tool-btn" :disabled="saving" @tap="enableAll">全部开启</button>
        <button class="tool-btn pause" :disabled="saving" @tap="disableAll">全部暂停</button>
        <text class="toolbar-note">试卷库始终开放，不受这里控制</text>
      </view>

      <view class="topic-list">
        <button
          v-for="topic in state.topics"
          :key="topic.topic_key"
          :class="['topic-card', { enabled: isEnabled(topic.topic_key) }]"
          :aria-pressed="isEnabled(topic.topic_key)"
          @tap="toggleTopic(topic.topic_key)"
        >
          <view class="topic-check" aria-hidden="true">{{ isEnabled(topic.topic_key) ? '✓' : '' }}</view>
          <view class="topic-main">
            <view class="topic-title-line">
              <text class="topic-title">{{ topic.title }}</text>
              <text :class="['ready-chip', { ready: topic.ready }]">{{ topic.ready ? '已达标' : '建设中' }}</text>
            </view>
            <text v-if="topic.short_title !== topic.title" class="topic-short">{{ topic.short_title }}</text>
            <view class="count-row">
              <text>客观 {{ topic.counts.choice }}/{{ state.targets.choice }}</text>
              <text>填空 {{ topic.counts.fill }}/{{ state.targets.fill }}</text>
              <text>大题 {{ topic.counts.subjective }}/{{ state.targets.subjective }}</text>
            </view>
          </view>
        </button>
      </view>

      <view class="rule-note" role="note">
        <pp-icon name="lightbulb" :size="28" />
        <text>综合题涉及多个范围时，必须所有相关范围都已开启才会出现。关闭范围后，未完成题目立即撤回，历史提交继续保留。</text>
      </view>

      <view class="save-bar">
        <view class="save-copy">
          <text>{{ dirty ? '有未保存修改' : '当前配置已保存' }}</text>
          <text v-if="lastWithdrawn" class="withdraw-note">上次撤回 {{ lastWithdrawn }} 道未完成题</text>
        </view>
        <button class="save-btn" :disabled="!dirty || saving" @tap="saveScope">
          {{ saving ? '保存中…' : '保存进度' }}
        </button>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';

const classes = ref([]);
const classId = ref(0);
const state = ref(null);
const selectedKeys = ref([]);
const savedKeys = ref([]);
const loadingClasses = ref(false);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const lastWithdrawn = ref(0);

const selectedClass = computed(() => classes.value.find((item) => Number(item.id) === Number(classId.value)) || null);
const classIndex = computed(() => Math.max(0, classes.value.findIndex((item) => Number(item.id) === Number(classId.value))));
const normalizedSelected = computed(() => [...selectedKeys.value].sort());
const dirty = computed(() => JSON.stringify(normalizedSelected.value) !== JSON.stringify([...savedKeys.value].sort()));
const scopeDescription = computed(() => {
  if (!selectedKeys.value.length) return '客观题和压轴题已全部暂停';
  if (selectedKeys.value.length === (state.value?.topics?.length || 0)) return '12 个固定范围已全部开启';
  return '仅放行已勾选范围，未勾选内容不会出现在学生端';
});

onShow(loadClasses);
onPullDownRefresh(async () => {
  try { await loadClasses(); } finally { uni.stopPullDownRefresh(); }
});

async function loadClasses() {
  if (loadingClasses.value) return;
  loadingClasses.value = true;
  error.value = '';
  try {
    const data = await api.get('/classes');
    classes.value = data.classes || [];
    if (!classes.value.some((item) => Number(item.id) === Number(classId.value))) {
      classId.value = Number(classes.value[0]?.id || 0);
    }
    if (classId.value) await loadState();
    else state.value = null;
  } catch (requestError) {
    error.value = requestError?.error || '请检查网络后重试';
  } finally {
    loadingClasses.value = false;
  }
}

async function loadState() {
  if (!classId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await api.get(`/content-progress/classes/${classId.value}`);
    state.value = data;
    selectedKeys.value = [...(data.scope?.allowed_topic_keys || [])];
    savedKeys.value = [...selectedKeys.value];
    lastWithdrawn.value = 0;
  } catch (requestError) {
    error.value = requestError?.error || '请检查网络后重试';
  } finally {
    loading.value = false;
  }
}

function selectClass(event) {
  const next = classes.value[Number(event.detail.value)];
  if (!next || Number(next.id) === Number(classId.value)) return;
  classId.value = Number(next.id);
  state.value = null;
  loadState();
}

function isEnabled(topicKey) { return selectedKeys.value.includes(topicKey); }

function toggleTopic(topicKey) {
  const index = selectedKeys.value.indexOf(topicKey);
  if (index >= 0) selectedKeys.value.splice(index, 1);
  else selectedKeys.value.push(topicKey);
}

function enableAll() { selectedKeys.value = (state.value?.topics || []).map((item) => item.topic_key); }
function disableAll() { selectedKeys.value = []; }

async function saveScope() {
  if (!dirty.value || saving.value) return;
  saving.value = true;
  try {
    const data = await api.put(`/content-progress/classes/${classId.value}`, {
      topic_keys: selectedKeys.value,
    });
    state.value = data.state;
    selectedKeys.value = [...(data.state?.scope?.allowed_topic_keys || [])];
    savedKeys.value = [...selectedKeys.value];
    const withdrawn = data.scope?.withdrawn || {};
    lastWithdrawn.value = Number(withdrawn.choice_issuances || 0) + Number(withdrawn.challenge_assignments || 0);
    uni.showToast({ title: '进度已保存', icon: 'success' });
  } catch (requestError) {
    uni.showToast({ title: requestError?.error || '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}

function openClasses() { uni.navigateTo({ url: '/pages/teacher-classes/index' }); }
</script>

<style scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx 24rpx 170rpx;
  color: #050505;
  background:
    repeating-linear-gradient(180deg, transparent 0, transparent 55rpx, rgba(153, 222, 244, .045) 56rpx),
    #F7FCFE;
}

.hero {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 30rpx;
  border: 1rpx solid #DCE9ED;
  border-left: 8rpx solid #0B789A;
  border-radius: 24rpx;
  background: #FFFFFF;
  box-shadow: 0 10rpx 28rpx rgba(5, 5, 5, .08);
}

.hero-mark {
  width: 84rpx;
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 22rpx;
  color: #050505;
  background: #E5F8FE;
}

.hero-copy,
.summary-copy,
.topic-main,
.save-copy {
  min-width: 0;
  flex: 1;
}

.eyebrow,
.section-kicker {
  display: block;
  color: #0B789A;
  font-size: 20rpx;
  font-weight: 760;
  letter-spacing: 2rpx;
}

.hero-title {
  display: block;
  margin-top: 7rpx;
  font-size: 38rpx;
  font-weight: 820;
}

.hero-sub {
  display: block;
  margin-top: 7rpx;
  color: #50545B;
  font-size: 23rpx;
  line-height: 1.55;
}

.control-card,
.summary-card,
.state-card,
.toolbar,
.rule-note {
  margin-top: 20rpx;
  border: 1rpx solid #DCE9ED;
  border-radius: 20rpx;
  background: #FFFFFF;
}

.control-card { padding: 24rpx; }
.control-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; }
.section-title { display: block; margin-top: 5rpx; font-size: 29rpx; font-weight: 780; }

.grade-chip {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  color: #050505;
  background: #E5F8FE;
  font-size: 21rpx;
  font-weight: 720;
}

.class-picker {
  min-height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding: 0 20rpx;
  border: 1rpx solid #DCE9ED;
  border-radius: 16rpx;
  background: #FBFDFE;
}

.class-name { display: block; font-size: 28rpx; font-weight: 760; }
.class-meta { display: block; margin-top: 5rpx; color: #50545B; font-size: 21rpx; }
.state-card { padding: 24rpx; }
.unsupported-card { border-left: 6rpx solid #F79BC0; }

.summary-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx;
}

.summary-title { display: block; margin-top: 4rpx; color: #050505; font-size: 36rpx; font-weight: 820; }
.summary-desc { display: block; margin-top: 6rpx; color: #50545B; font-size: 21rpx; line-height: 1.5; }
.summary-counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; flex: 0 0 auto; }
.summary-counts view { min-width: 78rpx; text-align: center; color: #50545B; font-size: 18rpx; }
.count-number { display: block; color: #050505; font-size: 27rpx; font-weight: 800; }

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 18rpx;
}

.tool-btn {
  min-height: 68rpx;
  margin: 0;
  padding: 0 22rpx;
  border: 1rpx solid #BFD0EA;
  border-radius: 14rpx;
  color: #050505;
  background: #E5F8FE;
  font-size: 23rpx;
  font-weight: 730;
}

.tool-btn::after,
.topic-card::after,
.save-btn::after { border: 0; }
.tool-btn.pause { border-color: #F1C6BF; color: #A24E43; background: #FFF0F6; }
.toolbar-note { width: 100%; color: #6B7078; font-size: 20rpx; }

.topic-list { display: grid; gap: 14rpx; margin-top: 18rpx; }
.topic-card {
  width: 100%;
  min-height: 132rpx;
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin: 0;
  padding: 20rpx;
  text-align: left;
  border: 1rpx solid #DCE9ED;
  border-radius: 18rpx;
  color: #050505;
  background: #FFFFFF;
}

.topic-card.enabled { border-color: #9EB7E2; background: #F5F9FF; box-shadow: inset 6rpx 0 #0B789A; }
.topic-check {
  width: 42rpx;
  height: 42rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  box-sizing: border-box;
  border: 2rpx solid #BFCBDD;
  border-radius: 11rpx;
  color: #FFFFFF;
  background: #FFFFFF;
  font-size: 25rpx;
  font-weight: 800;
}
.topic-card.enabled .topic-check { border-color: #050505; background: #0B789A; }
.topic-title-line { display: flex; align-items: flex-start; justify-content: space-between; gap: 12rpx; }
.topic-title { flex: 1; font-size: 26rpx; font-weight: 760; line-height: 1.45; }
.topic-short { display: block; margin-top: 4rpx; color: #50545B; font-size: 20rpx; }
.ready-chip { flex: 0 0 auto; padding: 5rpx 10rpx; border-radius: 999rpx; color: #8A6230; background: #FFF3DE; font-size: 18rpx; }
.ready-chip.ready { color: #26705D; background: #E6F5F0; }
.count-row { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 12rpx; }
.count-row text { padding: 5rpx 9rpx; border-radius: 8rpx; color: #50545B; background: #EDF3FA; font-size: 18rpx; }

.rule-note {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 20rpx;
  color: #50545B;
  font-size: 21rpx;
  line-height: 1.6;
}

.save-bar {
  position: fixed;
  right: 24rpx;
  bottom: calc(env(safe-area-inset-bottom) + 24rpx);
  left: 24rpx;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx 18rpx 18rpx 24rpx;
  border: 1rpx solid #CAD9EE;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, .97);
  box-shadow: 0 14rpx 38rpx rgba(5, 5, 5, .14);
}
.save-copy text { display: block; color: #50545B; font-size: 21rpx; }
.save-copy .withdraw-note { margin-top: 4rpx; color: #A24E43; font-size: 19rpx; }
.save-btn {
  min-width: 190rpx;
  min-height: 76rpx;
  margin: 0;
  padding: 0 24rpx;
  border-radius: 16rpx;
  color: #FFFFFF;
  background: #050505;
  font-size: 25rpx;
  font-weight: 780;
}
.save-btn[disabled] { color: #8290A4; background: #E7ECF3; opacity: 1; }

@media (min-width: 700px) {
  .page { max-width: 920px; margin: 0 auto; }
  .topic-list { grid-template-columns: 1fr 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .topic-card,
  .tool-btn,
  .save-btn { transition: none; }
}
</style>
