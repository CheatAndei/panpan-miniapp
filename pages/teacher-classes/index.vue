<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">学员</view>
    <text class="hero-title">学习小组管理</text>
    <view class="gold-rule"></view>
    <text class="hero-sub num">{{ classes.length }} 个学习小组 · {{ totalStudents }} 名学生</text>
  </view>

  <view v-if="loading" class="loading">加载中…</view>

  <view v-for="c in classes" :key="c.id" class="card class-card">
    <view class="c-header" @tap="toggleClass(c)">
      <view>
        <text class="c-name">{{ c.name }}</text>
        <text class="c-meta">{{ c.grade }} · {{ c.subject }} · {{ c._students.length }}人</text>
      </view>
      <view class="c-actions">
        <text class="c-toggle">{{ c._open ? '收起' : '展开' }}</text>
        <text class="btn-xs" @tap.stop="editClass(c)">编辑</text>
        <text class="btn-xs del" @tap.stop="delClass(c.id)">删除</text>
      </view>
    </view>

    <view v-if="c._open">
      <view v-if="c._students.length>0" class="stu-list">
        <view v-for="s in c._students" :key="s.id" class="stu-row">
          <view class="stu-info">
            <pp-avatar :name="s.name" :size="56" class="s-avatar" />
            <text class="s-name" @tap.stop="openStudent(s)">{{ s.name }}</text>
            <text v-if="s.level" :class="['s-level',lvClass(s.level)]">{{ s.level }}</text>
          </view>
          <text class="s-code">邀请码: {{ s.invite_code }}</text>
          <text class="btn-xs del" @tap.stop="delStu(c,s.id)">×</text>
        </view>
      </view>
      <view v-else class="empty-sm">暂无学生</view>
      <button class="btn-add-stu" @tap="openAddStu(c)">+ 添加学生</button>
    </view>
  </view>

  <view class="create-wrap">
    <button class="btn-create" @tap="showAddClass=true">+ 新建学习小组</button>
  </view>

  <!-- 学习小组弹窗 -->
  <view v-if="showAddClass" class="modal-mask" @tap="showAddClass=false">
    <view class="modal" @tap.stop>
      <view class="modal-title">{{ editingId ? '编辑学习小组' : '新建学习小组' }}</view>
      <input v-model="cForm.name" class="input" placeholder="学习小组名称" />
      <picker :range="grades" @change="i=>cForm.grade=grades[i.detail.value]">
        <view class="input">{{ cForm.grade || '选择年级' }}</view>
      </picker>
      <picker :range="subjects" @change="i=>cForm.subject=subjects[i.detail.value]">
        <view class="input">{{ cForm.subject || '选择学科' }}</view>
      </picker>
      <button class="btn-primary" @tap="createClass">确认</button>
      <button class="btn-cancel" @tap="showAddClass=false">取消</button>
    </view>
  </view>

  <!-- 学生弹窗 -->
  <view v-if="showStu" class="modal-mask" @tap="showStu=false">
    <view class="modal modal-wide" @tap.stop>
      <view class="modal-title">添加学生 — {{ activeClass?.name }}</view>
      <input v-model="sForm.name" class="input" placeholder="学生姓名" />
      <view class="label">性别</view>
      <view class="gender-row">
        <text :class="['gender-btn',{on:sForm.gender==='boy'}]" @tap="sForm.gender='boy'">男孩</text>
        <text :class="['gender-btn',{on:sForm.gender==='girl'}]" @tap="sForm.gender='girl'">女孩</text>
      </view>
      <view class="label">成绩水平</view>
      <view class="level-btns">
        <text v-for="lv in ['下','中下','中','中上','好']" :key="lv"
          :class="['lv-btn',{on:sForm.level===lv}]" @tap="sForm.level=lv">{{ lv }}</text>
      </view>
      <view class="label">性格描述（多选，最多8个）</view>
      <view class="trait-cats">
        <view v-for="cat in cats" :key="cat.name" class="trait-group">
          <view class="cat-head" @tap="toggleCat(cat.name)">
            <text class="cat-label">{{ cat.name }}</text>
            <text class="cat-meta">{{ countCat(cat) }} 个已选 · {{ traitOpen[cat.name] ? '收起' : '展开' }}</text>
          </view>
          <view v-if="traitOpen[cat.name]" class="cat-traits">
            <text v-for="t in cat.traits" :key="t"
              :class="['trait-tag',{on:sForm.traits.has(t)}]"
              @tap="toggleTrait(t)">{{ t }}</text>
          </view>
        </view>
      </view>
      <view v-if="sForm.traits.size>0" class="selected">
        <text v-for="t in [...sForm.traits]" :key="t" class="stag">{{ t }} <text class="del-tag" @tap="toggleTrait(t)">×</text></text>
      </view>
      <button class="btn-primary" @tap="createStu">确认</button>
      <button class="btn-cancel" @tap="showStu=false">取消</button>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { toastError, logError } from '@/utils/ui';
import { PERSONALITY_CATEGORIES } from '@/utils/traits';

const grades = ['一年级','二年级','三年级','四年级','五年级','六年级','初一','初二','初三','高一','高二','高三'];
const subjects = ['数学','物理'];

export default {
  data() {
    return {
      classes: [], totalStudents: 0, loading: false,
      grades, subjects,
      showAddClass: false, showStu: false,
      activeClass: null,
      cForm: { name:'', grade:'', subject:'' }, editingId: null,
      sForm: { name:'', level:'', traits: new Set() },
      cats: PERSONALITY_CATEGORIES,
      traitOpen: {}
    };
  },
  onShow() { this.loadData(); },
  methods: {
    lvClass(lv) {
      const m = { '好':'lv-a','中上':'lv-b','中':'lv-c','中下':'lv-d','下':'lv-e' };
      return m[lv] || '';
    },
    async loadData() {
      const t = uni.getStorageSync('token'); if (!t) return;
      this.loading = true;
      try {
        const res = await api.get('/classes');
        const classes = (res.classes || []).map(c => ({ ...c, _open: false, _students: [] }));
        // 并行加载各小组学生（原为逐组串行 await 的瀑布）
        await Promise.all(classes.map(async c => {
          try {
            const s = await api.get('/students?class_id='+c.id);
            c._students = s.students || [];
          } catch(e) { logError('class.students', e); }
        }));
        this.classes = classes;
        this.totalStudents = classes.reduce((n,c)=>n+c._students.length, 0);
      } catch(e) { logError('classes.loadData', e); }
      finally { this.loading = false; }
    },
    toggleClass(c) { c._open = !c._open; },
    editClass(c){ this.editingId=c.id; this.cForm={name:c.name,grade:c.grade,subject:c.subject}; this.showAddClass=true; },
    async createClass() {
      if (!this.cForm.name) return uni.showToast({ title:'请输入学习小组名称', icon:'none' });
      try {
        if (this.editingId) {
          await api.put('/classes/'+this.editingId, this.cForm);
        } else {
          await api.post('/classes', this.cForm);
        }
        this.showAddClass=false; this.editingId=null; this.cForm={name:'',grade:'',subject:''}; this.loadData();
      }
      catch(e) { toastError(e, '操作失败'); }
    },
    async delClass(id) {
      const r = await new Promise(r=>uni.showModal({title:'确认删除',success:r}));
      if (!r.confirm) return;
      try { await api.del('/classes/'+id); this.loadData(); }
      catch(e) { toastError(e, '删除失败'); }
    },
    openAddStu(c) { this.activeClass=c; this.sForm={name:'',gender:'boy',level:'',traits:new Set()}; this.traitOpen={}; this.showStu=true; },
    toggleCat(name){ this.traitOpen={...this.traitOpen,[name]:!this.traitOpen[name]}; },
    countCat(cat){ return cat.traits.filter(t=>this.sForm.traits.has(t)).length; },
    toggleTrait(t) {
      if (this.sForm.traits.has(t)) { this.sForm.traits.delete(t); return; }
      if (this.sForm.traits.size>=8) return;
      this.sForm.traits.add(t);
    },
    async createStu() {
      if (!this.sForm.name) return uni.showToast({ title:'请输入姓名', icon:'none' });
      try {
        await api.post('/students', {
          class_id: this.activeClass.id, name: this.sForm.name,
          level: this.sForm.level, gender: this.sForm.gender,
          personality: [...this.sForm.traits].join('、')
        });
        this.showStu=false; this.loadData();
      } catch(e) { toastError(e, '添加失败'); }
    },
    openStudent(s){ uni.navigateTo({ url: '/pages/student-detail/index?id='+s.id }); },
    async delStu(c, sid) {
      try { await api.del('/students/'+sid); this.loadData(); }
      catch(e) { toastError(e, '删除失败'); }
    }
  }
};
</script>

<style scoped>
.page { padding-bottom: 96rpx; background:#F4F5F2; min-height:100vh; }
.hero {
  padding: 42rpx 38rpx 34rpx;
  background: #FBFAF7;
  border-bottom: 1rpx solid #E5E0D8;
}
.hero .eyebrow { color:#8D6A3F; letter-spacing:1rpx; }
.hero .gold-rule { width:44rpx; height:3rpx; margin:14rpx 0; background:#A57945; }
.hero-title { font-size: 38rpx; font-weight:700; color:#202733; display:block; }
.hero-sub { font-size: 24rpx; color:#69717D; margin-top:4rpx; }

.class-card {
  margin: 18rpx 24rpx;
  padding: 0;
  background:#FFFFFF;
  border:1rpx solid #E5E0D8;
  border-radius:18rpx;
  box-shadow:0 6rpx 18rpx rgba(36,42,50,.045);
  overflow:hidden;
}
.c-header { display:flex; justify-content:space-between; align-items:center; padding:26rpx 28rpx; gap:20rpx; }
.c-header > view:first-child { min-width:0; flex:1; }
.c-name { font-size:30rpx; font-weight:700; color:#202733; display:block; margin-bottom:6rpx; }
.c-meta { font-size:24rpx; color:#69717D; display:block; margin-left:0; }
.c-actions { display:flex; align-items:center; gap:8rpx; flex-shrink:0; }
.c-toggle { font-size:24rpx; color:#8A929B; margin-right:4rpx; }

.stu-list { border-top:1rpx solid #ECE8E0; margin:0 28rpx; padding:10rpx 0; }
.stu-row { display:flex; align-items:center; padding:14rpx 0; border-bottom:1rpx solid #F0ECE5; }
.stu-row:last-child { border-bottom:none; }
.stu-info { flex:1; display:flex; align-items:center; gap:10rpx; }
.s-name { font-weight:600; font-size:28rpx; }
.s-avatar { width:56rpx; height:56rpx; border-radius:50%; flex-shrink:0; }
.s-level { font-size:20rpx; padding:2rpx 10rpx; border-radius:6rpx; }
.lv-a { background:#EEF5EF; color:#3F8B65; }
.lv-b { background:#EFF3F2; color:#52707E; }
.lv-c { background:#F7F2E5; color:#A57945; }
.lv-d { background:#F7EDEA; color:#A66A3E; }
.lv-e { background:#F7EDEA; color:#B85C4E; }
.s-code { font-size:22rpx; color:#A57945; margin-right:8rpx; }

.btn-xs { padding:6rpx 12rpx; font-size:22rpx; color:#69717D; border-radius:8rpx; background:#F8F6F1; }
.btn-xs.del { color:#B85C4E; }
.btn-add-stu { margin:10rpx 28rpx 26rpx; padding:16rpx; font-size:24rpx; background:#F8F6F1; color:#202733; border:1rpx solid #E5E0D8; border-radius:12rpx; width:auto; }
.empty-sm { text-align:center; color:#8A929B; padding:28rpx; font-size:24rpx; }

.create-wrap { padding: 8rpx 24rpx 0; }
.btn-create {
  background:#F7F1E7;
  color:#202733;
  border:1rpx solid #E2D3BF;
  border-radius:14rpx;
  padding:22rpx;
  font-size:30rpx;
  font-weight:700;
  width:100%;
}
.btn-primary { background:#202733; color:#fff; border-radius:12rpx; padding:24rpx; font-size:30rpx; text-align:center; border:none; width:100%; margin-top:20rpx; }
.btn-cancel { background:#fff; color:#8A929B; border:none; padding:16rpx; font-size:26rpx; text-align:center; width:100%; }

.modal-mask { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:99; display:flex; align-items:flex-end; }
.modal { background:#fff; border-radius:24rpx 24rpx 0 0; padding:30rpx; width:100%; max-height:80vh; overflow-y:auto; }
.modal-wide { max-height:85vh; }
.modal-title { font-size:34rpx; font-weight:700; text-align:center; margin-bottom:24rpx; color:#202733; }
.input { border:1rpx solid #E1DDD4; border-radius:10rpx; padding:18rpx; margin-bottom:16rpx; font-size:28rpx; color:#46515C; }
.label { font-size:26rpx; color:#46515C; margin:12rpx 0 8rpx; font-weight:600; }

.level-btns { display:flex; gap:12rpx; margin-bottom:12rpx; }
.lv-btn { flex:1; text-align:center; padding:14rpx 0; border:2rpx solid #E1DDD4; border-radius:10rpx; font-size:26rpx; color:#8A929B; }
.lv-btn.on { border-color:#202733; background:#F3F1EA; color:#202733; font-weight:700; }

.gender-row { display:flex; gap:12rpx; margin-bottom:12rpx; }
.gender-btn { flex:1; text-align:center; padding:14rpx 0; border:2rpx solid #E1DDD4; border-radius:10rpx; font-size:26rpx; color:#8A929B; }
.gender-btn.on { border-color:#202733; background:#F3F1EA; color:#202733; font-weight:700; }

.trait-group { margin-bottom:12rpx; }
.cat-head{display:flex;justify-content:space-between;align-items:center;background:#F8F6F1;border:1rpx solid #E5E0D8;border-radius:10rpx;padding:16rpx 18rpx}
.cat-label { font-size:24rpx; font-weight:700; color:#202733; display:block; }
.cat-meta{font-size:22rpx;color:#8A929B}
.cat-traits { display:flex; flex-wrap:wrap; gap:8rpx; }
.trait-tag { padding:6rpx 14rpx; border:1rpx solid #E1DDD4; border-radius:20rpx; font-size:22rpx; color:#69717D; }
.trait-tag.on { border-color:#202733; background:#F3F1EA; color:#202733; font-weight:600; }
.selected { display:flex; flex-wrap:wrap; gap:8rpx; margin:12rpx 0; }
.stag { background:#F3F1EA; color:#202733; font-size:22rpx; padding:4rpx 12rpx; border-radius:14rpx; }
.del-tag { color:#B85C4E; font-weight:700; margin-left:4rpx; }
</style>
