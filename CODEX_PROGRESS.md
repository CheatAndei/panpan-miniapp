# Panpan 八年级内容 MVP 进度

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
