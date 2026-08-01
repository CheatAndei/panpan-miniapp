<template>
  <view class="page">
    <BrandEntrance
      v-if="entranceVisible"
      :brand="BRAND"
      :mode="entranceMode"
      :phrase="entrancePhrase"
      :loading-text="entranceLoadingText"
      :leaving="entranceLeaving"
    />

    <view class="home-stage" :class="{ 'is-waiting': entranceVisible }">
      <HomeWelcome
        v-if="!user.role"
        :brand="BRAND"
        :loading="loginLoading"
        @login="handleLogin"
        @repair="handleLoginRepair"
      />

      <TeacherHomeView
        v-else-if="user.role === 'teacher'"
      v-model:classes-expanded="teacherClassesExpanded"
      :brand="BRAND"
      :teacher-name="currentTeacherName"
      :greeting="greeting"
      :today="today"
      :total-pending="totalPending"
      :pending-practice-count="pendingPracticeCount"
      :pending-practice-todos="pendingPracticeTodos"
      :pending-challenge-count="pendingChallengeCount"
      :pending-challenge-todos="pendingChallengeTodos"
      :answer-request-count="answerRequestCount"
      :answer-request-todos="answerRequestTodos"
      :pending-leaves="pendingLeaves"
      :today-session-count="todaySessions.length"
      :choice-alerts="choiceAlerts"
      :dismissing-alert-id="dismissingAlertId"
      :classes="classes"
      :loading="teacherLoading"
      :error="teacherError"
      :promotion-unseen="promotionUnseen"
      @navigate="navTo"
      @open-practice-todo="openPracticeTodo"
      @open-answer-requests="openAnswerRequests"
      @dismiss-choice-alert="dismissChoiceAlert"
      @reload="loadTeacherData"
      @open-promotion="openPromotionStudio"
      />

      <ParentHomeView
        v-else
      v-model:feedback-text="fbText"
      v-model:show-feedback="showFb"
      v-model:feedback-detail="showFbDetail"
      :brand="BRAND"
      :child="child"
      :bound-kids="boundKids"
      :greeting="greeting"
      :child-teacher-name="childTeacherName"
      :mental-summary="mentalSummary"
      :parent-loading="parentLoading"
      :parent-error="parentError"
      :learning-today="learningToday"
      :learning-error="learningError"
      :latest-feedback="latestFeedback"
      :student-feedback="stuFeedback"
      :today-status="todayStatus"
      :week-schedules="weekSchedules"
      :parent-opinions="parentOpinions"
      :leaves="leaves"
      :contact-mode="CONTACT_MODE"
      :teacher-wechat="TEACHER_WECHAT"
      :notify-requesting="notifyRequesting"
      :feedback-placeholder="feedbackPlaceholder"
      :feedback-sending="feedbackSending"
      :asset-url="api.assetUrl"
      @navigate="navTo"
      @switch-child="switchChild"
      @copy-teacher-wechat="copyTeacherWechat"
      @open-today-task="openTodayTask"
      @reload="loadParentData"
      @subscribe="requestSubscribe"
      @open-exam-library="openExamLibrary"
      @open-pdf="openPdf"
      @preview-feedback-image="previewFbImg"
      @send-feedback="sendFeedback"
      />

      <HomeworkNoticeDialog
        v-if="user.role === 'parent' && homeworkNotice"
      :notice="homeworkNotice"
      :count="homeworkNoticeCount"
      :handling="homeworkNoticeHandling"
      @dismiss="dismissHomeworkNotice"
      @open="openHomeworkNotice"
      />

      <view class="footer">{{ FOOTER_TEXT }}<br />桂ICP备2026013218号-2</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { onHide, onLoad, onShow, onPullDownRefresh, onUnload } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { clearLocalSession, doLogin, getUser } from '@/utils/auth';
import { BRAND, CONTACT_MODE, FOOTER_TEXT, TEACHER_WECHAT, teacherDisplayName, teacherNameFromChild } from '@/utils/brand';
import { toastError, logError } from '@/utils/ui';
import { requestSubscribeBatches, subscribeResultTitle } from '@/utils/subscribe';
import { nextWelcomeCopy } from '@/utils/welcome-copy';
import {
  clearEntranceTarget,
  consumeWelcomePending,
  peekEntranceTarget,
  waitForMinimum,
} from '@/utils/welcome-entry';
import BrandEntrance from '@/components/home/BrandEntrance.vue';
import HomeWelcome from '@/components/home/HomeWelcome.vue';
import HomeworkNoticeDialog from '@/components/home/HomeworkNoticeDialog.vue';
import ParentHomeView from '@/components/home/ParentHomeView.vue';
import TeacherHomeView from '@/components/home/TeacherHomeView.vue';

const user = ref({});
// 启动时从storage恢复
const token = uni.getStorageSync('token');
const savedUser = getUser();
if (token && savedUser?.role) {
  user.value = savedUser;
} else if (savedUser?.role) {
  uni.removeStorageSync('user');
  uni.removeStorageSync('activeChildId');
}

const entranceVisible = ref(false);
const entranceLeaving = ref(false);
const entranceMode = ref('returning');
const entrancePhrase = ref('持之以恒');
const entranceLoadingText = ref('正在同步学习记录');
const entranceTarget = ref('');
let entranceStartedAt = 0;
let entranceCompleting = false;
let entranceSession = 0;
let pageAlive = true;
let bypassHomeLoadForTarget = false;

function beginEntrance(reason = 'cold', pendingPhrase = '') {
  if (user.value.role === 'teacher') return;
  entranceMode.value = user.value.role === 'parent' ? 'returning' : 'new';
  entrancePhrase.value = entranceMode.value === 'returning'
    ? pendingPhrase || nextWelcomeCopy()
    : '初次见面';
  entranceLoadingText.value = entranceMode.value === 'new'
    ? '正在准备你的学习记录'
    : reason === 'share' ? '正在打开分享内容' : '正在同步今日记录';
  entranceStartedAt = Date.now();
  entranceCompleting = false;
  entranceLeaving.value = false;
  entranceVisible.value = true;
  uni.hideTabBar({ animation: false, fail: () => {} });
}

function openEntranceTarget() {
  const target = entranceTarget.value;
  entranceTarget.value = '';
  if (!target) return;
  if (target === '/pages/index/index') {
    clearEntranceTarget();
    return;
  }
  if (target.startsWith('/pages/index/index?')) {
    clearEntranceTarget();
    uni.reLaunch({
      url: target,
      fail: () => failEntranceTarget(),
    });
    return;
  }
  if (target.startsWith('/pages/mine/index')) {
    uni.switchTab({
      url: '/pages/mine/index',
      success: completeEntranceTarget,
      fail: () => failEntranceTarget(),
    });
    return;
  }
  setTimeout(() => {
    if (!pageAlive) return;
    uni.navigateTo({
      url: target,
      success: completeEntranceTarget,
      fail: () => failEntranceTarget(),
    });
  }, 40);
}

function completeEntranceTarget() {
  clearEntranceTarget();
  bypassHomeLoadForTarget = false;
}

function failEntranceTarget() {
  clearEntranceTarget();
  bypassHomeLoadForTarget = false;
  if (!pageAlive) return;
  uni.showToast({ title: '页面打开失败，已返回首页', icon: 'none' });
  setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 80);
}

async function completeEntranceAfter(request) {
  if (!entranceVisible.value || entranceCompleting) return;
  entranceCompleting = true;
  const session = ++entranceSession;
  try {
    await Promise.resolve(request).catch(() => null);
    const minimum = entranceMode.value === 'new' ? 1500 : 600;
    await waitForMinimum(entranceStartedAt, minimum);
    if (!pageAlive || session !== entranceSession) return;
    entranceLeaving.value = true;
    await new Promise((resolve) => setTimeout(resolve, 240));
    if (!pageAlive || session !== entranceSession) return;
    entranceVisible.value = false;
    entranceLeaving.value = false;
    uni.showTabBar({ animation: false, fail: () => {} });
    openEntranceTarget();
  } finally {
    entranceCompleting = false;
  }
}

onLoad(() => {
  const pending = consumeWelcomePending(user.value.role);
  entranceTarget.value = peekEntranceTarget();
  if (!pending) {
    if (entranceTarget.value === '/pages/index/index') {
      clearEntranceTarget();
      entranceTarget.value = '';
    } else if (entranceTarget.value) {
      bypassHomeLoadForTarget = true;
      nextTick(openEntranceTarget);
    }
    return;
  }
  beginEntrance(pending.reason, pending.phrase);
  if (user.value.role !== 'parent') completeEntranceAfter(Promise.resolve());
});

// 每次页面显示时刷新数据
let parentRefreshTimer = null;
let teacherRefreshTimer = null;
let teacherTodoRequesting = false;
let autoOpenedPromotionId = 0;
let queuedParentChildId = null;
function stopParentRefresh() {
  if (parentRefreshTimer) clearInterval(parentRefreshTimer);
  parentRefreshTimer = null;
}

function stopTeacherRefresh() {
  if (teacherRefreshTimer) clearInterval(teacherRefreshTimer);
  teacherRefreshTimer = null;
}

function startTeacherRefresh() {
  stopTeacherRefresh();
  if (user.value.role !== 'teacher') return;
  teacherRefreshTimer = setInterval(
    () => loadTeacherPracticeTodos({ announce: true }),
    15000,
  );
}

function resetHomeScroll() {
  nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 }));
}

onShow(() => {
  stopParentRefresh();
  stopTeacherRefresh();
  if (bypassHomeLoadForTarget) return;
  if (user.value.role === 'teacher') {
    loadTeacherData({ announcePractice: true }).finally(startTeacherRefresh);
  }
  else if (user.value.role === 'parent') {
    const notifyPromise = loadNotifyTemplates();
    // tabBar 页面会保留上次滚动位置；等异步孩子头部插入后再回顶，避免顶部看似被裁掉。
    const parentPromise = loadParentData().finally(resetHomeScroll);
    if (entranceVisible.value) completeEntranceAfter(Promise.allSettled([notifyPromise, parentPromise]));
    parentRefreshTimer = setInterval(() => loadParentData(), 30000);
  }
});
onHide(() => {
  stopParentRefresh();
  stopTeacherRefresh();
});
onUnload(() => {
  pageAlive = false;
  entranceSession += 1;
  if (entranceVisible.value) uni.showTabBar({ animation: false, fail: () => {} });
  stopParentRefresh();
  stopTeacherRefresh();
});

onPullDownRefresh(async () => {
  try {
    if (user.value.role === 'teacher') await loadTeacherData();
    else if (user.value.role === 'parent') await loadParentData(child.value?.id);
  } finally {
    uni.stopPullDownRefresh();
  }
});

const classes = ref([]);
const teacherClassesExpanded = ref(false);
const pendingLeaves = ref(0);
const pendingPracticeCount = ref(0);
const pendingPracticeTodos = ref([]);
const pendingChallengeCount = ref(0);
const pendingChallengeTodos = ref([]);
const answerRequestCount = ref(0);
const answerRequestTodos = ref([]);
const choiceAlerts = ref([]);
const promotionItems = ref([]);
const promotionUnseen = ref(0);
const dismissingAlertId = ref(null);
const todaySessions = ref([]);
const child = ref(null);
const boundKids = ref([]);
const fbText = ref('');
const showFb = ref(false);
const leaves = ref([]);
const todayStatus = ref(null);
const weekSchedules = ref([]);
const latestFeedback = ref(null);
const stuFeedback = ref(null);
const parentOpinions = ref([]);
const showFbDetail = ref('');
const learningToday = ref(null);
const learningError = ref('');
const mentalSummary = ref(null);
const homeworkNotice = ref(null);
const homeworkNoticeCount = ref(0);
const homeworkNoticeIds = ref([]);
const homeworkNoticeHandling = ref(false);
const notifyTpls = ref([]);
const loginLoading = ref(false);
const teacherLoading = ref(false);
const parentLoading = ref(false);
const notifyRequesting = ref(false);
const feedbackSending = ref(false);
const teacherError = ref('');
const parentError = ref('');
const currentTeacherName = computed(() => teacherDisplayName(user.value?.nickname));
const childTeacherName = computed(() => teacherNameFromChild(child.value));
const feedbackPlaceholder = computed(() => `有任何问题或建议告诉${childTeacherName.value}`);
const totalPending = computed(() => Number(pendingLeaves.value || 0)
  + Number(pendingPracticeCount.value || 0)
  + Number(pendingChallengeCount.value || 0)
  + Number(answerRequestCount.value || 0)
  + choiceAlerts.value.length);
const h = new Date().getHours();
const greeting = h < 6 ? '夜深了' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
const today = new Date().toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'long' });

function localDateKey() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function previewFbImg(list,i){ uni.previewImage({current:api.assetUrl(list[i]),urls:list.map(u=>api.assetUrl(u))}); }
async function openPdf(url) {
  try { await api.openPdf(url); }
  catch(e) { uni.showToast({ title: 'PDF 打开失败', icon: 'none' }); }
}
async function requestSubscribe() {
  if (notifyRequesting.value) return { accepted: 0 };
  notifyRequesting.value = true;
  if (notifyTpls.value.length === 0) {
    await loadNotifyTemplates();
  }
  const tpls = notifyTpls.value;
  if (tpls.length === 0) {
    uni.showToast({ title: '提醒模板未加载', icon: 'none' });
    notifyRequesting.value = false;
    return { accepted: 0 };
  }
  try {
    const result = await requestSubscribeBatches(tpls);
    uni.showToast({ title: subscribeResultTitle(result), icon: result.accepted === result.total ? 'success' : 'none' });
    return result;
  } catch (e) {
    logError('requestSubscribe', e);
    uni.showToast({ title: '订阅弹窗失败', icon: 'none' });
    throw e;
  } finally {
    notifyRequesting.value = false;
  }
}

async function loadNotifyTemplates() {
  try {
    const tplRes = await api.get('/notify/templates');
    notifyTpls.value = [...new Set([tplRes.checkin, tplRes.checkout, tplRes.reminder, tplRes.feedback, tplRes.homework].filter(Boolean))];
  } catch (e) {
    logError('loadNotifyTemplates', e);
  }
}

function switchChild(k) {
  uni.setStorageSync('activeChildId', k.id);
  latestFeedback.value = null;
  stuFeedback.value = null;
  parentOpinions.value = [];
  leaves.value = [];
  weekSchedules.value = [];
  learningToday.value = null;
  learningError.value = '';
  mentalSummary.value = null;
  loadParentData(k.id);
}
async function sendFeedback() {
  if (!fbText.value || feedbackSending.value) return;
  feedbackSending.value = true;
  try {
    await api.post('/leaves/feedback', { content: fbText.value, student_id: child.value?.id });
    uni.showToast({ title: '已发送', icon: 'success' });
    fbText.value = '';
    showFb.value = false;
    const history=await api.get('/leaves/feedback/history?student_id='+child.value.id+'&limit=3');
    parentOpinions.value=history.feedbacks||[];
  } catch(e) {
    toastError(e, '发送失败');
  } finally {
    feedbackSending.value = false;
  }
}
function navTo(url) { uni.navigateTo({ url }); }
async function loadHomeworkNotices() {
  if (homeworkNotice.value || homeworkNoticeHandling.value) return;
  try {
    const result = await api.get('/homework/notices?unread=1&limit=50');
    const notices = result.notices || [];
    homeworkNoticeIds.value = notices.map(item => Number(item.id)).filter(Boolean);
    homeworkNoticeCount.value = Number(result.total || notices.length);
    homeworkNotice.value = notices[0] || null;
  } catch (error) {
    logError('loadHomeworkNotices', error);
  }
}

async function acknowledgeHomeworkNotices() {
  if (homeworkNoticeHandling.value || homeworkNoticeIds.value.length === 0) return false;
  homeworkNoticeHandling.value = true;
  try {
    await api.post('/homework/notices/seen', { notice_ids: homeworkNoticeIds.value });
    homeworkNotice.value = null;
    homeworkNoticeCount.value = 0;
    homeworkNoticeIds.value = [];
    return true;
  } catch (error) {
    toastError(error, '提醒处理失败');
    return false;
  } finally {
    homeworkNoticeHandling.value = false;
  }
}

async function dismissHomeworkNotice() {
  await acknowledgeHomeworkNotices();
}

async function openHomeworkNotice() {
  const notice = homeworkNotice.value;
  if (!notice || !(await acknowledgeHomeworkNotices())) return;
  uni.setStorageSync('activeChildId', notice.student_id);
  navTo(`/pages/parent-homework/index?student_id=${notice.student_id}&batch_id=${notice.batch_id}`);
}

function openExamLibrary() {
  if (!child.value) return;
  navTo(`/pages/exam-library/index?student_id=${child.value.id}`);
}
function copyTeacherWechat() {
  uni.setClipboardData({ data:TEACHER_WECHAT, success:()=>uni.showToast({ title:'微信号已复制', icon:'success' }) });
}
function openPracticeTodo(item) {
  navTo(`/pages/practice-review/index?plan_id=${item.plan_id}&submission_id=${item.submission_id}`);
}
function openAnswerRequests(){navTo('/pages/exam-library/index?teacher_tab=requests');}
function openPromotionStudio() {
  navTo('/pages/promotion-posters/index');
}

function openTodayTask(task) {
  if (!child.value) return;
  if (task.route === 'practice') return navTo(`/pages/practice-parent/index?student_id=${child.value.id}`);
  if (task.route === 'weekly_challenge') return navTo(`/pages/weekly-challenge/index?student_id=${child.value.id}`);
  if (task.route === 'session' && task.session_type) {
    return navTo(`/pages/learning-session/index?student_id=${child.value.id}&type=${task.session_type}`);
  }
}

async function handleLogin() {
  if (loginLoading.value) return;
  loginLoading.value = true;
  try {
    const loggedInUser = await doLogin();
    user.value = loggedInUser;
    if (loggedInUser.role === 'teacher') {
      await loadTeacherData({ announcePractice: true });
      startTeacherRefresh();
    }
    else {
      await loadNotifyTemplates();
      const hasChild = await loadParentData();
      if (!hasChild) resetHomeScroll();
    }
  } catch(e) {
    const message = e?.error || e?.message || '登录失败，请稍后重试';
    uni.showToast({ title: message, icon: 'none' });
  } finally {
    loginLoading.value = false;
  }
}

async function handleLoginRepair() {
  if (loginLoading.value) return;
  loginLoading.value = true;
  stopParentRefresh();
  clearLocalSession();
  user.value = {};
  child.value = null;
  boundKids.value = [];
  try {
    const loggedInUser = await doLogin({ preferRole: 'parent' });
    user.value = loggedInUser;
    if (loggedInUser.role === 'teacher') {
      uni.showToast({ title: '请输入学生邀请码，切换到家长端', icon: 'none' });
      uni.navigateTo({ url: '/pages/bind/bind?source=repair' });
    } else {
      await loadNotifyTemplates();
      const hasChild = await loadParentData();
      if (!hasChild) resetHomeScroll();
    }
  } catch (e) {
    toastError(e, '修复登录失败，请稍后重试');
  } finally {
    loginLoading.value = false;
  }
}

async function loadTeacherPracticeTodos({ announce = false } = {}) {
  if (teacherTodoRequesting || user.value.role !== 'teacher') return false;
  teacherTodoRequesting = true;
  try {
    const previousCount = Number(pendingPracticeCount.value || 0);
    const result = await api.get('/practice/todos?limit=3');
    const nextCount = Number(result.count || 0);
    pendingPracticeCount.value = nextCount;
    pendingPracticeTodos.value = result.todos || [];
    if (announce && nextCount > previousCount) {
      uni.showToast({
        title: `收到 ${nextCount - previousCount} 份新打卡`,
        icon: 'none',
      });
    }
    return true;
  } catch (error) {
    logError('loadTeacherPracticeTodos', error);
    return false;
  } finally {
    teacherTodoRequesting = false;
  }
}

async function loadTeacherData({ announcePractice = false } = {}) {
  if (teacherLoading.value) return;
  teacherLoading.value = true;
  teacherError.value = '';
  try {
    const practicePromise = loadTeacherPracticeTodos({ announce: announcePractice });
    const results = await Promise.allSettled([
      api.get('/classes'),
      api.get('/leaves'),
      api.get('/schedules/sessions'),
      api.get('/weekly-challenge/v2/teacher/submissions?status=submitted&limit=3'),
      api.get('/exams/teacher/answer-todos?limit=3'),
      api.get('/promotions?limit=12'),
    ]);
    const [classResult, leaveResult, sessionResult, challengeResult, answerResult, promotionResult] = results;
    if (classResult.status === 'fulfilled') classes.value = classResult.value.classes || [];
    if (leaveResult.status === 'fulfilled') {
      pendingLeaves.value = (leaveResult.value.leaves || []).filter((item) => item.status === 'pending').length;
    }
    if (sessionResult.status === 'fulfilled') {
      todaySessions.value = (sessionResult.value.sessions || []).filter(
        (item) => item.class_date === localDateKey(),
      );
    }
    if (challengeResult.status === 'fulfilled') {
      pendingChallengeCount.value = Number(challengeResult.value.count || 0);
      pendingChallengeTodos.value = challengeResult.value.todos || [];
    }
    if (answerResult.status === 'fulfilled') {
      answerRequestCount.value = Number(answerResult.value.count || 0);
      answerRequestTodos.value = answerResult.value.requests || [];
    }
    if (promotionResult.status === 'fulfilled') {
      promotionItems.value = promotionResult.value.promotions || [];
      promotionUnseen.value = Number(promotionResult.value.unseen || 0);
    }
    const practiceLoaded = await practicePromise;
    const fulfilledCount = results.filter((result) => result.status === 'fulfilled').length;
    if (!practiceLoaded && fulfilledCount === 0) {
      const firstFailure = results.find((result) => result.status === 'rejected');
      throw firstFailure?.reason || new Error('教师工作台加载失败');
    }
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logError(`loadTeacherData.section${index + 1}`, result.reason);
      }
    });
    const newestPromotion = promotionItems.value.find(item => !item.seen);
    if (newestPromotion && Number(newestPromotion.id) !== autoOpenedPromotionId) {
      autoOpenedPromotionId = Number(newestPromotion.id);
      setTimeout(() => navTo(`/pages/promotion-posters/index?event_id=${newestPromotion.id}&auto=1`), 360);
    }
    try {
      const alertRes = await api.get('/choice-king/alerts?unread=1&limit=3');
      choiceAlerts.value = alertRes.alerts || [];
    } catch (alertError) {
      choiceAlerts.value = [];
      logError('loadChoiceKingAlerts', alertError);
    }
  } catch (e) {
    teacherError.value = e?.error || '请检查网络后重试';
    logError('loadTeacherData', e);
  } finally {
    teacherLoading.value = false;
  }
}

async function dismissChoiceAlert(item) {
  if (dismissingAlertId.value) return;
  dismissingAlertId.value = item.id;
  try {
    await api.put(`/choice-king/alerts/${item.id}/read`, { is_read: true });
    choiceAlerts.value = choiceAlerts.value.filter(alert => alert.id !== item.id);
  } catch (e) {
    toastError(e, '提醒处理失败');
  } finally {
    dismissingAlertId.value = null;
  }
}

async function loadParentData(childId) {
  const explicitChildId = childId === undefined || childId === null || childId === '' ? null : childId;
  if (parentLoading.value) {
    if (explicitChildId !== null) queuedParentChildId = explicitChildId;
    return Boolean(child.value);
  }
  parentLoading.value = true;
  parentError.value = '';
  try {
    const kids = await api.get('/bind/students');
    boundKids.value = kids.students || [];
    // 选指定孩子或第一个
    const savedChildId = explicitChildId || uni.getStorageSync('activeChildId');
    const target = boundKids.value.find(k=>String(k.id)===String(savedChildId))
      || boundKids.value[0]
      || null;
    if (!target) {
      child.value = null;
      todayStatus.value = null;
      weekSchedules.value = [];
      latestFeedback.value = null;
      stuFeedback.value = null;
      parentOpinions.value = [];
      learningToday.value = null;
      mentalSummary.value = null;
      return false;
    }
    child.value = target;

    const [schedParent, checkin, lv, fb, opinions, learning, mental] = await Promise.all([
      api.get('/schedules/parent?student_id='+target.id),
      api.get('/checkins/today?student_id='+target.id),
      api.get('/leaves'),
      api.get('/feedbacks/latest?class_id='+target.class_id),
      api.get('/leaves/feedback/history?student_id='+target.id+'&limit=3'),
      api.get('/learning/today?student_id='+target.id).catch(error => ({ __error: error })),
      api.get('/mental-arena/summary?student_id='+target.id).catch(error => ({ __error: error }))
    ]);
    parentOpinions.value=opinions.feedbacks||[];
    mentalSummary.value = mental.__error ? null : mental;
    if (learning.__error) {
      learningToday.value = null;
      learningError.value = learning.__error?.error || '学习任务加载失败';
      logError('loadLearningToday', learning.__error);
    } else {
      learningToday.value = learning;
      learningError.value = '';
    }
    todayStatus.value = checkin;
    if (checkin.checkInTime) {
      todayStatus.value.checkInTime = new Date(checkin.checkInTime).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
    }
    if (checkin.checkOutTime) {
      todayStatus.value.checkOutTime = new Date(checkin.checkOutTime).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
    }
    const myId = target.class_id;
    weekSchedules.value = (schedParent.schedules||[]).filter(s=>String(s.class_id)===String(myId))
      .sort((a,b)=>String(a.class_date||'9999-99-99').localeCompare(String(b.class_date||'9999-99-99')) || String(a.start_time||'').localeCompare(String(b.start_time||'')))
      .slice(0,3);
    leaves.value = (lv.leaves||[]).filter(l=>String(l.student_id)===String(target.id)).slice(0,5);
    latestFeedback.value = fb.feedback;
    stuFeedback.value = null;
    // 提取学生个人反馈
    if (fb.feedback && fb.feedback.student_feedbacks) {
      try {
        const list = JSON.parse(fb.feedback.student_feedbacks);
        const my = list.find(s => String(s.id) === String(target.id));
        if (my) stuFeedback.value = { date: fb.feedback.class_date, text: my.text, images: my.images || [] };
      } catch(e) { logError('parseStudentFeedback', e); }
    }
    await loadHomeworkNotices();
    return true;
  } catch (e) {
    parentError.value = e?.error || '请检查网络后重试';
    mentalSummary.value = null;
    logError('loadParentData', e);
    return false;
  } finally {
    parentLoading.value = false;
    const nextChildId = queuedParentChildId;
    queuedParentChildId = null;
    if (nextChildId !== null && String(nextChildId) !== String(child.value?.id)) {
      nextTick(() => loadParentData(nextChildId));
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-bottom: calc(44rpx + env(safe-area-inset-bottom));
  background: var(--page-bg, #F7FCFE);
}

.home-stage {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 240ms var(--ease-out), transform 240ms var(--ease-out);
}

.home-stage.is-waiting {
  opacity: 0;
  transform: translateY(12rpx);
}

.footer {
  padding: 40rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  color: var(--faint);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .home-stage { transition-duration: .01ms !important; }
  .home-stage.is-waiting { transform: none; }
}
</style>
