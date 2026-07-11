<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">反馈</view>
    <text class="hero-title">课后反馈</text>
    <text class="hero-sub">仅已签退学习安排可写反馈</text>
  </view>

  <!-- 已完成的学习安排 -->
  <view v-if="loading && completedSessions.length===0" class="state-card"><pp-state type="loading" title="正在整理待写反馈" /></view>
  <view v-else-if="error && completedSessions.length===0" class="state-card"><pp-state type="error" title="反馈任务加载失败" :description="error" action-text="重新加载" @action="loadSessions" /></view>
  <view v-else-if="completedSessions.length===0" class="state-card"><pp-state title="暂无待写反馈" description="完成签到与签退后，课程会进入这里。" action-text="前往签到" @action="goCheckin" /></view>

  <view v-for="se in completedSessions" :key="se.id" class="feedback-swipe-wrap">
    <view class="feedback-swipe-inner" :style="{transform:'translateX('+(se._swiped?-120:0)+'rpx)'}"
      @touchstart="onTouchStart($event,se)" @touchmove="onTouchMove($event,se)" @touchend="onTouchEnd($event,se)">
  <view class="card se-card">
    <view class="se-hd" @tap="se._open=false">
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
        <text class="field-label">课程进度</text>
        <input v-model="se._cf.lesson" class="input big" placeholder="第几讲（如第十一讲）" />
        <text class="field-label">本讲主题</text>
        <input v-model="se._cf.topic" class="input big" placeholder="课题（如一元一次方程）" />
        <text class="label">学习表现 {{ se._cf.perfScore }}/10</text>
        <slider :value="se._cf.perfScore" @change="e=>se._cf.perfScore=e.detail.value" min="1" max="10" block-size="24" activeColor="#183A36" />
        <text class="field-label">课后作业</text>
        <input v-model="se._cf.homework" class="input big" placeholder="填写作业内容（可选）" />
        <button class="btn-primary big" @tap="genClassFeedback(se)" :disabled="se._cf._genning">
          {{ se._cf._genning?'生成中...':(se._cf._text?'重新生成':'一键生成学习小组反馈') }}
        </button>
        <textarea v-model="se._cf._text" class="result-area" placeholder="可直接手动输入学习小组总反馈" :maxlength="500" />
      </view>

      <!-- 学生反馈板块 -->
      <view class="block-card" v-if="se._tab==='student'">
        <text class="block-title">学生反馈 ({{ se._students.filter(s=>!s._leave).length }}人)</text>
        <view class="feedback-style-switch" role="tablist" aria-label="反馈风格">
          <text :class="['style-choice',{on:se._feedbackStyle==='concise'}]" @tap="se._feedbackStyle='concise'">简洁</text>
          <text :class="['style-choice',{on:se._feedbackStyle==='warm'}]" @tap="se._feedbackStyle='warm'">温馨</text>
        </view>
        <text class="style-hint">{{ se._feedbackStyle==='warm' ? '温馨：更具体、更有鼓励感' : '简洁：原有短反馈模板' }}</text>
        <button class="btn-accent batch-button" @tap="genAllStu(se)" :disabled="se._batching">
          {{ se._batching?'生成中...':'一键生成全部学生' }}
        </button>
        <view v-for="s in se._students" :key="s.id" :class="['stu-card',{leave:s._leave}]">
          <view class="stu-hd">
            <text class="stu-name">{{ s.name }}</text>
            <text v-if="s.level" class="s-level">{{ s.level }}</text>
            <label class="leave-label" @tap="s._leave=!s._leave">
              <view :class="['leave-box',{on:s._leave}]">{{ s._leave?'✓':'' }}</view>{{ s._leave ? '已请假' : '请假' }}
            </label>
          </view>
          <view v-if="s._leave" class="leave-note">该学生已请假，不会发布个人反馈。点击右上角可取消标记。</view>
          <template v-else>
          <text class="label">出门测 {{ s._score }}/10</text>
          <slider :value="s._score" @change="e=>s._score=e.detail.value" min="1" max="10" block-size="20" activeColor="#2F7D6B" />
          <input v-model="s._note" class="input big" placeholder="大致情况" />
          <textarea v-model="s._text" class="result-area" placeholder="可直接手动输入学生反馈" :maxlength="240" />
          <!-- 图片 -->
          <view v-if="s._images && s._images.length>0" class="img-row">
            <view v-for="(img,i) in s._images" :key="i" class="thumb-wrap">
              <image :src="img" mode="aspectFill" class="thumb" @tap="previewStuImg(s,i)" />
              <text class="thumb-remove" @tap.stop="removeStuImg(s,i)">×</text>
            </view>
          </view>
          <view class="stu-btns">
            <button class="btn-sm" :disabled="s._genning" @tap="genStuFeedback(se,s)">{{ s._genning?'生成中...':(s._text?'重新生成':'一键生成') }}</button>
            <button class="btn-sm" @tap="addStuImg(s)">添加图片</button>
          </view>
          </template>
        </view>
      </view>

      <!-- PDF上传板块 -->
      <view class="block-card" v-if="se._tab==='pdf'">
        <text class="block-title">学习笔记</text>
        <button class="btn-outline" @tap="choosePDF(se)">{{ se._pdfName||'选择 PDF 文件' }}</button>
        <text v-if="se._pdfName" class="pdf-hint">已选择：{{ se._pdfName }}</text>
        <textarea v-model="se._noteRemark" class="result-area note-area" placeholder="给家长的备注（可选）" :maxlength="160" />
        <button class="btn-accent" @tap="publishNotes(se)" :disabled="se._publishingNotes">
          {{ se._publishingNotes?'发送中...':'单独发送学习笔记' }}
        </button>
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
    <view :class="['swipe-del',{show:se._swiped}]" @tap="deleteSession(se)">删除</view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { confirmAction, toastSuccess, toastError, logError } from '@/utils/ui';
export default {
  data(){return{
    completedSessions:[],loading:false,error:''
  };},
  onLoad(){this.loadSessions();},
  methods:{
    async loadSessions(){
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const ses=await api.get('/schedules/sessions/completed');
        this.completedSessions=(ses.sessions||[]).map(se=>({
          ...se,_open:false,_tab:'class',_batching:false,_swiped:false,_feedbackStyle:'concise',
          _cf:{lesson:'',topic:'',perfScore:5,homework:'',_text:'',_genning:false},
          _students:[],_publishing:false,_publishingNotes:false,_pdfTemp:'',_pdfName:'',_noteRemark:''
        }));
      }catch(e){this.error=e?.error||'请检查网络后重试';logError('feedback.loadSessions',e);}
      finally{this.loading=false;}
    },
    async openSession(se){
      se._open=true;
      if(se._students.length===0){
        try{
          const r=await api.get('/students?class_id='+se.class_id);
          const students=(r.students||[]).map(s=>{
            if(!s._images)s._images=[];
            return {...s,_score:s._score||5,_note:s._note||'',_text:s._text||'',_leave:false,_genning:false};
          });
          await Promise.all(students.map(async s=>{
            try{
              const ci=await api.get('/checkins/status?student_id='+s.id+'&date='+se.class_date);
              s._leave=ci.onLeave||false;
            }catch(e){logError('feedback.leaveStatus',e);}
          }));
          se._students=students;
        }catch(e){toastError(e,'学生信息加载失败');}
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
      if(se._batching)return;
      se._batching=true;
      try{
        const students=se._students.filter(s=>!s._leave).map(s=>({
          id:s.id,name:s.name,level:s.level,personality:s.personality,
          quizScore:s._score||5,note:s._note||''
        }));
        if(students.length===0)return uni.showToast({title:'没有需要生成反馈的学生',icon:'none'});
        const r=await api.post('/feedbacks/generate-student-batch',{
          students,classInfo:{content:se._cf.lesson+' '+se._cf.topic,perfScore:se._cf.perfScore},style:se._feedbackStyle
        });
        (r.results||[]).forEach((item,i)=>{
          const targetId=item.id??students[i]?.id;
          const s=se._students.find(student=>String(student.id)===String(targetId));
          if(s)s._text=this.formatStudentFeedback(s,item.feedback);
        });
        toastSuccess('全部生成完成');
      }catch(e){toastError(e,'生成失败');}
      finally{se._batching=false;}
    },
    async uploadImg(fp){
      const d=await api.upload('/feedbacks/upload-image',fp,'image');
      return d.url;
    },
    async uploadPDF(fp){
      const d=await api.upload('/feedbacks/upload-pdf',fp,'pdf');
      return d.url;
    },
    choosePDF(se){
      uni.chooseMessageFile({count:1,type:'file',extension:['pdf'],success:res=>{
        se._pdfTemp=res.tempFiles[0].path;se._pdfName=res.tempFiles[0].name;
      }});
    },
    addStuImg(s){
      if(!s._images)s._images=[];
      const remaining=Math.max(0,3-s._images.length);
      if(remaining===0)return uni.showToast({title:'每位学生最多添加 3 张',icon:'none'});
      uni.chooseImage({
        count:remaining,sizeType:['compressed'],
        success:res=>{ s._images.push(...res.tempFilePaths); },
        fail:err=>{ logError('addStuImg',err); }
      });
    },
    removeStuImg(s,i){s._images=s._images.filter((_,index)=>index!==i);},
    previewStuImg(s,i){
      if(!s._images||!s._images.length)return;
      uni.previewImage({current:s._images[i],urls:s._images});
    },
    async genStuFeedback(se,s,silent){
      if(s._genning)return;
      s._genning=true;
      try{
        const r=await api.post('/feedbacks/generate-student',{
          name:s.name,level:s.level,personality:s.personality,
          quizScore:s._score,note:s._note,content:se._cf.lesson+' '+se._cf.topic,perfScore:se._cf.perfScore,style:se._feedbackStyle
        });
        s._text=this.formatStudentFeedback(s,r.text);
      }catch(e){if(!silent)toastError(e,'生成失败');else logError('genStuFeedback',e);}
      finally{s._genning=false;}
    },
    async publishFeedback(se){
      if(se._publishing)return;
      if(!se._cf._text) return uni.showToast({title:'请先生成学习小组总反馈',icon:'none'});
      const activeStudents=se._students.filter(s=>!s._leave);
      const hasStu=se._students.some(s=>s._text&&!s._leave);
      if(activeStudents.length>0&&!hasStu) return uni.showToast({title:'请至少填写一位学生的反馈',icon:'none'});
      const confirmed=await confirmAction({title:'发布课后反馈',content:'发布后家长将收到学习小组与学生反馈。请确认内容已检查。',confirmText:'发布'});
      if(!confirmed)return;
      se._publishing=true;
      try{
        let notesPdfUrl='';
        if(se._pdfTemp){
          notesPdfUrl=await this.uploadPDF(se._pdfTemp);
        }
        // 上传图片 → 替换为服务器URL
        const sourceStudents=se._students.filter(s=>s._text&&!s._leave);
        const uploadedStudents=await Promise.all(sourceStudents.map(async s=>{
          const urls=[];
          if(s._images && s._images.length>0){
            for(const img of s._images){
              try{const res=await this.uploadImg(img);if(res)urls.push(res);}catch(e){logError('uploadImg',e);}
            }
          }
          return {id:s.id,name:s.name,text:this.formatStudentFeedback(s,s._text),images:urls};
        }));
        const students=uploadedStudents.filter(Boolean);
        await api.post('/feedbacks/publish',{
          class_id:se.class_id,class_date:se.class_date,schedule_id:se.schedule_id||null,
          class_feedback:se._cf._text,homework:se._cf.homework,
          notes_pdf_url:notesPdfUrl,
          students
        });
        await api.put('/schedules/sessions/'+se.id+'/complete',{status:'feedbacked'});
        toastSuccess('反馈已发布');
        await this.loadSessions();
      }catch(e){toastError(e,'发布失败');}
      finally{se._publishing=false;}
    },
    formatStudentFeedback(s,text){
      let body=String(text||'').replace(/\r/g,'').trim();
      body=body.replace(new RegExp('^'+s.name+'[：:，,\\s]*'),'').replace(/^[🌸🌟✨⭐]\s*/,'');
      const parts=body.split(/\n+/).map(p=>p.trim()).filter(Boolean);
      const normalized=(parts.length?parts:[body]).map(p=>'  '+p.replace(/^　+|^\s+/, '')).join('\n');
      return `${s.name}\n${normalized}`;
    },
    async publishNotes(se){
      if(!se._pdfTemp&&!se._noteRemark) return uni.showToast({title:'请选择学习笔记或填写备注',icon:'none'});
      se._publishingNotes=true;
      try{
        let notesPdfUrl='';
        if(se._pdfTemp){
          notesPdfUrl=await this.uploadPDF(se._pdfTemp);
        }
        await api.post('/feedbacks/publish-notes',{
          class_id:se.class_id,
          class_date:se.class_date,
          schedule_id:se.schedule_id||null,
          notes_pdf_url:notesPdfUrl,
          note_remark:se._noteRemark||''
        });
        toastSuccess('学习笔记已发送');
      }catch(e){toastError(e,'发送失败');}
      finally{se._publishingNotes=false;}
    },
    onTouchStart(e,se){se._startX=e.touches[0].clientX;se._swiping=true;},
    onTouchMove(e,se){if(!se._swiping)return;const dx=e.touches[0].clientX-se._startX;if(dx<-40)se._swiped=true;else if(dx>40)se._swiped=false;},
    onTouchEnd(e,se){se._swiping=false;},
    async deleteSession(se){
      const confirmed=await confirmAction({title:'删除未写反馈',content:'删除后该课程不会再出现在待写反馈中。',confirmText:'删除',danger:true});
      if(!confirmed)return;
      try{
        await api.del('/schedules/sessions/'+se.id);
        toastSuccess('已删除');
        await this.loadSessions();
      }catch(e){toastError(e,'删除失败');}
    },
    goCheckin(){uni.navigateTo({url:'/pages/teacher-checkin/index'});}
  }
};
</script>

<style scoped>
.page{padding-bottom:96rpx;background:#F3F7F5;min-height:100vh}
.hero{padding:42rpx 38rpx 34rpx;background:#F8FBFA;border-bottom:1rpx solid #DDE8E4}
.hero .eyebrow{color:#2F6E61;letter-spacing:1rpx}
.hero .gold-rule{width:44rpx;height:3rpx;margin:14rpx 0;background:#2F7D6B}
.hero-title{font-size:38rpx;font-weight:700;color:#183A36;display:block}
.hero-sub{font-size:24rpx;color:#697B76;margin-top:4rpx}
.se-card{
  margin:18rpx 24rpx;
  background:#FFFFFF;
  border:1rpx solid #DDE8E4;
  border-radius:18rpx;
  box-shadow:0 6rpx 18rpx rgba(36,42,50,.045);
}
.feedback-swipe-wrap{position:relative;overflow:hidden}
.feedback-swipe-inner{transition:transform .2s}
.swipe-del{position:absolute;right:0;top:18rpx;bottom:18rpx;width:120rpx;background:#C75D54;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26rpx;transform:translateX(120rpx);transition:transform .2s}
.swipe-del.show{transform:translateX(0)}
.se-hd{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:18rpx}
.se-title{font-size:30rpx;font-weight:700;color:#183A36}
.se-date{font-size:26rpx;color:#7C8C87}
.tag-done{background:#E8F4F0;color:#2F7D6B;font-size:24rpx;padding:6rpx 16rpx;border-radius:10rpx}
.tab-row{display:flex;gap:0;margin-bottom:22rpx;background:#F7FAF8;border:1rpx solid #DDE8E4;border-radius:14rpx;padding:6rpx}
.tab-btn{flex:1;text-align:center;padding:16rpx 6rpx;border:none;border-radius:10rpx;font-size:26rpx;color:#697B76;line-height:1.35}
.tab-btn.on{background:#FFFFFF;color:#183A36;font-weight:700;box-shadow:0 2rpx 8rpx rgba(36,42,50,.045)}
.block-card{background:#F7FAF8;border-radius:16rpx;padding:28rpx;margin-bottom:20rpx;border:1rpx solid #E3ECE8}
.block-title{font-size:32rpx;font-weight:700;color:#183A36;display:block;margin-bottom:22rpx}
.label{font-size:28rpx;color:#536762;margin:16rpx 0 8rpx;display:block}
.input{border:1rpx solid #D5E3DE;border-radius:12rpx;height:84rpx;padding:0 22rpx;font-size:30rpx;color:#536762;margin-bottom:16rpx;display:block;width:100%;box-sizing:border-box;line-height:84rpx;background:#FFFFFF}
.input::placeholder{color:#A4B1AD}
.btn-primary{background:#EDF5F2;color:#183A36;border:1rpx solid #D5E3DE;border-radius:12rpx;padding:22rpx;font-size:30rpx;border:none;width:100%;margin-top:16rpx;font-weight:700}
.btn-primary[disabled]{opacity:.5}
.btn-accent{background:#EEF7F3;color:#183A36;border:1rpx solid #E2D3BF;border-radius:12rpx;padding:22rpx;font-size:30rpx;border:none;width:100%;font-weight:700}
.btn-accent[disabled]{opacity:.5}
.btn-publish{background:#2F7D6B;color:#fff;border-radius:12rpx;padding:26rpx;font-size:32rpx;border:none;width:100%;font-weight:700;margin-top:4rpx}
.btn-publish[disabled]{opacity:.5}
.btn-outline{border:1rpx solid #183A36;color:#183A36;background:#fff;border-radius:12rpx;padding:22rpx;font-size:30rpx;width:100%;font-weight:700}
.result-area{width:100%;min-height:220rpx;border:1rpx solid #D5E3DE;border-radius:12rpx;padding:22rpx;font-size:28rpx;margin-top:16rpx;box-sizing:border-box;line-height:1.6;color:#536762;background:#FFFFFF}
.result-area::placeholder{color:#A4B1AD}
.note-area{min-height:140rpx;margin-bottom:16rpx}
.stu-card{background:#fff;border-radius:14rpx;padding:24rpx;margin-bottom:16rpx;border:1rpx solid #D5E3DE}
.stu-hd{display:flex;align-items:center;gap:12rpx;margin-bottom:14rpx}
.stu-name{font-size:32rpx;font-weight:700}
.s-level{font-size:24rpx;background:#EDF5F2;color:#183A36;padding:4rpx 14rpx;border-radius:6rpx}
.leave-label{display:flex;align-items:center;gap:8rpx;font-size:26rpx;color:#7C8C87;margin-left:auto}
.leave-box{width:40rpx;height:40rpx;border:2rpx solid #A4B1AD;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22rpx}
.leave-box.on{background:#C75D54;border-color:#C75D54;color:#fff}
.btn-sm{padding:14rpx 0;background:#EDF5F2;color:#183A36;border:1rpx solid #DDE8E4;border-radius:10rpx;font-size:26rpx;width:100%;margin-top:10rpx}
.pdf-hint{font-size:24rpx;color:#2F7D6B;margin-top:12rpx}
.stu-btns{display:flex;gap:12rpx}
.stu-btns .btn-sm{flex:1}
.img-row{display:flex;gap:10rpx;margin-top:10rpx}
.thumb{width:120rpx;height:120rpx;border-radius:8rpx}
.empty{text-align:center;color:#A4B1AD;padding:40rpx;font-size:28rpx}
</style>

<style scoped>
.page{padding-bottom:calc(96rpx + env(safe-area-inset-bottom));background:var(--bg)}
.hero{padding:46rpx 34rpx 36rpx;background:linear-gradient(150deg,#F9FCFB,#EEF6F3);border-color:var(--hairline)}
.hero .gold-rule{display:none}
.hero-title{margin-top:8rpx;font-size:40rpx;font-weight:760;color:var(--ink)}
.hero-sub{color:var(--text-muted)}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border)}
.se-card{border-radius:22rpx;border-color:var(--border);box-shadow:var(--shadow-sm)}
.se-title{color:var(--ink)}
.se-date{color:var(--text-muted);font-variant-numeric:tabular-nums}
.tab-row{padding:6rpx;border-radius:15rpx;background:#EDF3F1;border-color:var(--border)}
.tab-btn{min-height:68rpx;display:flex;align-items:center;justify-content:center;border-radius:11rpx;color:var(--text-muted);font-size:25rpx}
.tab-btn.on{color:var(--primary);box-shadow:0 5rpx 14rpx rgba(24,58,54,.07)}
.block-card{padding:26rpx;border-radius:18rpx;background:var(--surface-muted);border-color:var(--hairline)}
.block-title{color:var(--ink);font-size:30rpx}
.field-label{display:block;margin:4rpx 0 9rpx;color:var(--text-secondary);font-size:25rpx;font-weight:650}
.label{color:var(--text-secondary);font-size:26rpx;font-weight:620}
.input{height:88rpx;line-height:88rpx;border-radius:14rpx;background:#FFFFFF;border-color:#D5E3DE}
.result-area{border-radius:14rpx;border-color:#D5E3DE;color:var(--text-secondary)}
.btn-primary{min-height:82rpx;background:var(--primary);color:#FFFFFF;box-shadow:none}
.btn-accent{min-height:82rpx;background:var(--accent-soft);color:var(--accent-strong);border:1rpx solid #C8DED7;box-shadow:none}
.batch-button{margin-bottom:20rpx}
.btn-publish{min-height:90rpx;border-radius:15rpx;background:var(--accent-strong);box-shadow:0 12rpx 26rpx rgba(47,125,107,.15)}
.btn-outline{min-height:82rpx;border-radius:14rpx;border-color:#BFD2CC;color:var(--primary)}
.stu-card{border-radius:18rpx;border-color:var(--border);box-shadow:0 4rpx 14rpx rgba(24,58,54,.035)}
.stu-card.leave{background:var(--surface-muted);border-style:dashed}
.stu-name{color:var(--ink)}
.s-level{border-radius:9rpx;background:var(--accent-soft);color:var(--accent-strong)}
.leave-label{min-height:52rpx;color:var(--text-muted)}
.leave-box{border-color:#9FB1AC}.leave-box.on{background:var(--warning);border-color:var(--warning)}
.leave-note{padding:18rpx;border-radius:13rpx;background:var(--warning-soft);color:var(--warning);font-size:24rpx;line-height:1.6}
.stu-btns .btn-sm{min-height:72rpx;border-radius:12rpx;background:var(--accent-soft);color:var(--accent-strong);border-color:#C8DED7}
.img-row{flex-wrap:wrap}.thumb-wrap{position:relative;width:120rpx;height:120rpx}.thumb{border-radius:12rpx}
.thumb-remove{position:absolute;right:-10rpx;top:-10rpx;width:34rpx;height:34rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(16,46,42,.86);color:#fff;font-size:24rpx;line-height:1}
.pdf-hint{display:block;color:var(--success)}
.swipe-del{background:var(--danger)}
.feedback-style-switch{display:flex;align-self:flex-start;width:fit-content;padding:5rpx;margin:0 0 10rpx;background:#E8F1EE;border-radius:13rpx}
.style-choice{min-width:112rpx;padding:12rpx 18rpx;text-align:center;color:var(--text-muted);font-size:25rpx;border-radius:9rpx;font-weight:650}
.style-choice.on{background:#fff;color:var(--accent-strong);box-shadow:0 3rpx 10rpx rgba(24,58,54,.09)}
.style-hint{display:block;margin:0 0 16rpx;color:var(--text-muted);font-size:23rpx}
</style>
