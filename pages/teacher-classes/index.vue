<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">学员</view>
    <text class="hero-title">学习小组管理</text>
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
            <text class="btn-xs del" @tap.stop="delStu(c,s.id)">删除</text>
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
    <button class="btn-create" @tap="openCreateClass"><pp-icon name="plus" :size="38" />新建学习小组</button>
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
    async delStu(c, sid) {
      const confirmed=await confirmAction({title:'删除学生',content:'删除后该学生的绑定与记录可能无法恢复。',confirmText:'删除',danger:true});
      if(!confirmed)return;
      try { await api.del('/students/'+sid); c._students=c._students.filter(s=>s.id!==sid); this.totalStudents=Math.max(0,this.totalStudents-1); }
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
.page { padding-bottom: 96rpx; background:#F3F7F5; min-height:100vh; }
.hero {
  padding: 42rpx 38rpx 34rpx;
  background: #F8FBFA;
  border-bottom: 1rpx solid #DDE8E4;
}
.hero .eyebrow { color:#2F6E61; letter-spacing:1rpx; }
.hero .gold-rule { width:44rpx; height:3rpx; margin:14rpx 0; background:#2F7D6B; }
.hero-title { font-size: 38rpx; font-weight:700; color:#183A36; display:block; }
.hero-sub { font-size: 24rpx; color:#697B76; margin-top:4rpx; }

.class-card {
  margin: 18rpx 24rpx;
  padding: 0;
  background:#FFFFFF;
  border:1rpx solid #DDE8E4;
  border-radius:18rpx;
  box-shadow:0 6rpx 18rpx rgba(36,42,50,.045);
  overflow:hidden;
}
.c-header { display:flex; justify-content:space-between; align-items:center; padding:26rpx 28rpx; gap:20rpx; }
.c-header > view:first-child { min-width:0; flex:1; }
.c-name { font-size:30rpx; font-weight:700; color:#183A36; display:block; margin-bottom:6rpx; }
.c-meta { font-size:24rpx; color:#697B76; display:block; margin-left:0; }
.c-actions { display:flex; align-items:center; gap:8rpx; flex-shrink:0; }
.c-toggle { font-size:24rpx; color:#7C8C87; margin-right:4rpx; }

.stu-list { border-top:1rpx solid #E5EEEB; margin:0 28rpx; padding:10rpx 0; }
.stu-row { position:relative; display:flex; align-items:center; padding:48rpx 0 18rpx; border-bottom:1rpx solid #F0ECE5; gap:14rpx; }
.stu-row:last-child { border-bottom:none; }
.stu-info { min-width:0; flex:1; display:flex; align-items:center; gap:14rpx; }
.stu-main { min-width:0; flex:1; }
.stu-title-row { display:flex; align-items:center; gap:10rpx; min-width:0; }
.s-name { font-weight:700; font-size:29rpx; color:#183A36; max-width:none; overflow:visible; text-overflow:clip; white-space:normal; word-break:break-all; }
.s-avatar { width:56rpx; height:56rpx; border-radius:50%; flex-shrink:0; }
.s-level { font-size:20rpx; padding:2rpx 10rpx; border-radius:6rpx; }
.parent-line{display:flex;align-items:center;gap:8rpx;margin-top:6rpx;min-width:0}
.parent-bind{font-size:22rpx;padding:3rpx 12rpx;border-radius:8rpx;white-space:nowrap;font-weight:600}
.parent-bind.on{background:#E8F4F0;color:#2F735F}
.parent-bind.off{background:#FCEEEB;color:#A94F48}
.parent-names{min-width:0;flex:1;font-size:22rpx;color:#697B76;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lv-a { background:#E8F4F0; color:#2F7D6B; }
.lv-b { background:#EDF4F2; color:#52756F; }
.lv-c { background:#F4F2E8; color:#2F7D6B; }
.lv-d { background:#FCEEEB; color:#B66A3C; }
.lv-e { background:#FCEEEB; color:#C75D54; }
.stu-actions { display:flex; align-items:center; gap:10rpx; flex-shrink:0; flex-wrap:nowrap; }
.s-code { position:absolute; top:16rpx; right:0; font-size:22rpx; color:#2F6E61; max-width:220rpx; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.btn-xs { padding:10rpx 14rpx; font-size:22rpx; color:#697B76; border-radius:8rpx; background:#F7FAF8; line-height:1.35; }
.share-btn { margin:0; border:none; display:inline-flex; align-items:center; justify-content:center; min-height:44rpx; }
.share-btn::after { border:none; }
.btn-xs.share{color:#2F6E61}
.btn-xs.del { color:#C75D54; }
.btn-add-stu { margin:10rpx 28rpx 26rpx; padding:16rpx; font-size:24rpx; background:#F7FAF8; color:#183A36; border:1rpx solid #DDE8E4; border-radius:12rpx; width:auto; }
.btn-transfer-stu{margin:-12rpx 28rpx 26rpx;padding:16rpx;font-size:24rpx;background:#FFF9EA;color:#815E18;border:1rpx solid #E8D4A3;border-radius:12rpx;width:auto}.btn-transfer-stu[disabled]{opacity:.42}.btn-add-stu::after,.btn-transfer-stu::after{border:0}.transfer-note{margin-bottom:22rpx;padding:18rpx;border-radius:14rpx;background:#EEF7F3;color:#46645D;font-size:23rpx;line-height:1.6}.picker-input{display:flex;align-items:center;justify-content:space-between}
.empty-sm { text-align:center; color:#7C8C87; padding:28rpx; font-size:24rpx; }

.create-wrap { padding: 8rpx 24rpx 0; }
.btn-create {
  background:#EEF7F3;
  color:#183A36;
  border:1rpx solid #E2D3BF;
  border-radius:14rpx;
  padding:22rpx;
  font-size:30rpx;
  font-weight:700;
  width:100%;
}
.btn-primary { background:#183A36; color:#fff; border-radius:12rpx; padding:24rpx; font-size:30rpx; text-align:center; border:none; width:100%; margin-top:20rpx; }
.btn-cancel { background:#fff; color:#7C8C87; border:none; padding:16rpx; font-size:26rpx; text-align:center; width:100%; }

.modal-mask { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:99; display:flex; align-items:flex-end; }
.modal { background:#fff; border-radius:24rpx 24rpx 0 0; padding:34rpx 30rpx calc(34rpx + env(safe-area-inset-bottom)); width:100%; max-height:82vh; overflow-y:auto; box-sizing:border-box; }
.modal-wide { max-height:90vh; }
.modal-title { font-size:34rpx; font-weight:700; text-align:center; margin-bottom:28rpx; color:#183A36; }
.input { border:1rpx solid #D5E3DE; border-radius:16rpx; padding:0 24rpx; margin-bottom:22rpx; font-size:31rpx; color:#536762; min-height:92rpx; line-height:92rpx; background:#F8FBFA; box-sizing:border-box; }
.label { font-size:28rpx; color:#536762; margin:22rpx 0 12rpx; font-weight:700; }

.level-btns { display:flex; gap:14rpx; margin-bottom:18rpx; }
.lv-btn { flex:1; text-align:center; padding:22rpx 0; border:2rpx solid #D5E3DE; border-radius:14rpx; font-size:28rpx; color:#7C8C87; min-height:52rpx; line-height:52rpx; }
.lv-btn.on { border-color:#183A36; background:#EDF5F2; color:#183A36; font-weight:700; }

.gender-row { display:flex; gap:14rpx; margin-bottom:18rpx; }
.gender-btn { flex:1; text-align:center; padding:22rpx 0; border:2rpx solid #D5E3DE; border-radius:14rpx; font-size:30rpx; color:#7C8C87; min-height:52rpx; line-height:52rpx; }
.gender-btn.on { border-color:#183A36; background:#EDF5F2; color:#183A36; font-weight:700; }

.trait-group { margin-bottom:16rpx; }
.cat-head{display:flex;justify-content:space-between;align-items:center;background:#F7FAF8;border:1rpx solid #DDE8E4;border-radius:14rpx;padding:22rpx 20rpx;gap:16rpx}
.cat-label { font-size:27rpx; font-weight:700; color:#183A36; display:block; }
.cat-meta{font-size:23rpx;color:#7C8C87;white-space:nowrap}
.cat-traits { display:flex; flex-wrap:wrap; gap:12rpx; padding-top:14rpx; }
.trait-tag { padding:12rpx 18rpx; border:1rpx solid #D5E3DE; border-radius:24rpx; font-size:25rpx; color:#697B76; line-height:1.35; }
.trait-tag.on { border-color:#183A36; background:#EDF5F2; color:#183A36; font-weight:600; }
.selected { display:flex; flex-wrap:wrap; gap:10rpx; margin:16rpx 0; }
.stag { background:#EDF5F2; color:#183A36; font-size:24rpx; padding:8rpx 14rpx; border-radius:16rpx; }
.del-tag { color:#C75D54; font-weight:700; margin-left:6rpx; }
</style>

<style scoped>
.page { padding-bottom: calc(120rpx + env(safe-area-inset-bottom)); }
.hero { padding: 46rpx 34rpx 36rpx; background: linear-gradient(150deg,#F9FCFB,#EEF6F3); }
.hero .gold-rule { display:none; }
.hero-title { margin-top:8rpx; font-size:40rpx; font-weight:760; color:var(--ink); }
.hero-sub { color:var(--text-muted); }
.state-card { margin:22rpx 24rpx; background:#fff; border:1rpx solid var(--border); border-radius:22rpx; }
.class-card { border-radius:22rpx; border-color:var(--border); box-shadow:var(--shadow-sm); }
.c-header { min-height:90rpx; padding:26rpx 28rpx; }
.c-name { color:var(--ink); font-size:30rpx; }
.c-meta { color:var(--text-muted); }
.c-actions { flex-wrap:wrap; justify-content:flex-end; }
.c-toggle { color:var(--accent-strong); font-weight:650; }
.btn-xs { min-height:48rpx; display:inline-flex; align-items:center; padding:4rpx 14rpx; border-radius:9rpx; background:var(--surface-muted); color:var(--text-muted); }
.btn-xs.copy,.btn-xs.share { color:var(--accent-strong); background:var(--accent-soft); }
.btn-xs.del { color:var(--danger); background:var(--danger-soft); }
.stu-row { min-height:112rpx; padding:56rpx 28rpx 20rpx; border-color:var(--hairline); align-items:center; flex-wrap:nowrap; }
.stu-info { width:auto; min-width:0; }
.stu-actions { width:auto; margin-left:0; justify-content:flex-end; flex-wrap:nowrap; }
.s-name { color:var(--ink); }
.parent-bind { border-radius:8rpx; }
.s-code { top:18rpx; right:28rpx; color:var(--text-muted); font-variant-numeric:tabular-nums; }
.btn-add-stu { min-height:76rpx; display:flex; align-items:center; justify-content:center; gap:8rpx; margin:12rpx 28rpx 26rpx; border-radius:14rpx; background:var(--surface-muted); color:var(--primary); border-color:var(--border); font-weight:650; }
.create-wrap { position:fixed; left:0; right:0; bottom:0; z-index:20; padding:16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); background:rgba(243,247,245,.94); backdrop-filter:blur(18rpx); border-top:1rpx solid rgba(221,232,228,.8); }
.btn-create { min-height:88rpx; display:flex; align-items:center; justify-content:center; gap:10rpx; border-radius:16rpx; background:var(--primary); box-shadow:0 12rpx 26rpx rgba(24,58,54,.16); }
.modal { border-radius:32rpx 32rpx 0 0; }
.field-label { display:block; margin:6rpx 0 9rpx; color:var(--text-secondary); font-size:25rpx; font-weight:650; }
.input { margin-bottom:20rpx; background:#FAFCFB; border-color:#D5E3DE; }
.gender-btn,.lv-btn,.trait-tag { min-height:52rpx; display:inline-flex; align-items:center; border-radius:11rpx; }
.gender-btn.on,.lv-btn.on,.trait-tag.on { border-color:var(--accent); background:var(--accent-soft); color:var(--accent-strong); }
.cat-head { border-radius:14rpx; background:var(--surface-muted); border-color:var(--hairline); }
.stag { border-radius:9rpx; background:var(--accent-soft); color:var(--accent-strong); }
</style>
