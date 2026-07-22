<template>
  <view v-if="visible" class="report-mask" @tap="emit('close')">
    <view class="report-sheet" @tap.stop>
      <text class="report-title">这道题哪里有问题？</text>
      <text class="report-sub">反馈不会暂停计时，也不会影响本次成绩。</text>
      <view class="reason-grid">
        <button
          v-for="item in reasons"
          :key="item.value"
          :class="['reason-button',{active:reason===item.value}]"
          :disabled="submitting"
          @tap="reason=item.value"
        >{{ item.label }}</button>
      </view>
      <textarea v-model="detail" class="report-note" :maxlength="200" placeholder="可补充说明（选填，最多 200 字）" />
      <view class="report-actions">
        <button class="cancel-report" :disabled="submitting" @tap="emit('close')">取消</button>
        <button class="send-report" :disabled="!reason || submitting" @tap="submitReport">
          {{ submitting ? '提交中…' : '提交报错' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const props = defineProps({
  visible: { type: Boolean, default: false },
  sourceType: { type: String, required: true },
  sourceId: { type: [String, Number], required: true },
  studentId: { type: [String, Number], required: true },
  questionId: { type: [String, Number], default: '' },
});
const emit = defineEmits(['close', 'submitted']);
const reasons = [
  { value: 'sign_bracket', label: '正负号/括号错误' },
  { value: 'unclear', label: '题目条件不清' },
  { value: 'answer_error', label: '答案有误' },
  { value: 'duplicate', label: '重复题' },
  { value: 'other', label: '其他' },
];
const reason = ref('');
const detail = ref('');
const submitting = ref(false);

watch(() => props.visible, (value) => {
  if (!value) return;
  reason.value = '';
  detail.value = '';
});

async function submitReport() {
  if (!reason.value || submitting.value || !props.questionId) return;
  submitting.value = true;
  try {
    const result = await api.post('/calculation-reports', {
      source_type: props.sourceType,
      source_id: Number(props.sourceId),
      student_id: Number(props.studentId),
      question_id: String(props.questionId),
      reason: reason.value,
      detail: detail.value,
    });
    uni.showToast({ title: result.duplicate ? '这道题已经反馈过' : '已提交给老师', icon: 'none' });
    emit('submitted', result);
    emit('close');
  } catch (error) {
    uni.showToast({ title: error?.error || '提交失败，请重试', icon: 'none' });
    logError('calculationReport.submit', error);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.report-mask{position:fixed;z-index:30;inset:0;display:flex;align-items:flex-end;background:rgba(12,31,27,.46)}.report-sheet{box-sizing:border-box;width:100%;padding:30rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));border-radius:28rpx 28rpx 0 0;background:#fff}.report-title,.report-sub{display:block}.report-title{color:#183A36;font-size:31rpx;font-weight:780}.report-sub{margin-top:5rpx;color:#697B76;font-size:22rpx}.reason-grid{display:grid;grid-template-columns:1fr 1fr;gap:11rpx;margin-top:22rpx}.reason-button{min-height:72rpx;margin:0;padding:10rpx;border:1rpx solid #D6E3DF;border-radius:13rpx;background:#F8FBFA;color:#536762;font-size:21rpx}.reason-button.active{border:2rpx solid #2F7D6B;background:#EAF5F1;color:#205F51;font-weight:720}.report-note{box-sizing:border-box;width:100%;height:120rpx;margin-top:14rpx;padding:15rpx 17rpx;border:1rpx solid #D6E3DF;border-radius:13rpx;background:#F8FBFA;color:#263B36;font-size:22rpx}.report-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:12rpx;margin-top:18rpx}.cancel-report,.send-report{min-height:82rpx;margin:0;border-radius:14rpx;font-size:24rpx;font-weight:700}.cancel-report{border:1rpx solid #C9D8D3;background:#fff;color:#5E736D}.send-report{background:#183A36;color:#fff}button::after{border:0}
</style>
