<template>
  <view class="page page-bottom-safe">
    <view class="hero"><text class="eyebrow">TEACHING TOOLS</text><text class="hero-title">教学工具</text><text class="hero-sub">不改变原生底栏，把新增能力集中放在这里</text></view>
    <view class="tool-list">
      <button v-for="item in tools" :key="item.url" class="tool-card" @tap="go(item.url)">
        <view :class="['tool-mark',item.tone]"><pp-icon :name="item.icon" :size="40" /></view>
        <view class="tool-copy"><text class="tool-title">{{ item.title }}</text><text class="tool-desc">{{ item.desc }}</text></view>
        <pp-icon name="arrow" :size="32" />
      </button>
    </view>
    <view class="fair-note"><text class="note-title">口算冲榜规则</text><text class="note-copy">目标依据真实排行榜生成，只告诉学生“还差多少分”；不会新增虚假成绩，也不会修改已有成绩。</text></view>
  </view>
</template>
<script setup>
const tools=[
  {title:'每日打卡计划',desc:'四类初中计算题自由组合，发布并批改',icon:'clipboard',tone:'green',url:'/pages/practice-teacher/index'},
  {title:'广州真题大全',desc:'查看原卷、答案、家长下载和答案申请',icon:'book',tone:'rose',url:'/pages/exam-library/index?grade=g9'},
  {title:'压轴挑战批阅',desc:'核对填空、大题、标准答案和学生解题照片',icon:'check',tone:'gold',url:'/pages/weekly-review/index'},
  {title:'题目报错处理',desc:'统一核对选择题、口算题和学习计算题',icon:'message',tone:'rose',url:'/pages/choice-reports/index'},
  {title:'口算冲榜目标',desc:'给学生设置真实的周排名和分数目标',icon:'users',tone:'navy',url:'/pages/mental-goals/index'},
  {title:'学习小组历史',desc:'查看现有小组历次发布、反馈与作业',icon:'calendar',tone:'blue',url:'/pages/teacher-classes/index'},
];
function go(url){uni.navigateTo({url});}
</script>
<style scoped>
.page{min-height:100vh;padding:0 24rpx 50rpx;background:var(--page-bg)}.hero{margin:0 -24rpx 24rpx;padding:52rpx 34rpx 46rpx;border-radius:0 0 34rpx 34rpx;background:linear-gradient(145deg,#183A36,#2F6E61);color:#fff}.eyebrow{display:block;color:#B9DDD3;font-size:19rpx;font-weight:800;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:43rpx;font-weight:780}.hero-sub{display:block;margin-top:8rpx;color:#D8EDE7;font-size:23rpx}.tool-list{display:flex;flex-direction:column;gap:14rpx}.tool-card{width:100%;min-height:126rpx;display:flex;align-items:center;gap:18rpx;margin:0;padding:22rpx;border-radius:20rpx;background:#fff;border:1rpx solid var(--border);text-align:left;box-shadow:var(--shadow-sm)}.tool-card::after{border:0}.tool-mark{width:72rpx;height:72rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:21rpx;background:var(--accent-soft)}.tool-mark.rose{background:#FCEEEB}.tool-mark.gold{background:#FFF1CE}.tool-mark.navy{background:#E7EFED}.tool-mark.blue{background:#EAF3F7}.tool-copy{flex:1}.tool-title{display:block;color:var(--ink);font-size:29rpx;font-weight:730}.tool-desc{display:block;margin-top:5rpx;color:var(--text-muted);font-size:22rpx;line-height:1.45}.fair-note{margin-top:22rpx;padding:24rpx;border-radius:18rpx;background:#FFF8E7;border:1rpx solid #EACD83}.note-title{display:block;color:#5F4912;font-size:25rpx;font-weight:750}.note-copy{display:block;margin-top:7rpx;color:#846B2D;font-size:22rpx;line-height:1.6}
</style>
