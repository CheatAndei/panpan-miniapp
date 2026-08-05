<template>
  <view class="page page-bottom-safe">
    <view class="hero page-hero">
      <view class="hero-copy">
        <text class="eyebrow">LEARNING LOG</text>
        <text class="hero-title">{{ selectedStudent ? `${selectedStudent.name}的学习记录` : '学生学习记录' }}</text>
        <text class="hero-sub">
          {{ selectedStudent ? `${selectedStudent.class_name} · 累计做题与错题题库` : '按学生查看累计题量、错误分布和待掌握题目' }}
        </text>
      </view>
      <view class="hero-index" aria-hidden="true">{{ selectedStudent ? '02' : '01' }}</view>
      <view v-if="!selectedStudent && students.length" class="hero-summary">
        <view>
          <text class="summary-number num">{{ students.length }}</text>
          <text class="summary-label">名学生</text>
        </view>
        <view>
          <text class="summary-number num">{{ totalQuestions }}</text>
          <text class="summary-label">累计题目</text>
        </view>
        <view>
          <text class="summary-number num">{{ totalOpenWrong }}</text>
          <text class="summary-label">待掌握</text>
        </view>
      </view>
    </view>

    <view v-if="loading && !students.length && !selectedStudent" class="state-wrap">
      <pp-state type="loading" title="正在整理学生学习记录" />
    </view>
    <view v-else-if="error && !students.length && !selectedStudent" class="state-wrap">
      <pp-state type="error" title="学习记录加载失败" :description="error" action-text="重新加载" @action="loadStudents" />
    </view>

    <template v-else-if="!selectedStudent">
      <scroll-view v-if="classOptions.length > 1" class="class-filter" scroll-x :show-scrollbar="false">
        <view class="class-filter-track">
          <button
            v-for="item in classOptions"
            :key="item.value"
            :class="['filter-chip', { active: classFilter === item.value }]"
            @tap="classFilter = item.value"
          >
            {{ item.label }}
          </button>
        </view>
      </scroll-view>

      <view class="record-toolbar">
        <view>
          <text class="section-kicker">STUDENT INDEX</text>
          <text class="section-title">选择学生</text>
        </view>
        <view class="search-box">
          <pp-icon name="search" :size="30" label="搜索学生" />
          <input v-model="keyword" class="search-input" placeholder="搜索姓名" confirm-type="search" />
        </view>
      </view>

      <view v-if="error" class="inline-error" role="alert">
        <text>{{ error }}</text>
        <button @tap="loadStudents">重试</button>
      </view>

      <view v-if="filteredStudents.length" class="student-list">
        <button
          v-for="student in filteredStudents"
          :key="student.id"
          class="student-record"
          :aria-label="`查看${student.name}的学习记录`"
          @tap="openStudent(student)"
        >
          <view class="student-main">
            <pp-avatar :name="student.name" :size="82" />
            <view class="student-copy">
              <view class="student-title-line">
                <text class="student-name">{{ student.name }}</text>
                <text v-if="student.stats.open_wrong_count" class="wrong-badge">
                  {{ student.stats.open_wrong_count }} 道待掌握
                </text>
              </view>
              <text class="student-class">{{ student.class_name }}{{ student.level ? ` · ${student.level}` : '' }}</text>
              <text class="student-updated">
                {{ student.stats.latest_activity_at ? `最近学习 ${shortDate(student.stats.latest_activity_at)}` : '还没有做题记录' }}
              </text>
            </view>
            <pp-icon name="arrow" :size="30" decorative />
          </view>
          <view class="student-metrics">
            <view>
              <text class="metric-value num">{{ student.stats.total_questions }}</text>
              <text class="metric-label">总题量</text>
            </view>
            <view>
              <text class="metric-value num">{{ student.stats.channels.practice.total }}</text>
              <text class="metric-label">打卡题</text>
            </view>
            <view>
              <text class="metric-value num">{{ student.stats.channels.choice.total }}</text>
              <text class="metric-label">选择题</text>
            </view>
            <view>
              <text class="metric-value num">{{ accuracyLabel(student.stats.accuracy) }}</text>
              <text class="metric-label">正确率</text>
            </view>
          </view>
        </button>
      </view>
      <pp-state
        v-else
        title="没有找到学生"
        description="换一个姓名或学习小组试试。"
      />
    </template>

    <template v-else>
      <button class="back-to-list" @tap="closeStudent">
        <text aria-hidden="true">←</text>
        返回学生列表
      </button>

      <view v-if="detailLoading" class="state-wrap">
        <pp-state type="loading" title="正在汇总学习数据" />
      </view>
      <view v-else-if="detailError" class="state-wrap">
        <pp-state type="error" title="记录读取失败" :description="detailError" action-text="重新加载" @action="loadDetail" />
      </view>
      <template v-else-if="detail">
        <view class="overview-band">
          <view class="overview-primary">
            <view class="overview-primary-head">
              <text class="overview-kicker">累计做题</text>
              <button class="archive-button" aria-label="查阅该学生全部提交" @tap="openSubmissionArchive"><pp-icon name="history" :size="24" decorative />查阅</button>
            </view>
            <view class="overview-number-line">
              <text class="overview-number num">{{ detail.stats.total_questions }}</text>
              <text class="overview-unit">题</text>
            </view>
            <text class="overview-copy">已统计全部学习提交与做题记录</text>
          </view>
          <view class="overview-secondary">
            <view>
              <text class="overview-small num">{{ detail.stats.wrong_questions }}</text>
              <text>累计错题</text>
            </view>
            <view>
              <text class="overview-small num">{{ detail.stats.open_wrong_count }}</text>
              <text>待掌握</text>
            </view>
            <view>
              <text class="overview-small num">{{ accuracyLabel(detail.stats.accuracy) }}</text>
              <text>正确率</text>
            </view>
          </view>
        </view>

        <view class="section-heading">
          <view>
            <text class="section-kicker">CHANNELS</text>
            <text class="section-title">做题分布</text>
          </view>
          <text class="section-note">累计数据</text>
        </view>
        <view class="channel-grid">
          <view v-for="(item, index) in channelCards" :key="item.key" :class="['channel-card', item.tone]">
            <view class="channel-head">
              <view class="channel-icon">
                <pp-icon :name="item.icon" :size="34" motion="pop" :delay="80" :stagger="55" :index="index" decorative />
              </view>
              <text>{{ item.title }}</text>
            </view>
            <text class="channel-total num">{{ item.total }}</text>
            <view class="channel-foot">
              <text>{{ item.meta }}</text>
              <text v-if="item.wrong" class="channel-wrong">错 {{ item.wrong }}</text>
              <text v-else class="channel-clear">暂无错题</text>
            </view>
          </view>
        </view>

        <view class="question-bank-head">
          <view>
            <text class="section-kicker">STUDENT BANK</text>
            <text class="section-title">学生题库</text>
          </view>
          <text class="bank-count">{{ detail.question_bank.summary.open }} 道待掌握</text>
        </view>
        <view class="bank-tabs" role="tablist" aria-label="题库状态筛选">
          <button
            v-for="tab in bankTabs"
            :key="tab.value"
            :class="['bank-tab', { active: bankFilter === tab.value }]"
            @tap="bankFilter = tab.value"
          >
            {{ tab.label }}
          </button>
        </view>

        <view v-if="filteredQuestionBank.length" class="question-list">
          <view v-for="(item, index) in filteredQuestionBank" :key="item.id" class="question-item">
            <view class="question-head">
              <view class="question-position">{{ String(index + 1).padStart(2, '0') }}</view>
              <view class="question-tags">
                <text class="source-tag">{{ sourceLabel(item.source_type) }}</text>
                <text :class="['status-tag', item.status]">{{ item.status === 'open' ? '待掌握' : '已掌握' }}</text>
              </view>
              <text class="question-date">{{ shortDate(item.last_attempt_at || item.created_at) }}</text>
            </view>
            <pp-math-text class="question-stem" :value="item.stem || '题干记录暂缺'" />
            <view v-if="item.options" class="choice-options">
              <text v-for="(value, key) in item.options" :key="key" :class="{ correct: key === item.answer }">
                {{ key }}. {{ value }}
              </text>
            </view>
            <view class="answer-row">
              <text>答案 {{ item.answer || '待补充' }}</text>
              <text v-if="item.selected_answer">最近作答 {{ item.selected_answer }}</text>
              <text v-if="item.module">{{ item.module }}</text>
            </view>
          </view>
        </view>
        <pp-state
          v-else
          :title="bankFilter === 'open' ? '当前没有待掌握题目' : '这个分类还没有题目'"
          :description="bankFilter === 'open' ? '新错题出现后会自动进入这里。' : '切换题库状态查看其他记录。'"
        />
      </template>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const students = ref([]);
const selectedStudent = ref(null);
const detail = ref(null);
const loading = ref(false);
const detailLoading = ref(false);
const error = ref('');
const detailError = ref('');
const keyword = ref('');
const classFilter = ref('all');
const bankFilter = ref('open');
const initialStudentId = ref(0);

const bankTabs = [
  { value: 'open', label: '待掌握' },
  { value: 'mastered', label: '已掌握' },
  { value: 'all', label: '全部' },
];

const classOptions = computed(() => {
  const unique = new Map();
  for (const student of students.value) {
    if (student.class_id) unique.set(String(student.class_id), student.class_name || '未命名小组');
  }
  return [
    { value: 'all', label: '全部学生' },
    ...[...unique.entries()].map(([value, label]) => ({ value, label })),
  ];
});

const filteredStudents = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return students.value.filter((student) => {
    const inClass = classFilter.value === 'all' || String(student.class_id) === classFilter.value;
    const matches = !query || String(student.name || '').toLowerCase().includes(query)
      || String(student.class_name || '').toLowerCase().includes(query);
    return inClass && matches;
  });
});

const totalQuestions = computed(() => students.value.reduce(
  (sum, student) => sum + Number(student.stats?.total_questions || 0),
  0,
));
const totalOpenWrong = computed(() => students.value.reduce(
  (sum, student) => sum + Number(student.stats?.open_wrong_count || 0),
  0,
));

const channelCards = computed(() => {
  const channels = detail.value?.stats?.channels || {};
  return [
    {
      key: 'practice', title: '每日打卡', icon: 'clipboard', tone: 'tone-blue',
      total: channels.practice?.total || 0,
      wrong: channels.practice?.wrong || 0,
      meta: `${channels.practice?.days || 0} 天`,
    },
    {
      key: 'choice', title: '选择题王', icon: 'check', tone: 'tone-coral',
      total: channels.choice?.total || 0,
      wrong: channels.choice?.wrong || 0,
      meta: `${channels.choice?.distinct_total || 0} 道不同题`,
    },
    {
      key: 'mental', title: '口算王', icon: 'calculator', tone: 'tone-yellow',
      total: channels.mental?.total || 0,
      wrong: channels.mental?.wrong || 0,
      meta: `${channels.mental?.sessions || 0} 局`,
    },
    {
      key: 'learning', title: '学习中心', icon: 'book', tone: 'tone-mint',
      total: channels.learning?.total || 0,
      wrong: channels.learning?.wrong || 0,
      meta: `${channels.learning?.sessions || 0} 次任务`,
    },
    {
      key: 'knowledge', title: '知识闯关', icon: 'lightbulb', tone: 'tone-purple',
      total: channels.knowledge?.total || 0,
      wrong: channels.knowledge?.wrong || 0,
      meta: '知识点练习',
    },
  ];
});

const filteredQuestionBank = computed(() => {
  const items = detail.value?.question_bank?.items || [];
  if (bankFilter.value === 'all') return items;
  return items.filter((item) => item.status === bankFilter.value);
});

onLoad((query) => {
  initialStudentId.value = Number(query?.student_id || 0);
});

onShow(async () => {
  await loadStudents();
  if (initialStudentId.value && !selectedStudent.value) {
    const target = students.value.find((item) => Number(item.id) === initialStudentId.value);
    if (target) await openStudent(target);
  }
});

onPullDownRefresh(async () => {
  try {
    if (selectedStudent.value) await loadDetail();
    else await loadStudents();
  } finally {
    uni.stopPullDownRefresh();
  }
});

async function loadStudents() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await api.get('/students/learning-records');
    students.value = result.students || [];
  } catch (requestError) {
    error.value = requestError?.error || '请检查网络后重试';
    logError('studentRecords.loadStudents', requestError);
  } finally {
    loading.value = false;
  }
}

async function openStudent(student) {
  selectedStudent.value = student;
  detail.value = null;
  bankFilter.value = 'open';
  await loadDetail();
  uni.pageScrollTo({ scrollTop: 0, duration: 180 });
}

function closeStudent() {
  selectedStudent.value = null;
  detail.value = null;
  detailError.value = '';
  initialStudentId.value = 0;
  uni.pageScrollTo({ scrollTop: 0, duration: 0 });
}

async function loadDetail() {
  if (!selectedStudent.value || detailLoading.value) return;
  detailLoading.value = true;
  detailError.value = '';
  try {
    detail.value = await api.get(`/students/${selectedStudent.value.id}/learning-record`);
  } catch (requestError) {
    detailError.value = requestError?.error || '请检查网络后重试';
    logError('studentRecords.loadDetail', requestError);
  } finally {
    detailLoading.value = false;
  }
}

function openSubmissionArchive() {
  if (!selectedStudent.value?.id) return;
  uni.navigateTo({ url: `/pages/student-submissions/index?student_id=${selectedStudent.value.id}` });
}

function accuracyLabel(value) {
  return value === null || value === undefined ? '—' : `${value}%`;
}

function shortDate(value) {
  const text = String(value || '');
  if (!text) return '';
  const date = text.slice(0, 10);
  return date.replace(/^\d{4}-/, '').replace('-', '/');
}

function sourceLabel(source) {
  return {
    practice_review: '每日打卡',
    mental_arena: '口算王',
    learning: '学习中心',
    homework: '作业订正',
    choice_king: '选择题王',
  }[source] || '学习题目';
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx 48rpx;overflow-x:hidden;box-sizing:border-box;background-color:var(--page-bg);background-image:repeating-linear-gradient(0deg,transparent 0 63rpx,rgba(50,104,214,.028) 64rpx 65rpx)}.hero{position:relative;margin:0 -24rpx;padding:52rpx 34rpx 34rpx;border-bottom:8rpx solid var(--brand-sky);background:#fff!important}.hero::after{right:34rpx;top:0;width:136rpx;height:11rpx;border-radius:0;background:var(--gold)}.hero-copy{max-width:570rpx}.eyebrow{display:block;color:var(--primary);font-size:19rpx;font-weight:760;letter-spacing: 0}.hero-title{display:block;margin-top:10rpx;color:var(--ink);font-size:43rpx;font-weight:840;line-height:1.3}.hero-sub{display:block;margin-top:8rpx;color:var(--text-secondary);font-size:23rpx;line-height:1.55}.hero-index{position:absolute;right:34rpx;top:70rpx;color:#D7E3F6;font-size:92rpx;font-weight:900;line-height:1}.hero-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:1rpx;margin-top:28rpx;border:1rpx solid var(--border);background:var(--border)}.hero-summary>view{min-width:0;padding:16rpx 12rpx;background:var(--surface-muted);text-align:center}.summary-number,.summary-label{display:block}.summary-number{color:var(--ink);font-size:31rpx;font-weight:820}.summary-label{margin-top:2rpx;color:var(--text-muted);font-size:19rpx}.state-wrap{margin:24rpx 0;border:1rpx solid var(--border);background:#fff}.class-filter{width:calc(100% + 48rpx);margin:24rpx -24rpx 0;white-space:nowrap}.class-filter-track{display:inline-flex;gap:10rpx;padding:0 24rpx}.filter-chip{min-height:66rpx;margin:0;padding:0 22rpx;border:1rpx solid var(--border);border-radius:10rpx;background:#fff;color:var(--text-secondary);font-size:22rpx;line-height:66rpx}.filter-chip.active{border-color:var(--primary);background:var(--primary-soft);color:var(--primary-strong);font-weight:700}.filter-chip::after,.student-record::after,.back-to-list::after,.inline-error button::after,.bank-tab::after{border:0}.record-toolbar,.section-heading,.question-bank-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18rpx;margin-top:30rpx}.section-kicker{display:block;color:var(--primary);font-size:18rpx;font-weight:760;letter-spacing: 0}.section-title{display:block;margin-top:4rpx;color:var(--ink);font-size:32rpx;font-weight:800}.section-note{color:var(--text-muted);font-size:20rpx}.search-box{width:230rpx;min-height:66rpx;display:flex;align-items:center;gap:8rpx;padding:0 16rpx;border:1rpx solid var(--border);border-radius:10rpx;background:#fff;color:var(--primary)}.search-input{min-width:0;height:64rpx;flex:1;color:var(--ink);font-size:23rpx}.inline-error{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-top:16rpx;padding:14rpx 16rpx;border-left:6rpx solid var(--danger);background:var(--danger-soft);color:var(--danger);font-size:21rpx}.inline-error button{min-height:54rpx;margin:0;padding:0 18rpx;background:#fff;color:var(--danger);font-size:20rpx}.student-list{display:grid;gap:14rpx;margin-top:18rpx}.student-record{width:100%;margin:0;padding:22rpx;border:1rpx solid var(--border);border-radius:var(--r);background:#fff;color:var(--ink);text-align:left;box-shadow:var(--shadow-sm);transition:transform var(--motion-fast) var(--ease-out),border-color var(--motion-fast) var(--ease-out)}.student-record:active{transform:scale(var(--tap-scale));border-color:var(--primary)}.student-main{display:flex;align-items:center;gap:16rpx}.student-copy{min-width:0;flex:1}.student-title-line{display:flex;align-items:center;gap:10rpx}.student-name{color:var(--ink);font-size:29rpx;font-weight:790}.wrong-badge{padding:4rpx 9rpx;border-radius:7rpx;background:var(--coral-soft);color:var(--danger);font-size:18rpx;font-weight:700}.student-class,.student-updated{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.student-class{margin-top:5rpx;color:var(--text-secondary);font-size:22rpx}.student-updated{margin-top:3rpx;color:var(--faint);font-size:19rpx}.student-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1rpx;margin-top:18rpx;border-top:1rpx solid var(--hairline);background:var(--hairline)}.student-metrics>view{min-width:0;padding:14rpx 6rpx 0;background:#fff;text-align:center}.metric-value,.metric-label{display:block}.metric-value{color:var(--primary-strong);font-size:26rpx;font-weight:800}.metric-label{margin-top:2rpx;color:var(--text-muted);font-size:18rpx}.back-to-list{min-height:68rpx;display:inline-flex;align-items:center;gap:9rpx;margin:22rpx 0 0;padding:0 18rpx;border:1rpx solid var(--border);border-radius:9rpx;background:#fff;color:var(--primary-strong);font-size:22rpx;font-weight:700}.overview-band{display:grid;grid-template-columns:1.05fr 1fr;margin-top:18rpx;border:1rpx solid #B8CAE9;border-radius:var(--r);overflow:hidden;background:#fff;box-shadow:var(--shadow-sm)}.overview-primary{padding:26rpx;background:var(--primary-soft)}.overview-kicker{display:block;color:var(--primary-strong);font-size:20rpx;font-weight:720}.overview-number-line{display:flex;align-items:flex-end;margin-top:8rpx}.overview-number{color:var(--ink);font-size:70rpx;font-weight:900;line-height:1}.overview-unit{padding-bottom:7rpx;color:var(--text-secondary);font-size:23rpx}.overview-copy{display:block;margin-top:12rpx;color:var(--text-secondary);font-size:19rpx;line-height:1.5}.overview-secondary{display:grid;grid-template-rows:repeat(3,1fr);padding:12rpx 20rpx}.overview-secondary>view{display:flex;align-items:center;justify-content:space-between;border-bottom:1rpx solid var(--hairline);color:var(--text-muted);font-size:20rpx}.overview-secondary>view:last-child{border-bottom:0}.overview-small{color:var(--ink);font-size:29rpx;font-weight:800}.channel-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx;margin-top:18rpx}.channel-card{min-width:0;padding:19rpx;border:1rpx solid var(--border);border-radius:var(--r);background:#fff}.channel-card:last-child{grid-column:1/-1}.channel-head{display:flex;align-items:center;gap:10rpx;color:var(--text-secondary);font-size:21rpx;font-weight:700}.channel-icon{width:52rpx;height:52rpx;display:flex;align-items:center;justify-content:center;border-radius:9rpx}.tone-blue .channel-icon{background:var(--primary-soft);color:var(--primary)}.tone-coral .channel-icon{background:var(--coral-soft);color:var(--danger)}.tone-yellow .channel-icon{background:var(--gold-soft);color:var(--warning)}.tone-mint .channel-icon{background:var(--accent-soft);color:var(--accent-strong)}.tone-purple .channel-icon{background:#F0ECFF;color:#6B58B8}.channel-total{display:block;margin-top:12rpx;color:var(--ink);font-size:42rpx;font-weight:850;line-height:1}.channel-foot{display:flex;align-items:center;justify-content:space-between;gap:8rpx;margin-top:10rpx;color:var(--text-muted);font-size:18rpx}.channel-wrong{color:var(--danger);font-weight:700}.channel-clear{color:var(--success);font-weight:700}.bank-count{padding:6rpx 10rpx;border-radius:7rpx;background:var(--coral-soft);color:var(--danger);font-size:19rpx;font-weight:700}.bank-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6rpx;margin-top:16rpx;padding:5rpx;border:1rpx solid var(--border);border-radius:10rpx;background:#fff}.bank-tab{min-height:64rpx;margin:0;border-radius:7rpx;background:transparent;color:var(--text-muted);font-size:22rpx;font-weight:680}.bank-tab.active{background:var(--primary-soft);color:var(--primary-strong)}.question-list{display:grid;gap:14rpx;margin-top:16rpx}.question-item{padding:20rpx;border:1rpx solid var(--border);border-left:7rpx solid var(--primary);border-radius:var(--r);background:#fff;box-shadow:var(--shadow-sm)}.question-head{display:flex;align-items:center;gap:10rpx}.question-position{width:48rpx;height:42rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:7rpx;background:var(--primary-soft);color:var(--primary-strong);font-size:18rpx;font-weight:800}.question-tags{display:flex;align-items:center;gap:7rpx}.source-tag,.status-tag{padding:4rpx 8rpx;border-radius:6rpx;font-size:17rpx;font-weight:700}.source-tag{background:var(--surface-muted);color:var(--text-secondary)}.status-tag.open{background:var(--coral-soft);color:var(--danger)}.status-tag.mastered{background:var(--accent-soft);color:var(--success)}.question-date{margin-left:auto;color:var(--faint);font-size:17rpx}.question-stem{margin-top:18rpx;color:var(--ink);font-size:28rpx;font-weight:690;line-height:1.65}.choice-options{display:grid;gap:8rpx;margin-top:14rpx}.choice-options text{padding:10rpx 12rpx;border-radius:7rpx;background:var(--surface-muted);color:var(--text-secondary);font-size:22rpx}.choice-options text.correct{background:var(--accent-soft);color:var(--accent-strong);font-weight:700}.answer-row{display:flex;flex-wrap:wrap;gap:8rpx 18rpx;margin-top:16rpx;padding-top:14rpx;border-top:1rpx dashed var(--border);color:var(--text-muted);font-size:19rpx}.answer-row text:first-child{color:var(--primary-strong);font-weight:700}@media(max-width:340px){.hero-title{font-size:38rpx}.record-toolbar{align-items:flex-start;flex-direction:column}.search-box{width:100%;box-sizing:border-box}.overview-band{grid-template-columns:1fr}.overview-secondary{min-height:190rpx}.channel-grid{grid-template-columns:1fr}.channel-card:last-child{grid-column:auto}.student-metrics{grid-template-columns:repeat(2,1fr);row-gap:12rpx}}@media(prefers-reduced-motion:reduce){.student-record,.filter-chip,.bank-tab{transition:none!important}.student-record:active{transform:none}}
/* Teacher operations theme: bright learning studio v2. */
.page {
  --primary: #0B789A;
  --primary-strong: #050505;
  --primary-soft: #E5F8FE;
  --accent: #F79BC0;
  --accent-strong: #9B2F5F;
  --accent-soft: #FFF0F6;
  --success: #15755F;
  --success-soft: #E9F8F3;
  --gold: #FFF48A;
  --gold-soft: #FFFBE0;
  --coral: #F79BC0;
  --coral-soft: #FFF0F6;
  --danger: #B53A52;
  --danger-soft: #FFF0F3;
  --info: #0B789A;
  --info-soft: #E5F8FE;
  --ink: #050505;
  --text-secondary: #50545B;
  --text-muted: #6B7078;
  --faint: #939AA1;
  --page-bg: #F7FCFE;
  --surface: #FFFFFF;
  --surface-muted: #FBFDFE;
  --border: #DCE9ED;
  --hairline: #EDF3F5;
  background-color: #F7FCFE;
  background-image: repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(153, 222, 244, .035) 64rpx 65rpx);
}
.page {
  box-sizing: border-box;
  letter-spacing: 0;
}
.hero {
  padding: 34rpx 32rpx 28rpx 40rpx;
  border: 0;
  border-bottom: 1rpx solid #DCE9ED;
  border-left: 8rpx solid #0B789A;
  background: #FFFFFF !important;
}
.hero::after {
  top: 0;
  right: 32rpx;
  width: 112rpx;
  height: 8rpx;
  background: #F79BC0;
}
.eyebrow,
.section-kicker { color: #050505; }
.hero-title,
.section-title { color: #050505; }
.hero-sub { color: #50545B; }
.hero-index {
  color: #EDF3F5;
}
.hero-summary {
  align-items: start;
  border-color: #DCE9ED;
  background: transparent;
  gap: 8rpx;
}
.hero-summary > view {
  padding: 13rpx 10rpx;
  border-radius: 10rpx;
}
.hero-summary > view:nth-child(1) { background: #F8FCFD; }
.hero-summary > view:nth-child(2) { background: #F8FCFD; }
.hero-summary > view:nth-child(3) { background: #FFF0F6; }
.hero-summary > view:nth-child(1) .summary-number { color: #050505; }
.hero-summary > view:nth-child(2) .summary-number { color: #050505; }
.hero-summary > view:nth-child(3) .summary-number { color: #A94F48; }
.state-wrap {
  border-color: #DCE9ED;
  border-radius: 14rpx;
}
.class-filter-track,
.student-list,
.student-metrics,
.channel-grid,
.bank-tabs {
  align-items: start;
}
.filter-chip {
  height: 62rpx;
  min-height: 0;
  padding: 0 20rpx;
  border-color: #DCE9ED;
  line-height: 62rpx;
}
.filter-chip.active {
  border-color: #0B789A;
  background: #E5F8FE;
  color: #050505;
}
.record-toolbar,
.section-heading,
.question-bank-head {
  align-items: flex-start;
}
.search-box {
  min-height: 0;
  height: 64rpx;
  border-color: #DCE9ED;
  color: #050505;
}
.search-input { height: 62rpx; }
.student-record {
  display: block;
  min-height: 0;
  padding: 18rpx;
  border-color: #DCE9ED;
  border-left: 5rpx solid #0B789A;
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 5rpx 15rpx rgba(5, 5, 5, .045);
}
.student-main { align-items: flex-start; }
.wrong-badge {
  background: #FFF0F6;
  color: #A94F48;
}
.student-metrics {
  border-top-color: #EDF3F5;
  background: transparent;
  gap: 6rpx;
}
.student-metrics > view {
  padding: 11rpx 4rpx 0;
  background: transparent;
}
.student-metrics > view:nth-child(1) .metric-value { color: #050505; }
.student-metrics > view:nth-child(2) .metric-value { color: #050505; }
.student-metrics > view:nth-child(3) .metric-value { color: #050505; }
.student-metrics > view:nth-child(4) .metric-value { color: #050505; }
.back-to-list {
  height: 64rpx;
  min-height: 0;
  padding: 0 17rpx;
  border-color: #CDE8F0;
  background: #FFFFFF;
  color: #050505;
  line-height: 64rpx;
}
.overview-band {
  grid-template-columns: 1fr;
  align-items: start;
  border-color: #CDE8F0;
  border-radius: 14rpx;
  background: #FFFFFF;
}
.overview-primary {
  padding: 22rpx;
  background: #E5F8FE;
}
.overview-primary-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.archive-button{min-width:112rpx;height:58rpx;min-height:0;display:flex;align-items:center;justify-content:center;gap:5rpx;margin:0;padding:0 14rpx;border:1rpx solid #9DCFDA;border-radius:9rpx;background:#fff;color:#050505;font-size:20rpx;font-weight:720;line-height:58rpx}.archive-button::after{border:0}
.overview-kicker { color: #050505; }
.overview-number { color: #050505; }
.overview-secondary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: none;
  align-items: start;
  padding: 0;
}
.overview-secondary > view {
  min-height: 0;
  align-items: flex-start;
  flex-direction: column;
  justify-content: flex-start;
  padding: 14rpx;
  border-right: 1rpx solid #EDF3F5;
  border-bottom: 0;
}
.overview-secondary > view:nth-child(1) { background: #FFF0F6; }
.overview-secondary > view:nth-child(2) { background: #F8FCFD; }
.overview-secondary > view:nth-child(3) { background: #F8FCFD; }
.channel-grid { align-content: start; }
.channel-card {
  align-self: start;
  padding: 17rpx;
  border-color: #DCE9ED;
  border-top: 5rpx solid #0B789A;
  border-radius: 12rpx;
}
.channel-card.tone-blue { border-top-color: #0B789A; }
.channel-card.tone-coral { border-top-color: #F79BC0; }
.channel-card.tone-yellow { border-top-color: #0B789A; }
.channel-card.tone-mint { border-top-color: #0B789A; }
.channel-card.tone-purple { border-top-color: #0B789A; }
.tone-blue .channel-icon {
  background: #E5F8FE;
  color: #050505;
}
.tone-coral .channel-icon {
  background: #FFF0F6;
  color: #A94F48;
}
.tone-yellow .channel-icon {
  background: #E5F8FE;
  color: #050505;
}
.tone-mint .channel-icon {
  background: #E5F8FE;
  color: #050505;
}
.tone-purple .channel-icon {
  background: #E5F8FE;
  color: #050505;
}
.bank-count {
  background: #FFF0F6;
  color: #A94F48;
}
.bank-tabs {
  border-color: #DCE9ED;
  background: #FBFDFE;
}
.bank-tab {
  height: 60rpx;
  min-height: 0;
  padding: 0 8rpx;
  line-height: 60rpx;
}
.bank-tab.active {
  background: #FFFFFF;
  color: #050505;
}
.question-item {
  padding: 18rpx;
  border-color: #DCE9ED;
  border-left-color: #0B789A;
  border-radius: 12rpx;
  background: #FFFFFF;
  box-shadow: 0 5rpx 15rpx rgba(5, 5, 5, .045);
}
.question-position {
  background: #E5F8FE;
  color: #050505;
}
.source-tag {
  background: #FBFDFE;
  color: #50545B;
}
.status-tag.open {
  background: #FFF0F6;
  color: #A94F48;
}
.status-tag.mastered,
.choice-options text.correct {
  background: #E5F8FE;
  color: #050505;
}
.answer-row text:first-child { color: #050505; }

.student-record,
.overview-band,
.channel-card,
.question-item {
  animation: learning-record-enter 320ms var(--ease-out) both;
}
.student-record:nth-child(2),
.channel-card:nth-child(2),
.question-item:nth-child(2) { animation-delay: 45ms; }
.student-record:nth-child(3),
.channel-card:nth-child(3),
.question-item:nth-child(3) { animation-delay: 90ms; }
.student-record:nth-child(4),
.channel-card:nth-child(4),
.question-item:nth-child(4) { animation-delay: 135ms; }
.student-record:nth-child(5),
.channel-card:nth-child(5),
.question-item:nth-child(5) { animation-delay: 180ms; }

@keyframes learning-record-enter {
  from { opacity: 0; transform: translateY(10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .student-record,
  .overview-band,
  .channel-card,
  .question-item {
    animation: none !important;
  }
}
</style>
