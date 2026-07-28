# 番番记录 UI 外部参考账本

更新日期：2026-07-28  
适用范围：`teach/panpan` 全部 41 个小程序页面、共用组件与打卡/成就海报工作台。

## 本轮视觉决策

**浅蓝作业纸 × 潘潘老师数学记录 × 明亮学习活力**

- 主界面恢复为浅蓝作业纸、清亮学习蓝和少量薄荷绿/珊瑚红：蓝色承担品牌、主行动、进度与学习数据，薄荷绿只承担正确/完成，珊瑚只承担提醒、纠错和老师反馈；黄色仅在旧版海报主题中保留，不与蓝绿红同时争抢主界面层级。
- 视觉主体不是通用教育后台，而是“潘潘老师正在记录、批改并陪学生练数学”：练习纸横线、批改记号、题号、进度与老师签名成为跨页面识别线索。
- 教师端先呈现高频动作和待办，信息密度高但层级清楚。
- 家长端围绕“孩子今天怎么样、接下来做什么、最近有何进步”组织连续阅读，减少后台感。
- 学生学习与挑战页通过图标、进度、徽章、短促入场和一次性庆祝获得活力，不通过四色卡片拼贴；不牺牲可读性，不使用大幅漂浮或大面积深色底。
- 公开成就/宣传海报继续匿名化；老师私发家长的批改海报不再重复书写隐私说明，底栏改为随机鼓励与老师签名。

## 灵感来源

以下来源用于发现视觉语言与交互模式，不作为产品事实或可用性结论。只提取抽象模式，不复制截图、素材、品牌资产或完整布局。

| 来源 | 访问日期 | 本项目取用 | 明确不取用 |
|---|---|---|---|
| [Mobbin：Overview](https://docs.mobbin.com/) | 2026-07-28 | 以真实移动产品完整流程检查列表到详情、筛选、进度、弹窗、空状态与底部操作区 | 不照搬具体 App 的品牌、文案、图标或像素布局 |
| [CTA.gallery：Mobile App](https://www.cta.gallery/industry/mobile-app) | 2026-07-28 | 移动 App 的保存、提交、重试、确认、下载等动作主次；表单与弹窗的行动闭环 | 不把营销页的夸张转化手法套入家校沟通 |
| [Tubik Studio：Abuk](https://tubikstudio.com/works/abuk) | 2026-07-28 | 教育阅读产品的跨设备一致性、清晰可读的移动信息层级与品牌统一 | 不复制插画、角色、商标与案例画面 |
| [Tubik Studio：Evergreen Nexus University](https://tubikstudio.com/works/evergreen-nexus-university) | 2026-07-28 | 面向多年龄段的友好、清楚、功能型教育视觉；自定义视觉内容与克制动效 | 不采用大面积宣传页构图替代任务型小程序结构 |
| [Recent：Aave Auto Saver Flow](https://recent.design/i/9v93bo5-aave-auto-saver-flow) | 2026-07-28 | 浅色移动界面中用短促状态过渡表达进度，用于孩子切换、保存和完成反馈的动效校准 | 不将趋势当作可用性证据，不复制品牌与具体画面 |
| [Pinterest](https://www.pinterest.com/) | 沿用边界，未计入本轮直接证据 | 校园文具、练习册、成长记录的补充检索入口 | 不直接采用来源不明素材，不以收藏热度代替产品判断 |
| [Land-book](https://land-book.com/) | 沿用边界，未计入本轮直接证据 | 仅作为公开宣传页/公开海报的补充检索入口 | 不用于批改、打卡、反馈、请假等核心任务流程 |

## 支撑证据

支撑证据与灵感来源分开记录。下列内容只用于说明为何这样分工，不用于要求页面复刻：

- Mobbin 的设计参考入口强调真实产品界面与流程，适合作为小程序流程完整性、渐进展开和列表到详情的检查入口。
- CTA.gallery 的 Mobile App 分类聚合移动端行动界面，适合检查“保存—确认—结果”的动作层级。
- Tubik 的 Abuk 与 Evergreen Nexus University 均为教育场景案例，强调可读性、一致性、友好而功能性的表达，适合建立番番记录的教育品牌语气。
- Recent 的浅色移动微交互案例只用于校准短促、可中断的状态过渡，不作为视觉照搬依据。
- Pinterest 与 Land-book 本轮不计入已浏览的最低三来源证据，只保留后续素材探索和公开页路由边界。

## 来源到代码的追踪映射

| 来源 | 设计决策 | 组件 / 页面落点 |
|---|---|---|
| Mobbin | 教师先看待办与快捷动作；学习记录从学生索引渐进进入个人数据与题库；最近记录只露出 3 份再展开 | `components/home/TeacherHomeView.vue`、`pages/student-records/index.vue`、`pages/practice-review/index.vue` |
| CTA.gallery | 每个阶段保留明确主行动；预览、保存、重试、确认修改分层；失败不伪装为空状态 | `pages/practice-review/index.vue`、`pages/practice-parent/index.vue`、`components/pp-state/pp-state.vue` |
| Tubik / Abuk | 同一套浅色教育品牌贯穿身份入口、教师、家长和共用组件；图标本地化、文字优先可读 | `App.vue`、`components/home/HomeWelcome.vue`、`components/pp-avatar/pp-avatar.vue`、`components/pp-question-reader/pp-question-reader.vue` |
| Tubik / Evergreen Nexus University | 教师运营页保持友好但功能型，以扫描效率而非装饰为先 | `pages/teacher-classes/index.vue`、`pages/teacher-feedback/index.vue`、`pages/teacher-schedule/index.vue`、`pages/teacher-checkin/index.vue`、`pages/student-detail/index.vue` |
| Recent / Aave Auto Saver Flow | 学生挑战页和保存反馈使用浅底、清楚进度、短促状态过渡；主界面收敛到学习蓝、薄荷绿与珊瑚，不使用四色拼贴或幼儿化装饰 | `pages/choice-king*`、`pages/mental-arena/*`、`pages/learning-session/index.vue`、`pages/weekly-challenge/index.vue`、`pages/knowledge-challenge/index.vue` |
| 本轮用户实拍反馈 | 全局统一 `border-box` 与原生按钮垂直居中，修复按钮/答案卡/状态卡/空照片区被固定高度撑出的白块；批改图保留独立缩放位移并启用惯性回弹；全项目恢复浅蓝主视觉；口算、压轴和打卡海报恢复指定旧版界面，其中打卡海报仅回退表现层并保留随机文案与署名逻辑 | `App.vue`、`components/pp-state/pp-state.vue`、`components/pp-icon/pp-icon.vue`、`components/home/ParentHomeView.vue`、`components/home/TeacherHomeView.vue`、`pages/learning-center/index.vue`、`pages/practice-review/index.vue`、`utils/practice-review-poster.js`、`utils/mental-arena-poster.js`、`utils/promotion-poster.js` |

## 角色与页面映射

### 公共与身份入口

- 页面：首页、绑定、游客体验、维护页、我的、试卷库。
- 采用：Tubik 的清楚教育品牌语气 + Mobbin 的身份/空状态流程。
- 重点：首屏说清角色、当前状态和唯一下一步；登录、绑定失败可恢复；不出现整屏深绿。

### 家长端

- 页面：家长首页、课表、反馈、意见、作业、请假、学习中心、成长、成就与个人资料。
- 采用：Mobbin 的移动阅读顺序 + Tubik 的友好教育视觉 + CTA.gallery 的明确主行动。
- 重点：孩子身份始终可见；今天任务、最近反馈、成长证据优先；长列表分组；按钮文案说明结果；动效只用于切换孩子、状态更新和完成反馈。

### 教师端

- 页面：教师首页、班级、签到、反馈、批改台、课表、请假、周报、工具、练习、学生详情与海报。
- 采用：Mobbin 的任务流与筛选结构 + CTA.gallery 的批量动作、确认和保存层级。
- 重点：快捷工作置顶；待办和异常比统计卡更靠前；主按钮保持唯一；批改编辑需确认、可撤销视觉状态、失败可重试。

### 学生学习与挑战

- 页面：学习会话、练习、成长、成就、口算竞技、选择题王、周挑战、知识点闯关及结果/排行页。
- 采用：Mobbin 的进度与结果流程 + Recent 的轻量状态动效 + Tubik 的教育可读性。
- 重点：题目、输入和反馈高对比；蓝色承担学习进度，薄荷绿承担正确/完成，珊瑚承担纠错和结果提醒；庆祝为一次性且支持 reduced-motion。

### 海报与保存工作台

- 页面：宣传海报、打卡海报、批改海报、成就海报及其编辑/预览/保存状态。
- 采用：Land-book 的版式节奏 + CTA.gallery 的预览、保存、失败重试闭环。
- 重点：公开海报继续匿名化；批改海报以作业证据、结果、数据、随机评语为主，底栏只放鼓励语与“XX老师批改”；编辑后清除旧缓存并重新生成。

## 组件翻译规则

- 顶部：白色或极浅蓝作业纸页头，短标题 + 当前对象/上下文；避免大块深色品牌 Hero。
- 卡片：按“任务、记录、提醒、结果”区分结构，不把所有内容做成同一种圆角卡。
- 主行动：每个视口原则上只有一个蓝色主按钮；完成使用薄荷绿，警告、纠错与老师消息使用珊瑚；黄色只允许作为旧版口算/压轴海报的受控主题色。
- 列表：重要状态靠左或靠标题，次要时间/标签后置；行高满足触控，长内容支持展开。
- 弹窗：标题先说明影响，正文说明不可逆/联动结果，主次按钮位置和文案一致。
- 动效：120–600ms 的按压、切换、弹层和结果反馈；`pp-icon` 的 `pop/ring/shine/breathe/bob` 只绑定完成、提醒、奖励、目标和当前任务，避免所有卡片同时循环；支持 reduced-motion。

## 验收

- 41 个注册页面均使用全局浅蓝教育 tokens，主流程不存在黄绿蓝黑拼贴；口算、压轴与打卡海报按用户指定保留各自旧版视觉。
- 家长、教师、学生三个角色有明显但一致的节奏差异。
- 教师首页快捷工作置顶并新增“学生记录”；批改台最近三份可展开并横向滑动。
- 作业照片在真机可自然缩放、拖动、复位和多图切换，不与页面/轮播手势冲突。
- 批改海报全对、有错和底栏鼓励各有 100 条唯一文案，同一洗牌周期内不重复；右下角显示老师签名。
- 保存、提交、重试、确认、预览的主次层级一致。
- 390×844、768×1024、1440×900 无横向溢出；补查 320 / 430px 等效宽度；状态、触控、reduced-motion 和真机手势通过验收。
