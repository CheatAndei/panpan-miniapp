<template>
  <view class="page page-bottom-safe">
    <view class="hero">
      <text class="eyebrow">TRUE ACHIEVEMENTS</text>
      <text class="hero-title">学习成就海报</text>
      <text class="hero-sub">只使用真实成绩；姓名统一显示“姓＋同学”，不展示学校和班级。</text>
    </view>
    <pp-state v-if="loading" type="loading" title="正在整理真实成就" />
    <pp-state v-else-if="error" type="error" title="成就加载失败" :description="error" action-text="重试" @action="load" />
    <pp-state v-else-if="!items.length" title="还没有可生成的成就" description="完成口算挑战、压轴通关或达到选择题里程碑后会自动出现。" />
    <template v-else>
      <view class="privacy-strip">公开海报：{{ studentName }} · 不含学生照片、全名、学校、班级</view>
      <button v-for="item in items" :key="item.id" :class="['achievement-card',item.category,{selected:selected?.id===item.id}]" @tap="select(item)">
        <view class="category">{{ categoryLabel(item.category) }}</view>
        <text class="headline">{{ item.headline }}</text>
        <text class="meta">{{ metricText(item) }}</text>
        <text class="date">{{ dateText(item.achieved_at) }}</text>
      </button>
      <view v-if="selected" class="actions">
        <button class="generate" :disabled="generating" @tap="generate">{{ generating?'正在生成小程序码与海报…':'生成海报' }}</button>
        <button v-if="posterPath" class="preview" @tap="preview">预览海报</button>
        <button v-if="posterPath" class="save" :disabled="saving" @tap="save">{{ saving?'保存中…':'保存到相册' }}</button>
        <text class="save-note">微信不能自动替你发朋友圈；保存后由你自行选择分享。</text>
      </view>
    </template>
    <canvas canvas-id="achievementPosterCanvas" id="achievementPosterCanvas" class="poster-canvas" />
  </view>
</template>

<script setup>
import { getCurrentInstance, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { renderAchievementPoster, saveAchievementPoster, albumPermissionDenied } from '@/utils/achievement-poster';
import { logError } from '@/utils/ui';

const studentId=ref(0);const requestedId=ref(0);const studentName=ref('同学');const items=ref([]);const selected=ref(null);
const loading=ref(false);const error=ref('');const generating=ref(false);const saving=ref(false);const posterPath=ref('');
onLoad((query)=>{studentId.value=Number(query.student_id||uni.getStorageSync('activeChildId')||0);requestedId.value=Number(query.achievement_id||0);load();});
async function load(){
  if(!studentId.value||loading.value)return;loading.value=true;error.value='';
  try{const data=await api.get(`/achievements?student_id=${studentId.value}`);studentName.value=data.student_name||'同学';items.value=data.achievements||[];selected.value=items.value.find(x=>x.id===requestedId.value)||items.value[0]||null;}
  catch(e){error.value=e?.error||'请检查网络后重试';logError('achievements.load',e);}finally{loading.value=false;}
}
function select(item){selected.value=item;posterPath.value='';}
function categoryLabel(value){return value==='choice'?'选择刷题王':value==='mental'?'口算王':'压轴挑战';}
function metricText(item){
  if(item.category==='mental')return `正确率 ${item.accuracy||0}% · ${item.elapsed_seconds||0} 秒 · ${item.score||0} 分`;
  if(item.category==='challenge')return `${item.source_label||'潘潘老师精选'} · 累计通关 ${item.passed_count||1} 题`;
  return `完成 ${item.completed_count||0} 题 · 正确 ${item.correct_count||0} 题`;
}
function dateText(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('zh-CN');}
async function generate(){
  if(!selected.value||generating.value)return;generating.value=true;
  try{
    const code=await api.downloadPrivate(`/api/achievements/${selected.value.id}/code?student_id=${studentId.value}`);
    const page=getCurrentInstance()?.proxy;
    posterPath.value=await renderAchievementPoster({page,achievement:selected.value,codePath:code});
    await api.post(`/achievements/${selected.value.id}/seen`,{student_id:studentId.value});
    uni.showToast({title:'海报已生成',icon:'success'});
  }catch(e){uni.showToast({title:e?.error||e?.message||'海报生成失败',icon:'none'});logError('achievements.generate',e);}finally{generating.value=false;}
}
function preview(){if(posterPath.value)uni.previewImage({current:posterPath.value,urls:[posterPath.value]});}
async function save(){
  if(!posterPath.value||saving.value)return;saving.value=true;
  try{await saveAchievementPoster(posterPath.value);uni.showToast({title:'已保存到相册',icon:'success'});}
  catch(e){if(albumPermissionDenied(e))uni.showModal({title:'需要相册权限',content:'请在设置中允许保存到相册后重试。',confirmText:'去设置',success:r=>r.confirm&&uni.openSetting()});else uni.showToast({title:'保存失败，请重试',icon:'none'});}finally{saving.value=false;}
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(54rpx + env(safe-area-inset-bottom));background:#F3F7F5}.hero{margin:0 -24rpx;padding:48rpx 34rpx 42rpx;background:linear-gradient(145deg,#173A36,#315D56);color:#fff}.eyebrow{display:block;color:#B6DDD3;font-size:19rpx;font-weight:760;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:44rpx;font-weight:820}.hero-sub{display:block;margin-top:9rpx;color:#D5EAE4;font-size:22rpx;line-height:1.6}.privacy-strip{margin-top:20rpx;padding:18rpx 22rpx;border-radius:15rpx;background:#FFF4D9;color:#74561A;font-size:22rpx;line-height:1.55}.achievement-card{width:100%;min-height:200rpx;margin:16rpx 0 0;padding:25rpx;border:2rpx solid #D8E5E1;border-radius:22rpx;background:#fff;text-align:left}.achievement-card::after{border:0}.achievement-card.selected{border-color:#2F7D6B;box-shadow:0 12rpx 28rpx rgba(47,125,107,.12)}.category{display:inline-flex;padding:7rpx 13rpx;border-radius:999rpx;background:#E8F4F0;color:#2B6759;font-size:19rpx;font-weight:760}.headline,.meta,.date{display:block}.headline{margin-top:14rpx;color:#183A36;font-size:31rpx;font-weight:800}.meta{margin-top:8rpx;color:#596C66;font-size:23rpx;line-height:1.55}.date{margin-top:10rpx;color:#9AA6A2;font-size:19rpx}.actions{margin-top:20rpx;padding:26rpx;border:1rpx solid #D8E5E1;border-radius:22rpx;background:#fff}.generate,.preview,.save{min-height:86rpx;margin-top:12rpx;border-radius:14rpx;font-size:26rpx;font-weight:760}.generate{margin-top:0;background:#183A36;color:#fff}.preview{background:#E8F4F0;color:#285F53}.save{background:#F2C969;color:#4A3607}.save-note{display:block;margin-top:14rpx;color:#7C8C87;font-size:20rpx;line-height:1.55}.poster-canvas{position:fixed;left:-2000px;top:0;width:750px;height:1000px;pointer-events:none}
</style>
