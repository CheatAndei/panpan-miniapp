<template>
<view class="page page-bottom-safe">
  <view class="inbox-hero">
    <view class="hero-meta">
      <text class="eyebrow">TEACHER INBOX</text>
      <view class="pending-count">
        <pp-icon name="bell" :size="28" :motion="pending.length > 0 ? 'ring' : 'none'" />
        <text class="num">{{ pending.length }}</text>
        <text>待处理</text>
      </view>
    </view>
    <text class="hero-title">请假与反馈</text>
    <text class="hero-sub">家长申请与建议集中处理，处理结果会保留在全部记录中。</text>
    <view class="hero-rule" aria-hidden="true"></view>
  </view>

  <view class="workspace-head">
    <view><text class="section-kicker">家长来信</text><text class="section-title">选择要查看的记录</text></view>
    <text class="section-note">左滑可删除</text>
  </view>

  <view class="tabs" role="tablist" aria-label="待办记录筛选">
    <button :class="['tab',{on:filter==='pending'}]" :aria-selected="filter==='pending'" @tap="filter='pending'">待处理 <text class="tab-count num">{{ pending.length }}</text></button>
    <button :class="['tab',{on:filter==='all'}]" :aria-selected="filter==='all'" @tap="filter='all'">全部记录</button>
  </view>

  <view v-if="error && leaves.length" class="inline-error" role="alert">
    <view><text class="inline-error-title">记录刷新失败</text><text class="inline-error-copy">{{ error }}</text></view>
    <button :disabled="loading" @tap="loadData">{{ loading ? '重试中…' : '重新加载' }}</button>
  </view>

  <view v-if="loading && leaves.length===0" class="state-card"><pp-state type="loading" title="正在读取待办" /></view>
  <view v-else-if="error && leaves.length===0" class="state-card"><pp-state type="error" title="待办加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>
  <view v-else-if="filtered.length===0" class="state-card empty-state-card">
    <pp-state :title="filter==='pending'?'待办已清':'暂无记录'" :description="filter==='pending'?'新的请假和建议会显示在这里。':'处理过的内容会保留在这里。'" />
  </view>

  <view v-if="filtered.length" class="list-head">
    <text>{{ filter==='pending' ? '需要处理' : '全部来信' }}</text>
    <text class="num">{{ filtered.length }} 条</text>
  </view>

  <view v-for="item in filtered" :key="item.item_type+'-'+item.id" class="swipe-wrap">
    <view
      class="swipe-inner"
      :style="{transform:'translateX('+(item._swiped?-120:0)+'rpx)'}"
      @touchstart="onTouchStart($event,item)"
      @touchmove="onTouchMove($event,item)"
      @touchend="onTouchEnd($event,item)"
    >
      <view class="leave-card">
        <view class="l-top">
          <view class="l-identity">
            <view class="student-mark" aria-hidden="true">{{ (item.student_name || '同学').slice(0,1) }}</view>
            <view>
              <text class="l-name">{{ item.student_name }}</text>
              <text class="l-type">{{ item.item_type==='feedback' ? ((item.parent_name||'家长')+' · 意见反馈') : '请假申请' }}</text>
            </view>
          </view>
          <text :class="['l-tag',item.status]">{{ statusText(item) }}</text>
        </view>
        <view v-if="item.class_date" class="l-date"><text>课程日期</text><text class="num">{{ item.class_date }}</text></view>
        <text class="l-reason">{{ item.reason }}</text>
        <view v-if="item.reply" class="l-reply"><text class="reply-label">老师回复</text><text>{{ item.reply }}</text></view>

        <view v-if="item.status==='pending'" class="l-actions">
          <button class="btn-approve" :disabled="item._busy" @tap="handle(item,'approved')">{{ item._busy?'处理中...':(item.item_type==='feedback'?'已处理':'批准') }}</button>
          <button class="btn-reject" :disabled="item._busy" @tap="handle(item,'rejected')">{{ item.item_type==='feedback'?'忽略':'拒绝' }}</button>
        </view>
      </view>
    </view>
    <view :class="['swipe-del',{show:item._swiped}]" @tap="deleteItem(item)">删除</view>
  </view>

  <view v-if="replying" class="modal-mask" @tap="closeReply">
    <view class="modal reply-modal" @tap.stop>
      <view class="sheet-handle" aria-hidden="true"></view>
      <text class="modal-title">回复 {{ replying.student_name }}家长</text>
      <text class="modal-sub">回复发送后，这条反馈会标记为已处理。</text>
      <text class="reply-source">{{ replying.reason }}</text>
      <textarea v-model="replyText" class="reply-input" maxlength="300" placeholder="写下给家长的具体回复" />
      <text class="reply-count">{{ replyText.length }}/300</text>
      <button class="btn-primary" :disabled="!replyText.trim() || replying._busy" @tap="sendReply">
        {{ replying._busy ? '发送中...' : '发送并标记已处理' }}
      </button>
      <button class="btn-cancel" @tap="closeReply">取消</button>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { confirmAction, toastSuccess, toastError, logError } from '@/utils/ui';
export default {
  data(){return{
    leaves:[],filter:'pending',loading:false,error:'',
    statusMap:{pending:'待审批',approved:'已批准',rejected:'已拒绝'},
    replying:null,replyText:''
  };},
  computed:{
    pending(){return this.leaves.filter(l=>l.status==='pending');},
    filtered(){return this.filter==='pending'?this.pending:this.leaves;}
  },
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const data=await api.get('/leaves');
        this.leaves=(data.leaves||[]).map(l=>({...l,_swiped:false,_busy:false}));
      }catch(e){this.error=e?.error||'请检查网络后重试';logError('teacherLeaves.loadData',e);}
      finally{this.loading=false;}
    },
    statusText(item){
      if(item.item_type==='feedback'){
        return item.status==='pending'?'待处理':item.status==='approved'?'已处理':'已忽略';
      }
      return this.statusMap[item.status]||item.status;
    },
    async handle(item,status){
      if(item.item_type==='feedback'){
        if(status==='approved'){
          this.replying=item;
          this.replyText=item.reply||'';
          return;
        }
        const confirmed=await confirmAction({title:'忽略这条反馈',content:'家长端会显示“已处理”，但不会收到老师回复。',confirmText:'确认忽略'});
        if(confirmed)await this.submitDecision(item,status,'');
        return;
      }
      if(status==='rejected'){
        uni.showModal({
          title:'拒绝理由',
          editable:true,
          placeholderText:'请填写给家长看的原因',
          success:async r=>{
            if(!r.confirm)return;
            const reply=(r.content||'').trim();
            if(!reply)return uni.showToast({title:'请填写拒绝理由',icon:'none'});
            await this.submitDecision(item,status,reply);
          }
        });
        return;
      }
      await this.submitDecision(item,status,'收到，好好休息');
    },
    closeReply(){
      if(this.replying?._busy)return;
      this.replying=null;
      this.replyText='';
    },
    async sendReply(){
      const item=this.replying;
      const reply=this.replyText.trim();
      if(!item||!reply)return;
      const saved=await this.submitDecision(item,'approved',reply);
      if(saved)this.closeReply();
    },
    async submitDecision(item,status,reply){
      if(item._busy)return;
      item._busy=true;
      try{
        await api.put('/leaves/'+item.id,{status,reply,item_type:item.item_type});
        toastSuccess(item.item_type==='feedback'?(status==='approved'?'已处理':'已忽略'):(status==='approved'?'已批准':'已拒绝'));
        await this.loadData();
        return true;
      }catch(e){toastError(e,'操作失败');return false;}
      finally{item._busy=false;}
    },
    onTouchStart(e,item){item._startX=e.touches[0].clientX;item._swiping=true;},
    onTouchMove(e,item){if(!item._swiping)return;const dx=e.touches[0].clientX-item._startX;if(dx<-40)item._swiped=true;else if(dx>40)item._swiped=false;},
    onTouchEnd(e,item){item._swiping=false;},
    async deleteItem(item){
      const confirmed=await confirmAction({title:'删除记录',content:'删除后不会再显示，且无法恢复。',confirmText:'删除',danger:true});
      if(!confirmed)return;
      try{
        await api.del('/leaves/'+item.id+(item.item_type==='feedback'?'?type=feedback':''));
        toastSuccess('已删除');
        await this.loadData();
      }catch(e){toastError(e,'删除失败');}
    }
  }
};
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding-top: 24rpx;
  overflow-x: hidden;
  background: var(--page-bg, #F7FCFE);
}

.inbox-hero {
  position: relative;
  margin: 0 24rpx;
  padding: 32rpx 32rpx 28rpx;
  overflow: hidden;
  border: 1rpx solid #DCE9ED;
  border-left: 7rpx solid var(--primary, #0B789A);
  border-radius: 16rpx;
  background:
    linear-gradient(rgba(153, 222, 244, .045) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(153, 222, 244, .045) 1rpx, transparent 1rpx),
    #FFFFFF;
  background-size: 38rpx 38rpx, 38rpx 38rpx, auto;
  box-shadow: var(--shadow-sm);
  animation: inbox-enter var(--motion-slow, 240ms) var(--ease-out, ease-out) both;
}

.inbox-hero::after {
  content: '';
  position: absolute;
  top: 18rpx;
  right: -18rpx;
  width: 112rpx;
  height: 20rpx;
  border-radius: 4rpx;
  background: var(--gold, #0B789A);
  opacity: .72;
  transform: rotate(2deg);
}

.hero-meta,
.workspace-head,
.list-head,
.l-top,
.l-identity,
.l-date {
  display: flex;
  align-items: center;
}

.hero-meta,
.workspace-head,
.list-head,
.l-top,
.l-date {
  justify-content: space-between;
}

.eyebrow,
.section-kicker {
  color: var(--primary-strong, #050505);
  font-size: 19rpx;
  font-weight: 760;
  letter-spacing: 0;
}

.pending-count {
  position: relative;
  z-index: 1;
  min-width: 88rpx;
  min-height: 66rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rpx 12rpx;
  border: 1rpx solid #C7DDE4;
  border-radius: 11rpx;
  background: var(--warning-soft, #E5F8FE);
  color: #050505;
  font-size: 17rpx;
  box-sizing: border-box;
}

.pending-count .num {
  font-size: 27rpx;
  font-weight: 820;
  line-height: 1.05;
}

.hero-title {
  display: block;
  margin-top: 8rpx;
  color: var(--ink, #050505);
  font-size: 41rpx;
  font-weight: 800;
  line-height: 1.28;
}

.hero-sub {
  display: block;
  max-width: 565rpx;
  margin-top: 8rpx;
  color: var(--text-secondary, #50545B);
  font-size: 23rpx;
  line-height: 1.58;
}

.hero-rule {
  width: 56rpx;
  height: 5rpx;
  margin-top: 21rpx;
  border-radius: 3rpx;
  background: var(--gold, #0B789A);
}

.workspace-head {
  align-items: flex-end;
  gap: 20rpx;
  margin: 30rpx 28rpx 14rpx;
  animation: inbox-enter var(--motion-slow, 240ms) 45ms var(--ease-out, ease-out) both;
}

.section-kicker { display: block; }

.section-title {
  display: block;
  margin-top: 4rpx;
  color: var(--ink, #050505);
  font-size: 30rpx;
  font-weight: 780;
}

.section-note {
  flex: none;
  color: var(--text-muted, #50545B);
  font-size: 19rpx;
}

.tabs {
  display: flex;
  gap: 7rpx;
  margin: 0 24rpx 8rpx;
  padding: 6rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-radius: 14rpx;
  background: #E5F8FE;
  animation: inbox-enter var(--motion-slow, 240ms) 75ms var(--ease-out, ease-out) both;
}

.tab {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8rpx;
  margin: 0;
  border-radius: 10rpx;
  background: transparent;
  color: var(--text-muted, #50545B);
  font-size: 25rpx;
  font-weight: 650;
  line-height: 1.3;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), background-color var(--motion-base, 180ms) var(--ease-out, ease-out);
}

.tab::after { border: 0; }

.tab.on {
  background: #FFFFFF;
  color: var(--primary-strong, #050505);
  box-shadow: 0 5rpx 14rpx rgba(5, 5, 5, .09);
}

.tab:active { transform: scale(var(--tap-scale, .975)); }

.tab-count {
  min-width: 34rpx;
  padding: 2rpx 7rpx;
  border-radius: 7rpx;
  background: var(--warning-soft, #E5F8FE);
  color: #050505;
  font-size: 18rpx;
  font-weight: 760;
}

.state-card {
  margin: 22rpx 24rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-top: 5rpx solid var(--primary, #0B789A);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}

.empty-state-card { border-top-color: var(--accent, #0B789A); }

.inline-error {
  min-height: 106rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin: 16rpx 24rpx;
  padding: 15rpx 18rpx;
  border: 1rpx solid #F2C8D5;
  border-left: 5rpx solid var(--danger, #B53A52);
  border-radius: 13rpx;
  background: var(--danger-soft, #FFF0F6);
  box-sizing: border-box;
}

.inline-error-title {
  display: block;
  color: #B53A52;
  font-size: 22rpx;
  font-weight: 740;
}

.inline-error-copy {
  display: block;
  margin-top: 2rpx;
  color: var(--text-secondary, #50545B);
  font-size: 19rpx;
}

.inline-error button {
  min-width: 126rpx;
  min-height: 88rpx;
  flex: none;
  margin: 0;
  border: 1rpx solid #F2C8D5;
  border-radius: 10rpx;
  background: #FFFFFF;
  color: #B53A52;
  font-size: 20rpx;
  font-weight: 700;
}

.list-head {
  margin: 24rpx 28rpx 12rpx;
  color: var(--text-muted, #50545B);
  font-size: 20rpx;
  font-weight: 680;
}

.swipe-wrap {
  position: relative;
  margin: 0 24rpx 14rpx;
  overflow: hidden;
  border-radius: 17rpx;
  animation: item-enter var(--motion-slow, 240ms) var(--ease-out, ease-out) both;
}

.swipe-wrap:nth-of-type(n+7) { animation: none; }

.swipe-inner {
  position: relative;
  z-index: 1;
  transition: transform var(--motion-base, 180ms) var(--ease-out, ease-out);
}

.swipe-del {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 120rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--danger, #B53A52);
  color: #FFFFFF;
  font-size: 24rpx;
  font-weight: 720;
  transform: translateX(120rpx);
  transition: transform var(--motion-base, 180ms) var(--ease-out, ease-out);
}

.swipe-del.show { transform: translateX(0); }

.leave-card {
  padding: 23rpx 22rpx 21rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-top: 5rpx solid var(--primary, #0B789A);
  border-radius: 17rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}

.l-top {
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.l-identity {
  min-width: 0;
  gap: 13rpx;
}

.student-mark {
  width: 62rpx;
  height: 62rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1rpx solid #DCE9ED;
  border-radius: 14rpx;
  background: var(--primary-soft, #E5F8FE);
  color: var(--primary-strong, #050505);
  font-size: 25rpx;
  font-weight: 800;
}

.l-name {
  display: block;
  color: var(--ink, #050505);
  font-size: 28rpx;
  font-weight: 760;
  line-height: 1.35;
}

.l-type {
  display: block;
  margin-top: 2rpx;
  color: var(--text-muted, #50545B);
  font-size: 20rpx;
}

.l-tag {
  flex: none;
  padding: 5rpx 11rpx;
  border-radius: 8rpx;
  font-size: 19rpx;
  font-weight: 720;
}

.l-tag.pending {
  border: 1rpx solid #C7DDE4;
  background: var(--warning-soft, #E5F8FE);
  color: #050505;
}

.l-tag.approved {
  border: 1rpx solid #C7DDE4;
  background: var(--accent-soft, #E5F8FE);
  color: var(--accent-strong, #050505);
}

.l-tag.rejected {
  border: 1rpx solid #F2C8D5;
  background: var(--danger-soft, #FFF0F6);
  color: #B53A52;
}

.l-date {
  margin-bottom: 11rpx;
  padding: 9rpx 12rpx;
  border-radius: 8rpx;
  background: var(--surface-muted, #F7FCFE);
  color: var(--text-muted, #50545B);
  font-size: 20rpx;
}

.l-reason {
  display: block;
  color: var(--text-secondary, #50545B);
  font-size: 26rpx;
  line-height: 1.65;
  white-space: pre-wrap;
}

.l-reply {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-top: 13rpx;
  padding: 13rpx 15rpx;
  border-left: 5rpx solid var(--accent, #0B789A);
  border-radius: 9rpx;
  background: var(--accent-soft, #E5F8FE);
  color: var(--text-secondary, #50545B);
  font-size: 22rpx;
  line-height: 1.55;
}

.reply-label {
  color: var(--accent-strong, #050505);
  font-size: 18rpx;
  font-weight: 760;
}

.l-actions {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 11rpx;
  margin-top: 18rpx;
}

.btn-approve,
.btn-reject,
.inline-error button {
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.btn-approve,
.btn-reject {
  min-height: 88rpx;
  margin: 0;
  padding: 13rpx 15rpx;
  border-radius: 12rpx;
  font-size: 25rpx;
  font-weight: 720;
}

.btn-approve {
  border: 0;
  background: var(--primary, #0B789A);
  color: #FFFFFF;
}

.btn-reject {
  border: 1rpx solid #F2C8D5;
  background: #FFFFFF;
  color: var(--danger, #B53A52);
}

.btn-approve:active,
.btn-reject:active,
.inline-error button:active {
  transform: scale(var(--tap-scale, .975));
  opacity: .9;
}

.reply-modal { position: relative; }

.sheet-handle {
  width: 72rpx;
  height: 7rpx;
  margin: -12rpx auto 20rpx;
  border-radius: 999rpx;
  background: var(--border, #DCE9ED);
}

.modal-sub {
  display: block;
  margin: -14rpx 0 19rpx;
  color: var(--text-muted, #50545B);
  font-size: 21rpx;
  text-align: center;
}

.reply-source {
  display: block;
  padding: 16rpx 18rpx;
  border-left: 5rpx solid var(--gold, #0B789A);
  border-radius: 11rpx;
  background: var(--warning-soft, #E5F8FE);
  color: var(--text-secondary, #50545B);
  font-size: 23rpx;
  line-height: 1.6;
}

.reply-input {
  width: 100%;
  height: 240rpx;
  box-sizing: border-box;
  margin-top: 18rpx;
  padding: 19rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-radius: 13rpx;
  background: var(--surface-muted, #F7FCFE);
  color: var(--ink, #050505);
  font-size: 26rpx;
  line-height: 1.65;
}

.reply-input:focus {
  border-color: var(--primary, #0B789A);
  background: #FFFFFF;
}

.reply-count {
  display: block;
  margin: 7rpx 2rpx 17rpx;
  color: var(--faint, #50545B);
  font-size: 20rpx;
  text-align: right;
}

@keyframes inbox-enter {
  from { transform: translateY(12rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes item-enter {
  from { transform: translateY(9rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (max-width: 340px) {
  .inbox-hero,
  .tabs,
  .state-card,
  .inline-error,
  .swipe-wrap {
    margin-right: 20rpx;
    margin-left: 20rpx;
  }

  .inbox-hero { padding-right: 25rpx; padding-left: 26rpx; }
  .section-note { display: none; }
  .leave-card { padding-right: 18rpx; padding-left: 18rpx; }
  .student-mark { width: 58rpx; height: 58rpx; }
  .l-actions { grid-template-columns: 1fr 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .inbox-hero,
  .workspace-head,
  .tabs,
  .swipe-wrap,
  .swipe-inner,
  .swipe-del,
  .tab,
  .btn-approve,
  .btn-reject,
  .inline-error button {
    animation: none !important;
    transition-duration: .01ms !important;
  }

  .tab:active,
  .btn-approve:active,
  .btn-reject:active,
  .inline-error button:active {
    transform: none;
  }
}

/* Teacher operations theme: bright learning studio v2. */
.page {
  --primary: #0B789A;
  --primary-strong: #050505;
  --primary-soft: #E5F8FE;
  --accent: #F79BC0;
  --accent-strong: #9B2F5F;
  --accent-soft: #FFF0F6;
  --success: #15755F;
  --success-soft: #E9F8F3;
  --gold: #FFF48A;
  --gold-soft: #FFFBE0;
  --warning: #8A6B00;
  --warning-soft: #FFFBE0;
  --coral: #F79BC0;
  --coral-soft: #FFF0F6;
  --danger: #B53A52;
  --danger-soft: #FFF0F3;
  --info: #0B789A;
  --info-soft: #E5F8FE;
  --ink: #050505;
  --text-secondary: #50545B;
  --text-muted: #6B7078;
  --faint: #939AA1;
  --page-bg: #F7FCFE;
  --surface: #FFFFFF;
  --surface-muted: #FBFDFE;
  --border: #DCE9ED;
  --hairline: #EDF3F5;
  padding-top: 0;
  background-color: #F7FCFE;
  background-image: repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(153, 222, 244, .035) 64rpx 65rpx);
}
.page {
  box-sizing: border-box;
  letter-spacing: 0;
}
.inbox-hero {
  margin: 0;
  padding: 30rpx 28rpx 24rpx 36rpx;
  border: 0;
  border-bottom: 1rpx solid #DCE9ED;
  border-left: 8rpx solid #0B789A;
  border-radius: 0;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(153, 222, 244, .045) 48rpx 49rpx),
    #FFFFFF;
  box-shadow: none;
}
.inbox-hero::after {
  top: 0;
  right: 28rpx;
  width: 112rpx;
  height: 8rpx;
  border-radius: 0 0 4rpx 4rpx;
  background: #0B789A;
  opacity: 1;
  transform: none;
}
.eyebrow,
.section-kicker { color: #050505; }
.hero-title { color: #050505; }
.hero-sub { color: #50545B; }
.pending-count {
  min-height: 0;
  display: flex;
  align-items: center;
  gap: 7rpx;
  padding: 7rpx 12rpx;
  border-color: #F2C8D5;
  background: #FFF0F6;
  color: #B53A52;
}
.tabs {
  align-items: flex-start;
  border-color: #DCE9ED;
  background: #F8FCFD;
}
.tab {
  height: 68rpx;
  min-height: 0;
  padding: 0 8rpx;
  line-height: 68rpx;
}
.tab.on {
  background: #FFFFFF;
  color: #050505;
  box-shadow: 0 4rpx 12rpx rgba(5, 5, 5, .08);
}
.tab-count {
  background: #FFF0F6;
  color: #B53A52;
}
.state-card,
.swipe-wrap,
.leave-card {
  border-radius: 14rpx;
}
.state-card { border-top-color: #0B789A; }
.empty-state-card { border-top-color: #050505; }
.inline-error {
  min-height: 0;
  align-items: flex-start;
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  background: #FFF0F6;
}
.inline-error button {
  height: 58rpx;
  min-height: 0;
  padding: 0 15rpx;
  line-height: 58rpx;
}
.leave-card {
  padding: 19rpx;
  border-color: #DCE9ED;
  border-top-color: #0B789A;
}
.l-top,
.l-identity,
.l-date {
  align-items: flex-start;
}
.student-mark {
  border-color: #C7DDE4;
  background: #E5F8FE;
  color: #050505;
}
.l-tag.pending {
  border-color: #F2C8D5;
  background: #FFF0F6;
  color: #B53A52;
}
.l-tag.approved,
.l-reply {
  border-color: #C7DDE4;
  background: #E5F8FE;
  color: #050505;
}
.l-tag.rejected {
  border-color: #F2C8D5;
  background: #FFF0F6;
  color: #B53A52;
}
.l-actions {
  align-items: flex-start;
}
.btn-approve,
.btn-reject {
  height: 72rpx;
  min-height: 0;
  padding: 0 15rpx;
  line-height: 72rpx;
}
.btn-approve {
  background: #0B789A;
  color: #FFFFFF;
}
.btn-reject {
  border-color: #F2C8D5;
  background: #FFF0F6;
  color: #B53A52;
}
.reply-modal { border-radius: 16rpx 16rpx 0 0; }
.sheet-handle {
  border-radius: 4rpx;
  background: #DCE9ED;
}
.reply-source {
  border-left-color: #0B789A;
  background: #E5F8FE;
}
.reply-input {
  border-color: #DCE9ED;
  background: #F7FCFE;
}
.reply-input:focus { border-color: #0B789A; }
</style>
