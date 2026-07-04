<template>
  <view class="page">
    <!-- 未登录 -->
    <view v-if="!user.role" class="welcome">
      <view class="brand-icon"><view class="icon-book"></view></view>
      <view class="brand-name">{{ BRAND }}</view>
      <view class="gold-rule"></view>
      <view class="brand-sub">潘潘老师课堂管理助手</view>
      <view class="brand-desc">专业 · 靠谱 · 有温度</view>
      <button class="login-btn" @tap="handleLogin">微信登录</button>
    </view>

    <!-- 老师端 -->
    <view v-else-if="user.role==='teacher'">
      <view class="teacher-hero hero-navy">
        <view class="eyebrow">{{ BRAND }}</view>
        <view class="hero-greeting">{{ TEACHER }}，{{ greeting }}</view>
        <view class="gold-rule"></view>
        <view class="hero-date num">{{ today }}</view>
      </view>

      <view class="card quick-actions">
        <view class="action-row">
          <view class="action-item" @tap="navTo('/pages/teacher-checkin/index')">
            <view class="action-icon action-check"><view class="i-check on">✓</view></view>
            <text>签到</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-feedback/index')">
            <view class="action-icon action-feedback"><text class="action-letter">T</text></view>
            <text>发反馈</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-classes/index')">
            <view class="action-icon action-groups"><view class="mini-dots"><view></view><view></view></view></view>
            <text>学习小组</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-schedule/index')">
            <view class="action-icon action-schedule"><view class="mini-triangle"></view></view>
            <text>课表</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-leaves/index')">
            <view class="action-icon action-leave">
              <view class="mini-dot"></view>
              <view v-if="pendingLeaves>0" class="red-dot">{{ pendingLeaves }}</view>
            </view>
            <text>请假审批</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="section-title">学习小组概览</view>
        <view v-if="classes.length === 0" class="hint">暂无学习小组，去「学习小组管理」创建</view>
        <view v-for="c in classes" :key="c.id" class="class-item" @tap="navTo('/pages/teacher-classes/index')">
          <text class="c-name">{{ c.name }}</text>
          <text class="c-meta">{{ c.studentCount }}人 · {{ c.grade }}</text>
        </view>
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
        <view class="gold-rule"></view>
        <view class="child-class">{{ child.className }}</view>
      </view>

      <!-- 今日状态 -->
      <view class="card status-card" v-if="todayStatus">
        <view :class="['status-badge', statusBadgeClass(todayStatus)]">
          {{ statusText(todayStatus) }}
        </view>
      </view>

      <view class="card">
        <button class="btn-outline" @tap="requestSubscribe">接收签到签退和反馈提醒</button>
      </view>

      <!-- 本周课表 -->
      <view class="card" @tap="navTo('/pages/parent-schedule/index')">
        <view class="section-title">本周课表<text class="card-hint">点击进入学习小组详情</text></view>
        <view v-if="weekSchedules.length === 0" class="hint">本周暂无学习安排</view>
        <view v-for="sc in weekSchedules" :key="sc.id" class="sc-line">
          <view class="sc-badge">{{ dayNames[sc.day_of_week] }}</view>
          <view class="sc-body">
            <text class="sc-title">{{ sc.class_name }}</text>
            <text class="sc-time">{{ sc.start_time }} - {{ sc.end_time }}</text>
          </view>
          <text class="sc-arrow">›</text>
        </view>
      </view>

      <!-- 最新反馈 -->
      <view class="card">
        <view class="section-title" @tap="navTo('/pages/parent-feedback/index')">最新反馈</view>
        <view class="fb-box" v-if="latestFeedback" @tap="showFbDetail='class'">
          <text class="fb-label">学习小组总反馈</text>
          <text class="fb-date">{{ latestFeedback.class_date }}</text>
          <text class="fb-preview">{{ (latestFeedback.summary||'').slice(0,60) }}...</text>
        </view>
        <view class="fb-box" v-if="stuFeedback" @tap="showFbDetail='student'">
          <text class="fb-label">学生个人反馈</text>
          <text class="fb-date">{{ stuFeedback.date }}</text>
          <text class="fb-preview">{{ (stuFeedback.text||'').slice(0,60) }}...</text>
        </view>
        <view v-if="!latestFeedback && !stuFeedback" class="hint">暂无反馈</view>
      </view>

      <!-- 反馈详情弹窗 -->
      <view v-if="showFbDetail" class="modal-mask" @tap="showFbDetail=''">
        <view class="modal" @tap.stop>
          <text class="modal-title">{{ showFbDetail==='class'?'学习小组总反馈':'学生个人反馈' }}</text>
          <scroll-view scroll-y class="fb-modal-body">
            <template v-if="showFbDetail==='class' && latestFeedback">
              <text class="fb-full-text">{{ latestFeedback.summary }}</text>
              <view v-if="latestFeedback.homework" class="hw-card">作业：{{ latestFeedback.homework }}</view>
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


      <!-- 请假 -->
      <view class="card">
        <button class="btn-outline" @tap="child?navTo('/pages/parent-leave/index?child_id='+child.id):navTo('/pages/parent-leave/index')">请假申请</button>
        <view v-if="leaves.length>0" class="leave-list">
          <view v-for="l in leaves" :key="l.id" class="leave-row">
            <text class="lv-date">{{ l.class_date }}</text>
            <text :class="['lv-status',l.status]">{{ l.status==='pending'?'待审批':l.status==='approved'?'已批准':'已拒绝' }}</text>
          </view>
        </view>
      </view>

      <!-- 反馈 -->
      <view class="card">
        <button class="btn-outline" @tap="showFb=true">反馈与建议</button>
      </view>

      <!-- 反馈弹窗 -->
      <view v-if="showFb" class="modal-mask" @tap="showFb=false">
        <view class="modal" @tap.stop>
          <text class="modal-title">反馈与建议</text>
          <textarea v-model="fbText" class="fb-textarea" placeholder="有任何问题或建议告诉潘潘老师" :maxlength="200" />
          <button class="btn-primary" @tap="sendFeedback" :disabled="!fbText">发送</button>
          <button class="btn-cancel" @tap="showFb=false">取消</button>
        </view>
      </view>
    </view>

    <view class="footer">小程序由潘潘独立制作与维护<br/>如有问题欢迎私信反馈<br/>桂ICP备2026013218号-2</view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onHide, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { doLogin } from '@/utils/auth';
import { BRAND, TEACHER } from '@/utils/brand';
import { toastError, logError } from '@/utils/ui';

const user = ref({});
// 启动时从storage恢复
const token = uni.getStorageSync('token');
const saved = uni.getStorageSync('user');
if (token && saved) {
  try { user.value = JSON.parse(saved); } catch(e) { logError('parseUser', e); }
} else if (saved) {
  uni.removeStorageSync('user');
  uni.removeStorageSync('activeChildId');
}

// 每次页面显示时刷新数据
let parentRefreshTimer = null;
function stopParentRefresh() {
  if (parentRefreshTimer) clearInterval(parentRefreshTimer);
  parentRefreshTimer = null;
}

onShow(() => {
  stopParentRefresh();
  if (user.value.role === 'teacher') loadTeacherData();
  else if (user.value.role === 'parent') {
    loadParentData();
    parentRefreshTimer = setInterval(() => loadParentData(child.value?.id), 15000);
  }
});
onHide(stopParentRefresh);

const classes = ref([]);
const pendingLeaves = ref(0);
const child = ref(null);
const boundKids = ref([]);
const fbText = ref('');
const showFb = ref(false);
const leaves = ref([]);
const teacherStats = ref({ students: 0, schedules: 0 });
const todayStatus = ref(null);
const dayNames = ['周日','周一','周二','周三','周四','周五','周六'];
const weekSchedules = ref([]);
const latestFeedback = ref(null);
const stuFeedback = ref(null);
const showFbDetail = ref('');
const profile = ref(null);
const h = new Date().getHours();
const greeting = h < 6 ? '夜深了' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
const today = new Date().toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'long' });

function previewFbImg(list,i){ uni.previewImage({current:api.assetUrl(list[i]),urls:list.map(u=>api.assetUrl(u))}); }
function openPdf(url) {
  uni.downloadFile({
    url: api.assetUrl(url),
    success: (res) => {
      if (res.statusCode === 200) uni.openDocument({ filePath: res.tempFilePath, fileType: 'pdf', showMenu: true });
      else uni.showToast({ title: 'PDF 下载失败', icon: 'none' });
    },
    fail: () => uni.showToast({ title: 'PDF 下载失败', icon: 'none' })
  });
}
async function requestSubscribe() {
  try {
    const tplRes = await api.get('/notify/templates');
    const tpls = [...new Set([tplRes.checkin, tplRes.checkout, tplRes.feedback].filter(Boolean))];
    if (tpls.length === 0) return uni.showToast({ title: '提醒模板未配置', icon: 'none' });
    // 须在用户点击手势中调用；openid 已在登录时由后端用 code 换取并保存，无需前端回传。
    uni.requestSubscribeMessage({
      tmplIds: tpls,
      success: () => uni.showToast({ title: '提醒已开启', icon: 'success' }),
      fail(e) { logError('requestSubscribe', e); }
    });
  } catch (e) {
    logError('requestSubscribe', e);
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
  if (!fbText.value) return;
  try { await api.post('/leaves/feedback', { content: fbText.value }); uni.showToast({ title: '已发送', icon: 'success' }); fbText.value = ''; }
  catch(e) { uni.showToast({ title: '发送失败', icon: 'none' }); }
}
function navTo(url) { uni.navigateTo({ url }); }

async function handleLogin() {
  try {
    const loggedInUser = await doLogin();
    user.value = loggedInUser;
    if (loggedInUser.role === 'teacher') loadTeacherData();
    else uni.navigateTo({ url: '/pages/bind/bind' });
  } catch(e) {
    const message = e?.error || e?.message || '登录失败，请稍后重试';
    uni.showToast({ title: message, icon: 'none' });
  }
}


async function loadTeacherData() {
  try {
    const [cRes, lRes] = await Promise.all([api.get('/classes'), api.get('/leaves')]);
    classes.value = cRes.classes || [];
    pendingLeaves.value = (lRes.leaves||[]).filter(l=>l.status==='pending').length;
  } catch (e) {
    if (e?.statusCode === 401) user.value = {};
    logError('loadTeacherData', e);
  }
}

async function loadParentData(childId) {
  try {
    const [kids, schedParent] = await Promise.all([
      api.get('/bind/students'), api.get('/schedules/parent')
    ]);
    boundKids.value = kids.students || [];
    // 选指定孩子或第一个
    const savedChildId = childId || uni.getStorageSync('activeChildId');
    const target = savedChildId
      ? boundKids.value.find(k=>k.id===savedChildId)
      : (boundKids.value.length>0 ? boundKids.value[0] : null);
    if (!target) { child.value = null; return; }
    child.value = target;

    const [checkin, lv, fb] = await Promise.all([
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
    weekSchedules.value = (schedParent.schedules||[]).filter(s=>s.class_id===myId).slice(0,3);
    leaves.value = (lv.leaves||[]).filter(l=>l.student_id===target.id).slice(0,5);
    latestFeedback.value = fb.feedback;
    stuFeedback.value = null;
    // 提取学生个人反馈
    if (fb.feedback && fb.feedback.student_feedbacks) {
      try {
        const list = JSON.parse(fb.feedback.student_feedbacks);
        const my = list.find(s => s.id === target.id);
        if (my) stuFeedback.value = { date: fb.feedback.class_date, text: my.text, images: my.images || [] };
      } catch(e) { logError('parseStudentFeedback', e); }
    }
  } catch (e) {
    if (e?.statusCode === 401) user.value = {};
    logError('loadParentData', e);
  }
}

function statusBadgeClass(status) {
  return status?.checkedOut ? 'done' : (status?.checkedIn ? 'in' : 'out');
}

function statusText(status) {
  if (!status || !status.checkedIn) return '等待签到';
  if (status.checkedOut) return '今日已签退 ' + (status.checkOutTime || '');
  return '今日已签到 ' + (status.checkInTime || '');
}
</script>

<style scoped>
.page { padding-bottom: 40rpx; min-height: 100vh; background: #F4F5F2; }
.page .card {
  background: #FFFFFF;
  border-color: #E5E0D8;
  box-shadow: 0 6rpx 18rpx rgba(36, 42, 50, .045);
}
.welcome { text-align: center; padding: 240rpx 60rpx 0; }
.brand-icon { margin-bottom: 32rpx; display: flex; justify-content: center; }
.icon-book { width: 100rpx; height: 80rpx; border: 5rpx solid #202733; border-radius: 6rpx 12rpx 12rpx 6rpx; position: relative; }
.icon-book::after { content:''; position:absolute; left: 45rpx; top: 0; bottom: 0; width: 3rpx; background: #202733; }
.brand-name { font-size: 52rpx; font-weight: 800; color: #202733; letter-spacing: 8rpx; }
.welcome .gold-rule { width: 64rpx; margin: 24rpx auto; }
.brand-sub { font-size: 36rpx; color: #46515C; margin-top: 12rpx; }
.brand-desc { font-size: 26rpx; color: #8A929B; margin: 16rpx 0 60rpx; letter-spacing: 12rpx; }
.login-btn { background: #202733; color: #fff; border-radius: 14rpx; padding: 26rpx; font-size: 32rpx; width: 420rpx; margin: 0 auto; border: none; font-weight: 600; letter-spacing: 1rpx; display: block; }
.parent-btn { background: #fff; color: #202733; border: 1px solid #202733; border-radius: 12rpx; padding: 24rpx; font-size: 28rpx; width: 400rpx; margin: 24rpx auto 0; font-weight: 600; display: block; }

.teacher-hero.hero-navy,
.parent-hero.hero-navy {
  background: #FBFAF7;
  color: #202733;
  padding: 46rpx 38rpx 38rpx;
  border-bottom: 1rpx solid #E4DED2;
}
.teacher-hero .eyebrow,
.parent-hero .eyebrow {
  color: #8D6A3F;
  letter-spacing: 1rpx;
}
.teacher-hero .gold-rule,
.parent-hero .gold-rule {
  width: 44rpx;
  height: 3rpx;
  margin: 16rpx 0;
  background: #A57945;
}
.hero-greeting,
.child-greeting {
  font-size: 38rpx;
  font-weight: 700;
  color: #202733;
}
.hero-date,
.child-class {
  font-size: 24rpx;
  color: #69717D;
  margin-top: 4rpx;
}

.quick-actions {
  margin-top: 20rpx;
  border-color: #E1DDD4;
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
  border: 1rpx solid #E5DED2;
}
.action-check { background: #EEF5EF; border-color: #D7E8DB; }
.action-feedback { background: #F3F1EA; border-color: #E4DCCF; }
.action-groups { background: #F7F3EA; border-color: #E8DDC9; }
.action-schedule { background: #F0F3F2; border-color: #DCE5E1; }
.action-leave { background: #EFF6F3; border-color: #D7E8E0; }
.action-letter { color: #4B5765; font-size: 28rpx; font-weight: 700; }
.action-icon .i-check.on { background: #3F8B65; color: #fff; }
.mini-dots { display: flex; gap: 6rpx; }
.mini-dots view { width: 10rpx; height: 10rpx; border-radius: 50%; background: #5C6D7D; }
.mini-triangle {
  width: 0;
  height: 0;
  border-left: 9rpx solid transparent;
  border-right: 9rpx solid transparent;
  border-top: 14rpx solid #6B7668;
}
.mini-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: #3F8B65; }
.red-dot { position: absolute; top: -10rpx; right: -10rpx; min-width: 32rpx; height: 32rpx; background: #B85C4E; color: #fff; border-radius: 16rpx; font-size: 20rpx; display: flex; align-items: center; justify-content: center; padding: 0 6rpx; }

.child-switcher { display: flex; justify-content: center; gap: 12rpx; padding: 16rpx 30rpx; background: #fff; border-bottom: 1rpx solid #EFEDE7; }
.cs-chip { padding: 10rpx 24rpx; border-radius: 20rpx; font-size: 26rpx; background: #ECE8E0; color: #69717D; }
.cs-chip.on { background: #202733; color: #fff; font-weight: 600; }
.parent-hero { text-align: center; }
.parent-hero .gold-rule { margin: 16rpx auto; }
.child-avatar { width: 120rpx; height: 120rpx; border-radius: 50%; border: 3rpx solid #EFEDE7; margin-bottom: 16rpx; }
.fb-textarea { border: 1rpx solid #E1DDD4; border-radius: 10rpx; padding: 18rpx; font-size: 28rpx; width: 100%; min-height: 120rpx; box-sizing: border-box; margin-top: 8rpx; }

.status-card { display: flex; align-items: center; gap: 16rpx; }
.status-badge { padding: 10rpx 24rpx; border-radius: 20rpx; font-size: 28rpx; font-weight: 600; }
.status-badge.in { background: #EBF8F2; color: #3F8B65; }
.status-badge.done { background: #EEF2F7; color: #425B76; }
.status-badge.out { background: #F7F1E7; color: #A66A3E; }
.status-time { font-size: 24rpx; color: #8A929B; }

.section-title { font-size: 28rpx; font-weight: 700; margin-bottom: 12rpx; color: #202733; letter-spacing: 0; display: flex; justify-content: space-between; align-items: center; }
.card-hint { font-size: 22rpx; font-weight: 400; color: #8A929B; }
.class-item { padding: 14rpx 0; border-bottom: 1rpx solid #ECE8E0; display: flex; justify-content: space-between; align-items: center; }
.c-name { font-weight: 600; font-size: 28rpx; color: #202733; }
.c-meta { font-size: 24rpx; color: #7B8490; }

.sc-line { display: flex; align-items: center; padding: 14rpx 0; border-bottom: 1rpx solid #ECE8E0; gap: 16rpx; }
.sc-line:last-child { border-bottom: none; }
.sc-badge { background: #F7F1E7; color: #8D6A3F; font-size: 22rpx; padding: 6rpx 14rpx; border-radius: 6rpx; font-weight: 600; flex-shrink: 0; }
.sc-body { flex: 1; }
.sc-title { font-size: 28rpx; font-weight: 600; color: #202733; display: block; }
.sc-time { font-size: 24rpx; color: #8A929B; margin-top: 4rpx; }
.sc-arrow { font-size: 28rpx; color: #C3C1BA; }

.fb-box { background: #F8F6F1; border-radius: 10rpx; padding: 18rpx; margin-bottom: 12rpx; }
.fb-label { font-size: 22rpx; color: #A57945; font-weight: 600; display: block; margin-bottom: 6rpx; }
.fb-date { font-size: 24rpx; color: #8A929B; }
.fb-preview { font-size: 28rpx; color: #46515C; display: -webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; margin-top: 4rpx; }
.fb-modal-body { max-height: 60vh; overflow-y: auto; }
.fb-full-text { font-size: 28rpx; color: #46515C; line-height: 1.8; white-space: pre-wrap; }
.hw-card { background: #F7F1E7; border-radius: 10rpx; padding: 16rpx; font-size: 28rpx; color: #7B5B36; margin-top: 16rpx; }
.pdf-btn { background: #202733; color: #fff; border: none; padding: 18rpx; font-size: 28rpx; text-align: center; width: 100%; border-radius: 12rpx; margin-top: 16rpx; }
.fb-imgs { display: flex; gap: 10rpx; flex-wrap: wrap; margin-top: 16rpx; }
.fb-thumb { width: 150rpx; height: 150rpx; border-radius: 8rpx; }

.profile-preview { display: flex; gap: 12rpx; flex-wrap: wrap; }

.hint { text-align: center; color: #8A929B; padding: 24rpx; font-size: 26rpx; }
.btn-outline { border: 1px solid #202733; color: #202733; background: #fff; border-radius: 10rpx; padding: 20rpx; font-size: 28rpx; width: 100%; font-weight: 600; }
.footer { text-align: center; color: #AAB0B7; font-size: 24rpx; padding: 40rpx 30rpx 30rpx; line-height: 1.6; }
.action-item text { font-size: 24rpx; color: #3B4653; font-weight: 500; }
.leave-list { margin-top: 20rpx; border-top: 1rpx solid #ECE8E0; padding-top: 16rpx; }
.leave-row { display: flex; justify-content: space-between; padding: 10rpx 0; font-size: 26rpx; }
.lv-date { color: #46515C; }
.lv-status { color: #8A929B; }
.lv-status.pending { color: #A57945; }
.lv-status.approved { color: #3F8B65; }
.lv-status.rejected { color: #B85C4E; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 99; display: flex; align-items: flex-end; }
.modal { background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 30rpx; width: 100%; }
.modal-title { font-size: 32rpx; font-weight: 700; color: #202733; text-align: center; margin-bottom: 20rpx; }
.btn-cancel { background: #F8F6F1; color: #8A929B; border: none; padding: 20rpx; font-size: 28rpx; text-align: center; width: 100%; border-radius: 12rpx; margin-top: 12rpx; }
</style>
