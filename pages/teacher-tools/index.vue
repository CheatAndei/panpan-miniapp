<template>
  <view class="page page-bottom-safe">
    <view class="hero">
      <view class="paper-holes" aria-hidden="true">
        <view class="paper-hole"></view>
        <view class="paper-hole"></view>
        <view class="paper-hole"></view>
      </view>

      <view class="hero-tab">
        <text>快捷工作</text>
      </view>

      <view class="hero-content">
        <view class="hero-meta">
          <text class="course-chip">教师高频入口</text>
          <text class="hero-count">共 {{ tools.length }} 项</text>
        </view>
        <text class="hero-title">今天先处理什么</text>
        <text class="hero-sub">备课、批阅与管理集中在一页，直接进入今天的工作。</text>
        <view class="hero-footer">
          <view class="hero-rule" aria-hidden="true"></view>
          <text class="hero-code">TEACHING DESK · 01</text>
        </view>
      </view>
    </view>

    <view class="section-head">
      <view>
        <text class="section-kicker">工具总览</text>
        <text class="section-title">备课、批阅与管理</text>
      </view>
      <view class="section-index" aria-hidden="true">
        <text>{{ String(tools.length).padStart(2, '0') }}</text>
      </view>
    </view>

    <view class="tool-list">
      <button
        v-for="(item, index) in tools"
        :key="item.url"
        :class="['tool-card', `tool-card-${index + 1}`]"
        :aria-label="`打开${item.title}：${item.desc}`"
        @tap="go(item.url)"
      >
        <view class="tool-number" aria-hidden="true">
          <text>0{{ index + 1 }}</text>
        </view>
        <view :class="['tool-mark', item.tone]" aria-hidden="true">
          <pp-icon
            :name="item.icon"
            :size="40"
            :motion="index === 0 ? 'pop' : item.tone === 'coral' ? 'ring' : 'none'"
          />
        </view>
        <view class="tool-copy">
          <view class="tool-title-line">
            <text class="tool-title">{{ item.title }}</text>
            <text v-if="index === 0" class="tool-priority">常用</text>
          </view>
          <text class="tool-desc">{{ item.desc }}</text>
        </view>
        <view class="tool-arrow" aria-hidden="true">
          <pp-icon name="arrow" :size="26" />
        </view>
      </button>
    </view>

    <view
      class="fair-note"
      role="note"
      aria-label="口算冲榜规则：目标依据真实排行榜生成，不新增虚假成绩，也不修改已有成绩。"
    >
      <view class="note-tab"><text>数据原则</text></view>
      <view class="note-heading">
        <view class="note-mark" aria-hidden="true"></view>
        <text class="note-title">口算冲榜规则</text>
      </view>
      <text class="note-copy">目标依据真实排行榜生成，只告诉学生“还差多少分”；不会新增虚假成绩，也不会修改已有成绩。</text>
    </view>
  </view>
</template>

<script setup>
const tools = [
  { title: '每日打卡计划', desc: '四类初中计算题自由组合，发布并批改', icon: 'clipboard', tone: 'mint', url: '/pages/practice-teacher/index' },
  { title: '广州真题大全', desc: '查看原卷、答案、家长下载和答案申请', icon: 'exam', tone: 'mint', url: '/pages/exam-library/index?grade=g9' },
  { title: '压轴挑战批阅', desc: '核对填空、大题、标准答案和学生解题照片', icon: 'trophy', tone: 'mint', url: '/pages/weekly-review/index' },
  { title: '题目报错处理', desc: '统一核对选择题、口算题和学习计算题', icon: 'report', tone: 'coral', url: '/pages/choice-reports/index' },
  { title: '口算冲榜目标', desc: '给学生设置真实的周排名和分数目标', icon: 'target', tone: 'mint', url: '/pages/mental-goals/index' },
  { title: '学生学习记录', desc: '查看累计题量、错误分布和每名学生的题库', icon: 'report', tone: 'mint', url: '/pages/student-records/index' },
  { title: '学习小组历史', desc: '查看现有小组历次发布、反馈与作业', icon: 'history', tone: 'mint', url: '/pages/teacher-classes/index' },
];

function go(url) {
  uni.navigateTo({ url });
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx 26rpx 56rpx;
  overflow-x: hidden;
  box-sizing: border-box;
  background: var(--page-bg, #F8FCF9);
  color: var(--ink, #26352F);
}

.hero {
  position: relative;
  margin-top: 14rpx;
  overflow: hidden;
  border: 1rpx solid #D7E7DE;
  border-radius: 24rpx 12rpx 24rpx 12rpx;
  background-color: #ffffff;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 51rpx,
    rgba(32, 180, 134, 0.055) 52rpx,
    rgba(32, 180, 134, 0.055) 53rpx
  );
  box-shadow: 0 12rpx 30rpx rgba(21, 148, 109, 0.08);
  animation: page-rise 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.hero::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 56rpx;
  width: 2rpx;
  background: rgba(255, 116, 104, 0.28);
}

.paper-holes {
  position: absolute;
  top: 42rpx;
  bottom: 38rpx;
  left: 18rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.paper-hole {
  width: 16rpx;
  height: 16rpx;
  border: 1rpx solid #D7E7DE;
  border-radius: 50%;
  background: #F8FCF9;
  box-shadow: inset 0 2rpx 3rpx rgba(21, 148, 109, 0.08);
}

.hero-tab {
  position: absolute;
  top: 0;
  right: 28rpx;
  min-width: 144rpx;
  padding: 10rpx 20rpx 12rpx;
  border-radius: 0 0 12rpx 12rpx;
  background: var(--primary, #20B486);
  color: #ffffff;
  text-align: center;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 0;
}

.hero-content {
  position: relative;
  z-index: 1;
  padding: 64rpx 34rpx 32rpx 82rpx;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.course-chip {
  display: inline-flex;
  align-items: center;
  min-height: 40rpx;
  padding: 0 16rpx;
  border: 1rpx solid #D7E7DE;
  border-radius: 8rpx;
  background: var(--primary-soft, #E7F8F1);
  color: var(--primary-strong, #15946D);
  font-size: 20rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.hero-count {
  color: var(--text-secondary, #5A6A62);
  font-size: 21rpx;
  font-weight: 600;
}

.hero-title {
  display: block;
  margin-top: 18rpx;
  color: var(--ink, #26352F);
  font-size: 42rpx;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0;
}

.hero-sub {
  display: block;
  max-width: 540rpx;
  margin-top: 14rpx;
  color: var(--text-secondary, #5A6A62);
  font-size: 24rpx;
  line-height: 1.65;
}

.hero-footer {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 24rpx;
}

.hero-rule {
  width: 58rpx;
  height: 5rpx;
  border-radius: 2rpx;
  background: var(--gold, #20B486);
}

.hero-code {
  color: #5A6A62;
  font-size: 18rpx;
  font-weight: 700;
  letter-spacing: 0;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24rpx;
  margin: 34rpx 4rpx 18rpx;
  animation: page-rise 360ms 40ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.section-kicker {
  display: block;
  color: var(--primary, #20B486);
  font-size: 20rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.section-title {
  display: block;
  margin-top: 4rpx;
  color: var(--ink, #26352F);
  font-size: 31rpx;
  font-weight: 780;
  line-height: 1.35;
}

.section-index {
  width: 56rpx;
  height: 46rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-bottom: 5rpx solid var(--gold, #20B486);
  color: var(--primary-strong, #15946D);
  font-size: 25rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.tool-card {
  width: 100%;
  min-height: 132rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 0;
  padding: 20rpx 18rpx 20rpx 16rpx;
  border: 1rpx solid var(--border, #D7E7DE);
  border-left: 6rpx solid var(--primary, #20B486);
  border-radius: 14rpx;
  background: #ffffff;
  color: var(--ink, #26352F);
  text-align: left;
  line-height: normal;
  box-shadow: 0 7rpx 18rpx rgba(21, 148, 109, 0.055);
  box-sizing: border-box;
  transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease-out;
  animation: card-rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.tool-card::after {
  border: 0;
}

.tool-card:active {
  transform: translateY(2rpx) scale(0.988);
  opacity: 0.86;
}

.tool-card-2 { animation-delay: 35ms; }
.tool-card-3 { animation-delay: 70ms; }
.tool-card-4,
.tool-card-5,
.tool-card-6 { animation: none; }

.tool-number {
  width: 42rpx;
  flex: none;
  padding-right: 10rpx;
  border-right: 1rpx solid var(--border, #D7E7DE);
  color: #5A6A62;
  font-size: 20rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.tool-mark {
  width: 68rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1rpx solid transparent;
  border-radius: 14rpx;
  background: var(--primary-soft, #E7F8F1);
}

.tool-mark.blue {
  border-color: #D7E7DE;
  background: var(--primary-soft, #E7F8F1);
}

.tool-mark.mint {
  border-color: #B8DDCD;
  background: var(--accent-soft, #E7F8F1);
}

.tool-mark.yellow {
  border-color: #D7E7DE;
  background: var(--warning-soft, #E7F8F1);
}

.tool-mark.coral {
  border-color: #F2C4C0;
  background: var(--coral-soft, #FFF0EE);
}

.tool-copy {
  min-width: 0;
  flex: 1;
}

.tool-title-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.tool-title {
  display: block;
  color: var(--ink, #26352F);
  font-size: 28rpx;
  font-weight: 760;
  line-height: 1.35;
}

.tool-priority {
  padding: 3rpx 9rpx;
  border: 1rpx solid #B8DDCD;
  border-radius: 7rpx;
  background: var(--warning-soft, #E7F8F1);
  color: #15946D;
  font-size: 17rpx;
  font-weight: 760;
  line-height: 1.35;
}

.tool-desc {
  display: block;
  margin-top: 7rpx;
  color: var(--text-secondary, #5A6A62);
  font-size: 22rpx;
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
}

.tool-arrow {
  width: 36rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: none;
  opacity: 0.72;
  transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease-out;
}

.tool-card:active .tool-arrow {
  transform: translateX(4rpx);
  opacity: 1;
}

.fair-note {
  position: relative;
  margin-top: 24rpx;
  padding: 30rpx 28rpx 26rpx;
  overflow: hidden;
  border: 1rpx solid #D7E7DE;
  border-radius: 14rpx;
  background-color: #F8FCF9;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 47rpx,
    rgba(32, 180, 134, 0.06) 48rpx,
    rgba(32, 180, 134, 0.06) 49rpx
  );
  animation: card-rise 320ms 210ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.note-tab {
  position: absolute;
  top: 0;
  right: 22rpx;
  padding: 7rpx 14rpx 9rpx;
  border-radius: 0 0 8rpx 8rpx;
  background: var(--gold, #20B486);
  color: #15946D;
  font-size: 18rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.note-heading {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-right: 118rpx;
}

.note-mark {
  width: 7rpx;
  height: 28rpx;
  flex: none;
  border-radius: 2rpx;
  background: var(--coral, #FF7468);
}

.note-title {
  color: var(--ink, #26352F);
  font-size: 25rpx;
  font-weight: 780;
}

.note-copy {
  display: block;
  margin-top: 13rpx;
  color: #5A6A62;
  font-size: 22rpx;
  line-height: 1.65;
}

@keyframes page-rise {
  from {
    transform: translateY(14rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes card-rise {
  from {
    transform: translateY(10rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (max-width: 340px) {
  .page {
    padding-right: 22rpx;
    padding-left: 22rpx;
  }

  .hero-content {
    padding-right: 24rpx;
    padding-left: 76rpx;
  }

  .tool-card {
    gap: 13rpx;
    padding-right: 14rpx;
    padding-left: 12rpx;
  }

  .tool-number {
    width: 38rpx;
    padding-right: 7rpx;
  }

  .tool-mark {
    width: 64rpx;
    height: 64rpx;
  }

  .tool-desc {
    font-size: 21rpx;
  }
}

@media (min-width: 420px) {
  .page {
    padding-right: 32rpx;
    padding-left: 32rpx;
  }

  .hero-content {
    padding-right: 42rpx;
  }

  .tool-card {
    padding-right: 24rpx;
    padding-left: 20rpx;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .section-head,
  .tool-card,
  .tool-arrow,
  .fair-note {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }

  .tool-card:active,
  .tool-card:active .tool-arrow {
    transform: none;
  }
}

/* Teacher operations theme: bright learning studio v2. */
.page {
  --primary: #20B486;
  --primary-strong: #15946D;
  --primary-soft: #E7F8F1;
  --accent: #20B486;
  --accent-strong: #15946D;
  --accent-soft: #E7F8F1;
  --success: #15946D;
  --success-soft: #E7F8F1;
  --gold: #20B486;
  --gold-soft: #E7F8F1;
  --warning: #15946D;
  --warning-soft: #E7F8F1;
  --coral: #FF7468;
  --coral-soft: #FFF0EE;
  --danger: #D94B45;
  --danger-soft: #FFF0EE;
  --info: #20B486;
  --info-soft: #E7F8F1;
  --ink: #26352F;
  --text-secondary: #5A6A62;
  --text-muted: #5A6A62;
  --page-bg: #F8FCF9;
  --surface: #FFFFFF;
  --surface-muted: #F1F8F4;
  --border: #D7E7DE;
  --hairline: #E6F0EA;
  background-color: #F8FCF9;
  background-image: repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(32, 180, 134, .035) 64rpx 65rpx);
}
.page {
  box-sizing: border-box;
  letter-spacing: 0;
}
.hero {
  margin-top: 8rpx;
  border-color: #D7E7DE;
  border-left: 8rpx solid #20B486;
  border-radius: 16rpx;
  background-color: #FFFFFF;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 51rpx,
    rgba(32, 180, 134, .055) 52rpx,
    rgba(32, 180, 134, .055) 53rpx
  );
  box-shadow: 0 8rpx 22rpx rgba(21, 148, 109, .07);
}
.hero::before {
  left: 48rpx;
  background: rgba(255, 116, 104, .28);
}
.paper-holes { display: none; }
.hero-tab {
  background: #20B486;
  color: #FFFFFF;
}
.hero-content {
  padding: 56rpx 30rpx 26rpx 68rpx;
}
.course-chip {
  min-height: 0;
  padding: 7rpx 13rpx;
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.hero-count,
.hero-sub { color: #5A6A62; }
.hero-title { color: #26352F; }
.hero-rule { background: #20B486; }
.hero-code { color: #5A6A62; }
.section-kicker { color: #15946D; }
.section-title { color: #26352F; }
.section-index {
  border-bottom-color: #20B486;
  color: #15946D;
}
.tool-list {
  align-items: flex-start;
}
.tool-card {
  min-height: 0;
  align-items: flex-start;
  padding: 15rpx 14rpx;
  border-color: #D7E7DE;
  border-left-color: #20B486;
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 5rpx 15rpx rgba(38, 53, 47, .045);
}
.tool-card-2,
.tool-card-3,
.tool-card-5,
.tool-card-6 { border-left-color: #20B486; }
.tool-card-4 { border-left-color: #FF7468; }
.tool-card-7 { border-left-color: #20B486; }
.tool-number {
  border-right-color: #D7E7DE;
  color: #5A6A62;
}
.tool-mark {
  width: 64rpx;
  height: 64rpx;
  border-radius: 12rpx;
}
.tool-mark.blue,
.tool-mark.yellow,
.tool-mark.mint {
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.tool-mark.coral {
  border-color: #F2C4C0;
  background: #FFF0EE;
  color: #D94B45;
}
.tool-title { color: #26352F; }
.tool-desc { color: #5A6A62; }
.tool-priority {
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.tool-arrow { color: #15946D; }
.fair-note {
  padding: 25rpx 24rpx 22rpx;
  border-color: #D7E7DE;
  border-radius: 14rpx;
  background-color: #FFFFFF;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 47rpx,
    rgba(32, 180, 134, .06) 48rpx,
    rgba(32, 180, 134, .06) 49rpx
  );
}
.note-tab {
  background: #20B486;
  color: #FFFFFF;
}
.note-mark { background: #20B486; }
.note-title { color: #26352F; }
.note-copy { color: #5A6A62; }
</style>
