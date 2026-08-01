<template>
  <view v-if="visible" class="report-mask" @tap="emit('close')">
    <view class="report-sheet" @tap.stop>
      <view class="report-heading">
        <view class="report-mark"><pp-icon name="report" :size="30" motion="ring" /></view>
        <view>
          <text class="report-title">这道题哪里有问题？</text>
          <text class="report-sub">反馈不会暂停计时，也不会影响本次成绩。</text>
        </view>
      </view>
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
.report-mask {
  position: fixed;
  z-index: 30;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(5, 5, 5, .4);
}
.report-sheet {
  box-sizing: border-box;
  width: 100%;
  padding: 30rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  border-top: 6rpx solid #0B789A;
  border-radius: 16rpx 16rpx 0 0;
  background: #F7FCFE;
}
.report-title,
.report-sub { display: block; }
.report-heading { display: flex; align-items: center; gap: 12rpx; }
.report-mark { width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 11rpx; background: #FFF0F6; }
.report-title { color: #050505; font-size: 31rpx; font-weight: 780; }
.report-sub { margin-top: 5rpx; color: #50545B; font-size: 22rpx; }
.reason-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11rpx; margin-top: 22rpx; }
.reason-button {
  min-height: 80rpx;
  margin: 0;
  padding: 0 10rpx;
  border: 1rpx solid #DCE9ED;
  border-radius: 12rpx;
  background: #FFFFFF;
  color: #50545B;
  font-size: 21rpx;
}
.reason-button.active {
  border: 2rpx solid #0B789A;
  background: #E5F8FE;
  color: #050505;
  font-weight: 720;
}
.report-note {
  box-sizing: border-box;
  width: 100%;
  height: 120rpx;
  margin-top: 14rpx;
  padding: 15rpx 17rpx;
  border: 1rpx solid #DCE9ED;
  border-radius: 12rpx;
  background: #FFFFFF;
  color: #050505;
  font-size: 22rpx;
}
.report-actions { display: grid; grid-template-columns: .8fr 1.2fr; gap: 12rpx; margin-top: 18rpx; }
.cancel-report,
.send-report { min-height: 88rpx; margin: 0; padding: 0 18rpx; border-radius: 12rpx; font-size: 24rpx; font-weight: 700; }
.cancel-report { border: 1rpx solid #C7DDE4; background: #FFFFFF; color: #050505; }
.send-report { background: #F79BC0; color: #050505; }
button::after { border: 0; }
</style>
