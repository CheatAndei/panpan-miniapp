<template>
  <view class="page page-bottom-safe">
    <view class="hero">
      <text class="eyebrow">FREE EXPERIENCE</text>
      <text class="hero-title">先体验，再决定</text>
      <text class="hero-sub">体验成绩只保存在当前页面，不进入学生记录和排行榜。</text>
    </view>

    <view class="tabs" aria-label="体验项目">
      <button :class="['tab',{on:mode==='choice'}]" @tap="mode='choice'">选择题</button>
      <button :class="['tab',{on:mode==='mental'}]" @tap="mode='mental'">口算</button>
      <button :class="['tab',{on:mode==='challenge'}]" @tap="mode='challenge'">压轴示例</button>
    </view>

    <view v-if="mode==='choice'" class="card exercise-card">
      <view class="card-head"><text>选择题体验</text><text class="counter">已答 {{ choiceTotal }} 题</text></view>
      <pp-math-text class="stem" :value="choiceQuestion.stem" />
      <button v-for="(option,key) in choiceQuestion.options" :key="key"
        :class="['option',{selected:choiceSelected===key,correct:choiceSelected&&key===choiceQuestion.answer,wrong:choiceSelected===key&&key!==choiceQuestion.answer}]"
        :disabled="Boolean(choiceSelected)" @tap="answerChoice(key)">
        <text class="option-key">{{ key }}</text><pp-math-text class="option-copy" :value="option" />
      </button>
      <view v-if="choiceSelected" class="result-strip">
        <text class="result-title">{{ choiceSelected===choiceQuestion.answer ? '回答正确' : `正确答案：${choiceQuestion.answer}` }}</text>
        <pp-math-text class="result-copy" :value="choiceQuestion.explanation" />
      </view>
      <button v-if="choiceSelected" class="primary" @tap="nextChoice">继续随机一题</button>
    </view>

    <view v-else-if="mode==='mental'" class="card exercise-card">
      <view class="card-head"><text>口算体验</text><text class="counter">答对 {{ mentalCorrect }}/{{ mentalTotal }}</text></view>
      <text class="mental-stem">{{ mentalQuestion.stem }}</text>
      <input v-model="mentalInput" class="answer-input" type="number" :disabled="mentalChecked" placeholder="输入答案" @confirm="checkMental" />
      <button v-if="!mentalChecked" class="primary" :disabled="!String(mentalInput).trim()" @tap="checkMental">提交答案</button>
      <view v-else :class="['result-strip',{bad:Number(mentalInput)!==mentalQuestion.answer}]">
        <text class="result-title">{{ Number(mentalInput)===mentalQuestion.answer ? '回答正确' : `正确答案：${mentalQuestion.answer}` }}</text>
        <text class="result-copy">本次结果不保存，可不限次数继续体验。</text>
      </view>
      <button v-if="mentalChecked" class="primary" @tap="nextMental">继续随机一题</button>
    </view>

    <view v-else class="card challenge-card">
      <view class="sample-tag">仅展示 1 道示例</view>
      <text class="challenge-title">压轴挑战 · 几何示例</text>
      <text class="challenge-stem">在△ABC中，AB＝AC，点D在BC上，连接AD。若∠BAD＝20°，∠CAD＝30°，请结合全等三角形或辅助线方法，说明AD与BC之间可得到的数量或位置关系。</text>
      <view class="challenge-flow"><text>领取</text><text>→</text><text>拍照提交</text><text>→</text><text>老师批改</text><text>→</text><text>答对解锁下一题</text></view>
      <text class="privacy-note">体验模式不上传作答、不进入老师批改队列；绑定学生后才开放真实连续闯关。</text>
    </view>

    <view class="locked-card">
      <text class="locked-title">广州真题与解析</text>
      <text class="locked-copy">试卷属于绑定学生的受控学习资料，体验账号不能打开或下载。</text>
    </view>

    <view class="contact-card">
      <text class="contact-kicker">加入潘潘老师学习小组</text>
      <text class="contact-title">联系潘潘老师加入</text>
      <text v-if="CONTACT_MODE==='wechat_copy'" class="wechat">微信号：{{ TEACHER_WECHAT }}</text>
      <button v-if="CONTACT_MODE==='wechat_copy'" class="copy-btn" @tap="copyWechat">复制微信号</button>
      <button v-else class="copy-btn" open-type="contact">联系微信客服</button>
      <button class="bind-btn" @tap="goBind">已有邀请码，绑定学生</button>
      <text class="contact-note">由你主动复制并添加；小程序不新增个人信息收集表单。</text>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { CONTACT_MODE, TEACHER_WECHAT } from '@/utils/brand';

const mode = ref('choice');
const choiceTotal = ref(0);
const choiceIndex = ref(Math.floor(Math.random() * 12));
const choiceSelected = ref('');
const choiceBank = [
  { stem:'下列各式中，属于单项式的是（ ）', options:{A:'x＋1',B:'2x²',C:'a/b＋1',D:'x＝3'}, answer:'B', explanation:'单项式是数或字母的积，2x²符合定义。' },
  { stem:'若a＞b，则下列结论一定正确的是（ ）', options:{A:'a＋2＞b＋2',B:'−a＞−b',C:'2a＜2b',D:'a−3＜b−3'}, answer:'A', explanation:'不等式两边同时加同一个数，方向不变。' },
  { stem:'三角形两边长分别为3和7，第三边可能是（ ）', options:{A:'3',B:'4',C:'6',D:'10'}, answer:'C', explanation:'第三边x满足4＜x＜10，因此6符合。' },
  { stem:'下列运算正确的是（ ）', options:{A:'x²＋x²＝x⁴',B:'x²·x³＝x⁵',C:'(x²)³＝x⁵',D:'x⁶÷x²＝x³'}, answer:'B', explanation:'同底数幂相乘，指数相加。' },
  { stem:'因式分解x²−9的结果是（ ）', options:{A:'(x−3)²',B:'(x−9)(x＋1)',C:'(x−3)(x＋3)',D:'x(x−9)'}, answer:'C', explanation:'使用平方差公式a²−b²＝(a−b)(a＋b)。' },
  { stem:'点P(2，−3)关于x轴对称的点是（ ）', options:{A:'(−2，−3)',B:'(2，3)',C:'(−2，3)',D:'(3，2)'}, answer:'B', explanation:'关于x轴对称：横坐标不变，纵坐标互为相反数。' },
  { stem:'分式1/(x−2)有意义，x应满足（ ）', options:{A:'x＝2',B:'x≠2',C:'x＞2',D:'x＜2'}, answer:'B', explanation:'分式分母不能为0。' },
  { stem:'一个多边形的内角和为540°，它是（ ）', options:{A:'四边形',B:'五边形',C:'六边形',D:'七边形'}, answer:'B', explanation:'(n−2)×180°＝540°，解得n＝5。' },
  { stem:'方程2x＋3＝11的解是（ ）', options:{A:'x＝3',B:'x＝4',C:'x＝5',D:'x＝7'}, answer:'B', explanation:'2x＝8，所以x＝4。' },
  { stem:'下列图形中一定是轴对称图形的是（ ）', options:{A:'任意三角形',B:'平行四边形',C:'等腰三角形',D:'直角梯形'}, answer:'C', explanation:'等腰三角形的顶角平分线所在直线是对称轴。' },
  { stem:'若x²＋kx＋9是完全平方式，则k可以是（ ）', options:{A:'3',B:'6',C:'9',D:'12'}, answer:'B', explanation:'x²＋6x＋9＝(x＋3)²；k也可为−6，本题选6。' },
  { stem:'已知△ABC≌△DEF，∠A＝50°，∠B＝60°，则∠F＝（ ）', options:{A:'50°',B:'60°',C:'70°',D:'80°'}, answer:'C', explanation:'∠C＝180°−50°−60°＝70°，所以对应角∠F＝70°。' },
];
const choiceQuestion = computed(() => choiceBank[choiceIndex.value]);
function answerChoice(key){ if(choiceSelected.value)return; choiceSelected.value=key; choiceTotal.value+=1; }
function nextChoice(){ let next=choiceIndex.value; while(next===choiceIndex.value)next=Math.floor(Math.random()*choiceBank.length); choiceIndex.value=next; choiceSelected.value=''; }

const mentalQuestion = ref(makeMental());
const mentalInput = ref('');
const mentalChecked = ref(false);
const mentalTotal = ref(0);
const mentalCorrect = ref(0);
function makeMental(){
  const a=8+Math.floor(Math.random()*73); const b=2+Math.floor(Math.random()*28); const add=Math.random()>.45;
  return add ? {stem:`${a} ＋ ${b} ＝`,answer:a+b} : {stem:`${a+b} − ${b} ＝`,answer:a};
}
function checkMental(){ if(mentalChecked.value||!String(mentalInput.value).trim())return; mentalChecked.value=true; mentalTotal.value+=1; if(Number(mentalInput.value)===mentalQuestion.value.answer)mentalCorrect.value+=1; }
function nextMental(){ mentalQuestion.value=makeMental(); mentalInput.value=''; mentalChecked.value=false; }
function copyWechat(){ uni.setClipboardData({data:TEACHER_WECHAT,success:()=>uni.showToast({title:'微信号已复制',icon:'success'})}); }
function goBind(){ uni.navigateTo({url:'/pages/bind/bind'}); }
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 0 24rpx calc(54rpx + env(safe-area-inset-bottom));
  background: var(--page-bg);
}

.hero {
  position: relative;
  overflow: hidden;
  margin: 0 -24rpx;
  padding: 52rpx 34rpx 44rpx;
  border-bottom: 1rpx solid var(--hairline);
  background:
    linear-gradient(rgba(82, 124, 201, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(82, 124, 201, .05) 1rpx, transparent 1rpx),
    linear-gradient(145deg, #FFFFFF, var(--primary-soft));
  background-size: 40rpx 40rpx, 40rpx 40rpx, auto;
  color: var(--ink);
  animation: guest-enter var(--motion-slow) var(--ease-out) both;
}

.hero::after {
  content: '';
  position: absolute;
  width: 190rpx;
  height: 190rpx;
  right: -70rpx;
  top: -92rpx;
  border-radius: 50%;
  background: rgba(244, 199, 91, .28);
}

.eyebrow {
  position: relative;
  z-index: 1;
  display: block;
  color: var(--primary-strong);
  font-size: 19rpx;
  font-weight: 760;
  letter-spacing: 3rpx;
}

.hero-title {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 8rpx;
  color: var(--ink);
  font-size: 46rpx;
  font-weight: 830;
}

.hero-sub {
  position: relative;
  z-index: 1;
  display: block;
  max-width: 590rpx;
  margin-top: 10rpx;
  color: var(--text-secondary);
  font-size: 23rpx;
  line-height: 1.6;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  margin-top: 20rpx;
  padding: 7rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.tab {
  min-height: 80rpx;
  margin: 0;
  border-radius: 11rpx;
  background: transparent;
  color: var(--text-muted);
  font-size: 24rpx;
  font-weight: 710;
  transition: transform var(--motion-fast) var(--ease-out), background-color var(--motion-base) var(--ease-out), color var(--motion-base) var(--ease-out);
}

.tab::after,
.option::after,
.primary::after,
.copy-btn::after,
.bind-btn::after { border: 0; }
.tab:active,
.option:active,
.primary:active,
.copy-btn:active,
.bind-btn:active { transform: scale(var(--tap-scale)); }
.tab.on { background: var(--primary-strong); color: #FFFFFF; }

.card,
.locked-card,
.contact-card {
  margin-top: 18rpx;
  padding: 28rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.exercise-card,
.challenge-card { animation: guest-panel-enter var(--motion-slow) var(--ease-out) both; }
.card-head { display: flex; align-items: center; justify-content: space-between; color: var(--ink); font-size: 29rpx; font-weight: 780; }
.counter { color: var(--text-muted); font-size: 21rpx; font-weight: 650; }
.stem { display: block; margin: 28rpx 0 20rpx; color: var(--ink); font-size: 31rpx; font-weight: 720; line-height: 1.75; }

.option {
  width: 100%;
  min-height: 92rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin: 12rpx 0;
  padding: 15rpx 20rpx;
  border: 2rpx solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  color: var(--ink);
  font-size: 26rpx;
  text-align: left;
  transition: transform var(--motion-fast) var(--ease-out), border-color var(--motion-base) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}

.option-key {
  width: 46rpx;
  height: 46rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 13rpx;
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-weight: 800;
}

.option.selected { border-color: var(--primary); background: var(--primary-soft); }
.option.correct { border-color: var(--success); background: var(--success-soft); }
.option.wrong { border-color: var(--danger); background: var(--danger-soft); }
.result-strip { margin-top: 20rpx; padding: 22rpx; border-radius: var(--r-sm); background: var(--success-soft); }
.result-strip.bad { background: var(--danger-soft); }
.result-title,
.result-copy { display: block; }
.result-title { color: var(--success); font-size: 27rpx; font-weight: 800; }
.bad .result-title { color: var(--danger); }
.result-copy { margin-top: 7rpx; color: var(--text-secondary); font-size: 23rpx; line-height: 1.6; }

.primary {
  min-height: 92rpx;
  margin-top: 20rpx;
  border-radius: var(--r-sm);
  background: var(--primary-strong);
  color: #FFFFFF;
  font-size: 27rpx;
  font-weight: 760;
  box-shadow: 0 10rpx 24rpx rgba(49, 94, 168, .18);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.mental-stem { display: block; margin: 50rpx 0 32rpx; color: var(--ink); font-size: 64rpx; font-weight: 850; text-align: center; }
.answer-input { height: 98rpx; border: 2rpx solid #C8D8EA; border-radius: var(--r-sm); background: var(--surface-muted); color: var(--ink); font-size: 38rpx; text-align: center; }
.sample-tag { display: inline-flex; padding: 8rpx 14rpx; border-radius: var(--r-xs); background: var(--warning-soft); color: var(--warning); font-size: 20rpx; font-weight: 760; }
.challenge-title { display: block; margin-top: 18rpx; color: var(--ink); font-size: 31rpx; font-weight: 800; }
.challenge-stem { display: block; margin-top: 17rpx; color: var(--text-secondary); font-size: 27rpx; line-height: 1.9; }
.challenge-flow { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 24rpx; padding: 20rpx; border-radius: var(--r-sm); background: var(--warning-soft); color: var(--warning); font-size: 22rpx; font-weight: 700; }
.privacy-note { display: block; margin-top: 18rpx; color: var(--text-muted); font-size: 22rpx; line-height: 1.65; }

.locked-card { background: var(--surface-muted); }
.locked-title,
.locked-copy { display: block; }
.locked-title { color: var(--ink); font-size: 27rpx; font-weight: 760; }
.locked-copy { margin-top: 7rpx; color: var(--text-muted); font-size: 22rpx; line-height: 1.6; }

.contact-card {
  position: relative;
  overflow: hidden;
  border-color: #C5D6EE;
  background: linear-gradient(145deg, #FFFFFF, var(--primary-soft));
}

.contact-card::after {
  content: '';
  position: absolute;
  width: 150rpx;
  height: 150rpx;
  right: -52rpx;
  bottom: -70rpx;
  border-radius: 50%;
  background: rgba(101, 191, 168, .14);
}

.contact-kicker { position: relative; z-index: 1; display: block; color: var(--primary-strong); font-size: 20rpx; font-weight: 760; letter-spacing: 2rpx; }
.contact-title { position: relative; z-index: 1; display: block; margin-top: 7rpx; color: var(--ink); font-size: 34rpx; font-weight: 820; }
.wechat { position: relative; z-index: 1; display: block; margin-top: 10rpx; color: var(--text-secondary); font-size: 25rpx; }
.copy-btn,
.bind-btn { position: relative; z-index: 1; min-height: 88rpx; margin-top: 18rpx; border-radius: var(--r-sm); font-size: 26rpx; font-weight: 760; transition: transform var(--motion-fast) var(--ease-out); }
.copy-btn { background: var(--primary-strong); color: #FFFFFF; }
.bind-btn { border: 1rpx solid #BFD0EC; background: var(--surface); color: var(--primary-strong); }
.contact-note { position: relative; z-index: 1; display: block; margin-top: 14rpx; color: var(--text-muted); font-size: 20rpx; line-height: 1.55; }
.stem,
.option-copy,
.result-copy { display: flex; }
.option-copy { flex: 1; min-width: 0; }

@keyframes guest-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes guest-panel-enter {
  from { opacity: 0; transform: translateY(16rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .exercise-card,
  .challenge-card { animation: none; }
  .tab,
  .option,
  .primary,
  .copy-btn,
  .bind-btn { transition: none; }
}
</style>
