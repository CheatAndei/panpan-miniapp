<template>
<view class="page">
  <view v-if="student.id" class="hero hero-navy">
    <view class="eyebrow">学生档案</view>
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
      <button class="btn-ai" @tap="genAI" :disabled="genning">{{ genning?'生成中...':'一键生成' }}</button>
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
    <button class="btn-primary" @tap="save" :disabled="saving">{{ saving?'保存中...':'保存印象' }}</button>
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
    genning:false,saving:false,loading:false,error:'',traitOpen:{}
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
      try{
        await api.put('/students/'+this.studentId,{personality:this.traits.join('、')});
        await api.put('/profiles/'+this.studentId,this.profile);
        toastSuccess('已保存');
      }catch(e){toastError(e,'保存失败');}
      finally{this.saving=false;}
    }
  }
};
</script>

<style scoped>
.page{padding-bottom:calc(80rpx + env(safe-area-inset-bottom))}
.hero{padding:48rpx 32rpx 42rpx;text-align:center;background:linear-gradient(150deg,#F9FCFB,#EAF4F0)}
.hero-title{font-size:40rpx;font-weight:760;color:var(--ink);display:block}
.hero-sub{font-size:26rpx;color:#697B76;margin-top:6rpx}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border)}
.parent-status{display:inline-block;margin-top:14rpx;padding:6rpx 16rpx;border-radius:9rpx;font-size:23rpx;font-weight:650}
.parent-status.on{background:#E8F4F0;color:#2F735F}
.parent-status.off{background:#FCEEEB;color:#A94F48}
.char-img{margin:0 auto 16rpx}
.s-title{font-size:30rpx;font-weight:700;color:#183A36;margin-bottom:16rpx}
.bind-card{padding:28rpx 30rpx;border-radius:22rpx}
.bind-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18rpx;margin-bottom:18rpx}
.bind-head .s-title{display:block;margin-bottom:4rpx}
.bind-sub{font-size:24rpx;color:#697B76;display:block}
.bind-count{flex-shrink:0;min-width:86rpx;text-align:center;padding:8rpx 14rpx;border-radius:10rpx;font-size:26rpx;font-weight:700}
.bind-count.on{background:#E8F4F0;color:#2F735F}
.bind-count.off{background:#FCEEEB;color:#A94F48}
.bind-meter{height:12rpx;background:#E9F0ED;border-radius:8rpx;overflow:hidden}
.bind-fill{height:100%;background:#2F7D6B;border-radius:8rpx}
.parent-chips{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:18rpx}
.parent-chip{font-size:24rpx;color:var(--accent-strong);background:var(--accent-soft);border:1rpx solid #C8DED7;border-radius:10rpx;padding:8rpx 16rpx}
.bind-empty{display:block;margin-top:18rpx;font-size:24rpx;color:#697B76;line-height:1.5}
.s-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:16rpx}
.tags-row{display:flex;flex-wrap:wrap;gap:10rpx;margin-bottom:16rpx}
.tag{background:var(--accent-soft);color:var(--accent-strong);font-size:25rpx;padding:8rpx 14rpx;border-radius:10rpx}
.tag-del{color:#C75D54;font-weight:700;margin-left:4rpx;padding-left:4rpx}
.trait-cats{margin-top:16rpx}
.trait-cat{margin-bottom:14rpx}
.cat-head{display:flex;justify-content:space-between;align-items:center;background:var(--surface-muted);border:1rpx solid var(--hairline);border-radius:14rpx;padding:16rpx 18rpx}
.cat-label{font-size:24rpx;font-weight:700;color:#183A36;display:block}
.cat-meta{font-size:22rpx;color:#7C8C87}
.cat-traits{display:flex;flex-wrap:wrap;gap:8rpx}
.trait-btn{min-height:52rpx;display:inline-flex;align-items:center;padding:6rpx 16rpx;border:1rpx solid #D5E3DE;border-radius:11rpx;font-size:24rpx;color:var(--text-muted)}
.trait-btn.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-strong);font-weight:600}
.btn-ai{min-height:64rpx;padding:8rpx 22rpx;background:var(--accent);color:#fff;border:none;border-radius:12rpx;font-size:25rpx}
.btn-ai[disabled]{opacity:.5}
.field{margin-bottom:20rpx}
.label{font-size:28rpx;color:#536762;display:block;margin-bottom:8rpx}
.textarea{min-height:136rpx;border-radius:14rpx}
.btn-primary{width:100%;margin-top:20rpx}
.btn-primary[disabled]{opacity:.5}
</style>
