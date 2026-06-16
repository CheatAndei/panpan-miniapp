<template>
<view class="page">
  <view class="hero">
    <image :src="charImg" class="char-img" mode="aspectFit" @error="charImg=student.gender==='girl'?'/static/default-girl.png':'/static/default-boy.png'" />
    <text class="hero-title">{{ student.name }}</text>
    <text class="hero-sub">{{ student.level||'' }} · {{ student.class_name||'' }}</text>
  </view>

  <!-- 性格标签 -->
  <view class="card">
    <text class="s-title">性格标签（已选 {{ traits.length }}/8）</text>
    <view class="tags-row">
      <text v-for="(t,i) in traits" :key="i" class="tag">{{ t }} <text class="tag-del" @tap="delTrait(i)">×</text></text>
    </view>
    <view class="trait-cats">
      <view v-for="cat in cats" :key="cat.name" class="trait-cat">
        <text class="cat-label">{{ cat.name }}</text>
        <view class="cat-traits">
          <text v-for="t in cat.traits" :key="t"
            :class="['trait-btn',{on:traits.includes(t)}]"
            @tap="toggleTrait(t)">{{ t }}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- AI画像 -->
  <view class="card">
    <view class="s-hd">
      <text class="s-title">AI 学习画像</text>
      <button class="btn-ai" @tap="genAI" :disabled="genning">{{ genning?'生成中...':'AI 生成' }}</button>
    </view>
    <view class="field">
      <text class="label">性格描述</text>
      <textarea v-model="profile.personality" class="textarea" placeholder="AI 生成后可手动修改" :maxlength="200" />
    </view>
    <view class="field">
      <text class="label">优势</text>
      <textarea v-model="profile.strengths" class="textarea" placeholder="AI 生成后可手动修改" :maxlength="100" />
    </view>
    <view class="field">
      <text class="label">成长空间</text>
      <textarea v-model="profile.weaknesses" class="textarea" placeholder="AI 生成后可手动修改" :maxlength="100" />
    </view>
    <button class="btn-primary" @tap="save" :disabled="saving">{{ saving?'保存中...':'保存画像' }}</button>
  </view>
</view>
</template>

<script>
import BASE, { ASSET_BASE } from '@/utils/config';
import { PERSONALITY_CATEGORIES, getStudentAvatar } from '@/utils/traits';
export default {
  data(){return{
    student:{},traits:[],cats:PERSONALITY_CATEGORIES,
    profile:{personality:'',strengths:'',weaknesses:''},
    genning:false,saving:false,charImg:'/static/av-study.png'
  };},
  onLoad(opt){this.studentId=opt.id;this.loadData();},
  methods:{
    async loadData(){
      try{
        const [stu,pro]=await Promise.all([
          this.req('/students/'+this.studentId),
          this.req('/profiles/'+this.studentId)
        ]);
        this.student=stu.student||{};
        this.traits=(this.student.personality||'').split('、').filter(Boolean);
        this.charImg=getStudentAvatar(this.student.personality, this.traits, this.student.gender);
        if(pro.profile){this.profile=pro.profile;}
      }catch(e){}
    },
    toggleTrait(t){const i=this.traits.indexOf(t);if(i>-1){this.traits.splice(i,1);return;}if(this.traits.length>=8)return;this.traits.push(t);},
    delTrait(i){this.traits.splice(i,1);},
    async genAI(){
      this.genning=true;
      try{
        // 先用当前标签更新学生数据
        await this.req('/students/'+this.studentId,'PUT',{personality:this.traits.join('、')});
        const r=await this.req('/profiles/generate','POST',{studentId:this.studentId});
        this.profile={personality:r.profile.personality,strengths:r.profile.strengths,weaknesses:r.profile.weaknesses};
      }catch(e){uni.showToast({title:'生成失败',icon:'none'});}
      finally{this.genning=false;}
    },
    async save(){
      this.saving=true;
      try{
        await this.req('/students/'+this.studentId,'PUT',{personality:this.traits.join('、')});
        await this.req('/profiles/'+this.studentId,'PUT',this.profile);
        uni.showToast({title:'已保存',icon:'success'});
      }catch(e){uni.showToast({title:'保存失败',icon:'none'});}
      finally{this.saving=false;}
    },
    req(p,m='GET',d){const t=uni.getStorageSync('token');return new Promise((resolve,reject)=>{uni.request({url:BASE+p,method:m,data:d,header:{Authorization:`Bearer ${t}`},success(r){if(r.statusCode===200)resolve(r.data);else reject(r.data);},fail:reject});});}
  }
};
</script>

<style scoped>
.page{padding-bottom:80rpx}
.hero{padding:40rpx 30rpx;background:#fff;border-bottom:1rpx solid #EDF2F7;text-align:center}
.hero-title{font-size:40rpx;font-weight:700;color:#1A365D;display:block}
.hero-sub{font-size:26rpx;color:#718096;margin-top:6rpx}
.char-img{width:120rpx;height:140rpx;margin-bottom:16rpx}
.s-title{font-size:30rpx;font-weight:700;color:#1A365D;margin-bottom:16rpx}
.s-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:16rpx}
.tags-row{display:flex;flex-wrap:wrap;gap:10rpx;margin-bottom:16rpx}
.tag{background:#EBF0F7;color:#1A365D;font-size:26rpx;padding:8rpx 16rpx;border-radius:12rpx}
.tag-del{color:#E53E3E;font-weight:700;margin-left:4rpx;padding-left:4rpx}
.trait-cats{margin-top:16rpx}
.trait-cat{margin-bottom:14rpx}
.cat-label{font-size:24rpx;font-weight:600;color:#718096;display:block;margin-bottom:8rpx}
.cat-traits{display:flex;flex-wrap:wrap;gap:8rpx}
.trait-btn{padding:8rpx 16rpx;border:1rpx solid #E2E8F0;border-radius:20rpx;font-size:24rpx;color:#718096}
.trait-btn.on{border-color:#1A365D;background:#EBF0F7;color:#1A365D;font-weight:600}
.btn-ai{padding:12rpx 24rpx;background:#D69E2E;color:#fff;border:none;border-radius:10rpx;font-size:26rpx}
.btn-ai[disabled]{opacity:.5}
.field{margin-bottom:20rpx}
.label{font-size:28rpx;color:#4A5568;display:block;margin-bottom:8rpx}
.textarea{width:100%;min-height:120rpx;border:1rpx solid #E2E8F0;border-radius:10rpx;padding:18rpx;font-size:28rpx;box-sizing:border-box}
.btn-primary{background:#1A365D;color:#fff;border-radius:14rpx;padding:24rpx;font-size:32rpx;border:none;width:100%;margin-top:20rpx}
.btn-primary[disabled]{opacity:.5}
</style>
