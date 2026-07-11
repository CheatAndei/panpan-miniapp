<template>
<view class="page">
  <view class="hero">
    <view class="eyebrow">待办</view>
    <text class="hero-title">请假与反馈</text>
    <text class="hero-sub">集中处理家长发来的申请与建议</text>
  </view>

  <view class="tabs">
    <text :class="['tab',{on:filter==='pending'}]" @tap="filter='pending'">待处理 ({{ pending.length }})</text>
    <text :class="['tab',{on:filter==='all'}]" @tap="filter='all'">全部</text>
  </view>

  <view v-if="loading && leaves.length===0" class="state-card"><pp-state type="loading" title="正在读取待办" /></view>
  <view v-else-if="error && leaves.length===0" class="state-card"><pp-state type="error" title="待办加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>
  <view v-else-if="filtered.length===0" class="state-card"><pp-state :title="filter==='pending'?'待办已清':'暂无记录'" :description="filter==='pending'?'新的请假和建议会显示在这里。':'处理过的内容会保留在这里。'" /></view>

  <view v-for="item in filtered" :key="item.item_type+'-'+item.id" class="swipe-wrap">
    <view class="swipe-inner" :style="{transform:'translateX('+(item._swiped?-120:0)+'rpx)'}"
      @touchstart="onTouchStart($event,item)" @touchmove="onTouchMove($event,item)" @touchend="onTouchEnd($event,item)">
      <view class="card leave-card">
        <view class="l-top">
          <view>
            <text class="l-name">{{ item.student_name }}</text>
            <text class="l-type">{{ item.item_type==='feedback' ? '意见反馈' : '请假申请' }}</text>
          </view>
          <text :class="['l-tag',item.status]">{{ statusText(item) }}</text>
        </view>
        <text v-if="item.class_date" class="l-date">{{ item.class_date }}</text>
        <text class="l-reason">{{ item.reason }}</text>
        <view v-if="item.reply" class="l-reply">回复：{{ item.reply }}</view>

        <view v-if="item.status==='pending'" class="l-actions">
          <button class="btn-approve" :disabled="item._busy" @tap="handle(item,'approved')">{{ item._busy?'处理中...':(item.item_type==='feedback'?'已处理':'批准') }}</button>
          <button class="btn-reject" :disabled="item._busy" @tap="handle(item,'rejected')">{{ item.item_type==='feedback'?'忽略':'拒绝' }}</button>
        </view>
      </view>
    </view>
    <view :class="['swipe-del',{show:item._swiped}]" @tap="deleteItem(item)">删除</view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { confirmAction, toastSuccess, toastError, logError } from '@/utils/ui';
export default {
  data(){return{
    leaves:[],filter:'pending',loading:false,error:'',
    statusMap:{pending:'待审批',approved:'已批准',rejected:'已拒绝'}
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
        await this.submitDecision(item,status,status==='approved'?'已收到':'已忽略');
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
    async submitDecision(item,status,reply){
      if(item._busy)return;
      item._busy=true;
      try{
        await api.put('/leaves/'+item.id,{status,reply,item_type:item.item_type});
        toastSuccess(item.item_type==='feedback'?(status==='approved'?'已处理':'已忽略'):(status==='approved'?'已批准':'已拒绝'));
        await this.loadData();
      }catch(e){toastError(e,'操作失败');}
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
.page{padding-bottom:calc(80rpx + env(safe-area-inset-bottom))}
.hero{padding:46rpx 34rpx 36rpx;background:linear-gradient(150deg,#F9FCFB,#EEF6F3);border-bottom:1rpx solid var(--hairline)}
.hero .eyebrow{color:var(--accent)}
.hero-title{display:block;margin-top:8rpx;font-size:40rpx;font-weight:760;color:var(--ink)}
.hero-sub{display:block;margin-top:4rpx;color:var(--text-muted);font-size:24rpx}
.tabs{display:flex;margin:18rpx 24rpx 4rpx;padding:6rpx;background:#EAF1EF;gap:4rpx;border-radius:15rpx}
.tab{flex:1;min-height:66rpx;display:flex;align-items:center;justify-content:center;font-size:27rpx;color:var(--text-muted);border-radius:11rpx}
.tab.on{color:var(--primary);font-weight:700;background:#fff;box-shadow:0 5rpx 14rpx rgba(24,58,54,.07)}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border)}
.swipe-wrap{position:relative;overflow:hidden}
.swipe-inner{transition:transform .2s}
.swipe-del{position:absolute;right:0;top:0;bottom:8rpx;width:120rpx;background:#C75D54;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26rpx;transform:translateX(120rpx);transition:transform .2s}
.swipe-del.show{transform:translateX(0)}
.leave-card{margin-bottom:8rpx;border-radius:22rpx;border-color:var(--border);box-shadow:var(--shadow-sm)}
.l-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8rpx}
.l-name{font-size:30rpx;font-weight:700;color:#183A36}
.l-type{display:block;font-size:22rpx;color:#7C8C87;margin-top:2rpx}
.l-tag{font-size:23rpx;padding:4rpx 13rpx;border-radius:9rpx;font-weight:650}
.l-tag.pending{background:#F4F2E8;color:#3F7167}
.l-tag.approved{background:#E8F4F0;color:#2F735F}
.l-tag.rejected{background:#FCEEEB;color:#A94F48}
.l-date{font-size:24rpx;color:#7C8C87;margin-bottom:8rpx}
.l-reason{font-size:28rpx;color:#536762;line-height:1.6}
.l-reply{font-size:24rpx;color:#2F7D6B;margin-top:8rpx;background:#EEF7F3;padding:10rpx 14rpx;border-radius:8rpx}
.l-actions{display:flex;gap:16rpx;margin-top:16rpx}
.btn-approve{flex:1;min-height:76rpx;background:var(--accent);color:#fff;border:none;border-radius:13rpx;padding:14rpx;font-size:27rpx;font-weight:650}
.btn-reject{flex:1;min-height:76rpx;background:var(--danger-soft);color:var(--danger);border:1rpx solid #F1D4D0;border-radius:13rpx;padding:14rpx;font-size:27rpx;font-weight:650}
.empty{text-align:center;color:#A4B1AD;padding:40rpx;font-size:28rpx}
</style>
