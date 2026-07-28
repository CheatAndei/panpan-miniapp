<template>
<view class="page">
  <view v-if="student.id" class="hero hero-navy">
    <view class="dossier-kicker">
      <pp-icon name="user" :size="30" motion="pop" />
      <view class="eyebrow">学生档案</view>
    </view>
    <pp-avatar :name="student.name" :size="128" class="char-img" />
    <text class="hero-title">{{ student.name }}</text>
    <text class="hero-sub">{{ student.level||'' }} · {{ student.class_name||'' }}</text>
    <text :class="['parent-status', parentCount>0?'on':'off']">{{ parentCount>0 ? '家长 '+parentCount+'/3' : '未绑定家长' }}</text>
  </view>

  <view v-if="loading && !student.id" class="state-card"><pp-state type="loading" title="正在读取学生档案" /></view>
  <view v-else-if="error && !student.id" class="state-card"><pp-state type="error" title="学生档案加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>

  <view v-if="student.id" class="card bind-card">
    <view class="bind-head">
      <view>
        <text class="s-title">家长绑定</text>
        <text class="bind-sub">{{ bindHint }}</text>
      </view>
      <text :class="['bind-count', parentCount>0?'on':'off']">{{ parentCount }}/3</text>
    </view>
    <view class="bind-meter">
      <view class="bind-fill" :style="{ width: bindPercent + '%' }"></view>
    </view>
    <view v-if="parentNameList.length>0" class="parent-chips">
      <text v-for="name in parentNameList" :key="name" class="parent-chip">{{ name }}</text>
    </view>
    <text v-else class="bind-empty">暂无家长绑定，家长使用邀请码后这里会自动更新</text>
  </view>

  <!-- 性格标签 -->
  <view v-if="student.id" class="card">
    <text class="s-title">性格标签（已选 {{ traits.length }}/8）</text>
    <view class="tags-row">
      <text v-for="(t,i) in traits" :key="i" class="tag">{{ t }} <text class="tag-del" @tap="delTrait(i)">×</text></text>
    </view>
    <view class="trait-cats">
      <view v-for="cat in cats" :key="cat.name" class="trait-cat">
        <view class="cat-head" @tap="toggleCat(cat.name)">
          <text class="cat-label">{{ cat.name }}</text>
          <text class="cat-meta">{{ countCat(cat) }} 个已选 · {{ traitOpen[cat.name] ? '收起' : '展开' }}</text>
        </view>
        <view v-if="traitOpen[cat.name]" class="cat-traits">
          <text v-for="t in cat.traits" :key="t"
            :class="['trait-btn',{on:traits.includes(t)}]"
            @tap="toggleTrait(t)">{{ t }}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 学习印象 -->
  <view v-if="student.id" class="card">
    <view class="s-hd">
      <text class="s-title">学习印象</text>
      <button class="btn-ai" @tap="genAI" :disabled="genning">
        <pp-icon name="lightbulb" :size="28" />
        {{ genning?'生成中...':'一键生成' }}
      </button>
    </view>
    <view class="field">
      <text class="label">性格描述</text>
      <textarea v-model="profile.personality" class="textarea" placeholder="生成后可手动修改" :maxlength="200" />
    </view>
    <view class="field">
      <text class="label">优势</text>
      <textarea v-model="profile.strengths" class="textarea" placeholder="生成后可手动修改" :maxlength="100" />
    </view>
    <view class="field">
      <text class="label">成长空间</text>
      <textarea v-model="profile.weaknesses" class="textarea" placeholder="生成后可手动修改" :maxlength="100" />
    </view>
    <button class="btn-primary" @tap="save" :disabled="saving">
      <pp-icon v-if="saveSucceeded" name="check" :size="28" motion="pop" />
      {{ saving?'保存中...':saveSucceeded?'已保存':'保存印象' }}
    </button>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { toastSuccess, toastError, logError } from '@/utils/ui';
import { PERSONALITY_CATEGORIES } from '@/utils/traits';
export default {
  data(){return{
    student:{},traits:[],cats:PERSONALITY_CATEGORIES,
    profile:{personality:'',strengths:'',weaknesses:''},
    genning:false,saving:false,saveSucceeded:false,loading:false,error:'',traitOpen:{}
  };},
  computed:{
    parentCount(){return Number(this.student.parent_count||0);},
    bindPercent(){return Math.min(100, Math.max(0, this.parentCount / 3 * 100));},
    parentNameList(){return (this.student.parent_names||'').split('、').map(n=>n.trim()).filter(Boolean);},
    bindHint(){
      if (this.parentCount === 0) return '还没有家长绑定这个学生';
      if (this.parentCount >= 3) return '已达到绑定上限';
      return '还可以继续绑定 '+(3-this.parentCount)+' 位家长';
    }
  },
  onLoad(opt){this.studentId=opt.id;this.loadData();},
  methods:{
    async loadData(){
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const [stu,pro]=await Promise.all([
          api.get('/students/'+this.studentId),
          api.get('/profiles/'+this.studentId)
        ]);
        this.student=stu.student||{};
        this.traits=(this.student.personality||'').split('、').filter(Boolean);
        if(pro.profile){this.profile=pro.profile;}
      }catch(e){this.error=e?.error||'请检查网络后重试';logError('studentDetail.loadData',e);}
      finally{this.loading=false;}
    },
    toggleCat(name){this.traitOpen={...this.traitOpen,[name]:!this.traitOpen[name]};},
    countCat(cat){return cat.traits.filter(t=>this.traits.includes(t)).length;},
    toggleTrait(t){const i=this.traits.indexOf(t);if(i>-1){this.traits.splice(i,1);return;}if(this.traits.length>=8)return uni.showToast({title:'最多选择 8 个标签',icon:'none'});this.traits.push(t);},
    delTrait(i){this.traits.splice(i,1);},
    async genAI(){
      if(this.genning)return;
      if(this.traits.length===0)return uni.showToast({title:'请先选择性格标签',icon:'none'});
      this.genning=true;
      try{
        // 先用当前标签更新学生数据
        await api.put('/students/'+this.studentId,{personality:this.traits.join('、')});
        const r=await api.post('/profiles/generate',{studentId:this.studentId});
        this.profile={...this.profile,personality:r.profile.personality,strengths:r.profile.strengths,weaknesses:r.profile.weaknesses};
      }catch(e){toastError(e,'生成失败');}
      finally{this.genning=false;}
    },
    async save(){
      if(this.saving)return;
      this.saving=true;
      this.saveSucceeded=false;
      try{
        await api.put('/students/'+this.studentId,{personality:this.traits.join('、')});
        await api.put('/profiles/'+this.studentId,this.profile);
        this.saveSucceeded=true;
        toastSuccess('已保存');
        setTimeout(()=>{this.saveSucceeded=false;},1200);
      }catch(e){toastError(e,'保存失败');}
      finally{this.saving=false;}
    }
  }
};
</script>

<style scoped>
/* Teacher operations theme: a compact student dossier, not a profile poster. */
.page {
  min-height: 100vh;
  padding-bottom: calc(56rpx + env(safe-area-inset-bottom));
  color: var(--ink);
  background-color: var(--page-bg);
}
.hero.hero-navy {
  padding: 26rpx 28rpx 24rpx;
  border-bottom: 6rpx solid var(--primary);
  box-shadow: none;
  animation: none;
}
.hero.hero-navy::after {
  top: 0;
  right: 28rpx;
  bottom: auto;
  width: 104rpx;
  height: 8rpx;
  border-radius: 0 0 4rpx 4rpx;
  background: var(--gold);
}
.eyebrow {
  color: var(--primary-strong);
  letter-spacing: 0;
}
.char-img {
  margin: 6rpx auto 10rpx;
  border: 4rpx solid #FFFFFF;
  box-shadow: 0 4rpx 12rpx rgba(38, 53, 47, .1);
}
.hero-title {
  display: block;
  color: var(--ink);
  font-size: 36rpx;
  font-weight: 760;
}
.hero-sub {
  display: block;
  margin-top: 3rpx;
  color: var(--text-secondary);
  font-size: 23rpx;
}
.parent-status {
  margin-top: 10rpx;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  font-size: 21rpx;
}
.parent-status.on {
  background: var(--success-soft);
  color: var(--success);
}
.parent-status.off {
  background: var(--coral-soft);
  color: var(--danger);
}
.state-card {
  margin: 16rpx 20rpx;
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  background: var(--surface);
  box-shadow: none;
}
.page > .card {
  margin: 14rpx 20rpx;
  padding: 22rpx;
  border: 1rpx solid var(--border);
  border-radius: 14rpx;
  background: var(--surface);
  box-shadow: none;
}
.bind-card {
  padding: 20rpx 22rpx;
  border-top: 1rpx solid var(--border);
  border-left: 5rpx solid var(--gold);
}
.bind-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
  margin-bottom: 14rpx;
}
.s-title {
  display: block;
  margin-bottom: 12rpx;
  color: var(--ink);
  font-size: 28rpx;
  font-weight: 720;
}
.bind-head .s-title { margin-bottom: 2rpx; }
.bind-sub {
  display: block;
  color: var(--text-muted);
  font-size: 22rpx;
}
.bind-count {
  flex-shrink: 0;
  text-align: center;
  min-width: 72rpx;
  padding: 6rpx 10rpx;
  border-radius: 7rpx;
  font-size: 23rpx;
}
.bind-count.on {
  background: var(--success-soft);
  color: var(--success);
}
.bind-count.off {
  background: var(--coral-soft);
  color: var(--danger);
}
.bind-meter {
  overflow: hidden;
  height: 8rpx;
  border-radius: 4rpx;
  background: #E6F0EA;
}
.bind-fill {
  height: 100%;
  border-radius: 4rpx;
  background: var(--primary);
}
.parent-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7rpx;
  margin-top: 14rpx;
}
.parent-chip {
  padding: 5rpx 10rpx;
  border: 1rpx solid #B8DDCD;
  border-radius: 7rpx;
  background: var(--success-soft);
  color: var(--success);
  font-size: 22rpx;
}
.bind-empty {
  display: block;
  margin-top: 14rpx;
  color: var(--text-muted);
  font-size: 22rpx;
}
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7rpx;
  margin-bottom: 14rpx;
}
.tag {
  padding: 6rpx 10rpx;
  border: 1rpx solid #D7E7DE;
  border-radius: 7rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 22rpx;
}
.tag-del {
  color: var(--danger);
  font-weight: 700;
}
.trait-cats { margin-top: 12rpx; }
.trait-cat { margin-bottom: 10rpx; }
.cat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx 15rpx;
  border: 1rpx solid var(--border);
  border-radius: 8rpx;
  background: var(--surface-muted);
}
.cat-label {
  color: var(--ink);
  font-size: 23rpx;
  font-weight: 680;
}
.cat-meta {
  color: var(--text-muted);
  font-size: 20rpx;
}
.cat-traits {
  display: flex;
  flex-wrap: wrap;
  gap: 7rpx;
  padding-top: 10rpx;
}
.trait-btn {
  display: inline-flex;
  align-items: center;
  min-height: 46rpx;
  padding: 5rpx 12rpx;
  border: 1rpx solid var(--border);
  border-radius: 8rpx;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 22rpx;
}
.trait-btn.on {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.s-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.s-hd .s-title { margin-bottom: 0; }
.btn-ai {
  min-height: 60rpx;
  padding: 7rpx 16rpx;
  border: 1rpx solid #D7E7DE;
  border-radius: 8rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 23rpx;
}
.field { margin-bottom: 16rpx; }
.label {
  margin-bottom: 7rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
  font-weight: 650;
}
.textarea {
  width: 100%;
  min-height: 120rpx;
  padding: 16rpx;
  border: 1rpx solid var(--border);
  border-radius: 9rpx;
  background: #F8FCF9;
  color: var(--ink);
  font-size: 26rpx;
  line-height: 1.55;
  box-sizing: border-box;
}
.btn-primary {
  width: 100%;
  min-height: 86rpx;
  margin-top: 16rpx;
  border: 0;
  border-radius: 10rpx;
  background: var(--primary-strong);
  color: #FFFFFF;
  box-shadow: none;
  font-size: 28rpx;
}
.btn-ai[disabled],
.btn-primary[disabled] { opacity: .5; }
.btn-ai::after,
.btn-primary::after { border: 0; }

.cat-head,
.trait-btn,
.tag,
.btn-ai,
.btn-primary {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}
.cat-head:active,
.trait-btn:active,
.tag:active,
.btn-ai:active,
.btn-primary:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}

@media (prefers-reduced-motion: reduce) {
  .cat-head,
  .trait-btn,
  .tag,
  .btn-ai,
  .btn-primary {
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
.hero.hero-navy {
  display: grid;
  grid-template-columns: 128rpx minmax(0, 1fr);
  grid-template-areas:
    "avatar kicker"
    "avatar title"
    "avatar sub"
    "avatar status";
  column-gap: 20rpx;
  align-items: center;
  padding: 26rpx 28rpx 24rpx 36rpx;
  border: 0;
  border-bottom: 1rpx solid #D7E7DE;
  border-left: 8rpx solid #20B486;
  background: #FFFFFF !important;
  color: #26352F;
  text-align: left;
}
.hero.hero-navy::after {
  top: 0;
  right: 28rpx;
  width: 112rpx;
  height: 8rpx;
  background: #20B486;
}
.char-img {
  grid-area: avatar;
  margin: 0;
  border-color: #E7F8F1;
  box-shadow: 0 5rpx 14rpx rgba(21, 148, 109, .1);
}
.dossier-kicker {
  grid-area: kicker;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.eyebrow {
  color: #15946D;
}
.hero-title {
  grid-area: title;
  color: #26352F;
}
.hero-sub {
  grid-area: sub;
  color: #5A6A62;
}
.parent-status {
  grid-area: status;
  width: fit-content;
}
.parent-status.on {
  background: #E7F8F1;
  color: #15946D;
}
.parent-status.off {
  background: #FFF0EE;
  color: #D94B45;
}
.state-card,
.page > .card {
  border-color: #D7E7DE;
  border-radius: 14rpx;
  background: #FFFFFF;
}
.page > .card:not(.bind-card) {
  border-top: 4rpx solid #20B486;
}
.page > .card:last-child {
  border-top-color: #20B486;
}
.bind-card {
  border-left-color: #15946D;
}
.bind-head,
.s-hd,
.cat-head {
  align-items: flex-start;
}
.bind-count.on,
.parent-chip {
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.bind-count.off {
  background: #FFF0EE;
  color: #D94B45;
}
.bind-meter { background: #D7E7DE; }
.bind-fill { background: #20B486; }
.tag {
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.cat-head {
  background: #F1F8F4;
}
.trait-btn {
  min-height: 0;
  padding: 8rpx 12rpx;
}
.trait-btn.on {
  border-color: #20B486;
  background: #E7F8F1;
  color: #15946D;
}
.btn-ai {
  height: 58rpx;
  min-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 0 16rpx;
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
  line-height: 58rpx;
}
.textarea {
  border-color: #D7E7DE;
  background: #F8FCF9;
}
.btn-primary {
  height: 80rpx;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 0 18rpx;
  background: #20B486;
  color: #FFFFFF;
  line-height: 80rpx;
}

@media (max-width: 340px) {
  .hero.hero-navy {
    grid-template-columns: 108rpx minmax(0, 1fr);
    column-gap: 16rpx;
    padding-right: 22rpx;
    padding-left: 28rpx;
  }
}
</style>
