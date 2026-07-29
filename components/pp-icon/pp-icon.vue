<template>
  <image
    :class="['pp-icon', motionClass]"
    :src="iconSrc"
    :style="iconStyle"
    mode="aspectFit"
    :role="isDecorative ? undefined : 'img'"
    :alt="accessibleLabel"
    :aria-label="accessibleLabel"
    :aria-hidden="isDecorative"
  />
</template>

<script setup>
import { computed } from 'vue';

const DEFAULT_ICON_NAME = 'book';
const MOTION_NAMES = Object.freeze([
  'none',
  'breathe',
  'bob',
  'pop',
  'ring',
  'shine'
]);
const ICON_NAMES = Object.freeze([
  'arrow',
  'bell',
  'book',
  'brand',
  'calendar',
  'check',
  'clipboard',
  'home',
  'message',
  'plus',
  'user',
  'users',
  'exam',
  'trophy',
  'report',
  'search',
  'target',
  'history',
  'pencil',
  'calculator',
  'lightbulb',
  'school',
  'clock',
  'document',
  'trend',
  'family'
]);
const ICON_LABELS = Object.freeze({
  arrow: '前往',
  bell: '通知',
  book: '学习',
  brand: '番番记录',
  calendar: '日历',
  check: '完成',
  clipboard: '任务清单',
  home: '首页',
  message: '消息',
  plus: '添加',
  user: '个人',
  users: '学习小组',
  exam: '考试',
  trophy: '成就',
  report: '报告',
  search: '搜索',
  target: '学习目标',
  history: '历史记录',
  pencil: '书写',
  calculator: '计算',
  lightbulb: '学习提示',
  school: '课程',
  clock: '时间',
  document: '学习文档',
  trend: '学习趋势',
  family: '家校服务'
});

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 44 },
  label: { type: String, default: '' },
  decorative: { type: Boolean, default: true },
  motion: {
    type: String,
    default: 'none',
    validator: (value) => ['none', 'breathe', 'bob', 'pop', 'ring', 'shine'].includes(value)
  },
  delay: { type: [Number, String], default: 0 },
  stagger: { type: [Number, String], default: 0 },
  index: { type: [Number, String], default: 0 }
});

const safeName = computed(() => ICON_NAMES.includes(props.name) ? props.name : DEFAULT_ICON_NAME);
const safeMotion = computed(() => MOTION_NAMES.includes(props.motion) ? props.motion : 'none');
const iconSrc = computed(() => `/static/icons/${safeName.value}.svg`);
const isDecorative = computed(() => props.decorative && !props.label.trim());
const accessibleLabel = computed(() => {
  if (isDecorative.value) return '';
  return props.label.trim() || ICON_LABELS[safeName.value];
});

const toNonNegativeNumber = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const motionClass = computed(() => (
  safeMotion.value === 'none' ? '' : `pp-icon--motion-${safeMotion.value}`
));

const motionDelay = computed(() => {
  const delay = toNonNegativeNumber(props.delay);
  const stagger = toNonNegativeNumber(props.stagger);
  const index = Math.floor(toNonNegativeNumber(props.index));
  return Math.min(Math.round(delay + stagger * index), 10000);
});

const iconStyle = computed(() => {
  const parsedSize = typeof props.size === 'number' ? props.size : parseInt(props.size, 10);
  const size = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 44;
  const style = { width: `${size}rpx`, height: `${size}rpx` };
  if (safeMotion.value !== 'none' && motionDelay.value > 0) {
    style.animationDelay = `${motionDelay.value}ms`;
  }
  return style;
});
</script>

<style scoped>
.pp-icon {
  display: block;
  flex-shrink: 0;
  transform-origin: center;
}

.pp-icon--motion-breathe {
  animation: pp-icon-breathe 2400ms ease-in-out infinite;
}

.pp-icon--motion-bob {
  animation: pp-icon-bob 2200ms ease-in-out infinite;
}

.pp-icon--motion-pop {
  animation: pp-icon-pop 420ms cubic-bezier(0.2, 0.8, 0.2, 1) 1;
}

.pp-icon--motion-ring {
  animation: pp-icon-ring 560ms ease-in-out 1;
}

.pp-icon--motion-shine {
  animation: pp-icon-shine 2800ms ease-in-out infinite;
}

@keyframes pp-icon-breathe {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.88;
    transform: scale(1.04);
  }
}

@keyframes pp-icon-bob {
  0%,
  100% {
    opacity: 1;
    transform: translateY(0);
  }
  50% {
    opacity: 0.94;
    transform: translateY(-4rpx);
  }
}

@keyframes pp-icon-pop {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  32% {
    opacity: 0.82;
    transform: scale(0.88);
  }
  72% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes pp-icon-ring {
  0%,
  100% {
    opacity: 1;
    transform: rotate(0);
  }
  22% {
    transform: rotate(-8deg);
  }
  44% {
    transform: rotate(7deg);
  }
  66% {
    transform: rotate(-5deg);
  }
  84% {
    transform: rotate(3deg);
  }
}

@keyframes pp-icon-shine {
  0%,
  72%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  80% {
    opacity: 0.76;
    transform: scale(0.95);
  }
  88% {
    opacity: 1;
    transform: scale(1.06);
  }
  94% {
    opacity: 0.92;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pp-icon--motion-breathe,
  .pp-icon--motion-bob,
  .pp-icon--motion-pop,
  .pp-icon--motion-ring,
  .pp-icon--motion-shine {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
</style>
