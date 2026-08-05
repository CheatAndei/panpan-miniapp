<template>
  <view class="problem-sheet">
    <template v-for="(section, sectionIndex) in safeSections" :key="`${sectionIndex}-${section.type}`">
      <pp-math-text
        v-if="section.type === 'paragraph'"
        class="problem-paragraph"
        :value="section.text || ''"
        :blocks="section.blocks || []"
      />

      <view v-else-if="section.type === 'formula'" class="problem-formula">
        <pp-math-text
          :value="section.text || ''"
          :blocks="section.blocks || []"
          :align="section.align || 'center'"
        />
      </view>

      <view v-else-if="section.type === 'list'" class="problem-list">
        <view v-for="(item, itemIndex) in section.items || []" :key="itemIndex" class="problem-list-item">
          <text class="problem-list-label">{{ item.label || `（${itemIndex + 1}）` }}</text>
          <pp-math-text
            class="problem-list-copy"
            :value="item.text || ''"
            :blocks="item.blocks || []"
          />
        </view>
      </view>

      <view v-else-if="section.type === 'table'" class="problem-table-shell">
        <view
          class="problem-table"
          :style="{ gridTemplateColumns: `repeat(${tableColumns(section)}, minmax(0, 1fr))` }"
          role="table"
          :aria-label="section.label || '题目数据表'"
        >
          <view
            v-for="(cell, cellIndex) in tableCells(section)"
            :key="cellIndex"
            :class="['problem-cell', { 'is-heading': cell.heading }]"
            role="cell"
          >
            <pp-math-text :value="cell.text" :blocks="cell.blocks" align="center" />
          </view>
        </view>
      </view>

      <view
        v-else-if="section.type === 'number_line'"
        class="number-line-card"
        role="img"
        :aria-label="section.label || '数轴示意图'"
      >
        <text v-if="section.label" class="number-line-label">{{ section.label }}</text>
        <view class="number-line-stage">
          <view class="number-line-axis"></view>
          <view class="number-line-arrow left"></view>
          <view class="number-line-arrow right"></view>
          <view
            v-for="(motion, motionIndex) in section.motions || []"
            :key="`motion-${motionIndex}`"
            :class="['number-line-motion', { reverse: Number(motion.to) < Number(motion.from) }]"
            :style="motionStyle(motion)"
          >
            <text class="motion-copy">{{ motion.label || (Number(motion.to) >= Number(motion.from) ? '→' : '←') }}</text>
          </view>
          <view
            v-for="(point, pointIndex) in section.points || []"
            :key="`point-${pointIndex}`"
            class="number-line-point"
            :style="{ left: percent(point.position) }"
          >
            <text class="point-name">{{ point.name }}</text>
            <view class="point-dot"></view>
            <text class="point-value">{{ point.value }}</text>
          </view>
        </view>
      </view>

      <view v-else-if="section.type === 'note'" class="problem-note">
        <text v-if="section.label" class="problem-note-label">{{ section.label }}</text>
        <pp-math-text :value="section.text || ''" :blocks="section.blocks || []" />
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  render: { type: Object, default: () => ({}) },
});

const safeSections = computed(() => (
  Array.isArray(props.render?.sections) ? props.render.sections.filter(Boolean) : []
));

function tableColumns(section) {
  const headers = Array.isArray(section?.headers) ? section.headers : [];
  const firstRow = Array.isArray(section?.rows?.[0]) ? section.rows[0] : [];
  return Math.max(1, headers.length || firstRow.length || Number(section?.columns) || 1);
}

function normalizedCell(raw, heading = false) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return {
      heading,
      text: String(raw.text ?? raw.value ?? ''),
      blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
    };
  }
  return { heading, text: String(raw ?? ''), blocks: [] };
}

function tableCells(section) {
  const cells = [];
  (Array.isArray(section?.headers) ? section.headers : []).forEach((cell) => cells.push(normalizedCell(cell, true)));
  (Array.isArray(section?.rows) ? section.rows : []).forEach((row) => {
    (Array.isArray(row) ? row : []).forEach((cell) => cells.push(normalizedCell(cell, false)));
  });
  return cells;
}

function clamp(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(7, Math.min(93, number)) : 50;
}

function percent(value) {
  return `${clamp(value)}%`;
}

function motionStyle(motion) {
  const from = clamp(motion?.from);
  const to = clamp(motion?.to);
  return {
    left: `${Math.min(from, to)}%`,
    width: `${Math.max(7, Math.abs(to - from))}%`,
  };
}
</script>

<style scoped>
.problem-sheet { color: #050505; font-size: 27rpx; line-height: 1.75; }
.problem-paragraph + .problem-paragraph { margin-top: 14rpx; }
.problem-formula {
  margin: 18rpx 0;
  padding: 18rpx 20rpx;
  border-left: 6rpx solid #99DEF4;
  background: #F7FCFE;
  font-size: 31rpx;
  font-weight: 720;
}
.problem-list { margin-top: 18rpx; }
.problem-list-item { display: flex; align-items: flex-start; gap: 10rpx; margin-top: 18rpx; }
.problem-list-label { flex: none; color: #0B789A; font-weight: 800; }
.problem-list-copy { min-width: 0; flex: 1; }
.problem-table-shell { width: 100%; margin: 20rpx 0; overflow-x: auto; }
.problem-table {
  display: grid;
  min-width: 560rpx;
  overflow: hidden;
  border-top: 1rpx solid #050505;
  border-left: 1rpx solid #050505;
  background: #FFFFFF;
}
.problem-cell {
  min-height: 66rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10rpx 12rpx;
  border-right: 1rpx solid #050505;
  border-bottom: 1rpx solid #050505;
  font-variant-numeric: tabular-nums;
}
.problem-cell.is-heading { background: #FFFBE0; font-weight: 800; }
.number-line-card {
  margin: 22rpx 0;
  padding: 18rpx 14rpx 14rpx;
  border: 1rpx solid #DCE9ED;
  background: #FFFFFF;
}
.number-line-label { display: block; margin-left: 8rpx; color: #50545B; font-size: 20rpx; }
.number-line-stage { position: relative; height: 150rpx; margin-top: 8rpx; }
.number-line-axis { position: absolute; left: 7%; right: 7%; top: 78rpx; height: 3rpx; background: #050505; }
.number-line-arrow { position: absolute; top: 70rpx; width: 0; height: 0; border-top: 9rpx solid transparent; border-bottom: 9rpx solid transparent; }
.number-line-arrow.left { left: 5%; border-right: 15rpx solid #050505; }
.number-line-arrow.right { right: 5%; border-left: 15rpx solid #050505; }
.number-line-point { position: absolute; top: 28rpx; width: 86rpx; margin-left: -43rpx; text-align: center; }
.point-name,.point-value { display: block; font-size: 21rpx; font-weight: 760; }
.point-value { margin-top: 7rpx; color: #50545B; font-weight: 650; }
.point-dot { width: 15rpx; height: 15rpx; margin: 10rpx auto 0; border-radius: 50%; background: #050505; }
.number-line-motion { position: absolute; top: 0; height: 28rpx; border-top: 3rpx solid #0B789A; text-align: center; }
.number-line-motion::after { position: absolute; right: -1rpx; top: -8rpx; width: 11rpx; height: 11rpx; border-top: 3rpx solid #0B789A; border-right: 3rpx solid #0B789A; transform: rotate(45deg); content: ''; }
.number-line-motion.reverse::after { left: -1rpx; right: auto; border-top: 0; border-right: 0; border-bottom: 3rpx solid #0B789A; border-left: 3rpx solid #0B789A; }
.motion-copy { position: relative; top: -36rpx; color: #0B789A; font-size: 19rpx; font-weight: 760; }
.problem-note { margin-top: 20rpx; padding: 16rpx 18rpx; border-left: 6rpx solid #FFF48A; background: #FFFDF0; }
.problem-note-label { display: block; margin-bottom: 5rpx; font-size: 20rpx; font-weight: 800; }
</style>
