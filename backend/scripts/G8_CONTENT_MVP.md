# 八年级内容 MVP

## 已交付范围

- 固定 12 讲以 `backend/resources/g8-content/topics.js` 为唯一目录，不在教师端增删。
- 原创正式题库：每讲 60 道客观题、12 道压轴填空、12 道压轴解答，共 1008 道。
- 原创样板：每讲 2 道客观题、1 道填空、1 道解答，共 48 道，均包含在正式题库中。
- 八上题源包：1552 道候选题中，989 道满足固定 12 讲且置信度不为低，进入学生题库。
- 每日打卡：八年级 4 个计算模块共 480 道，与七年级题库和计划隔离。
- 试卷库：206 份候选试卷，其中 192 份广州考试、14 份模拟/复习；202 份有解析。

## 题源准入规则

`backend/resources/choice-king/g8-source-pack` 是私有资源，随现有加密私有题库包发布。

- `scope_confidence=low`：隔离，不入学生题库。
- 命中多边形、分式、拓展或其他非固定范围：隔离。
- 多标签题：必须全部标签都在教师已开启范围内。
- `mock_or_review`：统一显示“模拟/复习”，试卷类型写为 `mock`，不得显示成广州真题。
- 教师未勾选任一相关范围后，未完成的客观题和压轴题立即撤回；已提交历史保留。
- 试卷库始终开放，不受 12 讲范围开关影响。

## 本地同步试卷

以下操作只同步到指定后端数据库和 `EXAM_LIBRARY_DIR`，不会部署：

```powershell
Set-Location 'D:\biancheng\qian\teach\panpan\backend'
$env:G8_EXAM_SOURCE_DIR = 'E:\teach\(真题)广州8上数学'
npm run exams:g8:sync -- --source $env:G8_EXAM_SOURCE_DIR
```

同步会逐文件核对 SHA-256；发现缺失或内容变化立即失败。重复执行幂等。

## 生产整卷包

```powershell
Set-Location 'D:\biancheng\qian\teach\panpan\backend'
npm run exams:g8:bundle -- --source-root 'E:\teach\(真题)广州8上数学' --output 'D:\biancheng\qian\z-rubbish\panpan-g8-exam-bundle\exam-library'
```

部署包会再次校验 206 份原卷、202 份答案，并携带 989 条题目到原卷的关联。加密包通过
`.github/workflows/prod-exam-library-sync.yml` 导入，生产端必须核对试卷、答案与关联数量后才算成功。

## 验收

- 后端：`Set-Location 'D:\biancheng\qian\teach\panpan\backend'; npm test`
- 前端：`Set-Location 'D:\biancheng\qian\teach\panpan'; npm test`
- 小程序：`Set-Location 'D:\biancheng\qian\teach\panpan'; npm run build:mp`
- 真题包：`backend/test/g8-source-pack.test.js`
- 原创题库与题卡：`backend/test/g8-content-bank.test.js`
- 范围强制过滤：`backend/test/content-progress.test.js`
- 打卡年级隔离：`backend/test/practice-grade-isolation.test.js`

本轮部署已经获得用户确认；正式部署仍须先完成数据库备份、私有资源包验证、后端回滚门禁与小程序生产域名检查。
