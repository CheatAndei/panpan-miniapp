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
            <view class="action-icon" style="background:#EBF8F2"><view class="i-check on">✓</view></view>
            <text>签到</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-feedback/index')">
            <view class="action-icon" style="background:#EBF0F7"><text class="i-symbol">T</text></view>
            <text>发反馈</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-classes/index')">
            <view class="action-icon" style="background:#FEF5E7"><view style="display:flex;gap:4rpx"><view class="i-dot blue"></view><view class="i-dot blue"></view></view></view>
            <text>学习小组</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-schedule/index')">
            <view class="action-icon" style="background:#F0F0FF"><view style="width:0;height:0;border-left:8rpx solid transparent;border-right:8rpx solid transparent;border-top:12rpx solid #6B46C1"></view></view>
            <text>课表</text>
          </view>
          <view class="action-item" @tap="navTo('/pages/teacher-leaves/index')">
            <view class="action-icon" style="background:#F0FFF4;position:relative">
              <view class="i-dot green"></view>
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
        <view :class="['status-badge', todayStatus.checkedIn ? 'in' : 'out']">
          {{ todayStatus.checkedIn ? '今日已签到' : '等待签到' }}
        </view>
        <text class="status-time" v-if="todayStatus.checkInTime">{{ todayStatus.checkInTime }}</text>
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
            </template>
            <template v-if="showFbDetail==='student' && stuFeedback">
              <text class="fb-full-text">{{ stuFeedback.text }}</text>
              <view v-if="stuFeedback.images && stuFeedback.images.length>0" class="fb-imgs">
                <image v-for="(img,i) in stuFeedback.images" :key="i" :src="ASSET_BASE+img" mode="aspectFill" class="fb-thumb" @tap="previewFbImg(stuFeedback.images,i)" />
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

    <view class="footer">小程序由潘潘独立制作与维护<br/>如有问题欢迎私信反馈</view>
  </view>
</template>

<script setup>
import { ASSET_BASE } from '@/utils/config';
import { ref, computed } from 'vue';
import { api } from '@/utils/api';
import { doLogin } from '@/utils/auth';
import { BRAND, TEACHER } from '@/utils/brand';
import { toastError, logError } from '@/utils/ui';

const user = ref({});
// 启动时从storage恢复
const saved = uni.getStorageSync('user');
if (saved) { try { user.value = JSON.parse(saved); } catch(e) { logError('parseUser', e); } }
if (user.value.role === 'teacher') loadTeacherData();
else if (user.value.role === 'parent') loadParentData();

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

function previewFbImg(list,i){ uni.previewImage({current:ASSET_BASE+list[i],urls:list.map(u=>ASSET_BASE+u)}); }
async function requestSubscribe() {
  try {
    const tplRes = await api.get('/notify/templates');
    const tpls = Object.values(tplRes || {}).filter(Boolean);
    if (tpls.length === 0) return;
    // 须在用户点击手势中调用；openid 已在登录时由后端用 code 换取并保存，无需前端回传。
    uni.requestSubscribeMessage({
      tmplIds: tpls,
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
    const target = childId
      ? boundKids.value.find(k=>k.id===childId)
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
    const myId = target.class_id;
    weekSchedules.value = (schedParent.schedules||[]).filter(s=>s.class_id===myId).slice(0,3);
    leaves.value = (lv.leaves||[]).filter(l=>l.student_id===target.id).slice(0,5);
    latestFeedback.value = fb.feedback;
    // 提取学生个人反馈
    if (fb.feedback && fb.feedback.student_feedbacks) {
      try {
        const list = JSON.parse(fb.feedback.student_feedbacks);
        const my = list.find(s => s.id === target.id);
        if (my) stuFeedback.value = { date: fb.feedback.class_date, text: my.text, images: my.images || [] };
      } catch(e) { logError('parseStudentFeedback', e); }
    }
  } catch (e) {
    logError('loadParentData', e);
  }
}
</script>

<style scoped>
.page { padding-bottom: 40rpx; min-height: 100vh; }
.welcome { text-align: center; padding: 240rpx 60rpx 0; }
.brand-icon { margin-bottom: 32rpx; display: flex; justify-content: center; }
.icon-book { width: 100rpx; height: 80rpx; border: 5rpx solid #1A365D; border-radius: 6rpx 12rpx 12rpx 6rpx; position: relative; }
.icon-book::after { content:''; position:absolute; left: 45rpx; top: 0; bottom: 0; width: 3rpx; background: #1A365D; }
.brand-name { font-size: 52rpx; font-weight: 800; color: #1A365D; letter-spacing: 8rpx; }
.welcome .gold-rule { width: 64rpx; margin: 24rpx auto; }
.brand-sub { font-size: 36rpx; color: #4A5568; margin-top: 12rpx; }
.brand-desc { font-size: 26rpx; color: #A0AEC0; margin: 16rpx 0 60rpx; letter-spacing: 12rpx; }
.login-btn { background: linear-gradient(180deg,#244271,#1A365D); color: #fff; border-radius: 14rpx; padding: 26rpx; font-size: 32rpx; width: 420rpx; margin: 0 auto; border: none; font-weight: 600; letter-spacing: 1rpx; display: block; }
.parent-btn { background: #fff; color: #1A365D; border: 1px solid #1A365D; border-radius: 12rpx; padding: 24rpx; font-size: 28rpx; width: 400rpx; margin: 24rpx auto 0; font-weight: 600; display: block; }

.teacher-hero { padding: 52rpx 32rpx 40rpx; }
.teacher-hero .gold-rule { margin: 16rpx 0; }
.hero-greeting { font-size: 38rpx; font-weight: 700; color: #fff; }
.hero-date { font-size: 24rpx; color: rgba(255,255,255,.72); margin-top: 4rpx; }

.action-row { display: flex; justify-content: space-around; }
.action-item { display: flex; flex-direction: column; align-items: center; gap: 12rpx; font-size: 24rpx; color: #4A5568; }
.action-icon { width: 80rpx; height: 80rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; font-size: 36rpx; }
.red-dot { position: absolute; top: -10rpx; right: -10rpx; min-width: 32rpx; height: 32rpx; background: #E53E3E; color: #fff; border-radius: 16rpx; font-size: 20rpx; display: flex; align-items: center; justify-content: center; padding: 0 6rpx; }

.child-switcher { display: flex; justify-content: center; gap: 12rpx; padding: 16rpx 30rpx; background: #fff; border-bottom: 1rpx solid #EDF2F7; }
.cs-chip { padding: 10rpx 24rpx; border-radius: 20rpx; font-size: 26rpx; background: #F0F0F0; color: #718096; }
.cs-chip.on { background: #1A365D; color: #fff; font-weight: 600; }
.parent-hero { text-align: center; padding: 52rpx 32rpx 40rpx; }
.parent-hero .gold-rule { margin: 16rpx auto; }
.child-avatar { width: 120rpx; height: 120rpx; border-radius: 50%; border: 3rpx solid #EDF2F7; margin-bottom: 16rpx; }
.child-greeting { font-size: 38rpx; font-weight: 700; color: #fff; }
.child-class { font-size: 26rpx; color: rgba(255,255,255,.72); margin-top: 4rpx; }
.fb-textarea { border: 1rpx solid #E2E8F0; border-radius: 10rpx; padding: 18rpx; font-size: 28rpx; width: 100%; min-height: 120rpx; box-sizing: border-box; margin-top: 8rpx; }

.status-card { display: flex; align-items: center; gap: 16rpx; }
.status-badge { padding: 10rpx 24rpx; border-radius: 20rpx; font-size: 28rpx; font-weight: 600; }
.status-badge.in { background: #EBF8F2; color: #38A169; }
.status-badge.out { background: #FEF5E7; color: #DD6B20; }
.status-time { font-size: 24rpx; color: #A0AEC0; }

.section-title { font-size: 28rpx; font-weight: 700; margin-bottom: 12rpx; color: #2D3748; letter-spacing: .02em; display: flex; justify-content: space-between; align-items: center; }
.card-hint { font-size: 22rpx; font-weight: 400; color: #A0AEC0; }
.class-item { padding: 14rpx 0; border-bottom: 1rpx solid #EDF2F7; display: flex; justify-content: space-between; align-items: center; }
.c-name { font-weight: 600; font-size: 28rpx; color: #2D3748; }
.c-meta { font-size: 24rpx; color: #A0AEC0; }

.sc-line { display: flex; align-items: center; padding: 14rpx 0; border-bottom: 1rpx solid #F0F0F0; gap: 16rpx; }
.sc-line:last-child { border-bottom: none; }
.sc-badge { background: #FFF7E6; color: #B7791F; font-size: 22rpx; padding: 6rpx 14rpx; border-radius: 6rpx; font-weight: 600; flex-shrink: 0; }
.sc-body { flex: 1; }
.sc-title { font-size: 28rpx; font-weight: 600; color: #2D3748; display: block; }
.sc-time { font-size: 24rpx; color: #A0AEC0; margin-top: 4rpx; }
.sc-arrow { font-size: 28rpx; color: #CBD5E0; }

.fb-box { background: #F7F8FA; border-radius: 10rpx; padding: 18rpx; margin-bottom: 12rpx; }
.fb-label { font-size: 22rpx; color: #D69E2E; font-weight: 600; display: block; margin-bottom: 6rpx; }
.fb-date { font-size: 24rpx; color: #A0AEC0; }
.fb-preview { font-size: 28rpx; color: #4A5568; display: -webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; margin-top: 4rpx; }
.fb-modal-body { max-height: 60vh; overflow-y: auto; }
.fb-full-text { font-size: 28rpx; color: #4A5568; line-height: 1.8; white-space: pre-wrap; }
.hw-card { background: #FEF5E7; border-radius: 10rpx; padding: 16rpx; font-size: 28rpx; color: #975A16; margin-top: 16rpx; }
.fb-imgs { display: flex; gap: 10rpx; flex-wrap: wrap; margin-top: 16rpx; }
.fb-thumb { width: 150rpx; height: 150rpx; border-radius: 8rpx; }

.profile-preview { display: flex; gap: 12rpx; flex-wrap: wrap; }

.hint { text-align: center; color: #A0AEC0; padding: 24rpx; font-size: 26rpx; }
.btn-outline { border: 1px solid #1A365D; color: #1A365D; background: #fff; border-radius: 10rpx; padding: 20rpx; font-size: 28rpx; width: 100%; font-weight: 600; }
.footer { text-align: center; color: #CBD5E0; font-size: 24rpx; padding: 40rpx 30rpx 30rpx; line-height: 1.6; }
.action-item text { font-size: 24rpx; color: #4A5568; }
.leave-list { margin-top: 20rpx; border-top: 1rpx solid #F0F0F0; padding-top: 16rpx; }
.leave-row { display: flex; justify-content: space-between; padding: 10rpx 0; font-size: 26rpx; }
.lv-date { color: #4A5568; }
.lv-status { color: #A0AEC0; }
.lv-status.pending { color: #D69E2E; }
.lv-status.approved { color: #38A169; }
.lv-status.rejected { color: #E53E3E; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 99; display: flex; align-items: flex-end; }
.modal { background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 30rpx; width: 100%; }
.modal-title { font-size: 32rpx; font-weight: 700; color: #1A365D; text-align: center; margin-bottom: 20rpx; }
.btn-cancel { background: #F7F8FA; color: #A0AEC0; border: none; padding: 20rpx; font-size: 28rpx; text-align: center; width: 100%; border-radius: 12rpx; margin-top: 12rpx; }
</style>
