<template>
  <view :class="['pp-math-text', `align-${align}`]" :aria-label="source">
    <template v-for="(segment,index) in segments" :key="`${index}-${segment.type}`">
      <text v-if="segment.type==='text'" class="math-plain">{{ segment.value }}</text>
      <view v-else class="math-fraction" :aria-label="segment.label">
        <text class="math-numerator">{{ segment.numerator }}</text>
        <text class="math-denominator">{{ segment.denominator }}</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { normalizeMathPowers, parseMathSegments } from '@/utils/math-display';

const props = defineProps({
  value: { type: [String, Number], default: '' },
  blocks: { type: Array, default: () => [] },
  align: { type: String, default: 'left' },
});

function blockSegments(blocks) {
  return blocks.flatMap((block) => {
    if (!block || typeof block !== 'object') return [];
    if (block.type === 'fraction') {
      const numerator = String(block.numerator ?? '');
      const denominator = String(block.denominator ?? '');
      if (!numerator || !denominator) return [];
      return [{
        type: 'fraction',
        numerator,
        denominator,
        label: `${denominator} 分之 ${numerator}`,
      }];
    }
    if (block.type === 'line_break') return [{ type: 'text', value: '\n' }];
    if (['text', 'number', 'operator'].includes(block.type)) {
      return [{ type: 'text', value: normalizeMathPowers(block.value) }];
    }
    return [];
  });
}

const structuredSegments = computed(() => blockSegments(props.blocks));
const segments = computed(() => (
  structuredSegments.value.length ? structuredSegments.value : parseMathSegments(props.value)
));
const source = computed(() => segments.value.map((segment) => (
  segment.type === 'fraction'
    ? `${segment.denominator} 分之 ${segment.numerator}`
    : segment.value
)).join(''));
</script>

<style scoped>
.pp-math-text{display:flex;min-width:0;align-items:center;flex-wrap:wrap;color:inherit;font:inherit;line-height:inherit}.align-left{justify-content:flex-start;text-align:left}.align-center{justify-content:center;text-align:center}.align-right{justify-content:flex-end;text-align:right}.math-plain{white-space:pre-wrap}.math-fraction{display:inline-flex;min-width:1.35em;margin:0 .1em;align-items:stretch;flex-direction:column;justify-content:center;line-height:1;vertical-align:middle;transform:translateY(.03em)}.math-numerator,.math-denominator{display:block;padding:0 .14em;font-size:.72em;line-height:1.15;text-align:center;font-variant-numeric:tabular-nums}.math-numerator{padding-bottom:.07em;border-bottom:2rpx solid currentColor}.math-denominator{padding-top:.07em}
</style>
