export const WELCOME_COPY = Object.freeze([
  '持之以恒', '水滴石穿', '日拱一卒', '功不唐捐', '行稳致远',
  '学贵有恒', '积微成著', '笃行不怠', '温故知新', '勤能补拙',
  '熟能生巧', '循序渐进', '聚沙成塔', '锲而不舍', '久久为功',
  '脚踏实地', '专心致志', '自强不息', '知行合一', '厚积薄发',
  '迎难而上', '百尺竿头', '精益求精', '一以贯之', '静待花开',
  '每一步都算数', '今天也在进步', '把难题变熟悉', '坚持会有回声', '认真自有答案',
  '小步也能向前', '练习让思路发亮', '错题是进步路标', '先完成再完善', '越练越有底气',
  '每天多懂一点', '让努力留下痕迹', '把基础打得更牢', '专注当下这一题', '向着目标稳稳走',
  '学习是一场积累', '进步藏在重复里', '好习惯带来好结果', '不急不躁不放弃', '会做的更加熟练',
  '不会的慢慢学会', '思考比答案珍贵', '复盘让成长发生', '把今天认真过好', '难处正是成长起点',
  '耐心也是一种能力', '先理解再提速度', '稳稳走好每一步', '把认真变成习惯', '每次订正都有价值',
  '好成绩来自好过程', '今日积累明日底气', '多想一步就有收获', '慢一点也不要停', '看见问题就是进步',
  '把会做变成做对', '把做对变成做稳', '一题一题向前走', '让专注成为日常', '答案藏在思考里',
  '基础牢才能走得远', '认真练习不负时间', '保持好奇保持思考', '把目标拆成每一天', '从一道题开始改变',
  '今天比昨天更清楚', '再坚持一下就会了', '稳住节奏继续向前', '用耐心换来扎实', '把薄弱点练成强项',
  '每次回看都有新发现', '愿意订正就是成长', '学习从不怕起步晚', '先把眼前一步走好', '把知识连成一张网',
  '理解越深记得越牢', '进步不必轰轰烈烈', '每天进步一点点', '认真是最好的捷径', '让思路越来越清晰',
  '多练一次多一分把握', '今天的坚持有意义', '积累终会带来突破', '相信练习的力量', '为自己的进步鼓掌',
  '稳中求进日日有获', '保持节奏保持热爱', '把困难变成台阶', '专注让时间更有价值', '每次尝试都在靠近',
  '学会一道就是收获', '从容面对每个挑战', '把细节做到更扎实', '带着问题主动思考', '认真走过必有回响',
]);

export const WELCOME_COPY_STORAGE_KEY = 'ppWelcomeCopyCycleV1';

export function shuffleWelcomeCopy(items = WELCOME_COPY, random = Math.random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function drawWelcomeCopy(state = {}, random = Math.random) {
  const last = typeof state.last === 'string' ? state.last : '';
  let bag = Array.isArray(state.bag)
    ? state.bag.filter((item) => WELCOME_COPY.includes(item))
    : [];

  if (bag.length === 0) {
    bag = shuffleWelcomeCopy(WELCOME_COPY, random);
    if (bag.length > 1 && bag[0] === last) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }

  const value = bag.shift();
  return { value, state: { bag, last: value } };
}

export function nextWelcomeCopy(random = Math.random) {
  const storage = typeof uni !== 'undefined' ? uni : null;
  const previous = storage?.getStorageSync(WELCOME_COPY_STORAGE_KEY) || {};
  const result = drawWelcomeCopy(previous, random);
  storage?.setStorageSync(WELCOME_COPY_STORAGE_KEY, result.state);
  return result.value;
}
