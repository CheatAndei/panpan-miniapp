<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">反馈</view>
    <text class="hero-title">课后反馈</text>
    <view class="gold-rule"></view>
    <text class="hero-sub">仅已签退学习安排可写反馈</text>
  </view>

  <!-- 已完成的学习安排 -->
  <view v-if="loading" class="loading">加载中…</view>
  <view v-else-if="completedSessions.length===0" class="card">
    <view class="empty">暂无已完成学习安排，先去签到签退</view>
  </view>

  <view v-for="se in completedSessions" :key="se.id" class="card se-card">
    <view class="se-hd">
      <text class="se-title">{{ se.title }}</text>
      <text class="se-date">{{ se.class_date }}</text>
    </view>

    <template v-if="se._open">
      <!-- 切换按钮 -->
      <view class="tab-row">
        <text :class="['tab-btn',{on:se._tab==='class'}]" @tap="se._tab='class'">学习小组总反馈</text>
        <text :class="['tab-btn',{on:se._tab==='student'}]" @tap="se._tab='student'">学生反馈</text>
        <text :class="['tab-btn',{on:se._tab==='pdf'}]" @tap="se._tab='pdf'">学习笔记</text>
      </view>

      <!-- 学习小组总反馈板块 -->
      <view class="block-card" v-if="se._tab==='class'">
        <text class="block-title">学习小组总反馈</text>
        <input v-model="se._cf.lesson" class="input big" placeholder="第几讲（如第十一讲）" />
        <input v-model="se._cf.topic" class="input big" placeholder="课题（如一元一次方程）" />
        <text class="label">学习表现 {{ se._cf.perfScore }}/10</text>
        <slider :value="se._cf.perfScore" @change="e=>se._cf.perfScore=e.detail.value" min="1" max="10" block-size="24" activeColor="#202733" />
        <input v-model="se._cf.homework" class="input big" placeholder="作业" />
        <button class="btn-primary big" @tap="genClassFeedback(se)" :disabled="se._cf._genning">
          {{ se._cf._genning?'生成中...':(se._cf._text?'重新生成':'AI 生成学习小组反馈') }}
        </button>
        <textarea v-if="se._cf._text" v-model="se._cf._text" class="result-area" :maxlength="500" />
      </view>

      <!-- 学生反馈板块 -->
      <view class="block-card" v-if="se._tab==='student'">
        <text class="block-title">学生反馈 ({{ se._students.filter(s=>!s._leave).length }}人)</text>
        <button class="btn-accent" style="margin-bottom:20rpx" @tap="genAllStu(se)" :disabled="se._batching">
          {{ se._batching?'生成中...':'一键生成全部学生' }}
        </button>
        <view v-for="s in se._students" :key="s.id" class="stu-card" v-show="!s._leave">
          <view class="stu-hd">
            <text class="stu-name">{{ s.name }}</text>
            <text v-if="s.level" class="s-level">{{ s.level }}</text>
            <label class="leave-label" @tap="s._leave=!s._leave">
              <view :class="['leave-box',{on:s._leave}]">{{ s._leave?'请假':'✓' }}</view>请假
            </label>
          </view>
          <text class="label">出门测 {{ s._score }}/10</text>
          <slider :value="s._score" @change="e=>s._score=e.detail.value" min="1" max="10" block-size="20" activeColor="#A57945" />
          <input v-model="s._note" class="input big" placeholder="大致情况" />
          <textarea v-if="s._text" v-model="s._text" class="result-area" :maxlength="300" />
          <!-- 图片 -->
          <view v-if="s._images && s._images.length>0" class="img-row">
            <image v-for="(img,i) in s._images" :key="i" :src="img" mode="aspectFill" class="thumb" @tap="previewStuImg(s,i)" />
          </view>
          <view class="stu-btns">
            <button class="btn-sm" @tap="genStuFeedback(se,s)">{{ s._text?'重新生成':'AI 生成' }}</button>
            <button class="btn-sm" @tap="addStuImg(s)">添加图片</button>
          </view>
        </view>
      </view>

      <!-- PDF上传板块 -->
      <view class="block-card" v-if="se._tab==='pdf'">
        <text class="block-title">学习笔记</text>
        <button class="btn-outline" @tap="choosePDF(se)">{{ se._pdfName||'选择 PDF 文件' }}</button>
        <text v-if="se._pdfName" class="pdf-hint">已选择：{{ se._pdfName }}</text>
      </view>

      <button class="btn-publish big" @tap="publishFeedback(se)" :disabled="se._publishing">
        {{ se._publishing?'发布中...':'发布反馈给家长' }}
      </button>
    </template>

    <template v-if="!se._open">
      <button class="btn-outline" @tap="openSession(se)">写反馈</button>
    </template>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { toastSuccess, toastError, logError } from '@/utils/ui';
export default {
  data(){return{
    completedSessions:[],loading:false
  };},
  onLoad(){this.loadSessions();},
  methods:{
    async loadSessions(){
      this.loading=true;
      try{
        const ses=await api.get('/schedules/sessions/completed');
        this.completedSessions=(ses.sessions||[]).map(se=>({
          ...se,_open:false,_tab:'class',_batching:false,
          _cf:{lesson:'',topic:'',perfScore:5,homework:'',_text:'',_genning:false},
          _students:[],_publishing:false
        }));
      }catch(e){logError('feedback.loadSessions',e);}
      finally{this.loading=false;}
    },
    async openSession(se){
      se._open=true;
      if(se._students.length===0){
        try{
          const r=await api.get('/students?class_id='+se.class_id);
          se._students=(r.students||[]).map(s=>{
            if(!s._images)s._images=[];
            return {...s,_score:s._score||5,_note:s._note||'',_text:s._text||'',_leave:false};
          });
        }catch(e){logError('feedback.openSession',e);}
      }
    },
    async genClassFeedback(se){
      se._cf._genning=true;
      try{
        const cls=await api.get('/classes/'+se.class_id).catch(()=>({class:{}}));
        const r=await api.post('/feedbacks/generate-class',{...se._cf,grade:cls.class?.grade,subject:cls.class?.subject});
        se._cf._text=r.text;
      }catch(e){toastError(e,'生成失败');}
      finally{se._cf._genning=false;}
    },
    async genAllStu(se){
      se._batching=true;
      try{
        const students=se._students.filter(s=>!s._leave).map(s=>({
          id:s.id,name:s.name,level:s.level,personality:s.personality,
          quizScore:s._score||5,note:s._note||''
        }));
        const r=await api.post('/feedbacks/generate-student-batch',{
          students,classInfo:{content:se._cf.lesson+' '+se._cf.topic,perfScore:se._cf.perfScore}
        });
        (r.results||[]).forEach((item,i)=>{
          if(students[i]){const s=se._students.find(s=>s.id===students[i].id);if(s)s._text=item.feedback;}
        });
        toastSuccess('全部生成完成');
      }catch(e){toastError(e,'生成失败');}
      finally{se._batching=false;}
    },
    async uploadImg(fp){
      const d=await api.upload('/feedbacks/upload-image',fp,'image');
      return d.url;
    },
    choosePDF(se){
      uni.chooseMessageFile({count:1,type:'file',extension:['pdf'],success:res=>{
        se._pdfTemp=res.tempFiles[0].path;se._pdfName=res.tempFiles[0].name;
      }});
    },
    addStuImg(s){
      if(!s._images)s._images=[];
      uni.chooseImage({
        count:3,sizeType:['compressed'],
        success:res=>{ s._images.push(...res.tempFilePaths); },
        fail:err=>{ logError('addStuImg',err); }
      });
    },
    previewStuImg(s,i){
      if(!s._images||!s._images.length)return;
      uni.previewImage({current:s._images[i],urls:s._images});
    },
    async genStuFeedback(se,s,silent){
      try{
        const r=await api.post('/feedbacks/generate-student',{
          name:s.name,level:s.level,personality:s.personality,
          quizScore:s._score,note:s._note,content:se._cf.lesson+' '+se._cf.topic,perfScore:se._cf.perfScore
        });
        s._text=r.text;
      }catch(e){if(!silent)toastError(e,'生成失败');else logError('genStuFeedback',e);}
    },
    async publishFeedback(se){
      if(!se._cf._text) return uni.showToast({title:'请先生成学习小组总反馈',icon:'none'});
      const hasStu=se._students.some(s=>s._text&&!s._leave);
      if(!hasStu) return uni.showToast({title:'请至少生成一位学生的反馈',icon:'none'});
      se._publishing=true;
      try{
        // 上传图片 → 替换为服务器URL
        const students=[];
        for(const s of se._students.filter(s=>s._text&&!s._leave)){
          const urls=[];
          if(s._images && s._images.length>0){
            for(const img of s._images){
              try{const res=await this.uploadImg(img);if(res)urls.push(res);}catch(e){logError('uploadImg',e);}
            }
          }
          students.push({id:s.id,name:s.name,text:s._text,images:urls});
        }
        await api.post('/feedbacks/publish',{
          class_id:se.class_id,class_date:se.class_date,
          class_feedback:se._cf._text,homework:se._cf.homework,
          students
        });
        await api.put('/schedules/sessions/'+se.id+'/complete',{status:'feedbacked'});
        toastSuccess('已发布！');
        this.loadSessions();
      }catch(e){toastError(e,'发布失败');}
      finally{se._publishing=false;}
    }
  }
};
</script>

<style scoped>
.page{padding-bottom:96rpx;background:#F4F5F2;min-height:100vh}
.hero{padding:42rpx 38rpx 34rpx;background:#FBFAF7;border-bottom:1rpx solid #E5E0D8}
.hero .eyebrow{color:#8D6A3F;letter-spacing:1rpx}
.hero .gold-rule{width:44rpx;height:3rpx;margin:14rpx 0;background:#A57945}
.hero-title{font-size:38rpx;font-weight:700;color:#202733;display:block}
.hero-sub{font-size:24rpx;color:#69717D;margin-top:4rpx}
.se-card{
  margin:18rpx 24rpx;
  background:#FFFFFF;
  border:1rpx solid #E5E0D8;
  border-radius:18rpx;
  box-shadow:0 6rpx 18rpx rgba(36,42,50,.045);
}
.se-hd{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:18rpx}
.se-title{font-size:30rpx;font-weight:700;color:#202733}
.se-date{font-size:26rpx;color:#8A929B}
.tag-done{background:#EEF5EF;color:#3F8B65;font-size:24rpx;padding:6rpx 16rpx;border-radius:10rpx}
.tab-row{display:flex;gap:0;margin-bottom:22rpx;background:#F8F6F1;border:1rpx solid #E5E0D8;border-radius:14rpx;padding:6rpx}
.tab-btn{flex:1;text-align:center;padding:16rpx 6rpx;border:none;border-radius:10rpx;font-size:26rpx;color:#69717D;line-height:1.35}
.tab-btn.on{background:#FFFFFF;color:#202733;font-weight:700;box-shadow:0 2rpx 8rpx rgba(36,42,50,.045)}
.block-card{background:#F8F6F1;border-radius:16rpx;padding:28rpx;margin-bottom:20rpx;border:1rpx solid #ECE6DC}
.block-title{font-size:32rpx;font-weight:700;color:#202733;display:block;margin-bottom:22rpx}
.label{font-size:28rpx;color:#46515C;margin:16rpx 0 8rpx;display:block}
.input{border:1rpx solid #E1DDD4;border-radius:12rpx;height:84rpx;padding:0 22rpx;font-size:30rpx;color:#46515C;margin-bottom:16rpx;display:block;width:100%;box-sizing:border-box;line-height:84rpx;background:#FFFFFF}
.input::placeholder{color:#C3C1BA}
.btn-primary{background:#F3F1EA;color:#202733;border:1rpx solid #E1DDD4;border-radius:12rpx;padding:22rpx;font-size:30rpx;border:none;width:100%;margin-top:16rpx;font-weight:700}
.btn-primary[disabled]{opacity:.5}
.btn-accent{background:#F7F1E7;color:#202733;border:1rpx solid #E2D3BF;border-radius:12rpx;padding:22rpx;font-size:30rpx;border:none;width:100%;font-weight:700}
.btn-accent[disabled]{opacity:.5}
.btn-publish{background:#A57945;color:#fff;border-radius:12rpx;padding:26rpx;font-size:32rpx;border:none;width:100%;font-weight:700;margin-top:4rpx}
.btn-publish[disabled]{opacity:.5}
.btn-outline{border:1rpx solid #202733;color:#202733;background:#fff;border-radius:12rpx;padding:22rpx;font-size:30rpx;width:100%;font-weight:700}
.result-area{width:100%;min-height:220rpx;border:1rpx solid #E1DDD4;border-radius:12rpx;padding:22rpx;font-size:28rpx;margin-top:16rpx;box-sizing:border-box;line-height:1.6;color:#46515C;background:#FFFFFF}
.result-area::placeholder{color:#C3C1BA}
.stu-card{background:#fff;border-radius:14rpx;padding:24rpx;margin-bottom:16rpx;border:1rpx solid #E1DDD4}
.stu-hd{display:flex;align-items:center;gap:12rpx;margin-bottom:14rpx}
.stu-name{font-size:32rpx;font-weight:700}
.s-level{font-size:24rpx;background:#F3F1EA;color:#202733;padding:4rpx 14rpx;border-radius:6rpx}
.leave-label{display:flex;align-items:center;gap:8rpx;font-size:26rpx;color:#8A929B;margin-left:auto}
.leave-box{width:40rpx;height:40rpx;border:2rpx solid #C3C1BA;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22rpx}
.leave-box.on{background:#B85C4E;border-color:#B85C4E;color:#fff}
.btn-sm{padding:14rpx 0;background:#F3F1EA;color:#202733;border:1rpx solid #E5E0D8;border-radius:10rpx;font-size:26rpx;width:100%;margin-top:10rpx}
.pdf-hint{font-size:24rpx;color:#3F8B65;margin-top:12rpx}
.stu-btns{display:flex;gap:12rpx}
.stu-btns .btn-sm{flex:1}
.img-row{display:flex;gap:10rpx;margin-top:10rpx}
.thumb{width:120rpx;height:120rpx;border-radius:8rpx}
.empty{text-align:center;color:#C3C1BA;padding:40rpx;font-size:28rpx}
</style>
