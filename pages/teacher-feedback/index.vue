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
        <slider :value="se._cf.perfScore" @change="e=>se._cf.perfScore=e.detail.value" min="1" max="10" block-size="24" activeColor="#1A365D" />
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
          <slider :value="s._score" @change="e=>s._score=e.detail.value" min="1" max="10" block-size="20" activeColor="#D69E2E" />
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

      <button class="btn-accent big" @tap="publishFeedback(se)" :disabled="se._publishing">
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
.page{padding-bottom:80rpx}
.hero{padding:40rpx 32rpx 30rpx;background:var(--card);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero .gold-rule{margin:14rpx 0}
.hero-title{font-size:38rpx;font-weight:700;color:var(--ink);display:block}
.hero-sub{font-size:24rpx;color:var(--muted);margin-top:4rpx}
.se-card{margin-bottom:16rpx}
.se-hd{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:16rpx}
.se-title{font-size:30rpx;font-weight:700;color:#1A365D}
.se-date{font-size:26rpx;color:#A0AEC0}
.tag-done{background:#F0FFF4;color:#38A169;font-size:24rpx;padding:6rpx 16rpx;border-radius:10rpx}
.tab-row{display:flex;gap:12rpx;margin-bottom:20rpx}
.tab-btn{flex:1;text-align:center;padding:20rpx;border:2rpx solid #E2E8F0;border-radius:14rpx;font-size:28rpx;color:#718096}
.tab-btn.on{border-color:#1A365D;background:#EBF0F7;color:#1A365D;font-weight:700}
.block-card{background:#F7F8FA;border-radius:20rpx;padding:32rpx;margin-bottom:20rpx}
.block-title{font-size:34rpx;font-weight:700;color:#1A365D;display:block;margin-bottom:24rpx}
.label{font-size:28rpx;color:#4A5568;margin:16rpx 0 8rpx;display:block}
.input{border:1rpx solid #E2E8F0;border-radius:14rpx;height:88rpx;padding:0 22rpx;font-size:30rpx;color:#4A5568;margin-bottom:18rpx;display:block;width:100%;box-sizing:border-box;line-height:88rpx}
.input::placeholder{color:#CBD5E0}
.btn-primary{background:#1A365D;color:#fff;border-radius:14rpx;padding:24rpx;font-size:32rpx;border:none;width:100%;margin-top:16rpx}
.btn-primary[disabled]{opacity:.5}
.btn-accent{background:#D69E2E;color:#fff;border-radius:14rpx;padding:28rpx;font-size:34rpx;border:none;width:100%}
.btn-accent[disabled]{opacity:.5}
.btn-outline{border:3rpx solid #1A365D;color:#1A365D;background:#fff;border-radius:14rpx;padding:26rpx;font-size:32rpx;width:100%}
.result-area{width:100%;min-height:220rpx;border:1rpx solid #E2E8F0;border-radius:14rpx;padding:24rpx 22rpx;font-size:28rpx;margin-top:16rpx;box-sizing:border-box;line-height:1.6;color:#4A5568}
.result-area::placeholder{color:#CBD5E0}
.stu-card{background:#fff;border-radius:16rpx;padding:26rpx;margin-bottom:18rpx;border:1rpx solid #E2E8F0}
.stu-hd{display:flex;align-items:center;gap:12rpx;margin-bottom:14rpx}
.stu-name{font-size:32rpx;font-weight:700}
.s-level{font-size:24rpx;background:#EBF0F7;color:#1A365D;padding:4rpx 14rpx;border-radius:6rpx}
.leave-label{display:flex;align-items:center;gap:8rpx;font-size:26rpx;color:#A0AEC0;margin-left:auto}
.leave-box{width:40rpx;height:40rpx;border:2rpx solid #CBD5E0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22rpx}
.leave-box.on{background:#E53E3E;border-color:#E53E3E;color:#fff}
.btn-sm{padding:14rpx 0;background:#EBF0F7;color:#1A365D;border:none;border-radius:10rpx;font-size:26rpx;width:100%;margin-top:10rpx}
.pdf-hint{font-size:24rpx;color:#38A169;margin-top:12rpx}
.stu-btns{display:flex;gap:12rpx}
.stu-btns .btn-sm{flex:1}
.img-row{display:flex;gap:10rpx;margin-top:10rpx}
.thumb{width:120rpx;height:120rpx;border-radius:8rpx}
.empty{text-align:center;color:#CBD5E0;padding:40rpx;font-size:28rpx}
</style>
