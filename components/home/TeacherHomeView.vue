<template>
  <view class="teacher-home">
    <view class="teacher-hero">
      <view class="hero-tab"><text>教师工作台</text></view>
      <view class="hero-copy">
        <text class="eyebrow">{{ brand }} · 今日教务</text>
        <text class="hero-greeting">{{ teacherName }}，{{ greeting }}</text>
        <text class="hero-date num">{{ today }}</text>
      </view>
      <view class="hero-stationery" aria-hidden="true">
        <view class="stationery-line"></view>
        <view class="stationery-line short"></view>
        <view class="stationery-square"></view>
      </view>
    </view>

    <view v-if="loading && classes.length === 0" class="teacher-state-card">
      <pp-state type="loading" title="正在整理今日教务" description="待办、课程和学习小组正在同步。" />
    </view>
    <view v-else-if="error" class="teacher-state-card">
      <pp-state
        type="error"
        title="今日教务加载失败"
        :description="error"
        action-text="重新加载"
        @action="$emit('reload')"
      />
    </view>

    <template v-else>
    <view class="section-head quick-section-head">
      <view>
        <text class="section-kicker">QUICK WORK</text>
        <text class="section-title">快捷工作</text>
      </view>
      <text class="section-note">常用入口</text>
    </view>

    <view class="quick-actions">
      <button class="action-item action-tone-blue" aria-label="进入签到" @tap="navigate('/pages/teacher-checkin/index')">
        <view class="action-icon"><pp-icon name="check" :size="40" motion="pop" :delay="60" decorative /></view>
        <text>签到</text>
      </button>
      <button class="action-item action-tone-coral" aria-label="发送课堂反馈" @tap="navigate('/pages/teacher-feedback/index')">
        <view class="action-icon"><pp-icon name="message" :size="40" motion="ring" :delay="120" decorative /></view>
        <text>发反馈</text>
      </button>
      <button class="action-item action-tone-mint" aria-label="管理学习小组" @tap="navigate('/pages/teacher-classes/index')">
        <view class="action-icon"><pp-icon name="users" :size="40" motion="pop" :delay="180" decorative /></view>
        <text>小组管理</text>
      </button>
      <button class="action-item action-tone-blue" aria-label="查看教师课表" @tap="navigate('/pages/teacher-schedule/index')">
        <view class="action-icon"><pp-icon name="calendar" :size="40" motion="pop" :delay="240" decorative /></view>
        <text>课表</text>
      </button>
      <button class="action-item action-tone-coral" aria-label="处理审批事项" @tap="navigate('/pages/teacher-leaves/index')">
        <view class="action-icon">
          <pp-icon name="clipboard" :size="40" :motion="approvalCount > 0 ? 'ring' : 'pop'" :delay="300" decorative />
          <view v-if="approvalCount > 0" class="red-dot">{{ approvalCount }}</view>
        </view>
        <text>审批</text>
      </button>
      <button class="action-item action-tone-mint record-action" aria-label="查看学生学习记录" @tap="navigate('/pages/student-records/index')">
        <view class="action-icon"><pp-icon name="report" :size="40" motion="shine" :delay="360" decorative /></view>
        <text>学习记录</text>
      </button>
    </view>

    <view class="focus-card">
      <view class="focus-topline">
        <view>
          <text class="focus-label">今日总览</text>
          <text class="focus-summary">{{ totalPending ? `还有 ${totalPending} 项需要处理` : '待办已完成，看看今天的课程安排' }}</text>
        </view>
        <text :class="totalPending ? 'focus-pending' : 'focus-ready'">
          {{ totalPending ? `${totalPending} 项待办` : '待办已清' }}
        </text>
      </view>
      <view class="focus-metrics">
        <button class="focus-metric focus-mastery tone-mastery" aria-label="查看待批阅周末攻坚战" @tap="navigate('/pages/weekend-mastery-review/index')">
          <view class="focus-metric-head">
            <pp-icon name="target" :size="29" :motion="pendingMasteryCount ? 'shine' : 'pop'" decorative />
            <text class="focus-number num">{{ pendingMasteryCount }}</text>
          </view>
          <text class="focus-copy">攻坚战批阅</text>
        </button>
        <button class="focus-metric tone-blue" aria-label="查看待批改学生打卡" @tap="navigate('/pages/practice-review/index')">
          <view class="focus-metric-head">
            <pp-icon name="clipboard" :size="29" :motion="pendingPracticeCount ? 'breathe' : 'pop'" decorative />
            <text class="focus-number num">{{ pendingPracticeCount }}</text>
          </view>
          <text class="focus-copy">打卡批改</text>
        </button>
        <button class="focus-metric tone-yellow" aria-label="查看待批阅压轴挑战" @tap="navigate('/pages/weekly-review/index')">
          <view class="focus-metric-head">
            <pp-icon name="trophy" :size="29" :motion="pendingChallengeCount ? 'shine' : 'pop'" decorative />
            <text class="focus-number num">{{ pendingChallengeCount }}</text>
          </view>
          <text class="focus-copy">压轴批阅</text>
        </button>
        <button class="focus-metric tone-coral" aria-label="查看待审批请假" @tap="navigate('/pages/teacher-leaves/index')">
          <view class="focus-metric-head">
            <pp-icon name="calendar" :size="29" :motion="pendingLeaves ? 'ring' : 'pop'" decorative />
            <text class="focus-number num">{{ pendingLeaves }}</text>
          </view>
          <text class="focus-copy">待审批</text>
        </button>
        <button class="focus-metric tone-mint" aria-label="查看今日课程" @tap="navigate('/pages/teacher-schedule/index')">
          <view class="focus-metric-head">
            <pp-icon name="calendar" :size="29" motion="pop" :delay="160" decorative />
            <text class="focus-number num">{{ todaySessionCount }}</text>
          </view>
          <text class="focus-copy">今日课程</text>
        </button>
      </view>
    </view>

    <view class="section-head">
      <view>
        <text class="section-kicker">PRIORITY</text>
        <text class="section-title">高优先待办</text>
      </view>
      <text class="section-note">{{ priorityCount ? `${priorityCount} 项` : '已处理完成' }}</text>
    </view>

    <view class="priority-stack">
      <view v-if="pendingMasteryCount" class="todo-card tone-mastery">
        <view class="todo-head">
          <view>
            <text class="todo-kicker">周末攻坚战</text>
            <text class="todo-title">待批阅 {{ pendingMasteryCount }} 份</text>
          </view>
          <text class="todo-badge">双关训练</text>
        </view>
        <button
          v-for="item in pendingMasteryTodos"
          :key="item.submission.id"
          class="todo-row"
          :aria-label="`批阅${item.student_name}的周末攻坚战`"
          @tap="navigate('/pages/weekend-mastery-review/index')"
        >
          <view class="todo-copy">
            <text class="todo-name">{{ item.student_name }} · 第 {{ item.stage }} 关</text>
            <text class="todo-meta">{{ item.class_name || '未分组' }} · {{ item.title }}</text>
          </view>
          <text class="todo-action">批阅</text>
          <pp-icon name="arrow" :size="28" decorative />
        </button>
        <button class="todo-all" @tap="navigate('/pages/weekend-mastery-review/index')">进入攻坚战批阅台</button>
      </view>

      <view v-if="pendingPracticeCount" class="todo-card tone-blue">
        <view class="todo-head">
          <view>
            <text class="todo-kicker">学生打卡</text>
            <text class="todo-title">待批改 {{ pendingPracticeCount }} 份</text>
          </view>
          <text class="todo-badge">待批改</text>
        </view>
        <button
          v-for="item in pendingPracticeTodos"
          :key="item.submission_id"
          class="todo-row"
          :aria-label="`批改${item.student_name}的打卡`"
          @tap="$emit('open-practice-todo', item)"
        >
          <view class="todo-copy">
            <text class="todo-name">{{ item.student_name }} · {{ item.practice_date }}</text>
            <text class="todo-meta">{{ item.class_name }} · {{ item.plan_title }}</text>
          </view>
          <text class="todo-action">批改</text>
          <pp-icon name="arrow" :size="28" decorative />
        </button>
        <button class="todo-all" @tap="navigate('/pages/practice-review/index')">进入批改台</button>
      </view>

      <view v-if="pendingChallengeCount" class="todo-card tone-yellow">
        <view class="todo-head">
          <view>
            <text class="todo-kicker">压轴挑战</text>
            <text class="todo-title">待批阅 {{ pendingChallengeCount }} 份</text>
          </view>
          <text class="todo-badge">待批阅</text>
        </view>
        <button
          v-for="item in pendingChallengeTodos"
          :key="item.submission.id"
          class="todo-row"
          :aria-label="`批阅${item.student_name}的压轴挑战`"
          @tap="navigate('/pages/weekly-review/index')"
        >
          <view class="todo-copy">
            <text class="todo-name">{{ item.student_name }} · {{ item.week_start }}</text>
            <text class="todo-meta">{{ item.class_name }} · {{ item.title }}</text>
          </view>
          <text class="todo-action">批阅</text>
          <pp-icon name="arrow" :size="28" decorative />
        </button>
        <button class="todo-all" @tap="navigate('/pages/weekly-review/index')">进入压轴挑战批阅台</button>
      </view>

      <view v-if="answerRequestCount" class="todo-card tone-mint">
        <view class="todo-head">
          <view>
            <text class="todo-kicker">真题答案申请</text>
            <text class="todo-title">等待批准 {{ answerRequestCount }} 份</text>
          </view>
          <text class="todo-badge">待批准</text>
        </view>
        <button
          v-for="item in answerRequestTodos"
          :key="item.id"
          class="todo-row"
          :aria-label="`处理${item.student_name}的答案申请`"
          @tap="$emit('open-answer-requests')"
        >
          <view class="todo-copy">
            <text class="todo-name">{{ item.student_name }} · {{ item.parent_name }}</text>
            <text class="todo-meta">{{ item.display_title }}</text>
          </view>
          <text class="todo-action">处理</text>
          <pp-icon name="arrow" :size="28" decorative />
        </button>
        <button class="todo-all" @tap="$emit('open-answer-requests')">进入答案申请</button>
      </view>

      <view v-if="pendingLeaves" class="todo-card tone-coral compact-todo">
        <view class="todo-head">
          <view>
            <text class="todo-kicker">请假审批</text>
            <text class="todo-title">有 {{ pendingLeaves }} 条申请等待处理</text>
          </view>
          <text class="todo-badge">待审批</text>
        </view>
        <button class="todo-all" @tap="navigate('/pages/teacher-leaves/index')">查看请假申请</button>
      </view>

      <view v-if="pendingQuestionReportCount" class="todo-card tone-coral">
        <view class="todo-head">
          <view>
            <text class="todo-kicker">题目报错</text>
            <text class="todo-title">有 {{ pendingQuestionReportCount }} 条等待审批</text>
          </view>
          <text class="todo-badge">待核对</text>
        </view>
        <button
          v-for="item in pendingQuestionReports"
          :key="`${item.report_kind}-${item.id}`"
          class="todo-row"
          :aria-label="`核对${item.student_name || '学生'}反馈的题目`"
          @tap="navigate('/pages/choice-reports/index')"
        >
          <view class="todo-copy">
            <text class="todo-name">{{ item.student_name || '学生反馈' }} · {{ item.class_name || '未分组' }}</text>
            <text class="todo-meta">{{ item.source_label || item.question_stem || '题目或答案需要核对' }}</text>
          </view>
          <text class="todo-action">审批</text>
          <pp-icon name="arrow" :size="28" decorative />
        </button>
        <button class="todo-all" @tap="navigate('/pages/choice-reports/index')">进入题目报错审批</button>
      </view>

      <view v-if="choiceAlerts.length" class="todo-card tone-mint">
        <view class="todo-head">
          <view>
            <text class="todo-kicker">重要提醒</text>
            <text class="todo-title">学习进度与多人反馈提醒</text>
          </view>
          <text class="todo-badge">里程碑</text>
        </view>
        <view v-for="item in choiceAlerts" :key="item.id" class="choice-alert-row">
          <view class="todo-copy">
            <text class="todo-name">{{ item.title || item.student_name }} · {{ item.class_name || '未分组' }}</text>
            <text class="todo-meta">{{ item.message }}</text>
          </view>
          <button
            class="choice-alert-dismiss"
            :disabled="dismissingAlertId === item.id"
            :aria-label="`确认${item.student_name}的里程碑提醒`"
            @tap="$emit('dismiss-choice-alert', item)"
          >
            {{ dismissingAlertId === item.id ? '处理中' : '知道了' }}
          </button>
        </view>
      </view>

      <view v-if="!hasPriority" class="priority-clear">
        <view class="priority-clear-mark" aria-hidden="true"><pp-icon name="check" :size="42" motion="pop" decorative /></view>
        <view>
          <text class="priority-clear-title">高优先事项已处理</text>
          <text class="priority-clear-copy">可以继续准备课程或整理学习小组。</text>
        </view>
      </view>
    </view>

    <view class="section-head">
      <view>
        <text class="section-kicker">CLASS NOTES</text>
        <text class="section-title">班级历史</text>
      </view>
      <text class="section-note">{{ classes.length }} 个小组</text>
    </view>

    <view class="class-history-card">
      <view class="class-history-head" @tap="toggleClasses">
        <view>
          <text class="class-history-title">学习小组历史查看</text>
          <text class="class-history-summary">反馈、作业与历次发布集中回看</text>
        </view>
        <view class="class-history-actions">
          <button class="class-manage" @tap.stop="navigate('/pages/teacher-classes/index')">管理</button>
          <text class="collapse-label">{{ classesExpanded ? '收起' : '展开' }}</text>
        </view>
      </view>
      <template v-if="classesExpanded">
        <pp-state v-if="loading && classes.length === 0" type="loading" title="正在整理历史" />
        <pp-state
          v-else-if="error && classes.length === 0"
          type="error"
          title="历史加载失败"
          :description="error"
          action-text="重新加载"
          @action="$emit('reload')"
        />
        <pp-state
          v-else-if="classes.length === 0"
          title="还没有学习小组"
          description="创建小组并添加学生后，即可开始排课。"
          action-text="新建小组"
          @action="navigate('/pages/teacher-classes/index')"
        />
        <button
          v-for="item in classes"
          :key="item.id"
          class="class-item"
          :aria-label="`查看${item.name}的历史`"
          @tap="navigate('/pages/class-history/index?id=' + item.id)"
        >
          <view class="class-copy">
            <text class="class-name">{{ item.name }}</text>
            <text class="class-meta">{{ item.grade || '未设置年级' }} · {{ item.subject || '未设置科目' }} · {{ item.feedback_count || 0 }} 条反馈</text>
          </view>
          <view class="class-tail">
            <text class="class-count num">{{ item.studentCount || 0 }}</text>
            <text>人</text>
            <pp-icon name="arrow" :size="30" decorative />
          </view>
        </button>
      </template>
    </view>

    <view class="section-head">
      <view>
        <text class="section-kicker">TEACHING KIT</text>
        <text class="section-title">练习与工具</text>
      </view>
      <text class="section-note">备课资源</text>
    </view>

    <view class="resource-list">
      <button class="resource-entry" @tap="navigate('/pages/practice-teacher/index')">
        <view class="resource-index">01</view>
        <view class="resource-icon tone-mint"><pp-icon name="clipboard" :size="42" motion="pop" decorative /></view>
        <view class="resource-copy">
          <text class="resource-kicker">假期个性化练习</text>
          <text class="resource-title">打卡计划与复核</text>
          <text class="resource-desc">发布题目、查看上传、下载五日 PDF</text>
        </view>
        <pp-icon name="arrow" :size="32" decorative />
      </button>
      <button class="resource-entry" @tap="navigate('/pages/teacher-tools/index')">
        <view class="resource-index">02</view>
        <view class="resource-icon tone-blue"><pp-icon name="exam" :size="42" motion="pop" :delay="100" decorative /></view>
        <view class="resource-copy">
          <text class="resource-kicker">教学工具箱</text>
          <text class="resource-title">真题、压轴挑战与口算目标</text>
          <text class="resource-desc">原卷下载、答案申请、挑战批阅与真实冲榜目标</text>
        </view>
        <pp-icon name="arrow" :size="32" decorative />
      </button>
    </view>

    <button class="promotion-launcher" aria-label="打开宣传海报工作台" @tap="$emit('open-promotion')">
      <view class="promotion-grid" aria-hidden="true"></view>
      <view class="promotion-number">{{ promotionUnseen ? String(promotionUnseen).padStart(2, '0') : 'PP' }}</view>
      <view class="promotion-copy">
        <text class="promotion-kicker">PUBLICITY DESK</text>
        <text class="promotion-title">宣传海报工作台</text>
        <text class="promotion-desc">口算登顶与压轴通关，自动生成真实成绩海报</text>
      </view>
      <view class="promotion-action">
        <text :class="['promotion-badge', { quiet: !promotionUnseen }]">
          {{ promotionUnseen ? `${promotionUnseen} 张新海报` : '查看历史' }}
        </text>
        <pp-icon name="arrow" :size="34" decorative />
      </view>
    </button>
    </template>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  brand: { type: String, default: '番番记录' },
  teacherName: { type: String, default: '老师' },
  greeting: { type: String, default: '' },
  today: { type: String, default: '' },
  totalPending: { type: Number, default: 0 },
  pendingPracticeCount: { type: Number, default: 0 },
  pendingPracticeTodos: { type: Array, default: () => [] },
  pendingMasteryCount: { type: Number, default: 0 },
  pendingMasteryTodos: { type: Array, default: () => [] },
  pendingChallengeCount: { type: Number, default: 0 },
  pendingChallengeTodos: { type: Array, default: () => [] },
  answerRequestCount: { type: Number, default: 0 },
  answerRequestTodos: { type: Array, default: () => [] },
  pendingLeaves: { type: Number, default: 0 },
  pendingQuestionReportCount: { type: Number, default: 0 },
  pendingQuestionReports: { type: Array, default: () => [] },
  todaySessionCount: { type: Number, default: 0 },
  choiceAlerts: { type: Array, default: () => [] },
  dismissingAlertId: { type: [Number, String], default: null },
  classes: { type: Array, default: () => [] },
  classesExpanded: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  promotionUnseen: { type: Number, default: 0 },
});

const emit = defineEmits([
  'navigate',
  'open-practice-todo',
  'open-answer-requests',
  'dismiss-choice-alert',
  'reload',
  'update:classesExpanded',
  'open-promotion',
]);

const priorityCount = computed(() => Number(props.pendingPracticeCount || 0)
  + Number(props.pendingMasteryCount || 0)
  + Number(props.pendingChallengeCount || 0)
  + Number(props.answerRequestCount || 0)
  + Number(props.pendingLeaves || 0)
  + Number(props.pendingQuestionReportCount || 0)
  + props.choiceAlerts.length);

const hasPriority = computed(() => priorityCount.value > 0);
const approvalCount = computed(() => Number(props.pendingLeaves || 0) + Number(props.pendingQuestionReportCount || 0));

function navigate(url) {
  emit('navigate', url);
}

function toggleClasses() {
  emit('update:classesExpanded', !props.classesExpanded);
}
</script>

<style scoped>
.teacher-home {
  padding: 18rpx 24rpx 10rpx;
}

.teacher-hero,
.teacher-state-card,
.focus-card,
.quick-actions,
.todo-card,
.priority-clear,
.class-history-card,
.resource-entry,
.promotion-launcher {
  box-sizing: border-box;
}

.teacher-hero {
  position: relative;
  min-height: 224rpx;
  overflow: hidden;
  padding: 54rpx 34rpx 34rpx 42rpx;
  border: 1rpx solid #CDE8F0;
  border-radius: 16rpx;
  background-color: #FFFFFF;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 50rpx,
    rgba(153, 222, 244, .075) 51rpx,
    rgba(153, 222, 244, .075) 52rpx
  );
  box-shadow: var(--shadow);
  animation: section-enter var(--motion-slow) var(--ease-out) both;
}

.teacher-hero::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 26rpx;
  width: 2rpx;
  background: rgba(247, 155, 192, .42);
}

.hero-tab {
  position: absolute;
  top: 0;
  right: 30rpx;
  padding: 9rpx 18rpx 11rpx;
  border-radius: 0 0 10rpx 10rpx;
  background: var(--coral-soft);
  color: #A94F48;
  font-size: 19rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.hero-copy {
  position: relative;
  z-index: 1;
  max-width: 470rpx;
}

.eyebrow {
  display: block;
  color: var(--primary-strong);
  font-size: 20rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.hero-greeting {
  display: block;
  margin-top: 10rpx;
  color: var(--ink);
  font-size: 39rpx;
  font-weight: 780;
  line-height: 1.4;
  letter-spacing: 0;
}

.hero-date {
  display: block;
  margin-top: 8rpx;
  color: var(--text-muted);
  font-size: 24rpx;
}

.hero-stationery {
  position: absolute;
  right: 34rpx;
  bottom: 31rpx;
  width: 120rpx;
  height: 52rpx;
  opacity: .72;
}

.stationery-line {
  width: 84rpx;
  height: 6rpx;
  margin-top: 10rpx;
  border-radius: 3rpx;
  background: var(--gold);
  transform: rotate(-6deg);
}

.stationery-line.short {
  width: 58rpx;
  margin-left: 18rpx;
  background: var(--accent);
}

.stationery-square {
  position: absolute;
  top: 0;
  right: 0;
  width: 34rpx;
  height: 34rpx;
  border: 3rpx solid rgba(247, 155, 192, .62);
  transform: rotate(9deg);
}

.teacher-state-card {
  margin-top: 18rpx;
  overflow: hidden;
  border: 1rpx solid var(--border);
  border-top: 5rpx solid var(--primary);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}

.focus-card {
  position: relative;
  margin-top: 18rpx;
  padding: 28rpx;
  border: 1rpx solid #CDE8F0;
  border-left: 8rpx solid var(--primary);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
  animation: section-enter var(--motion-slow) 40ms var(--ease-out) both;
}

.focus-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.focus-label {
  display: block;
  color: var(--primary-strong);
  font-size: 22rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.focus-summary {
  display: block;
  margin-top: 4rpx;
  color: var(--ink);
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.45;
}

.focus-pending,
.focus-ready {
  flex: none;
  padding: 7rpx 13rpx;
  border-radius: 9rpx;
  font-size: 20rpx;
  font-weight: 700;
}

.focus-pending {
  color: #A65147;
  background: var(--coral-soft);
}

.focus-ready {
  color: var(--accent-strong);
  background: var(--accent-soft);
}

.focus-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
  margin-top: 22rpx;
}

.focus-metric {
  min-width: 0;
  min-height: 94rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4rpx;
  margin: 0;
  padding: 14rpx 18rpx;
  border: 1rpx solid transparent;
  border-radius: 14rpx;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.focus-metric::after,
.action-item::after,
.todo-row::after,
.todo-all::after,
.choice-alert-dismiss::after,
.class-manage::after,
.class-item::after,
.resource-entry::after,
.promotion-launcher::after {
  border: 0;
}

.focus-metric:active,
.action-item:active,
.todo-row:active,
.todo-all:active,
.choice-alert-dismiss:active,
.class-item:active,
.resource-entry:active,
.promotion-launcher:active {
  transform: scale(.985);
  opacity: .84;
}

.tone-blue {
  border-color: #CDE8F0;
  background: #F8FCFD;
}

.tone-mastery {
  border-color: #E6D65B;
  background: #FFFBE0;
}

.focus-mastery {
  grid-column: 1 / -1;
  min-height: 102rpx;
}

.tone-mastery .focus-metric-head,
.tone-mastery .todo-kicker {
  color: #050505;
}

.tone-yellow {
  border-color: #CDE8F0;
  background: #F8FCFD;
}

.tone-coral {
  border-color: #F0D2CC;
  background: var(--coral-soft);
}

.tone-mint {
  border-color: #CDE8F0;
  background: #F8FCFD;
}

.focus-number {
  color: var(--ink);
  font-size: 38rpx;
  font-weight: 820;
  line-height: 1.05;
}

.focus-metric-head {
  display: flex;
  align-items: center;
  gap: 9rpx;
  color: var(--primary-strong);
}

.tone-coral .focus-metric-head {
  color: var(--danger);
}

.focus-copy {
  color: var(--text-secondary);
  font-size: 21rpx;
  font-weight: 600;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin: 34rpx 4rpx 16rpx;
}

.quick-section-head {
  margin-top: 20rpx;
}

.section-kicker {
  display: block;
  color: var(--primary);
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.section-title {
  display: block;
  margin-top: 3rpx;
  color: var(--ink);
  font-size: 31rpx;
  font-weight: 780;
  line-height: 1.35;
}

.section-note {
  flex: none;
  padding-bottom: 4rpx;
  color: var(--text-muted);
  font-size: 21rpx;
}

.priority-stack {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.todo-card {
  padding: 24rpx;
  border: 1rpx solid var(--border);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}

.todo-card.tone-blue { border-left: 6rpx solid var(--primary); }
.todo-card.tone-mastery { border-left: 8rpx solid #050505; }
.todo-card.tone-yellow { border-left: 6rpx solid var(--primary); }
.todo-card.tone-mint { border-left: 6rpx solid var(--primary); }
.todo-card.tone-coral { border-left: 6rpx solid var(--coral); }

.todo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.todo-kicker {
  display: block;
  color: var(--primary-strong);
  font-size: 19rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.todo-title {
  display: block;
  margin-top: 4rpx;
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 760;
  line-height: 1.45;
}

.todo-badge {
  flex: none;
  padding: 7rpx 13rpx;
  border-radius: 9rpx;
  background: rgba(255, 255, 255, .72);
  color: var(--text-secondary);
  font-size: 20rpx;
  font-weight: 750;
}

.todo-row {
  width: 100%;
  min-height: 82rpx;
  display: flex;
  align-items: center;
  gap: 9rpx;
  margin: 16rpx 0 0;
  padding: 12rpx 0;
  border-top: 1rpx solid rgba(185, 202, 224, .62);
  border-radius: 0;
  background: transparent;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.todo-copy {
  min-width: 0;
  flex: 1;
}

.todo-name {
  display: block;
  color: var(--ink);
  font-size: 25rpx;
  font-weight: 700;
  line-height: 1.4;
}

.todo-meta {
  display: block;
  margin-top: 4rpx;
  color: var(--text-muted);
  font-size: 21rpx;
  line-height: 1.45;
}

.todo-action {
  flex: none;
  color: var(--primary-strong);
  font-size: 22rpx;
  font-weight: 750;
}

.todo-all {
  width: 100%;
  min-height: 80rpx;
  margin: 18rpx 0 0;
  padding: 12rpx 18rpx;
  border: 1rpx solid #C7DDE4;
  border-radius: 14rpx;
  background: #FFFFFF;
  color: var(--primary-strong);
  font-size: 25rpx;
  font-weight: 740;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.compact-todo .todo-all {
  background: var(--coral-soft);
  border-color: #F2C8D5;
  color: #A65147;
}

.choice-alert-row {
  min-height: 96rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #D7E9E4;
}

.choice-alert-dismiss {
  min-height: 72rpx;
  flex: none;
  margin: 0;
  padding: 0 20rpx;
  border: 1rpx solid #BBDCD3;
  border-radius: 12rpx;
  background: #FFFFFF;
  color: var(--accent-strong);
  font-size: 21rpx;
  font-weight: 720;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.priority-clear {
  min-height: 104rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
  border: 1rpx dashed #BFDACE;
  border-radius: 16rpx;
  background: #F8FCFB;
}

.priority-clear-mark {
  width: 68rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 16rpx;
  background: var(--accent-soft);
}

.priority-clear-title {
  display: block;
  color: var(--ink);
  font-size: 27rpx;
  font-weight: 730;
}

.priority-clear-copy {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted);
  font-size: 22rpx;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  padding: 12rpx;
  border: 1rpx solid var(--border);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
  animation: section-enter var(--motion-slow) 30ms var(--ease-out) both;
}

.action-item {
  min-width: 0;
  min-height: 104rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9rpx;
  margin: 0;
  padding: 10rpx 6rpx 9rpx;
  border-radius: 14rpx;
  border: 1rpx solid #DCE9ED;
  background: #F7FCFE;
  color: var(--text-secondary);
  font-size: 22rpx;
  font-weight: 650;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.action-icon {
  position: relative;
  width: 58rpx;
  height: 58rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #CDE8F0;
  border-radius: 14rpx;
  background: #E5F8FE;
  color: #050505;
}

.action-item.action-tone-blue {
  border-color: #CDE8F0;
  background: #F5F8FF;
}

.action-tone-blue .action-icon {
  border-color: #CDE8F0;
  background: #E5F8FE;
  color: #050505;
}

.action-item.action-tone-coral {
  border-color: #F0D2CC;
  background: #FFF8F6;
}

.action-tone-coral .action-icon {
  border-color: #F0D2CC;
  background: #FFF0F6;
  color: #A94F48;
}

.action-item.action-tone-mint {
  border-color: #CBE3DD;
  background: #F5FBF9;
}

.action-tone-mint .action-icon {
  border-color: #CBE3DD;
  background: #EAF7F3;
  color: #2F796B;
}

.red-dot {
  position: absolute;
  top: -9rpx;
  right: -9rpx;
  min-width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6rpx;
  border: 3rpx solid #FFFFFF;
  border-radius: 16rpx;
  background: var(--coral);
  color: #050505;
  font-size: 19rpx;
  box-sizing: border-box;
  animation: pending-dot-pop 440ms 420ms var(--ease-out) both;
}

.class-history-card {
  overflow: hidden;
  border: 1rpx solid var(--border);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}

.class-history-head {
  min-height: 92rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 22rpx 24rpx;
  box-sizing: border-box;
}

.class-history-title {
  display: block;
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 740;
}

.class-history-summary {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted);
  font-size: 21rpx;
}

.class-history-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.class-manage {
  min-height: 66rpx;
  margin: 0;
  padding: 0 17rpx;
  border: 1rpx solid #C7DDE4;
  border-radius: 11rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 21rpx;
  font-weight: 700;
}

.collapse-label {
  color: var(--primary-strong);
  font-size: 21rpx;
  font-weight: 700;
}

.class-item {
  width: calc(100% - 48rpx);
  min-height: 86rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 0 24rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid var(--hairline);
  border-radius: 0;
  background: transparent;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.class-copy {
  min-width: 0;
  flex: 1;
}

.class-name {
  display: block;
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 720;
}

.class-meta {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted);
  font-size: 21rpx;
  line-height: 1.45;
}

.class-tail {
  display: flex;
  align-items: center;
  flex: none;
  color: var(--text-muted);
  font-size: 21rpx;
}

.class-count {
  margin-right: 3rpx;
  color: var(--primary-strong);
  font-size: 28rpx;
  font-weight: 760;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.resource-entry {
  width: 100%;
  min-height: 96rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 0;
  padding: 15rpx 20rpx;
  border: 1rpx solid var(--border);
  border-left: 5rpx solid var(--primary);
  border-radius: 15rpx;
  background: #FFFFFF;
  text-align: left;
  box-shadow: var(--shadow-sm);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.resource-index {
  width: 38rpx;
  flex: none;
  padding-right: 8rpx;
  border-right: 1rpx solid var(--border);
  color: var(--accent-strong);
  font-size: 19rpx;
  font-weight: 800;
}

.resource-icon {
  width: 66rpx;
  height: 66rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 14rpx;
}

.resource-copy {
  min-width: 0;
  flex: 1;
}

.resource-kicker {
  display: block;
  color: var(--primary-strong);
  font-size: 18rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.resource-title {
  display: block;
  margin-top: 2rpx;
  color: var(--ink);
  font-size: 27rpx;
  font-weight: 740;
  line-height: 1.4;
}

.resource-desc {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted);
  font-size: 20rpx;
  line-height: 1.45;
}

.promotion-launcher {
  position: relative;
  width: 100%;
  min-height: 156rpx;
  display: grid;
  grid-template-columns: 102rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 18rpx;
  margin: 18rpx 0 0;
  padding: 26rpx;
  overflow: hidden;
  border: 1rpx solid #CDE8F0;
  border-radius: 16rpx;
  background: #F7FCFE;
  color: var(--ink);
  text-align: left;
  box-shadow: var(--shadow);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.promotion-grid {
  position: absolute;
  inset: 0;
  opacity: .4;
  background-image: linear-gradient(rgba(153, 222, 244, .09) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(153, 222, 244, .09) 1rpx, transparent 1rpx);
  background-size: 38rpx 38rpx;
}

.promotion-number,
.promotion-copy,
.promotion-action {
  position: relative;
  z-index: 1;
}

.promotion-number {
  width: 96rpx;
  height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #FCEEEB;
  border-radius: 12rpx;
  background: var(--coral-soft);
  color: #A94F48;
  font-family: "DIN Alternate", monospace;
  font-size: 42rpx;
  font-weight: 900;
}

.promotion-kicker,
.promotion-title,
.promotion-desc {
  display: block;
}

.promotion-kicker {
  color: var(--primary-strong);
  font-size: 17rpx;
  font-weight: 820;
  letter-spacing: 0;
}

.promotion-title {
  margin-top: 5rpx;
  color: var(--ink);
  font-size: 29rpx;
  font-weight: 820;
}

.promotion-desc {
  max-width: 350rpx;
  margin-top: 5rpx;
  color: var(--text-secondary);
  font-size: 19rpx;
  line-height: 1.45;
}

.promotion-action {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
}

.promotion-badge {
  padding: 7rpx 10rpx;
  border-radius: 7rpx;
  background: var(--coral-soft);
  color: #A65147;
  font-size: 17rpx;
  font-weight: 750;
}

.promotion-badge.quiet {
  background: #FFFFFF;
  color: var(--text-muted);
}

@keyframes section-enter {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pending-dot-pop {
  0% { opacity: 0; transform: scale(.65); }
  72% { opacity: 1; transform: scale(1.12); }
  100% { opacity: 1; transform: scale(1); }
}

@media (max-width: 340px) {
  .teacher-home {
    padding-right: 20rpx;
    padding-left: 20rpx;
  }

  .teacher-hero {
    padding-right: 26rpx;
  }

  .hero-stationery {
    display: none;
  }

  .focus-card,
  .todo-card {
    padding-right: 20rpx;
    padding-left: 20rpx;
  }

  .promotion-launcher {
    grid-template-columns: 82rpx minmax(0, 1fr);
  }

  .promotion-number {
    width: 80rpx;
    height: 98rpx;
    font-size: 36rpx;
  }

  .promotion-action {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .teacher-hero,
  .quick-actions,
  .focus-card,
  .focus-metric,
  .action-item,
  .todo-row,
  .todo-all,
  .choice-alert-dismiss,
  .class-item,
  .resource-entry,
  .promotion-launcher {
    animation: none !important;
    transition: none !important;
  }

  .red-dot {
    animation: none !important;
  }

  .focus-metric:active,
  .action-item:active,
  .todo-row:active,
  .todo-all:active,
  .choice-alert-dismiss:active,
  .class-item:active,
  .resource-entry:active,
  .promotion-launcher:active {
    transform: none;
  }
}

/* Teacher side keeps scan density; color lives in small, repeatable work labels. */
.teacher-home {
  --brand-sky: #99DEF4;
  --brand-pink: #F79BC0;
  --brand-yellow: #FFF48A;
}
.teacher-hero {
  border: 3rpx solid #050505;
  border-top: 12rpx solid #99DEF4;
  box-shadow: none;
}
.teacher-hero .hero-tab { background: #F79BC0; color: #050505; }
.action-item { border-width: 2rpx; box-shadow: none; }
.action-tone-blue { border-color: #99DEF4; background: #E5F8FE; }
.action-tone-coral { border-color: #F79BC0; background: #FFF0F6; }
.action-tone-mint { border-color: #E8D957; background: #FFFBE0; }
.action-tone-blue .action-icon { background: #99DEF4; color: #050505; }
.action-tone-coral .action-icon { background: #F79BC0; color: #050505; }
.action-tone-mint .action-icon { background: #FFF48A; color: #050505; }
.focus-card { border: 2rpx solid #050505; border-left: 12rpx solid #99DEF4; box-shadow: none; }
.focus-metric.tone-blue { background: #E5F8FE; }
.focus-metric.tone-yellow { background: #FFFBE0; }
.focus-metric.tone-coral { background: #FFF0F6; }
.focus-metric.tone-mint { background: #F8FCFD; }
.todo-card.tone-blue { border-left-color: #99DEF4; }
.todo-card.tone-yellow { border-left-color: #FFF48A; }
.todo-card.tone-coral { border-left-color: #F79BC0; }
</style>
