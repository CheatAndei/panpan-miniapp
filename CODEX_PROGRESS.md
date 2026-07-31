# Panpan 任务进度

## 当前子树任务：年级特色学习入口

### 总目标

- 七年级继续以「口算王」为特色项目。
- 八年级在「轻量练习」恢复「知识点大全」，并加入「错题清零」。
- 八年级可从学习中心参加口算王。
- 口算王排行榜保持七、八年级混排，每条成绩显示对应年级。

### 安全边界

- 工作分支：`codex/panpan-grade-feature-hub`
- 开工 checkpoint：`d33be59`
- 不部署后端，不上传微信小程序体验版。
- 保留历史任务 `G8-10` 状态，不替代其部署验收。

### 原子步骤

- [x] `GF-01` 完成恢复检查、现状盘点、独立分支与空 checkpoint。
- [x] `GF-02` 恢复八年级知识点大全入口，并加入错题清零与口算王。
- [x] `GF-03` 为混合口算榜增加年级字段与前端标签。
- [x] `GF-04` 更新回归测试并完成构建验证。
- [x] `GF-05` 更新架构登记并回传主树。

### 当前步骤

- 当前：无
- 状态：已完成
- 更新时间：2026-07-31

### 验证记录

- 前端全量测试：168/168 通过。
- 后端定向测试：`mental-arena` 8/8、`multigrade-achievements` 4/4、`learning` 8/8 通过。
- 微信小程序生产构建：成功，产物位于 `dist/build/mp-weixin`。
- 未执行部署或体验版上传。

### 架构登记

- `GET /api/learning/catalog`：八年级 `sections` 新增 `knowledge`、`wrong`、`arena`。
- `GET /api/learning/catalog`：八年级 `features.knowledge_challenge` 按可用知识点数量开启。
- `GET /api/mental-arena/leaderboard`：`entries[]` 与 `my_rank` 新增 `grade_label`。
- 学习中心：七年级特色标记为口算王；八年级特色标记为知识点大全。
- 知识点旧页面复用并更名为「知识点大全」，未新增平行页面。

---

## 历史任务：八年级内容 MVP

## 总目标

一次完成八年级客观题、压轴填空/大题、试卷库、班级进度控制与打卡年级隔离，并在全部测试通过后部署后端、上传微信小程序体验版。

## 安全边界

- 基线分支：`codex/panpan-practice-history-repair`
- 工作分支：`codex/panpan-g8-content-mvp`
- 开工 checkpoint：`9f1b176`
- 不修改七份打卡历史修复文件：
  - `backend/routes/practice.js`
  - `backend/test/practice.test.js`
  - `pages/practice-review/index.vue`
  - `test/practice-review-layout-regression.test.js`
  - `test/practice-ui.test.js`
  - `backend/scripts/repair-practice-history.js`
  - `backend/test/practice-history-repair.test.js`

## 原子步骤

- [x] `G8-01` 完成只读盘点、需求确认与空 checkpoint。
- [x] `G8-02` 建立 12 个固定范围、班级范围配置与多标签数据结构。
- [x] `G8-03` 实现教师端「03 进度控制管理」与权限校验。
- [x] `G8-04` 对客观题、压轴填空/大题实施服务端强制过滤。
- [x] `G8-05` 下线旧知识闯关入口并安全迁移合格内容。
- [x] `G8-06` 实现打卡题库与计划的年级隔离。
- [x] `G8-07` 生成、审计 48 道样板与 1008 道正式题库。
- [x] `G8-08` 合并八上广州试卷拆分成果。
- [x] `G8-09` 完成数据、后端、前端与回归测试。
- [ ] `G8-10` 部署后端并上传微信小程序体验版。

## 当前步骤

- 当前：`G8-10`
- 状态：进行中
- 更新时间：2026-07-31

## 并行任务：八年级显示、拍照与压轴年级修复

### 安全边界

- 工作分支：`codex/panpan-g8-photo-grade-fixes`
- 开工 checkpoint：`c668354`
- 不部署、不上传体验版；不改既有 `G8-10` 状态。

### 原子步骤

- [x] `BUG-01` 只读复现与定位三项问题，确认交互规则并创建空 checkpoint。
- [x] `BUG-02` 清洗八年级题源中的 Word 私有数学字符并增加回归测试。
- [x] `BUG-03` 增加打卡照片即时预览，避免上传刷新后回到页首。
- [x] `BUG-04` 增加压轴挑战年级选择、班级年级初始值与按学生持久化。
- [x] `BUG-05` 运行定向测试、完整测试与小程序构建，复核差异。

### 当前步骤

- 当前：`BUG-05`
- 状态：已完成
- 更新时间：2026-07-31

### 验证结果

- 前端完整测试：170/170 通过。
- 后端关键测试：8/8 通过；完整测试首轮 137/141，4 项均因隔离工作树缺少旧压轴资源包；补只读资源链接后失败文件 6/6 通过。
- 微信小程序生产构建：通过。
- 未部署、未上传体验版；真机拍照后的滚动位置待体验版验证。
