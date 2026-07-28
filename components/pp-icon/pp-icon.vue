<template>
  <image
    class="pp-icon"
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
  'target',
  'history',
  'pencil',
  'calculator',
  'lightbulb'
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
  target: '学习目标',
  history: '历史记录',
  pencil: '书写',
  calculator: '计算',
  lightbulb: '学习提示'
});

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 44 },
  label: { type: String, default: '' },
  decorative: { type: Boolean, default: true }
});

const safeName = computed(() => ICON_NAMES.includes(props.name) ? props.name : DEFAULT_ICON_NAME);
const iconSrc = computed(() => `/static/icons/${safeName.value}.svg`);
const isDecorative = computed(() => props.decorative && !props.label.trim());
const accessibleLabel = computed(() => {
  if (isDecorative.value) return '';
  return props.label.trim() || ICON_LABELS[safeName.value];
});

const iconStyle = computed(() => {
  const parsedSize = typeof props.size === 'number' ? props.size : parseInt(props.size, 10);
  const size = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 44;
  return { width: `${size}rpx`, height: `${size}rpx` };
});
</script>

<style scoped>
.pp-icon {
  display: block;
  flex-shrink: 0;
}
</style>
