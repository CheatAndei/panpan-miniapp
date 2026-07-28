<template>
  <view class="parent-home">
    <scroll-view v-if="boundKids.length > 1" class="child-switcher" scroll-x aria-label="切换孩子">
      <view class="child-switcher-inner">
        <button
          v-for="item in boundKids"
          :key="item.id"
          :class="['child-chip', { active: child && child.id === item.id }]"
          :aria-label="`切换到${item.name}`"
          @tap="$emit('switch-child', item)"
        >
          {{ item.name }}
        </button>
      </view>
    </scroll-view>

    <view v-if="child" class="parent-hero">
      <view class="hero-tab"><text>家长今日</text></view>
      <view class="parent-hero-grid">
        <view class="parent-hero-copy">
          <text class="eyebrow">{{ brand }} · 学习记录</text>
          <text class="child-greeting">{{ greeting }}，{{ child.name }}家长</text>
          <text class="child-class">{{ child.className }} · {{ childTeacherName }}</text>
        </view>
        <button
          class="mental-hero-mini"
          :aria-label="`查看${child.name}的口算王成绩`"
          @tap="navigate('/pages/mental-arena/index?student_id=' + child.id)"
        >
          <text class="mental-mini-kicker">口算王</text>
          <text class="mental-mini-rank">{{ mentalSummary?.rank ? `本周第 ${mentalSummary.rank} 名` : '本周未上榜' }}</text>
          <text v-if="mentalSummary?.goal && mentalSummary.goal.remaining_score" class="mental-mini-goal">
            距目标差 {{ mentalSummary.goal.remaining_score }} 分
          </text>
          <text v-else class="mental-mini-goal">{{ mentalSummary?.campaign?.reward_text || '前三名有奶茶红包' }}</text>
        </button>
      </view>
    </view>

    <view v-if="child" class="parent-section-nav" aria-label="家长端学习导航">
      <button class="parent-nav-item active" aria-current="page">今日</button>
      <button class="parent-nav-item" @tap="navigate('/pages/learning-center/index?student_id=' + child.id)">学习</button>
      <button class="parent-nav-item" @tap="navigate('/pages/growth/index?student_id=' + child.id)">成长</button>
    </view>

    <view v-if="parentError && child" class="parent-error-strip" role="alert">
      <text>{{ parentError }}</text>
      <button :disabled="parentLoading" @tap="$emit('reload', child.id)">
        {{ parentLoading ? '重试中…' : '重新加载' }}
      </button>
    </view>

    <view v-if="parentLoading && !child" class="state-wrap">
      <pp-state type="loading" title="正在读取孩子的学习动态" />
    </view>
    <view v-else-if="parentError && !child" class="state-wrap">
      <pp-state
        type="error"
        title="暂时无法加载"
        :description="parentError"
        action-text="重新加载"
        @action="$emit('reload')"
      />
    </view>

    <view v-else-if="!child" class="guest-home">
      <view class="guest-status">已微信登录 · 尚未绑定学生</view>
      <text class="guest-title">可以先免费体验</text>
      <text class="guest-copy">选择题、口算不限次数；体验成绩不进排行榜和学生记录。试卷与真实压轴批改需绑定后开放。</text>
      <button class="guest-primary" @tap="navigate('/pages/guest-experience/index')">进入免费体验</button>
      <button class="guest-bind" @tap="navigate('/pages/bind/bind')">已有邀请码，绑定学生</button>
      <view class="guest-contact">
        <text v-if="contactMode === 'wechat_copy'">联系潘潘老师加入 · 微信 {{ teacherWechat }}</text>
        <text v-else>联系潘潘老师加入</text>
        <button v-if="contactMode === 'wechat_copy'" @tap="$emit('copy-teacher-wechat')">复制微信号</button>
        <button v-else open-type="contact">联系微信客服</button>
      </view>
    </view>

    <template v-if="child">
      <view v-if="learningToday" class="today-learning-card">
        <view class="today-learning-head">
          <view>
            <text class="today-eyebrow">TODAY'S PLAN</text>
            <text class="today-title">今日学习任务</text>
            <text class="today-summary">{{ learningToday.progress.completed }} / {{ learningToday.progress.total }} 已完成 · 连续学习 {{ learningToday.stats.streak_days }} 天</text>
          </view>
          <view class="today-percent"><text class="num">{{ learningToday.progress.percent }}</text>%</view>
        </view>
        <view
          class="today-progress"
          role="progressbar"
          aria-label="今日学习完成进度"
          :aria-valuenow="learningToday.progress.percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <view class="today-progress-fill" :style="{ width: learningToday.progress.percent + '%' }"></view>
        </view>
        <button
          v-for="task in learningToday.tasks"
          :key="task.key"
          class="today-task"
          :aria-label="`${task.title}，${taskStatusLabel(task)}`"
          @tap="$emit('open-today-task', task)"
        >
          <view :class="['task-position', { done: task.completed, pending: ['pending_review', 'correction_required'].includes(task.status) }]">
            <text>{{ task.completed ? '✓' : task.position }}</text>
          </view>
          <view class="task-copy">
            <text class="task-title">{{ task.title }}</text>
            <text class="task-desc">{{ task.description }}</text>
          </view>
          <text :class="['task-state', task.status]">{{ taskStatusLabel(task) }}</text>
          <pp-icon name="arrow" :size="28" decorative />
        </button>
        <view class="today-footer">
          <text>近期正确率 {{ learningToday.stats.accuracy === null ? '待积累' : learningToday.stats.accuracy + '%' }}</text>
          <text>{{ learningToday.stats.open_wrong_count }} 道错题待掌握</text>
        </view>
      </view>

      <view v-else-if="learningError" class="home-card learning-error-strip">
        <text>今日学习任务暂未加载</text>
        <button @tap="$emit('reload', child.id)">重试</button>
      </view>

      <pp-homework-brief
        :content="feedbackHomework(latestFeedback)"
        :date="latestFeedback?.class_date || ''"
        :class-name="child.className || ''"
      />

      <view v-if="todayStatus" class="home-card status-card">
        <view class="status-mark" aria-hidden="true">
          <pp-icon :name="todayStatus.checkedIn ? 'check' : 'calendar'" :size="48" decorative />
        </view>
        <view class="status-content">
          <text class="status-kicker">今日状态</text>
          <text :class="['status-badge', statusBadgeClass(todayStatus)]">{{ statusText(todayStatus) }}</text>
          <text v-if="todayStatus.checkOutNote" class="status-note">{{ todayStatus.checkOutNote }}</text>
        </view>
      </view>

      <button class="home-card notify-strip" :disabled="notifyRequesting" @tap="$emit('subscribe')">
        <view class="notify-icon" aria-hidden="true"><pp-icon name="bell" :size="42" decorative /></view>
        <view class="notify-copy">
          <text class="notify-title">{{ notifyRequesting ? '正在申请提醒' : '开启学习提醒' }}</text>
          <text class="notify-desc">接收签到、签退、上课、反馈和作业提醒</text>
        </view>
        <pp-icon name="arrow" :size="32" decorative />
      </button>

      <button class="home-card schedule-card" @tap="navigate('/pages/parent-schedule/index')">
        <view class="card-heading">
          <text class="card-title">本周课表</text>
          <text class="card-link">进入学习小组详情</text>
        </view>
        <view v-if="weekSchedules.length === 0" class="hint">本周暂无学习安排</view>
        <view v-for="item in weekSchedules" :key="item.id" class="schedule-row">
          <text class="schedule-badge">{{ scheduleLabel(item) }}</text>
          <view class="schedule-copy">
            <text class="schedule-title">{{ item.class_name }}</text>
            <text class="schedule-time">{{ item.start_time }} - {{ item.end_time }}</text>
          </view>
          <pp-icon name="arrow" :size="30" decorative />
        </view>
      </button>

      <view class="home-card feedback-card">
        <view class="card-heading">
          <text class="card-title">最新反馈</text>
          <button class="card-link-button" @tap="navigate('/pages/parent-feedback/index')">全部反馈</button>
        </view>
        <button
          v-if="latestFeedback"
          class="feedback-box"
          aria-label="查看学习小组总反馈"
          @tap="$emit('update:feedbackDetail', 'class')"
        >
          <text class="feedback-label">学习小组总反馈</text>
          <text class="feedback-date">{{ latestFeedback.class_date }}</text>
          <text class="feedback-preview">{{ feedbackPreview(latestFeedback.summary) }}</text>
        </button>
        <button
          v-if="studentFeedback"
          class="feedback-box"
          aria-label="查看学生个人反馈"
          @tap="$emit('update:feedbackDetail', 'student')"
        >
          <text class="feedback-label">学生个人反馈</text>
          <text class="feedback-date">{{ studentFeedback.date }}</text>
          <text class="feedback-preview">{{ studentPreview(studentFeedback.text) }}</text>
        </button>
        <view v-if="!latestFeedback && !studentFeedback" class="hint">暂无反馈</view>
      </view>

      <view v-if="parentOpinions.length" class="home-card opinion-card">
        <view class="card-heading">
          <text class="card-title">我的反馈</text>
          <button class="card-link-button" @tap="navigate('/pages/parent-opinions/index?student_id=' + child.id)">全部记录</button>
        </view>
        <button
          v-for="item in parentOpinions"
          :key="item.id"
          class="opinion-row"
          :aria-label="`查看${shortDate(item.created_at)}的反馈记录`"
          @tap="navigate('/pages/parent-opinions/index?student_id=' + child.id)"
        >
          <view class="opinion-head">
            <text :class="['opinion-status', item.status]">{{ opinionStatus(item.status) }}</text>
            <text class="opinion-date">{{ shortDate(item.created_at) }}</text>
          </view>
          <text class="opinion-content">{{ item.content }}</text>
          <text v-if="item.reply" class="opinion-reply">老师：{{ item.reply }}</text>
        </button>
      </view>

      <view class="home-card learning-shortcuts">
        <view class="card-heading">
          <text class="card-title">更多练习</text>
          <button class="card-link-button" @tap="navigate('/pages/learning-center/index?student_id=' + child.id)">进入学习中心</button>
        </view>
        <view class="shortcut-grid">
          <button class="learning-shortcut" @tap="navigate('/pages/weekly-challenge/index?student_id=' + child.id)">
            <view class="shortcut-icon" aria-hidden="true"><pp-icon name="trophy" :size="38" decorative /></view>
            <text class="shortcut-title">压轴挑战</text>
            <text class="shortcut-desc">填空与大题 · 拍照提交</text>
          </button>
          <button class="learning-shortcut" @tap="$emit('open-exam-library')">
            <view class="shortcut-icon" aria-hidden="true"><pp-icon name="exam" :size="38" decorative /></view>
            <text class="shortcut-title">广州真题大全</text>
            <text class="shortcut-desc">一模 · 期中 · 期末</text>
          </button>
        </view>
      </view>

      <view class="home-card parent-tools">
        <text class="card-title service-title">常用服务</text>
        <view class="tool-grid">
          <button class="tool-item" @tap="navigate('/pages/parent-leave/index?child_id=' + child.id)">
            <view class="tool-icon" aria-hidden="true"><pp-icon name="calendar" :size="40" decorative /></view>
            <text class="tool-title">请假申请</text>
            <text class="tool-desc">提交并查看审批</text>
          </button>
          <button class="tool-item" @tap="$emit('update:showFeedback', true)">
            <view class="tool-icon" aria-hidden="true"><pp-icon name="message" :size="40" decorative /></view>
            <text class="tool-title">反馈建议</text>
            <text class="tool-desc">直接告诉老师</text>
          </button>
        </view>
        <view v-if="leaves.length > 0" class="leave-list">
          <view v-for="item in leaves" :key="item.id" class="leave-row">
            <text class="leave-date">{{ item.class_date }}</text>
            <text :class="['leave-status', item.status]">{{ item.status === 'pending' ? '待审批' : item.status === 'approved' ? '已批准' : '已拒绝' }}</text>
          </view>
        </view>
      </view>
    </template>

    <view v-if="feedbackDetail" class="modal-mask" @tap="$emit('update:feedbackDetail', '')">
      <view class="modal" role="dialog" aria-modal="true" aria-label="反馈详情" @tap.stop>
        <text class="modal-title">{{ feedbackDetail === 'class' ? '学习小组总反馈' : '学生个人反馈' }}</text>
        <scroll-view scroll-y class="feedback-modal-body">
          <template v-if="feedbackDetail === 'class' && latestFeedback">
            <text class="feedback-full-text">{{ feedbackSummaryWithoutHomework(latestFeedback.summary) }}</text>
            <button
              v-if="latestFeedback.notes_pdf_url"
              class="pdf-btn"
              @tap="$emit('open-pdf', latestFeedback.notes_pdf_url)"
            >
              打开学习笔记 PDF
            </button>
          </template>
          <template v-if="feedbackDetail === 'student' && studentFeedback">
            <text class="feedback-full-text">{{ studentFeedback.text }}</text>
            <view v-if="studentFeedback.images && studentFeedback.images.length > 0" class="feedback-images">
              <image
                v-for="(image, index) in studentFeedback.images"
                :key="index"
                :src="assetUrl(image)"
                mode="aspectFill"
                class="feedback-thumb"
                @tap="$emit('preview-feedback-image', studentFeedback.images, index)"
              />
            </view>
          </template>
        </scroll-view>
        <button class="modal-close" @tap="$emit('update:feedbackDetail', '')">关闭</button>
      </view>
    </view>

    <view v-if="child && showFeedback" class="modal-mask" @tap="$emit('update:showFeedback', false)">
      <view class="modal" role="dialog" aria-modal="true" aria-label="反馈与建议" @tap.stop>
        <text class="modal-title">反馈与建议</text>
        <textarea
          class="feedback-textarea"
          :value="feedbackText"
          :placeholder="feedbackPlaceholder"
          :maxlength="200"
          @input="updateFeedbackText"
        />
        <button
          class="feedback-submit"
          :disabled="!feedbackText || feedbackSending"
          @tap="$emit('send-feedback')"
        >
          {{ feedbackSending ? '发送中...' : '发送' }}
        </button>
        <button class="modal-close" @tap="$emit('update:showFeedback', false)">取消</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { feedbackHomework, feedbackSummaryWithoutHomework } from '@/utils/feedback';

const props = defineProps({
  brand: { type: String, default: '番番记录' },
  child: { type: Object, default: null },
  boundKids: { type: Array, default: () => [] },
  greeting: { type: String, default: '' },
  childTeacherName: { type: String, default: '' },
  mentalSummary: { type: Object, default: null },
  parentLoading: { type: Boolean, default: false },
  parentError: { type: String, default: '' },
  learningToday: { type: Object, default: null },
  learningError: { type: String, default: '' },
  latestFeedback: { type: Object, default: null },
  studentFeedback: { type: Object, default: null },
  todayStatus: { type: Object, default: null },
  weekSchedules: { type: Array, default: () => [] },
  parentOpinions: { type: Array, default: () => [] },
  leaves: { type: Array, default: () => [] },
  contactMode: { type: String, default: 'customer_service' },
  teacherWechat: { type: String, default: '' },
  notifyRequesting: { type: Boolean, default: false },
  feedbackPlaceholder: { type: String, default: '' },
  feedbackText: { type: String, default: '' },
  feedbackSending: { type: Boolean, default: false },
  showFeedback: { type: Boolean, default: false },
  feedbackDetail: { type: String, default: '' },
  assetUrl: { type: Function, default: (value) => value || '' },
});

const emit = defineEmits([
  'navigate',
  'switch-child',
  'copy-teacher-wechat',
  'open-today-task',
  'reload',
  'subscribe',
  'open-exam-library',
  'open-pdf',
  'preview-feedback-image',
  'send-feedback',
  'update:feedbackText',
  'update:showFeedback',
  'update:feedbackDetail',
]);

const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function navigate(url) {
  emit('navigate', url);
}

function updateFeedbackText(event) {
  emit('update:feedbackText', event.detail.value);
}

function feedbackPreview(value) {
  const text = feedbackSummaryWithoutHomework(value);
  return `${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`;
}

function studentPreview(value) {
  const text = String(value || '');
  return `${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`;
}

function opinionStatus(status) {
  return status === 'approved' ? '老师已回复' : status === 'rejected' ? '已处理' : '等待回复';
}

function shortDate(value) {
  return String(value || '').replace('T', ' ').slice(0, 16);
}

function taskStatusLabel(task) {
  if (task.completed) return '已完成';
  if (task.status === 'pending_review') return '待批改';
  if (task.status === 'correction_required') return '去订正';
  return task.status === 'active' ? '继续' : '开始';
}

function statusBadgeClass(status) {
  if (status?.onLeave) return 'leave';
  return status?.checkedOut ? 'done' : (status?.checkedIn ? 'in' : 'out');
}

function statusText(status) {
  if (status?.onLeave) return '今日已请假';
  if (!status || !status.checkedIn) return '等待签到';
  if (status.checkedOut) return `今日已签退 ${status.checkOutTime || ''}`;
  return `今日已签到 ${status.checkInTime || ''}`;
}

function scheduleLabel(schedule) {
  if (schedule.class_date) {
    const date = new Date(`${schedule.class_date}T00:00:00+08:00`);
    return `${date.getMonth() + 1}/${date.getDate()} ${dayNames[date.getDay()]}`;
  }
  return dayNames[schedule.day_of_week];
}
</script>

<style scoped>
.parent-home {
  padding: 18rpx 24rpx 10rpx;
}

.child-switcher {
  width: calc(100% + 48rpx);
  margin: -18rpx -24rpx 16rpx;
  white-space: nowrap;
  background: rgba(255, 255, 255, .92);
  border-bottom: 1rpx solid var(--hairline);
}

.child-switcher-inner {
  min-width: 100%;
  display: inline-flex;
  gap: 12rpx;
  padding: 12rpx 24rpx;
  box-sizing: border-box;
}

.child-chip {
  min-height: 112rpx;
  flex: none;
  margin: 0;
  padding: 0 24rpx;
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  background: #FFFFFF;
  color: var(--text-muted);
  font-size: 25rpx;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.child-chip.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-weight: 700;
}

.child-chip::after,
.mental-hero-mini::after,
.parent-nav-item::after,
.guest-home button::after,
.today-task::after,
.notify-strip::after,
.schedule-card::after,
.card-link-button::after,
.feedback-box::after,
.opinion-row::after,
.learning-shortcut::after,
.tool-item::after,
.learning-error-strip button::after,
.pdf-btn::after,
.feedback-submit::after,
.modal-close::after {
  border: 0;
}

.parent-hero {
  position: relative;
  overflow: hidden;
  padding: 50rpx 30rpx 32rpx 36rpx;
  border: 1rpx solid #CADCF2;
  border-radius: 24rpx 12rpx 24rpx 12rpx;
  background-color: #FFFFFF;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 51rpx,
    rgba(82, 124, 201, .08) 52rpx,
    rgba(82, 124, 201, .08) 53rpx
  );
  box-shadow: var(--shadow);
  animation: parent-enter var(--motion-slow) var(--ease-out) both;
}

.parent-hero::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 24rpx;
  width: 2rpx;
  background: rgba(233, 133, 119, .3);
}

.hero-tab {
  position: absolute;
  top: 0;
  right: 28rpx;
  padding: 9rpx 17rpx 11rpx;
  border-radius: 0 0 10rpx 10rpx;
  background: var(--primary);
  color: #FFFFFF;
  font-size: 19rpx;
  font-weight: 750;
}

.parent-hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 208rpx;
  align-items: center;
  gap: 20rpx;
}

.parent-hero-copy {
  min-width: 0;
}

.eyebrow {
  display: block;
  color: var(--primary-strong);
  font-size: 19rpx;
  font-weight: 760;
  letter-spacing: 2rpx;
}

.child-greeting {
  display: block;
  margin-top: 10rpx;
  padding: 2rpx 0;
  overflow: visible;
  color: var(--ink);
  font-size: 37rpx;
  font-weight: 780;
  line-height: 1.45;
  letter-spacing: -1rpx;
}

.child-class {
  display: block;
  margin-top: 6rpx;
  color: var(--text-muted);
  font-size: 23rpx;
  line-height: 1.45;
}

.mental-hero-mini {
  min-height: 152rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin: 0;
  padding: 18rpx 16rpx;
  border: 1rpx solid #E6CD7D;
  border-radius: 16rpx;
  background: #FFF8DE;
  text-align: left;
  box-shadow: 0 10rpx 24rpx rgba(142, 99, 12, .1);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.mental-mini-kicker {
  color: #8B6816;
  font-size: 19rpx;
  font-weight: 850;
  letter-spacing: 2rpx;
}

.mental-mini-rank {
  display: block;
  margin-top: 4rpx;
  color: var(--ink);
  font-size: 26rpx;
  font-weight: 800;
}

.mental-mini-goal {
  display: block;
  margin-top: 4rpx;
  color: #806522;
  font-size: 18rpx;
  line-height: 1.4;
}

.parent-section-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  margin-top: 18rpx;
  padding: 8rpx;
  border: 1rpx solid var(--border);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}

.parent-nav-item {
  min-height: 112rpx;
  border-radius: 12rpx;
  background: transparent;
  color: var(--text-muted);
  font-size: 26rpx;
  font-weight: 650;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.parent-nav-item.active {
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-weight: 750;
}

.state-wrap {
  margin-top: 20rpx;
}

.parent-error-strip {
  min-height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid #EFC9C2;
  border-radius: 14rpx;
  background: var(--danger-soft);
  color: #A65147;
  font-size: 22rpx;
  line-height: 1.5;
}

.parent-error-strip button {
  min-height: 88rpx;
  flex: none;
  margin: 0;
  padding: 0 20rpx;
  border: 1rpx solid #E5B7AF;
  border-radius: 11rpx;
  background: #FFFFFF;
  color: #A65147;
  font-size: 21rpx;
  font-weight: 720;
}

.parent-error-strip button::after { border: 0; }

.guest-home {
  margin-top: 20rpx;
  padding: 32rpx;
  border: 1rpx solid #CADCF2;
  border-radius: 20rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow);
}

.guest-status {
  display: inline-flex;
  padding: 8rpx 14rpx;
  border-radius: 9rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 20rpx;
  font-weight: 730;
}

.guest-title,
.guest-copy {
  display: block;
}

.guest-title {
  margin-top: 18rpx;
  color: var(--ink);
  font-size: 36rpx;
  font-weight: 810;
}

.guest-copy {
  margin-top: 9rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.guest-primary,
.guest-bind {
  min-height: 112rpx;
  margin: 18rpx 0 0;
  border-radius: 15rpx;
  font-size: 27rpx;
  font-weight: 760;
}

.guest-primary {
  background: var(--primary-strong);
  color: #FFFFFF;
}

.guest-bind {
  border: 1rpx solid #BCD0EC;
  background: #FFFFFF;
  color: var(--primary-strong);
}

.guest-contact {
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--hairline);
  color: var(--text-secondary);
  font-size: 22rpx;
}

.guest-contact text {
  display: block;
}

.guest-contact button {
  min-height: 88rpx;
  margin: 12rpx 0 0;
  padding: 0 22rpx;
  border: 1rpx solid #E8D79E;
  border-radius: 12rpx;
  background: #FFF8DE;
  color: #765413;
  font-size: 23rpx;
  font-weight: 760;
}

.today-learning-card {
  margin-top: 20rpx;
  overflow: hidden;
  border: 1rpx solid #C9DAF0;
  border-radius: 20rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow);
}

.today-learning-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding: 28rpx 26rpx 22rpx;
  background: var(--primary-soft);
  color: var(--ink);
}

.today-eyebrow {
  display: block;
  color: var(--primary-strong);
  font-size: 19rpx;
  font-weight: 780;
  letter-spacing: 2rpx;
}

.today-title {
  display: block;
  margin-top: 4rpx;
  font-size: 33rpx;
  font-weight: 780;
}

.today-summary {
  display: block;
  margin-top: 6rpx;
  color: var(--text-secondary);
  font-size: 21rpx;
  line-height: 1.45;
}

.today-percent {
  width: 90rpx;
  height: 90rpx;
  display: flex;
  align-items: baseline;
  justify-content: center;
  flex: none;
  padding-top: 17rpx;
  border: 2rpx solid #AFC7E9;
  border-radius: 50%;
  box-sizing: border-box;
  color: var(--primary-strong);
  font-size: 19rpx;
}

.today-percent .num {
  font-size: 36rpx;
  font-weight: 820;
}

.today-progress {
  height: 8rpx;
  background: #DCE8F7;
}

.today-progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width var(--motion-base) var(--ease-out);
}

.today-task {
  width: 100%;
  min-height: 122rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin: 0;
  padding: 20rpx 22rpx;
  border-bottom: 1rpx solid var(--hairline);
  border-radius: 0;
  background: #FFFFFF;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.task-position {
  width: 58rpx;
  height: 58rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 14rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 24rpx;
  font-weight: 800;
}

.task-position.done {
  background: var(--accent);
  color: #FFFFFF;
}

.task-position.pending {
  background: #FFF4D4;
  color: #8A681E;
}

.task-copy {
  min-width: 0;
  flex: 1;
}

.task-title {
  display: block;
  color: var(--ink);
  font-size: 27rpx;
  font-weight: 720;
}

.task-desc {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted);
  font-size: 21rpx;
  line-height: 1.45;
}

.task-state {
  flex: none;
  color: var(--primary-strong);
  font-size: 20rpx;
  font-weight: 720;
}

.task-state.completed { color: var(--accent-strong); }
.task-state.pending_review,
.task-state.correction_required { color: #9A6A22; }

.today-footer {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  padding: 18rpx 22rpx 20rpx;
  background: #F8FBFF;
  color: var(--text-muted);
  font-size: 19rpx;
}

.home-card {
  width: 100%;
  margin-top: 18rpx;
  padding: 26rpx;
  border: 1rpx solid var(--border);
  border-radius: 18rpx;
  background: #FFFFFF;
  box-sizing: border-box;
  box-shadow: var(--shadow-sm);
}

.learning-error-strip {
  min-height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  color: var(--text-muted);
  font-size: 23rpx;
}

.learning-error-strip button {
  min-height: 88rpx;
  margin: 0;
  padding: 8rpx 24rpx;
  border-radius: 12rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 22rpx;
  font-weight: 700;
}

.status-card {
  min-height: 132rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.status-mark,
.notify-icon {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 16rpx;
  background: var(--primary-soft);
}

.status-content {
  flex: 1;
}

.status-kicker {
  display: block;
  color: var(--text-muted);
  font-size: 21rpx;
}

.status-badge {
  display: block;
  margin-top: 2rpx;
  color: var(--ink);
  font-size: 29rpx;
  font-weight: 730;
}

.status-badge.done,
.status-badge.in {
  color: var(--accent-strong);
}

.status-badge.out {
  color: #8A681E;
}

.status-badge.leave {
  color: #B0574D;
}

.status-note {
  display: block;
  margin-top: 6rpx;
  color: #B0574D;
  font-size: 22rpx;
}

.notify-strip {
  min-height: 112rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.notify-copy {
  min-width: 0;
  flex: 1;
}

.notify-title {
  display: block;
  color: var(--ink);
  font-size: 27rpx;
  font-weight: 700;
}

.notify-desc {
  display: block;
  margin-top: 2rpx;
  color: var(--text-muted);
  font-size: 22rpx;
  line-height: 1.45;
}

.schedule-card {
  display: block;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.card-heading {
  min-height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
}

.card-title {
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 750;
}

.card-link,
.card-link-button {
  color: var(--primary-strong);
  font-size: 21rpx;
  font-weight: 650;
}

.card-link-button {
  min-height: 72rpx;
  margin: 0;
  padding: 0 8rpx;
  background: transparent;
}

.hint {
  padding: 24rpx;
  color: var(--text-muted);
  font-size: 24rpx;
  text-align: center;
}

.schedule-row {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid var(--hairline);
}

.schedule-badge {
  flex: none;
  padding: 7rpx 12rpx;
  border-radius: 9rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 20rpx;
  font-weight: 650;
}

.schedule-copy {
  min-width: 0;
  flex: 1;
}

.schedule-title {
  display: block;
  color: var(--ink);
  font-size: 26rpx;
  font-weight: 650;
}

.schedule-time {
  display: block;
  margin-top: 2rpx;
  color: var(--text-muted);
  font-size: 22rpx;
}

.feedback-box {
  width: 100%;
  min-height: 112rpx;
  display: block;
  margin: 0 0 12rpx;
  padding: 19rpx;
  border: 1rpx solid #D9E5F3;
  border-radius: 14rpx;
  background: #F8FBFF;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.feedback-label,
.feedback-date,
.feedback-preview {
  display: block;
}

.feedback-label {
  color: var(--primary-strong);
  font-size: 21rpx;
  font-weight: 700;
}

.feedback-date {
  margin-top: 2rpx;
  color: var(--text-muted);
  font-size: 21rpx;
}

.feedback-preview {
  display: -webkit-box;
  margin-top: 5rpx;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 25rpx;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.opinion-row {
  width: 100%;
  min-height: 112rpx;
  display: block;
  margin: 0;
  padding: 20rpx 0;
  border-top: 1rpx solid var(--hairline);
  border-radius: 0;
  background: transparent;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.opinion-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.opinion-status {
  padding: 5rpx 12rpx;
  border-radius: 8rpx;
  background: #FFF4D4;
  color: #8A681E;
  font-size: 20rpx;
  font-weight: 700;
}

.opinion-status.approved {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.opinion-status.rejected {
  background: var(--surface-muted);
  color: var(--text-muted);
}

.opinion-date {
  color: var(--faint);
  font-size: 20rpx;
}

.opinion-content {
  display: block;
  margin-top: 9rpx;
  color: var(--ink);
  font-size: 25rpx;
  line-height: 1.6;
}

.opinion-reply {
  display: block;
  margin-top: 9rpx;
  padding: 12rpx 14rpx;
  border-left: 5rpx solid var(--accent);
  border-radius: 0 9rpx 9rpx 0;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 22rpx;
  line-height: 1.55;
}

.shortcut-grid,
.tool-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
}

.learning-shortcut,
.tool-item {
  min-height: 148rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  margin: 0;
  padding: 20rpx;
  border: 1rpx solid #D9E5F3;
  border-radius: 15rpx;
  background: #F8FBFF;
  color: var(--ink);
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.shortcut-icon,
.tool-icon {
  width: 58rpx;
  height: 58rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 9rpx;
  border-radius: 14rpx;
  background: var(--primary-soft);
}

.shortcut-title,
.tool-title {
  color: var(--ink);
  font-size: 25rpx;
  font-weight: 720;
  line-height: 1.4;
}

.shortcut-desc,
.tool-desc {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted);
  font-size: 20rpx;
  font-weight: 500;
  line-height: 1.45;
}

.service-title {
  display: block;
  margin-bottom: 15rpx;
}

.leave-list {
  margin-top: 18rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid var(--hairline);
}

.leave-row {
  display: flex;
  justify-content: space-between;
  padding: 10rpx 0;
  font-size: 24rpx;
}

.leave-date { color: var(--text-secondary); }
.leave-status { color: var(--text-muted); }
.leave-status.pending { color: #8A681E; }
.leave-status.approved { color: var(--accent-strong); }
.leave-status.rejected { color: #B0574D; }

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 99;
  display: flex;
  align-items: flex-end;
  background: rgba(36, 50, 74, .46);
  animation: modal-mask-enter var(--motion-base) ease-out both;
}

.modal {
  width: 100%;
  max-height: 86vh;
  padding: 32rpx 30rpx calc(28rpx + env(safe-area-inset-bottom));
  overflow: hidden;
  border-radius: 24rpx 24rpx 0 0;
  background: #FFFFFF;
  box-sizing: border-box;
  box-shadow: var(--shadow-lg);
  animation: modal-enter var(--motion-slow) var(--ease-out) both;
}

.modal-title {
  display: block;
  margin-bottom: 20rpx;
  color: var(--ink);
  font-size: 31rpx;
  font-weight: 750;
  text-align: center;
}

.feedback-modal-body {
  max-height: 56vh;
  overflow-y: auto;
}

.feedback-full-text {
  color: var(--text-secondary);
  font-size: 27rpx;
  line-height: 1.8;
  white-space: pre-wrap;
}

.pdf-btn,
.feedback-submit {
  width: 100%;
  min-height: 112rpx;
  margin: 18rpx 0 0;
  border-radius: 14rpx;
  background: var(--primary-strong);
  color: #FFFFFF;
  font-size: 27rpx;
  font-weight: 720;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.feedback-images {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 16rpx;
}

.feedback-thumb {
  width: 150rpx;
  height: 150rpx;
  border-radius: 8rpx;
}

.feedback-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 18rpx;
  border: 1rpx solid #C9DAF0;
  border-radius: 14rpx;
  background: #FAFCFF;
  box-sizing: border-box;
  color: var(--ink);
  font-size: 27rpx;
  line-height: 1.6;
}

.modal-close {
  width: 100%;
  min-height: 96rpx;
  margin: 12rpx 0 0;
  border: 1rpx solid var(--border);
  border-radius: 13rpx;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 27rpx;
}

.child-chip:active,
.mental-hero-mini:active,
.parent-nav-item:active,
.guest-home button:active,
.today-task:active,
.notify-strip:active,
.schedule-card:active,
.feedback-box:active,
.opinion-row:active,
.learning-shortcut:active,
.tool-item:active,
.pdf-btn:active,
.feedback-submit:active {
  transform: scale(.985);
  opacity: .84;
}

@keyframes parent-enter {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes modal-mask-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: translateY(36rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 360px) {
  .parent-home {
    padding-right: 20rpx;
    padding-left: 20rpx;
  }

  .child-switcher {
    width: calc(100% + 40rpx);
    margin-right: -20rpx;
    margin-left: -20rpx;
  }

  .parent-hero {
    padding-right: 24rpx;
  }

  .parent-hero-grid {
    grid-template-columns: 1fr;
  }

  .mental-hero-mini {
    min-height: 112rpx;
  }

  .child-greeting {
    font-size: 34rpx;
  }

  .today-learning-head {
    padding-right: 22rpx;
    padding-left: 22rpx;
  }

  .today-footer {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .parent-hero,
  .child-chip,
  .mental-hero-mini,
  .parent-nav-item,
  .guest-home button,
  .today-progress-fill,
  .today-task,
  .notify-strip,
  .schedule-card,
  .feedback-box,
  .opinion-row,
  .learning-shortcut,
  .tool-item,
  .modal-mask,
  .modal,
  .pdf-btn,
  .feedback-submit {
    animation: none !important;
    transition: none !important;
  }

  .child-chip:active,
  .mental-hero-mini:active,
  .parent-nav-item:active,
  .guest-home button:active,
  .today-task:active,
  .notify-strip:active,
  .schedule-card:active,
  .feedback-box:active,
  .opinion-row:active,
  .learning-shortcut:active,
  .tool-item:active,
  .pdf-btn:active,
  .feedback-submit:active {
    transform: none;
  }
}
</style>
