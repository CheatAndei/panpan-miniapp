<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">学员</view>
    <view class="hero-title-line">
      <pp-icon name="users" :size="34" motion="pop" />
      <text class="hero-title">学习小组管理</text>
    </view>
    <text class="hero-sub num">{{ classes.length }} 个学习小组 · {{ totalStudents }} 名学生</text>
  </view>

  <view v-if="loading && classes.length===0" class="state-card"><pp-state type="loading" title="正在整理学习小组" /></view>
  <view v-else-if="error && classes.length===0" class="state-card"><pp-state type="error" title="学习小组加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>
  <view v-else-if="classes.length===0" class="state-card"><pp-state title="还没有学习小组" description="先创建小组，再添加学生。" action-text="新建小组" @action="openCreateClass" /></view>

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
        <view v-for="s in c._students" :key="s.id" class="stu-row" @tap="openStudent(s)">
          <view class="stu-info">
            <pp-avatar :name="s.name" :size="56" class="s-avatar" />
            <view class="stu-main">
              <view class="stu-title-row">
                <text class="s-name">{{ s.name }}</text>
                <text v-if="s.level" :class="['s-level',lvClass(s.level)]">{{ s.level }}</text>
              </view>
              <view class="parent-line">
                <text :class="['parent-bind', parentCount(s)>0?'on':'off']">{{ parentLabel(s) }}</text>
                <text class="parent-names">{{ parentNames(s) || '等待家长绑定邀请码' }}</text>
              </view>
            </view>
          </view>
          <view class="stu-actions">
            <text class="btn-xs copy" @tap.stop="copyInviteCode(s.invite_code)">复制</text>
            <button
              class="btn-xs share share-btn"
              open-type="share"
              :data-student-name="s.name"
              :data-invite-code="s.invite_code"
              @tap.stop
            >分享</button>
            <text class="s-code" @tap.stop="copyInviteCode(s.invite_code)">邀请码: {{ s.invite_code }}</text>
            <text class="btn-xs del" @tap.stop="delStu(c,s)">删除</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-sm">暂无学生</view>
      <button class="btn-add-stu" @tap="openAddStu(c)"><pp-icon name="plus" :size="34" />添加学生</button>
      <button class="btn-transfer-stu" :disabled="!c._students.length || classes.length<2" @tap="openTransfer(c)">
        <pp-icon name="users" :size="32" />迁移学生
      </button>
    </view>
  </view>

  <view class="create-wrap">
    <button class="btn-create" @tap="openCreateClass"><pp-icon name="plus" :size="38" motion="pop" />新建学习小组</button>
  </view>

  <!-- 学习小组弹窗 -->
  <view v-if="showAddClass" class="modal-mask" @tap="closeClassModal">
    <view class="modal" @tap.stop>
      <view class="modal-title">{{ editingId ? '编辑学习小组' : '新建学习小组' }}</view>
      <text class="field-label">学习小组名称</text>
      <input v-model="cForm.name" class="input" placeholder="学习小组名称" />
      <text class="field-label">年级</text>
      <picker :range="grades" @change="i=>cForm.grade=grades[i.detail.value]">
        <view class="input">{{ cForm.grade || '选择年级' }}</view>
      </picker>
      <text class="field-label">学科</text>
      <picker :range="subjects" @change="i=>cForm.subject=subjects[i.detail.value]">
        <view class="input">{{ cForm.subject || '选择学科' }}</view>
      </picker>
      <button class="btn-primary" :disabled="savingClass" @tap="createClass">{{ savingClass ? '保存中...' : '保存学习小组' }}</button>
      <button class="btn-cancel" @tap="closeClassModal">取消</button>
    </view>
  </view>

  <!-- 学生弹窗 -->
  <view v-if="showStu" class="modal-mask" @tap="showStu=false">
    <view class="modal modal-wide" @tap.stop>
      <view class="modal-title">添加学生 - {{ activeClass?.name }}</view>
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
          <view v-for="cat in displayCats" :key="cat.name" class="trait-group">
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
      <button class="btn-primary" :disabled="savingStudent" @tap="createStu">{{ savingStudent ? '添加中...' : '添加学生' }}</button>
      <button class="btn-cancel" @tap="showStu=false">取消</button>
    </view>
  </view>

  <!-- 学生迁移弹窗 -->
  <view v-if="showTransfer" class="modal-mask" @tap="closeTransfer">
    <view class="modal" @tap.stop>
      <view class="modal-title">迁移学生</view>
      <view class="transfer-note">迁移只改变学生当前学习小组，历史反馈、作业、错题、签到和家长绑定都会保留。</view>
      <text class="field-label">从 {{ activeClass?.name }} 迁出</text>
      <picker :range="activeClass?._students || []" range-key="name" :value="transferStudentIndex" @change="selectTransferStudent">
        <view class="input picker-input">{{ selectedTransferStudent?.name || '选择学生' }}<text>›</text></view>
      </picker>
      <text class="field-label">迁入学习小组</text>
      <picker :range="transferTargets" range-key="name" :value="transferTargetIndex" @change="selectTransferTarget">
        <view class="input picker-input">{{ selectedTransferTarget?.name || '选择目标学习小组' }}<text>›</text></view>
      </picker>
      <text class="field-label">迁移原因（选填）</text>
      <input v-model="transferForm.reason" class="input" maxlength="120" placeholder="如：暑期转入新班" />
      <button class="btn-primary" :disabled="savingTransfer || !selectedTransferStudent || !selectedTransferTarget" @tap="transferStudent">
        {{ savingTransfer ? '迁移中…' : '确认迁移并保留历史' }}
      </button>
      <button class="btn-cancel" @tap="closeTransfer">取消</button>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { confirmAction, toastError, logError } from '@/utils/ui';
import { PERSONALITY_CATEGORIES } from '@/utils/traits';

const grades = ['一年级','二年级','三年级','四年级','五年级','六年级','初一','初二','初三','高一','高二','高三'];
const subjects = ['数学','物理','语文','英语','化学'];

export default {
  data() {
    return {
      classes: [], totalStudents: 0, loading: false, error:'',
      grades, subjects,
      showAddClass: false, showStu: false, showTransfer: false,
      activeClass: null,
      cForm: { name:'', grade:'', subject:'' }, editingId: null,
      sForm: { name:'', level:'', traits: new Set() },
      cats: PERSONALITY_CATEGORIES,
      traitOpen: {}, savingClass:false, savingStudent:false, savingTransfer:false,
      transferForm:{student_id:'',target_class_id:'',reason:''}
    };
  },
  onShow() { this.loadData(); },
  onShareAppMessage(event) {
    const dataset = event?.target?.dataset || {};
    const inviteCode = dataset.inviteCode || '';
    const studentName = dataset.studentName || '孩子';
    if (!inviteCode) {
      return {
        title: '番番记录',
        path: '/pages/index/index'
      };
    }
    return {
      title: `绑定${studentName}的番番记录`,
      path: `/pages/bind/bind?code=${encodeURIComponent(inviteCode)}`
    };
  },
  methods: {
    lvClass(lv) {
      const m = { '好':'lv-a','中上':'lv-b','中':'lv-c','中下':'lv-d','下':'lv-e' };
      return m[lv] || '';
    },
    async loadData() {
      const t = uni.getStorageSync('token'); if (!t) return;
      if (this.loading) return;
      this.loading = true;
      this.error = '';
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
      } catch(e) { this.error=e?.error||'请检查网络后重试';logError('classes.loadData', e); }
      finally { this.loading = false; }
    },
    toggleClass(c) { c._open = !c._open; },
    openCreateClass(){this.editingId=null;this.cForm={name:'',grade:'',subject:''};this.showAddClass=true;},
    closeClassModal(){this.showAddClass=false;this.editingId=null;this.cForm={name:'',grade:'',subject:''};},
    editClass(c){ this.editingId=c.id; this.cForm={name:c.name,grade:c.grade,subject:c.subject}; this.showAddClass=true; },
    async createClass() {
      if (this.savingClass) return;
      if (!this.cForm.name.trim()) return uni.showToast({ title:'请输入学习小组名称', icon:'none' });
      this.savingClass=true;
      try {
        const payload={...this.cForm,name:this.cForm.name.trim()};
        if (this.editingId) {
          await api.put('/classes/'+this.editingId, payload);
        } else {
          await api.post('/classes', payload);
        }
        this.closeClassModal(); await this.loadData();
      }
      catch(e) { toastError(e, '操作失败'); }
      finally{this.savingClass=false;}
    },
    async delClass(id) {
      const confirmed=await confirmAction({title:'删除学习小组',content:'删除后无法恢复，请确认小组内没有需要保留的记录。',confirmText:'删除',danger:true});
      if (!confirmed) return;
      try { await api.del('/classes/'+id); await this.loadData(); }
      catch(e) { toastError(e, '删除失败'); }
    },
    openAddStu(c) { this.activeClass=c; this.sForm={name:'',gender:'boy',level:'',traits:new Set()}; this.traitOpen={}; this.showStu=true; },
    openTransfer(c) {
      if (!c._students.length) return uni.showToast({ title:'该小组没有可迁移学生', icon:'none' });
      const target=this.classes.find(item=>Number(item.id)!==Number(c.id));
      if (!target) return uni.showToast({ title:'请先创建另一个学习小组', icon:'none' });
      this.activeClass=c;
      this.transferForm={student_id:c._students[0].id,target_class_id:target.id,reason:''};
      this.showTransfer=true;
    },
    closeTransfer(){if(this.savingTransfer)return;this.showTransfer=false;this.transferForm={student_id:'',target_class_id:'',reason:''};},
    selectTransferStudent(event){this.transferForm.student_id=this.activeClass?._students[Number(event.detail.value)]?.id||'';},
    selectTransferTarget(event){this.transferForm.target_class_id=this.transferTargets[Number(event.detail.value)]?.id||'';},
    async transferStudent(){
      if(this.savingTransfer||!this.selectedTransferStudent||!this.selectedTransferTarget)return;
      const confirmed=await confirmAction({
        title:'确认迁移学生',
        content:`将 ${this.selectedTransferStudent.name} 从“${this.activeClass.name}”迁移到“${this.selectedTransferTarget.name}”？历史数据和家长绑定会保留。`,
        confirmText:'确认迁移'
      });
      if(!confirmed)return;
      this.savingTransfer=true;
      try{
        await api.post(`/students/${this.selectedTransferStudent.id}/transfer`,{
          target_class_id:this.selectedTransferTarget.id,
          reason:this.transferForm.reason.trim()
        });
        this.showTransfer=false;
        this.transferForm={student_id:'',target_class_id:'',reason:''};
        await this.loadData();
        uni.showToast({title:'学生已迁移',icon:'success'});
      }catch(e){toastError(e,'迁移失败');}
      finally{this.savingTransfer=false;}
    },
    toggleCat(name){ this.traitOpen={...this.traitOpen,[name]:!this.traitOpen[name]}; },
    countCat(cat){ return cat.traits.filter(t=>this.sForm.traits.has(t)).length; },
    parentCount(s){return Number(s.parent_count||0);},
    parentLabel(s){const n=this.parentCount(s); return n>0 ? '已绑定 '+n+'/3' : '未绑定';},
    parentNames(s){return (s.parent_names||'').trim();},
    toggleTrait(t) {
      if (this.sForm.traits.has(t)) { this.sForm.traits.delete(t); return; }
      if (this.sForm.traits.size>=8) return;
      this.sForm.traits.add(t);
    },
    async createStu() {
      if(this.savingStudent)return;
      if (!this.sForm.name.trim()) return uni.showToast({ title:'请输入姓名', icon:'none' });
      if(!this.activeClass?.id)return uni.showToast({title:'请重新选择学习小组',icon:'none'});
      this.savingStudent=true;
      try {
        const created=await api.post('/students', {
          class_id: this.activeClass.id, name: this.sForm.name.trim(),
          level: this.sForm.level, gender: this.sForm.gender,
          personality: [...this.sForm.traits].join('、')
        });
        if(created.student)this.activeClass._students.push(created.student);
        this.totalStudents+=1;
        const lastGender=this.sForm.gender;
        this.sForm={name:'',gender:lastGender,level:'',traits:new Set()};
        this.traitOpen={};
        uni.showToast({title:'已添加，可继续添加',icon:'success'});
      } catch(e) { toastError(e, '添加失败'); }
      finally{this.savingStudent=false;}
    },
    copyInviteCode(code) {
      if (!code) return uni.showToast({ title:'暂无邀请码', icon:'none' });
      uni.setClipboardData({
        data: code,
        success: () => uni.showToast({ title:'已复制', icon:'success' }),
        fail: () => uni.showToast({ title:'复制失败', icon:'none' })
      });
    },
    openStudent(s){ uni.navigateTo({ url: '/pages/student-detail/index?id='+s.id }); },
    async delStu(c, student) {
      const confirmed=await confirmAction({
        title:`删除${student.name}`,
        content:`确认删除“${student.name}”？教师端和家长端将停止显示，历史学习记录仍保留在服务器。`,
        confirmText:'确认删除',
        danger:true
      });
      if(!confirmed)return;
      try {
        await api.del('/students/'+student.id);
        c._students=c._students.filter(s=>s.id!==student.id);
        this.totalStudents=Math.max(0,this.totalStudents-1);
        uni.showToast({title:'已删除，历史记录仍保留',icon:'none'});
      }
      catch(e) { toastError(e, '删除失败'); }
    }
  },
  computed:{
    transferTargets(){return this.classes.filter(item=>Number(item.id)!==Number(this.activeClass?.id));},
    selectedTransferStudent(){return this.activeClass?._students?.find(item=>Number(item.id)===Number(this.transferForm.student_id))||null;},
    selectedTransferTarget(){return this.transferTargets.find(item=>Number(item.id)===Number(this.transferForm.target_class_id))||null;},
    transferStudentIndex(){return Math.max(0,(this.activeClass?._students||[]).findIndex(item=>Number(item.id)===Number(this.transferForm.student_id)));},
    transferTargetIndex(){return Math.max(0,this.transferTargets.findIndex(item=>Number(item.id)===Number(this.transferForm.target_class_id)));},
    displayCats(){
      const used=new Set();
      return this.cats.map(cat=>({
        ...cat,
        traits:cat.traits.filter(trait=>{
          if(used.has(trait))return false;
          used.add(trait);
          return true;
        })
      })).filter(cat=>cat.traits.length>0);
    }
  }
};
</script>

<style scoped>
/* Teacher operations theme: compact, ruled-paper, and scan first. */
.page {
  min-height: 100vh;
  padding-bottom: calc(112rpx + env(safe-area-inset-bottom));
  color: var(--ink);
  background-color: var(--page-bg);
}
.hero {
  padding: 30rpx 28rpx 24rpx;
  border-bottom: 6rpx solid var(--primary);
  box-shadow: none;
  animation: none;
}
.hero::after {
  top: 0;
  right: 28rpx;
  bottom: auto;
  width: 104rpx;
  height: 8rpx;
  border-radius: 0 0 4rpx 4rpx;
  background: var(--gold);
}
.hero .eyebrow {
  color: var(--primary-strong);
  letter-spacing: 0;
}
.hero .gold-rule { display: none; }
.hero-title {
  display: block;
  margin-top: 6rpx;
  color: var(--ink);
  font-size: 38rpx;
  font-weight: 760;
}
.hero-sub {
  display: block;
  margin-top: 4rpx;
  color: var(--text-secondary);
  font-size: 23rpx;
}
.state-card {
  margin: 16rpx 20rpx;
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  background: var(--surface);
  box-shadow: none;
}
.class-card {
  position: relative;
  margin: 14rpx 20rpx;
  padding: 0;
  overflow: hidden;
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  background: var(--surface);
  box-shadow: none;
}
.class-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 5rpx;
  height: auto;
  border-radius: 0;
  background: var(--primary);
  content: "";
  pointer-events: none;
}
.c-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76rpx;
  padding: 20rpx 20rpx 18rpx 24rpx;
  gap: 14rpx;
}
.c-header > view:first-child {
  min-width: 0;
  flex: 1;
}
.c-name {
  display: block;
  margin-bottom: 3rpx;
  color: var(--ink);
  font-size: 29rpx;
  font-weight: 720;
}
.c-meta {
  display: block;
  color: var(--text-secondary);
  font-size: 22rpx;
}
.c-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: nowrap;
  gap: 6rpx;
}
.c-toggle {
  margin-right: 2rpx;
  color: var(--primary-strong);
  font-size: 22rpx;
  font-weight: 650;
}
.stu-list {
  margin: 0 20rpx;
  padding: 0;
  border-top: 1rpx solid var(--hairline);
}
.stu-row {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 82rpx;
  padding: 42rpx 0 14rpx;
  gap: 12rpx;
  border-bottom: 1rpx solid var(--hairline);
}
.stu-info {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 12rpx;
}
.stu-main {
  min-width: 0;
  flex: 1;
}
.stu-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8rpx;
}
.s-avatar {
  width: 52rpx;
  height: 52rpx;
  flex-shrink: 0;
}
.s-name {
  color: var(--ink);
  font-size: 27rpx;
  font-weight: 680;
  word-break: break-all;
}
.s-level {
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  font-size: 19rpx;
}
.lv-a,
.lv-b { background: var(--success-soft); color: var(--success); }
.lv-c { background: var(--gold-soft); color: var(--warning); }
.lv-d,
.lv-e { background: var(--coral-soft); color: var(--danger); }
.parent-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6rpx;
  margin-top: 4rpx;
}
.parent-bind {
  padding: 2rpx 9rpx;
  border-radius: 6rpx;
  font-size: 20rpx;
}
.parent-bind.on { background: var(--success-soft); color: var(--success); }
.parent-bind.off { background: var(--coral-soft); color: var(--danger); }
.parent-names {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.s-code {
  position: absolute;
  top: 12rpx;
  right: 0;
  max-width: 250rpx;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stu-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6rpx;
  flex-wrap: nowrap;
}
.btn-xs {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44rpx;
  padding: 2rpx 11rpx;
  border: 1rpx solid var(--border);
  border-radius: 7rpx;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 21rpx;
  line-height: 1.35;
}
.btn-xs.copy,
.btn-xs.share {
  border-color: #D7E7DE;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.btn-xs.del {
  border-color: #F2C4C0;
  background: var(--coral-soft);
  color: var(--danger);
}
.share-btn {
  min-height: 44rpx;
  margin: 0;
  border: 0;
}
.empty-sm {
  padding: 24rpx;
  color: var(--text-muted);
  font-size: 23rpx;
}
.btn-add-stu,
.btn-transfer-stu {
  display: flex;
  width: auto;
  align-items: center;
  justify-content: center;
  min-height: 68rpx;
  margin: 10rpx 20rpx 0;
  padding: 10rpx 16rpx;
  border-radius: 9rpx;
  font-size: 23rpx;
  font-weight: 650;
}
.btn-transfer-stu[disabled] { opacity: .42; }
.btn-add-stu {
  border: 1rpx solid #D7E7DE;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.btn-transfer-stu {
  margin-bottom: 18rpx;
  border: 1rpx solid #B8DDCD;
  background: var(--gold-soft);
  color: var(--warning);
}
.create-wrap {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 12rpx 20rpx calc(12rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border);
  background: rgba(248, 252, 249, .98);
  backdrop-filter: none;
}
.btn-create {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-height: 84rpx;
  border: 0;
  border-radius: 11rpx;
  background: var(--primary-strong);
  color: #FFFFFF;
  box-shadow: none;
  font-size: 28rpx;
}
.modal-mask {
  position: fixed;
  z-index: 99;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(38, 53, 47, .44);
}
.modal {
  width: 100%;
  max-height: 88vh;
  overflow-y: auto;
  padding: 28rpx 26rpx calc(28rpx + env(safe-area-inset-bottom));
  border: 1rpx solid var(--border);
  border-radius: 18rpx 18rpx 0 0;
  background: var(--surface);
  animation: none;
  box-sizing: border-box;
}
.modal-wide { max-height: 90vh; }
.modal-title {
  margin-bottom: 22rpx;
  color: var(--ink);
  font-size: 31rpx;
  text-align: left;
}
.field-label,
.label {
  margin: 18rpx 0 8rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
  font-weight: 650;
}
.input {
  width: 100%;
  min-height: 82rpx;
  margin-bottom: 16rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--border);
  border-radius: 9rpx;
  background: #F8FCF9;
  color: var(--ink);
  font-size: 28rpx;
  line-height: 82rpx;
  box-sizing: border-box;
}
.picker-input {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.gender-row,
.level-btns {
  display: flex;
  gap: 10rpx;
  margin-bottom: 16rpx;
}
.gender-btn,
.lv-btn,
.trait-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48rpx;
  border: 1rpx solid var(--border);
  border-radius: 8rpx;
  background: var(--surface);
  color: var(--text-secondary);
}
.gender-btn,
.lv-btn {
  flex: 1;
  padding: 14rpx 0;
  font-size: 26rpx;
  line-height: 48rpx;
  text-align: center;
}
.gender-btn.on,
.lv-btn.on,
.trait-tag.on {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.cat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 16rpx;
  border: 1rpx solid var(--border);
  border-radius: 9rpx;
  background: var(--surface-muted);
}
.cat-label {
  color: var(--ink);
  font-size: 25rpx;
}
.cat-meta {
  color: var(--text-muted);
  font-size: 21rpx;
  white-space: nowrap;
}
.trait-group { margin-bottom: 12rpx; }
.cat-traits {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  padding-top: 10rpx;
}
.trait-tag {
  padding: 8rpx 13rpx;
  font-size: 23rpx;
}
.stag {
  padding: 6rpx 11rpx;
  border-radius: 7rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 22rpx;
}
.selected {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin: 14rpx 0;
}
.del-tag {
  margin-left: 4rpx;
  color: var(--danger);
  font-weight: 700;
}
.transfer-note {
  padding: 14rpx 16rpx;
  border-left: 5rpx solid var(--gold);
  border-radius: 6rpx;
  background: var(--gold-soft);
  color: var(--text-secondary);
}
.btn-primary {
  width: 100%;
  min-height: 88rpx;
  margin-top: 18rpx;
  border: 0;
  border-radius: 10rpx;
  background: var(--primary-strong);
  color: #FFFFFF;
  box-shadow: none;
  font-size: 28rpx;
}
.btn-cancel {
  width: 100%;
  min-height: 72rpx;
  border: 0;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 24rpx;
  text-align: center;
}
.btn-primary[disabled],
.btn-create[disabled] { opacity: .5; }
.btn-create::after,
.btn-primary::after,
.btn-cancel::after,
.btn-add-stu::after,
.btn-transfer-stu::after { border: 0; }

.c-header,
.stu-row,
.btn-xs,
.btn-add-stu,
.btn-transfer-stu,
.btn-create,
.btn-primary,
.btn-cancel,
.gender-btn,
.lv-btn,
.trait-tag,
.cat-head {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}
.c-header:active,
.stu-row:active,
.btn-xs:active,
.btn-add-stu:active,
.btn-transfer-stu:active,
.btn-create:active,
.btn-primary:active,
.btn-cancel:active,
.gender-btn:active,
.lv-btn:active,
.trait-tag:active,
.cat-head:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}

@media (prefers-reduced-motion: reduce) {
  .c-header,
  .stu-row,
  .btn-xs,
  .btn-add-stu,
  .btn-transfer-stu,
  .btn-create,
  .btn-primary,
  .btn-cancel,
  .gender-btn,
  .lv-btn,
  .trait-tag,
  .cat-head {
    transition: none !important;
  }
}

/* Teacher operations theme: bright learning studio v2. */
.page {
  --primary: #20B486;
  --primary-strong: #15946D;
  --primary-soft: #E7F8F1;
  --accent: #20B486;
  --accent-strong: #15946D;
  --accent-soft: #E7F8F1;
  --success: #15946D;
  --success-soft: #E7F8F1;
  --gold: #20B486;
  --gold-soft: #E7F8F1;
  --warning: #15946D;
  --warning-soft: #E7F8F1;
  --coral: #FF7468;
  --coral-soft: #FFF0EE;
  --danger: #D94B45;
  --danger-soft: #FFF0EE;
  --info: #20B486;
  --info-soft: #E7F8F1;
  --ink: #26352F;
  --text-secondary: #5A6A62;
  --text-muted: #5A6A62;
  --page-bg: #F8FCF9;
  --surface: #FFFFFF;
  --surface-muted: #F1F8F4;
  --border: #D7E7DE;
  --hairline: #E6F0EA;
  background-color: #F8FCF9;
  background-image: repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(32, 180, 134, .035) 64rpx 65rpx);
}
.page {
  box-sizing: border-box;
  letter-spacing: 0;
}
.hero {
  position: relative;
  padding: 28rpx 28rpx 22rpx 36rpx;
  border: 0;
  border-bottom: 1rpx solid #D7E7DE;
  background: #FFFFFF !important;
}
.hero::before {
  position: absolute;
  top: 22rpx;
  bottom: 22rpx;
  left: 20rpx;
  width: 6rpx;
  border-radius: 3rpx;
  background: #20B486;
  content: "";
}
.hero::after {
  top: 0;
  right: 28rpx;
  width: 112rpx;
  height: 8rpx;
  background: #20B486;
}
.hero .eyebrow { color: #15946D; }
.hero-title-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 6rpx;
}
.hero-title { margin-top: 0; color: #26352F; }
.hero-sub { color: #5A6A62; }
.state-card,
.class-card {
  border-color: #D7E7DE;
  border-radius: 14rpx;
  background: #FFFFFF;
}
.class-card::before { background: #20B486; }
.c-header {
  min-height: 0;
  padding: 17rpx 18rpx 15rpx 24rpx;
  align-items: flex-start;
}
.c-toggle { color: #15946D; }
.stu-list { border-top-color: #E6F0EA; }
.stu-row {
  min-height: 0;
  padding: 14rpx 0;
  align-items: flex-start;
  flex-wrap: wrap;
}
.stu-actions {
  width: 100%;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.s-code {
  position: static;
  order: -1;
  max-width: none;
  margin-right: auto;
  color: #5A6A62;
}
.btn-xs,
.share-btn {
  height: 48rpx;
  min-height: 0;
  padding: 0 11rpx;
  line-height: 48rpx;
}
.btn-xs.copy,
.btn-xs.share {
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.btn-xs.del {
  border-color: #F2C4C0;
  background: #FFF0EE;
  color: #D94B45;
}
.btn-add-stu,
.btn-transfer-stu {
  height: 68rpx;
  min-height: 0;
  padding: 0 16rpx;
  line-height: 68rpx;
}
.btn-add-stu {
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.btn-transfer-stu {
  border-color: #B8DDCD;
  background: #FFFFFF;
  color: #15946D;
}
.create-wrap { background: rgba(248, 252, 249, .98); }
.btn-create,
.btn-primary {
  height: 82rpx;
  min-height: 0;
  padding: 0 18rpx;
  background: #20B486;
  color: #FFFFFF;
  line-height: 82rpx;
}
.modal {
  border-radius: 16rpx 16rpx 0 0;
  background: #FFFFFF;
}
.input {
  background: #F8FCF9;
  border-color: #D7E7DE;
}
.gender-btn,
.lv-btn {
  min-height: 0;
  padding: 13rpx 0;
  line-height: 1.35;
}
.gender-btn.on,
.lv-btn.on,
.trait-tag.on {
  border-color: #20B486;
  background: #E7F8F1;
  color: #15946D;
}
.cat-head {
  align-items: flex-start;
  background: #F1F8F4;
}
.btn-cancel {
  height: 64rpx;
  min-height: 0;
  padding: 0;
  line-height: 64rpx;
}
</style>
