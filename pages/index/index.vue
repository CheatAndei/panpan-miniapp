<template>
  <view class="page">
    <!-- 未登录 -->
    <view v-if="!user.role" class="welcome">
      <view class="brand-icon"><pp-icon name="brand" :size="128" /></view>
      <view class="brand-name">{{ BRAND }}</view>
      <view class="brand-sub">课堂记录与家校反馈助手</view>
      <view class="brand-desc">课表、签到与反馈，轻松记在一起</view>
      <button class="login-btn" :disabled="loginLoading" @tap="handleLogin">
        {{ loginLoading ? '登录中...' : '微信登录' }}
      </button>
      <button class="repair-login-btn" :disabled="loginLoading" @tap="handleLoginRepair">切换身份 / 登录修复</button>
      <view class="welcome-note">首次登录默认为家长身份</view>
    </view>

    <!-- 老师端 -->
    <view v-else-if="user.role==='teacher'">
      <view class="teacher-hero hero-navy">
        <view class="eyebrow">{{ BRAND }}</view>
        <view class="hero-greeting">{{ currentTeacherName }}，{{ greeting }}</view>
        <view class="hero-date num">{{ today }}</view>
      </view>

      <view class="card focus-card">
        <view class="focus-topline">
          <text class="focus-label">今日工作</text>
          <text v-if="totalPending>0" class="focus-pending">{{ totalPending }} 项待办</text>
          <text v-else class="focus-ready">待办已清</text>
        </view>
        <view class="focus-metrics">
          <view class="focus-metric">
            <text class="focus-number num">{{ todaySessions.length }}</text>
            <text class="focus-copy">节待处理课程</text>
          </view>
          <view class="focus-divider"></view>
          <view class="focus-metric">
            <text class="focus-number num">{{ totalStudents }}</text>
            <text class="focus-copy">位学生</text>
          </view>
        </view>
      </view>

      <view class="card quick-actions">
        <view class="action-row">
          <view class="action-item" @tap="navTo('/pages/teacher-checkin/index')">
            <view class="action-icon action-check"><pp-icon name="check" /></view>
            <text>签到</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-feedback/index')">
            <view class="action-icon action-feedback"><pp-icon name="message" /></view>
            <text>发反馈</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-classes/index')">
            <view class="action-icon action-groups"><pp-icon name="users" /></view>
            <text>学习小组</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-schedule/index')">
            <view class="action-icon action-schedule"><pp-icon name="calendar" /></view>
            <text>课表</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-leaves/index')">
            <view class="action-icon action-leave">
              <pp-icon name="clipboard" />
              <view v-if="pendingLeaves>0" class="red-dot">{{ pendingLeaves }}</view>
            </view>
            <text>审批</text>
          </view>
        </view>
      </view>

      <view v-if="pendingPracticeCount" class="card practice-todo-card">
        <view class="practice-todo-head">
          <view>
            <text class="practice-todo-kicker">今日待办</text>
            <text class="practice-todo-title">学生打卡待批改 {{ pendingPracticeCount }} 份</text>
          </view>
          <text class="practice-todo-badge">待批改</text>
        </view>
        <view v-for="item in pendingPracticeTodos" :key="item.submission_id" class="practice-todo-row" @tap="openPracticeTodo(item)">
          <view>
            <text class="practice-todo-name">{{ item.student_name }} · {{ item.practice_date }}</text>
            <text class="practice-todo-meta">{{ item.class_name }} · {{ item.plan_title }}</text>
          </view>
          <text class="practice-todo-action">批改 ›</text>
        </view>
        <button class="practice-todo-all" @tap="navTo('/pages/practice-teacher/index')">进入批改台</button>
      </view>

      <view class="card">
        <view class="section-title">
          <text>学习小组</text>
          <text class="card-hint" @tap="navTo('/pages/teacher-classes/index')">管理</text>
        </view>
        <pp-state v-if="teacherLoading && classes.length === 0" type="loading" title="正在整理工作台" />
        <pp-state v-else-if="teacherError && classes.length === 0" type="error" title="工作台加载失败" :description="teacherError" action-text="重新加载" @action="loadTeacherData" />
        <pp-state v-else-if="classes.length === 0" title="还没有学习小组" description="创建小组并添加学生后，即可开始排课。" action-text="新建小组" @action="navTo('/pages/teacher-classes/index')" />
        <view v-for="c in classes" :key="c.id" class="class-item" @tap="navTo('/pages/teacher-classes/index')">
          <view>
            <text class="c-name">{{ c.name }}</text>
            <text class="c-meta">{{ c.grade || '未设置年级' }} · {{ c.subject || '未设置科目' }}</text>
          </view>
          <view class="class-tail"><text class="class-count num">{{ c.studentCount || 0 }}</text><text>人</text><pp-icon name="arrow" :size="34" /></view>
        </view>
      </view>

      <view class="card practice-entry practice-entry-teacher" @tap="navTo('/pages/practice-teacher/index')">
        <view class="practice-entry-icon"><pp-icon name="clipboard" :size="42" /></view>
        <view class="practice-entry-copy">
          <text class="practice-entry-kicker">假期个性化练习</text>
          <text class="practice-entry-title">打卡计划与复核</text>
          <text class="practice-entry-desc">发布题目、查看上传、下载五日 PDF</text>
        </view>
        <pp-icon name="arrow" :size="34" />
      </view>
    </view>

    <!-- 家长端 -->
    <view v-else>
      <!-- 孩子切换 -->
      <view class="child-switcher" v-if="boundKids.length>1">
        <text v-for="k in boundKids" :key="k.id"
          :class="['cs-chip',{on:child&&child.id===k.id}]"
          @tap="switchChild(k)">{{ k.name }}</text>
      </view>
      <!-- 孩子卡片 -->
      <view class="parent-hero hero-navy" v-if="child">
        <view class="eyebrow">{{ BRAND }}</view>
        <view class="child-greeting">{{ greeting }}，{{ child.name }}家长</view>
        <view class="child-class">{{ child.className }} · {{ childTeacherName }}</view>
      </view>

      <pp-state v-if="parentLoading && !child" type="loading" title="正在读取孩子的学习动态" />
      <pp-state v-else-if="parentError && !child" type="error" title="暂时无法加载" :description="parentError" action-text="重新加载" @action="loadParentData()" />

      <!-- 今日状态 -->
      <view class="card status-card" v-if="todayStatus">
        <view class="status-mark"><pp-icon :name="todayStatus.checkedIn ? 'check' : 'calendar'" :size="48" /></view>
        <view class="status-content">
          <text class="status-kicker">今日状态</text>
          <view :class="['status-badge', statusBadgeClass(todayStatus)]">{{ statusText(todayStatus) }}</view>
          <view v-if="todayStatus.checkOutNote" class="status-note">{{ todayStatus.checkOutNote }}</view>
        </view>
      </view>

      <view class="card notify-strip" @tap="requestSubscribe">
        <view class="notify-icon"><pp-icon name="bell" :size="42" /></view>
        <view class="notify-copy">
          <text class="notify-title">开启学习提醒</text>
          <text class="notify-desc">接收签到、签退、上课、反馈和作业提醒</text>
        </view>
        <pp-icon name="arrow" :size="34" />
      </view>

      <!-- 本周课表 -->
      <view class="card" @tap="navTo('/pages/parent-schedule/index')">
        <view class="section-title">本周课表<text class="card-hint">点击进入学习小组详情</text></view>
        <view v-if="weekSchedules.length === 0" class="hint">本周暂无学习安排</view>
        <view v-for="sc in weekSchedules" :key="sc.id" class="sc-line">
          <view class="sc-badge">{{ scheduleLabel(sc) }}</view>
          <view class="sc-body">
            <text class="sc-title">{{ sc.class_name }}</text>
            <text class="sc-time">{{ sc.start_time }} - {{ sc.end_time }}</text>
          </view>
          <pp-icon name="arrow" :size="34" />
        </view>
      </view>

      <pp-homework-brief
        v-if="child"
        :content="feedbackHomework(latestFeedback)"
        :date="latestFeedback?.class_date || ''"
        :class-name="child.className || ''"
      />

      <!-- 最新反馈 -->
      <view class="card">
        <view class="section-title" @tap="navTo('/pages/parent-feedback/index')">最新反馈</view>
        <view class="fb-box" v-if="latestFeedback" @tap="showFbDetail='class'">
          <text class="fb-label">学习小组总反馈</text>
          <text class="fb-date">{{ latestFeedback.class_date }}</text>
          <text class="fb-preview">{{ feedbackSummaryWithoutHomework(latestFeedback.summary).slice(0,60) }}{{ feedbackSummaryWithoutHomework(latestFeedback.summary).length>60?'...':'' }}</text>
        </view>
        <view class="fb-box" v-if="stuFeedback" @tap="showFbDetail='student'">
          <text class="fb-label">学生个人反馈</text>
          <text class="fb-date">{{ stuFeedback.date }}</text>
          <text class="fb-preview">{{ (stuFeedback.text||'').slice(0,60) }}...</text>
        </view>
        <view v-if="!latestFeedback && !stuFeedback" class="hint">暂无反馈</view>
      </view>

      <view class="card practice-entry" @tap="child&&navTo('/pages/practice-parent/index?student_id='+child.id)">
        <view class="practice-entry-icon"><pp-icon name="clipboard" :size="42" /></view>
        <view class="practice-entry-copy">
          <text class="practice-entry-kicker">每日约 20 分钟</text>
          <text class="practice-entry-title">每日打卡</text>
          <text class="practice-entry-desc">领取今日题目、拍照提交、查看复核结果</text>
        </view>
        <pp-icon name="arrow" :size="34" />
      </view>

      <view class="card practice-entry arena-entry" @tap="child&&navTo('/pages/mental-arena/index?student_id='+child.id)">
        <view class="practice-entry-icon arena-icon"><text class="arena-symbol">王</text></view>
        <view class="practice-entry-copy">
          <text class="practice-entry-kicker arena-kicker">20 题限时挑战</text>
          <text class="practice-entry-title">口算王</text>
          <text class="practice-entry-desc">小学、初中战场自由选择 · 本周榜与历史榜</text>
        </view>
        <pp-icon name="arrow" :size="34" />
      </view>

      <!-- 反馈详情弹窗 -->
      <view v-if="showFbDetail" class="modal-mask" @tap="showFbDetail=''">
        <view class="modal" @tap.stop>
          <text class="modal-title">{{ showFbDetail==='class'?'学习小组总反馈':'学生个人反馈' }}</text>
          <scroll-view scroll-y class="fb-modal-body">
            <template v-if="showFbDetail==='class' && latestFeedback">
              <text class="fb-full-text">{{ feedbackSummaryWithoutHomework(latestFeedback.summary) }}</text>
              <button v-if="latestFeedback.notes_pdf_url" class="pdf-btn" @tap="openPdf(latestFeedback.notes_pdf_url)">打开学习笔记 PDF</button>
            </template>
            <template v-if="showFbDetail==='student' && stuFeedback">
              <text class="fb-full-text">{{ stuFeedback.text }}</text>
              <view v-if="stuFeedback.images && stuFeedback.images.length>0" class="fb-imgs">
                <image v-for="(img,i) in stuFeedback.images" :key="i" :src="api.assetUrl(img)" mode="aspectFill" class="fb-thumb" @tap="previewFbImg(stuFeedback.images,i)" />
              </view>
            </template>
          </scroll-view>
          <button class="btn-cancel" @tap="showFbDetail=''">关闭</button>
        </view>
      </view>


      <view class="card parent-tools">
        <view class="section-title">常用服务</view>
        <view class="tool-grid">
          <view class="tool-item" @tap="child?navTo('/pages/parent-leave/index?child_id='+child.id):navTo('/pages/parent-leave/index')">
            <view class="tool-icon"><pp-icon name="calendar" /></view>
            <text class="tool-title">请假申请</text>
            <text class="tool-desc">提交并查看审批</text>
          </view>
          <view class="tool-item" @tap="showFb=true">
            <view class="tool-icon"><pp-icon name="message" /></view>
            <text class="tool-title">反馈建议</text>
            <text class="tool-desc">直接告诉老师</text>
          </view>
        </view>
        <view v-if="leaves.length>0" class="leave-list">
          <view v-for="l in leaves" :key="l.id" class="leave-row">
            <text class="lv-date">{{ l.class_date }}</text>
            <text :class="['lv-status',l.status]">{{ l.status==='pending'?'待审批':l.status==='approved'?'已批准':'已拒绝' }}</text>
          </view>
        </view>
      </view>

      <!-- 反馈弹窗 -->
      <view v-if="showFb" class="modal-mask" @tap="showFb=false">
        <view class="modal" @tap.stop>
          <text class="modal-title">反馈与建议</text>
          <textarea v-model="fbText" class="fb-textarea" :placeholder="feedbackPlaceholder" :maxlength="200" />
          <button class="btn-primary" @tap="sendFeedback" :disabled="!fbText || feedbackSending">
            {{ feedbackSending ? '发送中...' : '发送' }}
          </button>
          <button class="btn-cancel" @tap="showFb=false">取消</button>
        </view>
      </view>
    </view>

    <view class="footer">{{ FOOTER_TEXT }}<br/>桂ICP备2026013218号-2</view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { onHide, onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { clearLocalSession, doLogin, getUser } from '@/utils/auth';
import { feedbackHomework, feedbackSummaryWithoutHomework } from '@/utils/feedback';
import { BRAND, FOOTER_TEXT, teacherDisplayName, teacherNameFromChild } from '@/utils/brand';
import { toastError, logError } from '@/utils/ui';
import { requestSubscribeBatches, subscribeResultTitle } from '@/utils/subscribe';

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

// 每次页面显示时刷新数据
let parentRefreshTimer = null;
function stopParentRefresh() {
  if (parentRefreshTimer) clearInterval(parentRefreshTimer);
  parentRefreshTimer = null;
}

function resetHomeScroll() {
  nextTick(() => uni.pageScrollTo({ scrollTop: 0, duration: 0 }));
}

onShow(() => {
  stopParentRefresh();
  if (user.value.role === 'teacher') loadTeacherData();
  else if (user.value.role === 'parent') {
    loadNotifyTemplates();
    // tabBar 页面会保留上次滚动位置；等异步孩子头部插入后再回顶，避免顶部看似被裁掉。
    loadParentData().finally(resetHomeScroll);
    parentRefreshTimer = setInterval(() => loadParentData(child.value?.id), 30000);
  }
});
onHide(stopParentRefresh);

onPullDownRefresh(async () => {
  try {
    if (user.value.role === 'teacher') await loadTeacherData();
    else if (user.value.role === 'parent') await loadParentData(child.value?.id);
  } finally {
    uni.stopPullDownRefresh();
  }
});

const classes = ref([]);
const pendingLeaves = ref(0);
const pendingPracticeCount = ref(0);
const pendingPracticeTodos = ref([]);
const todaySessions = ref([]);
const child = ref(null);
const boundKids = ref([]);
const fbText = ref('');
const showFb = ref(false);
const leaves = ref([]);
const todayStatus = ref(null);
const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];
const weekSchedules = ref([]);
const latestFeedback = ref(null);
const stuFeedback = ref(null);
const showFbDetail = ref('');
const profile = ref(null);
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
const totalStudents = computed(() => classes.value.reduce((sum, item) => sum + Number(item.studentCount || 0), 0));
const totalPending = computed(() => Number(pendingLeaves.value || 0) + Number(pendingPracticeCount.value || 0));
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
  leaves.value = [];
  weekSchedules.value = [];
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
  } catch(e) {
    toastError(e, '发送失败');
  } finally {
    feedbackSending.value = false;
  }
}
function navTo(url) { uni.navigateTo({ url }); }
function openPracticeTodo(item) {
  navTo(`/pages/practice-teacher/index?plan_id=${item.plan_id}&submission_id=${item.submission_id}`);
}

async function handleLogin() {
  if (loginLoading.value) return;
  loginLoading.value = true;
  try {
    const loggedInUser = await doLogin();
    user.value = loggedInUser;
    if (loggedInUser.role === 'teacher') await loadTeacherData();
    else {
      await loadNotifyTemplates();
      const hasChild = await loadParentData();
      if (!hasChild) uni.navigateTo({ url: '/pages/bind/bind' });
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
      if (!hasChild) uni.navigateTo({ url: '/pages/bind/bind' });
    }
  } catch (e) {
    toastError(e, '修复登录失败，请稍后重试');
  } finally {
    loginLoading.value = false;
  }
}


async function loadTeacherData() {
  if (teacherLoading.value) return;
  teacherLoading.value = true;
  teacherError.value = '';
  try {
    const [cRes, lRes, sessionRes, practiceTodos] = await Promise.all([
      api.get('/classes'),
      api.get('/leaves'),
      api.get('/schedules/sessions'),
      api.get('/practice/todos?limit=3')
    ]);
    classes.value = cRes.classes || [];
    pendingLeaves.value = (lRes.leaves||[]).filter(l=>l.status==='pending').length;
    pendingPracticeCount.value = Number(practiceTodos.count || 0);
    pendingPracticeTodos.value = practiceTodos.todos || [];
    todaySessions.value = (sessionRes.sessions || []).filter(item => item.class_date === localDateKey());
  } catch (e) {
    teacherError.value = e?.error || '请检查网络后重试';
    logError('loadTeacherData', e);
  } finally {
    teacherLoading.value = false;
  }
}

async function loadParentData(childId) {
  if (parentLoading.value) return Boolean(child.value);
  parentLoading.value = true;
  parentError.value = '';
  try {
    const kids = await api.get('/bind/students');
    boundKids.value = kids.students || [];
    // 选指定孩子或第一个
    const savedChildId = childId || uni.getStorageSync('activeChildId');
    const target = boundKids.value.find(k=>String(k.id)===String(savedChildId))
      || boundKids.value[0]
      || null;
    if (!target) {
      child.value = null;
      todayStatus.value = null;
      weekSchedules.value = [];
      latestFeedback.value = null;
      stuFeedback.value = null;
      return false;
    }
    child.value = target;

    const [schedParent, checkin, lv, fb] = await Promise.all([
      api.get('/schedules/parent?student_id='+target.id),
      api.get('/checkins/today?student_id='+target.id),
      api.get('/leaves'),
      api.get('/feedbacks/latest?class_id='+target.class_id)
    ]);
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
    return true;
  } catch (e) {
    parentError.value = e?.error || '请检查网络后重试';
    logError('loadParentData', e);
    return false;
  } finally {
    parentLoading.value = false;
  }
}

function statusBadgeClass(status) {
  if (status?.onLeave) return 'leave';
  return status?.checkedOut ? 'done' : (status?.checkedIn ? 'in' : 'out');
}

function statusText(status) {
  if (status?.onLeave) return '今日已请假';
  if (!status || !status.checkedIn) return '等待签到';
  if (status.checkedOut) return '今日已签退 ' + (status.checkOutTime || '');
  return '今日已签到 ' + (status.checkInTime || '');
}
function scheduleLabel(sc) {
  if (sc.class_date) {
    const d = new Date(sc.class_date + 'T00:00:00+08:00');
    return `${d.getMonth()+1}/${d.getDate()} ${dayNames[d.getDay()]}`;
  }
  return dayNames[sc.day_of_week];
}
</script>

<style scoped>
.page { padding-bottom: 40rpx; min-height: 100vh; background: #F3F7F5; }
.page .card {
  background: #FFFFFF;
  border-color: #DDE8E4;
  box-shadow: 0 6rpx 18rpx rgba(36, 42, 50, .045);
}
.welcome { text-align: center; padding: 240rpx 60rpx 0; }
.brand-icon { margin-bottom: 32rpx; display: flex; justify-content: center; }
.icon-book { width: 100rpx; height: 80rpx; border: 5rpx solid #183A36; border-radius: 6rpx 12rpx 12rpx 6rpx; position: relative; }
.icon-book::after { content:''; position:absolute; left: 45rpx; top: 0; bottom: 0; width: 3rpx; background: #183A36; }
.brand-name { font-size: 52rpx; font-weight: 800; color: #183A36; letter-spacing: 8rpx; }
.welcome .gold-rule { width: 64rpx; margin: 24rpx auto; }
.brand-sub { font-size: 36rpx; color: #536762; margin-top: 12rpx; }
.brand-desc { font-size: 26rpx; color: #7C8C87; margin: 16rpx 0 60rpx; letter-spacing: 12rpx; }
.login-btn { background: #183A36; color: #fff; border-radius: 14rpx; padding: 26rpx; font-size: 32rpx; width: 420rpx; margin: 0 auto; border: none; font-weight: 600; letter-spacing: 1rpx; display: block; }
.parent-btn { background: #fff; color: #183A36; border: 1px solid #183A36; border-radius: 12rpx; padding: 24rpx; font-size: 28rpx; width: 400rpx; margin: 24rpx auto 0; font-weight: 600; display: block; }

.teacher-hero.hero-navy,
.parent-hero.hero-navy {
  background: #F8FBFA;
  color: #183A36;
  padding: 46rpx 38rpx 38rpx;
  border-bottom: 1rpx solid #DBE7E2;
}
.teacher-hero .eyebrow,
.parent-hero .eyebrow {
  color: #2F6E61;
  letter-spacing: 1rpx;
}
.teacher-hero .gold-rule,
.parent-hero .gold-rule {
  width: 44rpx;
  height: 3rpx;
  margin: 16rpx 0;
  background: #2F7D6B;
}
.hero-greeting,
.child-greeting {
  font-size: 38rpx;
  font-weight: 700;
  color: #183A36;
}
.hero-date,
.child-class {
  font-size: 24rpx;
  color: #697B76;
  margin-top: 4rpx;
}

.quick-actions {
  margin-top: 20rpx;
  border-color: #D5E3DE;
  box-shadow: 0 8rpx 20rpx rgba(42, 48, 56, .05);
}
.action-row { display: flex; justify-content: space-between; }
.action-item { display: flex; flex-direction: column; align-items: center; gap: 12rpx; font-size: 24rpx; color: #3B4653; width: 20%; }
.action-icon {
  width: 74rpx;
  height: 74rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  position: relative;
  background: #F6F4EF;
  border: 1rpx solid #DDE8E4;
}
.action-check { background: #E8F4F0; border-color: #D7E8DB; }
.action-feedback { background: #EDF5F2; border-color: #E4DCCF; }
.action-groups { background: #F7F3EA; border-color: #E8DDC9; }
.action-schedule { background: #F0F3F2; border-color: #DCE5E1; }
.action-leave { background: #EFF6F3; border-color: #D7E8E0; }
.action-letter { color: #4B5765; font-size: 28rpx; font-weight: 700; }
.action-icon .i-check.on { background: #2F7D6B; color: #fff; }
.mini-dots { display: flex; gap: 6rpx; }
.mini-dots view { width: 10rpx; height: 10rpx; border-radius: 50%; background: #5C6D7D; }
.mini-triangle {
  width: 0;
  height: 0;
  border-left: 9rpx solid transparent;
  border-right: 9rpx solid transparent;
  border-top: 14rpx solid #6B7668;
}
.mini-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: #2F7D6B; }
.red-dot { position: absolute; top: -10rpx; right: -10rpx; min-width: 32rpx; height: 32rpx; background: #C75D54; color: #fff; border-radius: 16rpx; font-size: 20rpx; display: flex; align-items: center; justify-content: center; padding: 0 6rpx; }

.child-switcher { display: flex; justify-content: center; gap: 12rpx; padding: 16rpx 30rpx; background: #fff; border-bottom: 1rpx solid #E9F0ED; }
.cs-chip { padding: 10rpx 24rpx; border-radius: 20rpx; font-size: 26rpx; background: #E5EEEB; color: #697B76; }
.cs-chip.on { background: #183A36; color: #fff; font-weight: 600; }
.parent-hero { text-align: center; }
.parent-hero .gold-rule { margin: 16rpx auto; }
.child-avatar { width: 120rpx; height: 120rpx; border-radius: 50%; border: 3rpx solid #E9F0ED; margin-bottom: 16rpx; }
.fb-textarea { border: 1rpx solid #D5E3DE; border-radius: 10rpx; padding: 18rpx; font-size: 28rpx; width: 100%; min-height: 120rpx; box-sizing: border-box; margin-top: 8rpx; }

.status-card { display: flex; flex-direction: column; align-items: flex-start; gap: 12rpx; }
.status-badge { padding: 10rpx 24rpx; border-radius: 20rpx; font-size: 28rpx; font-weight: 600; }
.status-badge.in { background: #E4F4EE; color: #2F7D6B; }
.status-badge.done { background: #EEF2F7; color: #425B76; }
.status-badge.out { background: #EEF7F3; color: #B66A3C; }
.status-badge.leave { background: #FCEEEB; color: #A94F48; }
.status-note { color: #A94F48; font-size: 24rpx; line-height: 1.5; }
.status-time { font-size: 24rpx; color: #7C8C87; }

.section-title { font-size: 28rpx; font-weight: 700; margin-bottom: 12rpx; color: #183A36; letter-spacing: 0; display: flex; justify-content: space-between; align-items: center; }
.card-hint { font-size: 22rpx; font-weight: 400; color: #7C8C87; }
.class-item { padding: 14rpx 0; border-bottom: 1rpx solid #E5EEEB; display: flex; justify-content: space-between; align-items: center; }
.c-name { font-weight: 600; font-size: 28rpx; color: #183A36; }
.c-meta { font-size: 24rpx; color: #7B8490; }

.sc-line { display: flex; align-items: center; padding: 14rpx 0; border-bottom: 1rpx solid #E5EEEB; gap: 16rpx; }
.sc-line:last-child { border-bottom: none; }
.sc-badge { background: #EEF7F3; color: #2F6E61; font-size: 22rpx; padding: 6rpx 14rpx; border-radius: 6rpx; font-weight: 600; flex-shrink: 0; }
.sc-body { flex: 1; }
.sc-title { font-size: 28rpx; font-weight: 600; color: #183A36; display: block; }
.sc-time { font-size: 24rpx; color: #7C8C87; margin-top: 4rpx; }
.sc-arrow { font-size: 28rpx; color: #A4B1AD; }

.fb-box { background: #F7FAF8; border-radius: 10rpx; padding: 18rpx; margin-bottom: 12rpx; }
.fb-label { font-size: 22rpx; color: #2F7D6B; font-weight: 600; display: block; margin-bottom: 6rpx; }
.fb-date { font-size: 24rpx; color: #7C8C87; }
.fb-preview { font-size: 28rpx; color: #536762; display: -webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; margin-top: 4rpx; }
.fb-modal-body { max-height: 60vh; overflow-y: auto; }
.fb-full-text { font-size: 28rpx; color: #536762; line-height: 1.8; white-space: pre-wrap; }
.hw-card { background: #EEF7F3; border-radius: 10rpx; padding: 16rpx; font-size: 28rpx; color: #3F7167; margin-top: 16rpx; }
.pdf-btn { background: #183A36; color: #fff; border: none; padding: 18rpx; font-size: 28rpx; text-align: center; width: 100%; border-radius: 12rpx; margin-top: 16rpx; }
.fb-imgs { display: flex; gap: 10rpx; flex-wrap: wrap; margin-top: 16rpx; }
.fb-thumb { width: 150rpx; height: 150rpx; border-radius: 8rpx; }
.practice-entry { display:flex; align-items:center; gap:18rpx; overflow:hidden; }
.practice-entry-teacher { margin-top:20rpx; background:linear-gradient(135deg,#F2F8F5,#FFFFFF); border-color:#CFE2DB; }
.practice-entry-icon { width:72rpx; height:72rpx; flex:none; border-radius:22rpx; display:flex; align-items:center; justify-content:center; background:var(--accent-soft); color:var(--accent-strong); }
.practice-entry-copy { flex:1; min-width:0; }
.practice-entry-kicker { display:block; margin-bottom:2rpx; color:var(--accent-strong); font-size:20rpx; font-weight:700; letter-spacing:1rpx; }
.practice-entry-title { display:block; color:var(--ink); font-size:29rpx; font-weight:700; }
.practice-entry-desc { display:block; margin-top:4rpx; color:var(--text-muted); font-size:23rpx; line-height:1.45; }
.arena-entry{border-color:#E8C879!important;background:linear-gradient(135deg,#FFF9E8,#FFFFFF)!important}.arena-icon{background:#F5B83D!important}.arena-symbol{color:#493000;font-size:34rpx!important;font-weight:950!important}.arena-kicker{color:#9A6A0D}
.practice-todo-card{border-color:#E8C879!important;background:linear-gradient(135deg,#FFFBF0,#FFFFFF)!important}.practice-todo-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.practice-todo-kicker{display:block;color:#9A6A0D;font-size:20rpx;font-weight:800;letter-spacing:2rpx}.practice-todo-title{display:block;margin-top:5rpx;color:var(--ink);font-size:29rpx;font-weight:760}.practice-todo-badge{flex:none;padding:9rpx 15rpx;border-radius:999rpx;background:#F5B83D;color:#493000;font-size:21rpx;font-weight:800}.practice-todo-row{display:flex;align-items:center;justify-content:space-between;gap:14rpx;padding:18rpx 0;border-bottom:1rpx solid #F0E3C4}.practice-todo-name{display:block;color:var(--ink);font-size:26rpx;font-weight:700}.practice-todo-meta{display:block;margin-top:4rpx;color:var(--text-muted);font-size:21rpx}.practice-todo-action{flex:none;color:#9A6A0D;font-size:23rpx;font-weight:800}.practice-todo-all{min-height:84rpx;margin:20rpx 0 0;border-radius:14rpx;background:#183A36;color:#fff;font-size:25rpx;font-weight:720}.practice-todo-all::after{border:0}

.profile-preview { display: flex; gap: 12rpx; flex-wrap: wrap; }

.hint { text-align: center; color: #7C8C87; padding: 24rpx; font-size: 26rpx; }
.btn-outline { border: 1px solid #183A36; color: #183A36; background: #fff; border-radius: 10rpx; padding: 20rpx; font-size: 28rpx; width: 100%; font-weight: 600; }
.btn-primary { background:#183A36; color:#fff; border:none; border-radius:10rpx; padding:20rpx; font-size:28rpx; width:100%; font-weight:600; }
.mt-sm { margin-top:12rpx; }
.footer { text-align: center; color: #9AA9A5; font-size: 24rpx; padding: 40rpx 30rpx 30rpx; line-height: 1.6; }
.action-item text { font-size: 24rpx; color: #3B4653; font-weight: 500; }
.leave-list { margin-top: 20rpx; border-top: 1rpx solid #E5EEEB; padding-top: 16rpx; }
.leave-row { display: flex; justify-content: space-between; padding: 10rpx 0; font-size: 26rpx; }
.lv-date { color: #536762; }
.lv-status { color: #7C8C87; }
.lv-status.pending { color: #2F7D6B; }
.lv-status.approved { color: #2F7D6B; }
.lv-status.rejected { color: #C75D54; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 99; display: flex; align-items: flex-end; }
.modal { background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 30rpx; width: 100%; }
.modal-title { font-size: 32rpx; font-weight: 700; color: #183A36; text-align: center; margin-bottom: 20rpx; }
.btn-cancel { background: #F7FAF8; color: #7C8C87; border: none; padding: 20rpx; font-size: 28rpx; text-align: center; width: 100%; border-radius: 12rpx; margin-top: 12rpx; }
</style>

<style scoped>
.page { padding-bottom: calc(44rpx + env(safe-area-inset-bottom)); }

.welcome {
  min-height: calc(100vh - 100rpx);
  padding: 168rpx 58rpx 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}
.brand-icon { width: 128rpx; height: 128rpx; margin: 0 0 30rpx; filter: drop-shadow(0 16rpx 26rpx rgba(24,58,54,.16)); }
.icon-book { display: none; }
.brand-name { color: var(--ink); font-size: 54rpx; font-weight: 780; letter-spacing: 7rpx; }
.brand-sub { margin-top: 20rpx; color: var(--text-secondary); font-size: 31rpx; font-weight: 600; }
.brand-desc { margin: 12rpx 0 54rpx; color: var(--text-muted); font-size: 25rpx; letter-spacing: 0; }
.login-btn {
  width: 100%;
  max-width: 540rpx;
  min-height: 94rpx;
  padding: 22rpx 30rpx;
  background: var(--primary);
  border-radius: 18rpx;
  box-shadow: 0 16rpx 34rpx rgba(24,58,54,.17);
  font-size: 31rpx;
  font-weight: 680;
  transition: transform .16s var(--ease-out), opacity .16s var(--ease-out);
}
.login-btn:active { transform: scale(.975); opacity: .92; }
.repair-login-btn { width: 100%; max-width: 540rpx; min-height: 78rpx; margin-top: 18rpx; border: 1rpx solid var(--border); border-radius: 16rpx; background: #fff; color: var(--accent-strong); font-size: 27rpx; }
.welcome-note { margin-top: 24rpx; color: var(--faint); font-size: 23rpx; }

.teacher-hero.hero-navy,
.parent-hero.hero-navy { padding: 48rpx 34rpx 42rpx; text-align: left; background: linear-gradient(150deg,#F9FCFB 0%,#EEF6F3 100%); border-color: var(--hairline); }
.teacher-hero .eyebrow,
.parent-hero .eyebrow { color: var(--accent-strong); }
.hero-greeting,
.child-greeting { margin-top: 10rpx; color: var(--ink); font-size: 40rpx; font-weight: 700; letter-spacing: -1rpx; }
.child-greeting { display: block; line-height: 1.45; padding: 2rpx 0; overflow: visible; }
.hero-date,
.child-class { margin-top: 8rpx; color: var(--text-muted); font-size: 25rpx; }
.parent-hero .gold-rule { display: none; }

.focus-card { margin-top: 22rpx; padding: 28rpx 30rpx 30rpx; background: var(--primary); border: none; box-shadow: 0 18rpx 40rpx rgba(24,58,54,.18); }
.focus-topline { display: flex; align-items: center; justify-content: space-between; }
.focus-label { color: rgba(255,255,255,.74); font-size: 24rpx; font-weight: 600; }
.focus-pending,
.focus-ready { padding: 5rpx 13rpx; border-radius: 9rpx; font-size: 21rpx; font-weight: 650; }
.focus-pending { color: #FFE7DE; background: rgba(230,115,85,.18); }
.focus-ready { color: #D5F2EA; background: rgba(119,195,176,.16); }
.focus-metrics { display: flex; align-items: center; margin-top: 24rpx; }
.focus-metric { flex: 1; display: flex; align-items: baseline; gap: 10rpx; }
.focus-number { color: #FFFFFF; font-size: 52rpx; font-weight: 760; line-height: 1; }
.focus-copy { color: rgba(255,255,255,.7); font-size: 23rpx; }
.focus-divider { width: 1rpx; height: 50rpx; margin: 0 30rpx; background: rgba(255,255,255,.14); }

.quick-actions { padding: 24rpx 16rpx 22rpx; }
.action-row { gap: 4rpx; }
.action-item { width: 20%; min-height: 112rpx; justify-content: center; gap: 10rpx; border-radius: 16rpx; }
.action-icon { width: 70rpx; height: 70rpx; border: none; border-radius: 22rpx; background: var(--accent-soft); }
.action-check,.action-feedback,.action-groups,.action-schedule,.action-leave { background: var(--accent-soft); border: none; }
.action-item text { color: var(--text-secondary); font-size: 23rpx; font-weight: 600; }
.red-dot { top: -7rpx; right: -7rpx; background: var(--danger); border: 3rpx solid #FFFFFF; }

.section-title { min-height: 44rpx; margin-bottom: 14rpx; color: var(--ink); font-size: 29rpx; }
.card-hint { color: var(--accent-strong); font-size: 24rpx; font-weight: 650; }
.class-item { min-height: 88rpx; padding: 18rpx 0; border-color: var(--hairline); }
.c-name { display: block; color: var(--ink); font-size: 29rpx; }
.c-meta { display: block; margin-top: 3rpx; color: var(--text-muted); font-size: 23rpx; }
.class-tail { display: flex; align-items: center; color: var(--text-muted); font-size: 23rpx; }
.class-count { margin-right: 3rpx; color: var(--accent-strong); font-size: 28rpx; font-weight: 720; }

.child-switcher { justify-content: flex-start; overflow-x: auto; padding: 14rpx 24rpx; border-color: var(--hairline); background: rgba(255,255,255,.92); }
.cs-chip { flex-shrink: 0; min-height: 52rpx; display: flex; align-items: center; padding: 4rpx 22rpx; border-radius: 14rpx; color: var(--text-muted); background: var(--surface-muted); }
.cs-chip.on { color: #FFFFFF; background: var(--primary); }

.status-card { flex-direction: row; align-items: center; gap: 20rpx; padding: 28rpx 30rpx; }
.status-mark { width: 76rpx; height: 76rpx; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; background: var(--accent-soft); flex-shrink: 0; }
.status-content { flex: 1; }
.status-kicker { display: block; color: var(--text-muted); font-size: 22rpx; }
.status-badge { display: block; padding: 0; margin-top: 2rpx; background: transparent !important; color: var(--ink) !important; font-size: 30rpx; font-weight: 720; }
.status-note { margin-top: 7rpx; color: var(--danger); }

.notify-strip { min-height: 104rpx; display: flex; align-items: center; gap: 18rpx; padding: 24rpx 26rpx; background: #F9FCFB; }
.notify-icon { width: 68rpx; height: 68rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; background: var(--accent-soft); }
.notify-copy { flex: 1; }
.notify-title { display: block; color: var(--ink); font-size: 28rpx; font-weight: 680; }
.notify-desc { display: block; margin-top: 1rpx; color: var(--text-muted); font-size: 23rpx; }

.sc-line { min-height: 82rpx; padding: 16rpx 0; border-color: var(--hairline); }
.sc-badge { background: var(--accent-soft); color: var(--accent-strong); border-radius: 10rpx; }
.sc-title { color: var(--ink); }
.sc-time { color: var(--text-muted); }

.fb-box { padding: 20rpx; border-radius: 16rpx; background: var(--surface-muted); }
.fb-label { color: var(--accent-strong); }
.fb-preview { color: var(--text-secondary); }

.tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.tool-item { min-height: 146rpx; padding: 22rpx; border-radius: 18rpx; background: var(--surface-muted); box-sizing: border-box; transition: transform .16s var(--ease-out), opacity .16s var(--ease-out); }
.tool-item:active { transform: scale(.975); opacity: .88; }
.tool-icon { width: 56rpx; height: 56rpx; border-radius: 16rpx; display: flex; align-items: center; justify-content: center; background: var(--accent-soft); }
.tool-title { display: block; margin-top: 12rpx; color: var(--ink); font-size: 27rpx; font-weight: 680; }
.tool-desc { display: block; margin-top: 2rpx; color: var(--text-muted); font-size: 22rpx; }
.leave-list { border-color: var(--hairline); }

.modal { padding: 32rpx 30rpx calc(28rpx + env(safe-area-inset-bottom)); }
.fb-textarea { border-color: #D5E3DE; border-radius: 14rpx; background: #FAFCFB; }
.footer { color: var(--faint); padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); }
</style>
